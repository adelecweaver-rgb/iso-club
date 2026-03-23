"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Props = {
  displayName: string;
  arxConnected: boolean;
  carolConnected: boolean;
  onboardingUpdatedAt?: string | null;
};

type Preferences = {
  welcome_sms: boolean;
  protocol_ready_sms: boolean;
  scan_results_sms: boolean;
  weekly_summary_sms: boolean;
  session_reminder_sms: boolean;
  low_recovery_sms: boolean;
};

const defaultPreferences: Preferences = {
  welcome_sms: true,
  protocol_ready_sms: true,
  scan_results_sms: true,
  weekly_summary_sms: true,
  session_reminder_sms: true,
  low_recovery_sms: true,
};

// ── Design tokens (cream / forest-green) ─────────────────────────────────────
const C = {
  bg:         "#F5F0E8",
  bg2:        "#EDE8DE",
  bg3:        "#E4DDD2",
  white:      "#ffffff",
  text:       "#1C2B1E",
  text2:      "#3D4F3F",
  text3:      "#6B7B6E",
  border:     "rgba(28,43,30,0.12)",
  border2:    "rgba(28,43,30,0.22)",
  green:      "#3A6347",
  greenDim:   "rgba(58,99,71,0.1)",
  greenDim2:  "rgba(58,99,71,0.06)",
  coral:      "#b84040",
};

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      padding: "3px 9px",
      borderRadius: 20,
      background: connected ? C.greenDim : "rgba(28,43,30,0.06)",
      color: connected ? C.green : C.text3,
      border: `1px solid ${connected ? "rgba(58,99,71,0.3)" : C.border}`,
    }}>
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function formatUpdatedDate(iso: string | null | undefined): string {
  if (!iso) return "Not yet updated";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "Unknown date";
  }
}

export function MemberSettingsClient({ displayName, arxConnected, carolConnected, onboardingUpdatedAt: initialUpdatedAt }: Props) {
  const [fullName, setFullName] = useState(displayName);
  const [phone, setPhone] = useState("");
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [onboardingUpdatedAt, setOnboardingUpdatedAt] = useState<string | null | undefined>(initialUpdatedAt);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/member/settings", { method: "GET" });
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && payload.success !== false) {
          setFullName(String(payload.profile?.full_name ?? displayName));
          setPhone(String(payload.profile?.phone ?? ""));
          setPrefs({ ...defaultPreferences, ...(payload.notification_preferences ?? {}) });
          setOnboardingUpdatedAt(payload.profile?.onboarding_updated_at ?? initialUpdatedAt ?? null);
          setLoaded(true);
        }
      } catch { /* silent */ }
    })();
    return () => { active = false; };
  }, [displayName, initialUpdatedAt]);

  const notificationRows = useMemo(() => [
    { key: "welcome_sms" as const,          label: "Welcome" },
    { key: "protocol_ready_sms" as const,   label: "Protocol ready" },
    { key: "scan_results_sms" as const,     label: "Scan results" },
    { key: "weekly_summary_sms" as const,   label: "Weekly summary" },
    { key: "session_reminder_sms" as const, label: "Session reminder" },
    { key: "low_recovery_sms" as const,     label: "Low recovery alert" },
  ], []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/member/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone, notification_preferences: prefs }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.success === false) throw new Error(payload.error || "Unable to save.");
      setProfileMsg({ text: "Saved.", ok: true });
    } catch (err) {
      setProfileMsg({ text: err instanceof Error ? err.message : "Unable to save.", ok: false });
    } finally {
      setProfileSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: C.white,
    border: `1px solid ${C.border2}`,
    color: C.text,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  };

  const cardStyle: React.CSSProperties = {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontWeight: 600,
    color: C.text3,
    marginBottom: 12,
  };

  const divider: React.CSSProperties = {
    borderTop: `1px solid ${C.border}`,
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: `1px solid ${C.border}`,
    gap: 12,
  };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, maxWidth: 560, margin: "0 auto", padding: "28px 20px 60px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Settings</div>
          <div style={{ fontSize: 13, color: C.text3, marginTop: 2 }}>{displayName}</div>
        </div>
        <Link href="/dashboard" style={{ fontSize: 12, color: C.text3, textDecoration: "none" }}>
          ← Dashboard
        </Link>
      </div>

      {/* ── 1. Profile ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={sectionLabel}>Profile</div>
        <div style={cardStyle}>
          <form onSubmit={handleProfileSave}>
            <div style={{ padding: "16px 18px 4px" }}>
              <label style={{ display: "grid", gap: 5, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 5, marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Phone (for SMS alerts)</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-1234"
                  type="tel"
                  style={inputStyle}
                />
              </label>
            </div>

            {/* SMS notification toggles */}
            <div style={{ ...divider, padding: "14px 18px 4px" }}>
              <div style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>SMS notifications</div>
              {notificationRows.map((row) => (
                <label key={row.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, gap: 10 }}>
                  <span style={{ fontSize: 13, color: C.text2 }}>{row.label}</span>
                  <input
                    type="checkbox"
                    checked={prefs[row.key]}
                    onChange={(e) => setPrefs((p) => ({ ...p, [row.key]: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.green }}
                  />
                </label>
              ))}
            </div>

            <div style={{ ...divider, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.bg2 }}>
              <button
                type="submit"
                disabled={profileSaving || !loaded}
                style={{ background: C.green, border: "none", color: "#fff", borderRadius: 8, padding: "9px 20px", fontWeight: 600, fontSize: 13, cursor: profileSaving ? "not-allowed" : "pointer", opacity: profileSaving ? 0.7 : 1 }}
              >
                {profileSaving ? "Saving…" : "Save"}
              </button>
              {profileMsg && (
                <span style={{ fontSize: 12, color: profileMsg.ok ? C.green : C.coral }}>{profileMsg.text}</span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ── 2. Health profile ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={sectionLabel}>Health profile</div>
        <p style={{ fontSize: 12, color: C.text3, lineHeight: 1.6, marginBottom: 10, marginTop: 0 }}>
          Your answers from onboarding. Update anything that&apos;s changed — your coach will only be notified if you request a review.
        </p>
        <div style={cardStyle}>
          <div style={{ ...rowStyle, borderBottom: "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>My health profile</div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                Last updated {formatUpdatedDate(onboardingUpdatedAt)}
              </div>
            </div>
            <Link
              href="/dashboard/settings/health-profile"
              style={{ fontSize: 12, fontWeight: 600, color: C.green, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Edit →
            </Link>
          </div>
        </div>
      </div>

      {/* ── 3. Connected Devices ─────────────────────────────────────────── */}
      <div>
        <div style={sectionLabel}>Connected devices</div>
        <div style={cardStyle}>

          {/* ARX */}
          <div style={rowStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: C.greenDim2, border: `1px solid rgba(58,99,71,0.2)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>ARX</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>ARX Strength</div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>Strength training sessions</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <StatusBadge connected={arxConnected} />
              <Link
                href="/member/connect/arx"
                style={{ fontSize: 12, fontWeight: 600, color: arxConnected ? C.text3 : C.green, textDecoration: "none", whiteSpace: "nowrap" }}
              >
                {arxConnected ? "Sync" : "Connect →"}
              </Link>
            </div>
          </div>

          {/* CAROL */}
          <div style={rowStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(56,130,84,0.08)", border: "1px solid rgba(56,130,84,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#2d6b4a" }}>CAROL</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>CAROL Bike</div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>Cardio &amp; REHIT sessions</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <StatusBadge connected={carolConnected} />
              <Link
                href="/member/connect/carol"
                style={{ fontSize: 12, fontWeight: 600, color: carolConnected ? C.text3 : C.green, textDecoration: "none", whiteSpace: "nowrap" }}
              >
                {carolConnected ? "Sync" : "Connect →"}
              </Link>
            </div>
          </div>

          {/* Fit3D */}
          <div style={{ ...rowStyle, borderBottom: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(107,90,140,0.08)", border: "1px solid rgba(107,90,140,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#6b5a8c" }}>FIT3D</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Fit3D Body Scanner</div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>Body composition scans</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, background: C.bg2, color: C.text3, border: `1px solid ${C.border}` }}>
                Coach synced
              </span>
            </div>
          </div>

        </div>

        <p style={{ fontSize: 11, color: C.text3, lineHeight: 1.6, marginTop: -8 }}>
          Fit3D scans are imported by your coach after each scan session.
        </p>
      </div>

    </main>
  );
}
