"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Props = {
  displayName: string;
  arxConnected: boolean;
  carolConnected: boolean;
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

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      padding: "3px 9px",
      borderRadius: 20,
      background: connected ? "rgba(157,204,58,0.12)" : "rgba(255,255,255,0.06)",
      color: connected ? "#9dcc3a" : "var(--text3, #9b9889)",
      border: `1px solid ${connected ? "rgba(157,204,58,0.3)" : "rgba(255,255,255,0.1)"}`,
    }}>
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

export function MemberSettingsClient({ displayName, arxConnected, carolConnected }: Props) {
  const [fullName, setFullName] = useState(displayName);
  const [phone, setPhone] = useState("");
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loaded, setLoaded] = useState(false);

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
          setLoaded(true);
        }
      } catch { /* silent */ }
    })();
    return () => { active = false; };
  }, [displayName]);

  const notificationRows = useMemo(() => [
    { key: "welcome_sms" as const, label: "Welcome" },
    { key: "protocol_ready_sms" as const, label: "Protocol ready" },
    { key: "scan_results_sms" as const, label: "Scan results" },
    { key: "weekly_summary_sms" as const, label: "Weekly summary" },
    { key: "session_reminder_sms" as const, label: "Session reminder" },
    { key: "low_recovery_sms" as const, label: "Low recovery alert" },
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

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontWeight: 600,
    color: "var(--text3, #9b9889)",
    marginBottom: 12,
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg2, #111209)",
    border: "1px solid var(--border, rgba(255,255,255,0.1))",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
    gap: 12,
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg, #0b0c09)", color: "var(--text, #edeae0)", maxWidth: 560, margin: "0 auto", padding: "28px 20px 60px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text, #edeae0)" }}>Settings</div>
          <div style={{ fontSize: 13, color: "var(--text3, #9b9889)", marginTop: 2 }}>{displayName}</div>
        </div>
        <Link href="/dashboard" style={{ fontSize: 12, color: "var(--text3, #9b9889)", textDecoration: "none" }}>
          ← Dashboard
        </Link>
      </div>

      {/* ── 1. Profile ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={sectionLabel}>Profile</div>
        <div style={cardStyle}>
          <form onSubmit={handleProfileSave}>
            <div style={{ padding: "14px 18px 0" }}>
              <label style={{ display: "grid", gap: 5, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "var(--text3, #9b9889)" }}>Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  style={{ background: "var(--bg3, #1a1b14)", border: "1px solid var(--border, rgba(255,255,255,0.12))", color: "var(--text, #edeae0)", borderRadius: 8, padding: "10px 12px", fontSize: 13, width: "100%", boxSizing: "border-box" }}
                />
              </label>
              <label style={{ display: "grid", gap: 5, marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: "var(--text3, #9b9889)" }}>Phone (for SMS alerts)</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-1234"
                  type="tel"
                  style={{ background: "var(--bg3, #1a1b14)", border: "1px solid var(--border, rgba(255,255,255,0.12))", color: "var(--text, #edeae0)", borderRadius: 8, padding: "10px 12px", fontSize: 13, width: "100%", boxSizing: "border-box" }}
                />
              </label>
            </div>

            {/* SMS notification toggles */}
            <div style={{ borderTop: "1px solid var(--border, rgba(255,255,255,0.08))", padding: "12px 18px 0" }}>
              <div style={{ fontSize: 11, color: "var(--text3, #9b9889)", marginBottom: 10 }}>SMS notifications</div>
              {notificationRows.map((row) => (
                <label key={row.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, gap: 10 }}>
                  <span style={{ fontSize: 13, color: "var(--text2, #c8c4b4)" }}>{row.label}</span>
                  <input
                    type="checkbox"
                    checked={prefs[row.key]}
                    onChange={(e) => setPrefs((p) => ({ ...p, [row.key]: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                </label>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--border, rgba(255,255,255,0.08))", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button
                type="submit"
                disabled={profileSaving || !loaded}
                style={{ background: "#9dcc3a", border: "none", color: "#0b0c09", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: profileSaving ? "not-allowed" : "pointer", opacity: profileSaving ? 0.7 : 1 }}
              >
                {profileSaving ? "Saving…" : "Save"}
              </button>
              {profileMsg && (
                <span style={{ fontSize: 12, color: profileMsg.ok ? "#9dcc3a" : "#e05252" }}>{profileMsg.text}</span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ── 2. Connected Devices ───────────────────────────────────────────── */}
      <div>
        <div style={sectionLabel}>Connected devices</div>
        <div style={cardStyle}>

          {/* ARX */}
          <div style={{ ...rowStyle }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(157,204,58,0.08)", border: "1px solid rgba(157,204,58,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#9dcc3a" }}>ARX</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text, #edeae0)" }}>ARX Strength</div>
                <div style={{ fontSize: 11, color: "var(--text3, #9b9889)", marginTop: 1 }}>Strength training sessions</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <StatusBadge connected={arxConnected} />
              <Link
                href="/member/connect/arx"
                style={{ fontSize: 12, fontWeight: 500, color: arxConnected ? "var(--text3, #9b9889)" : "#9dcc3a", textDecoration: "none", whiteSpace: "nowrap" }}
              >
                {arxConnected ? "Sync" : "Connect →"}
              </Link>
            </div>
          </div>

          {/* CAROL */}
          <div style={{ ...rowStyle }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8" }}>CAROL</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text, #edeae0)" }}>CAROL Bike</div>
                <div style={{ fontSize: 11, color: "var(--text3, #9b9889)", marginTop: 1 }}>Cardio &amp; REHIT sessions</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <StatusBadge connected={carolConnected} />
              <Link
                href="/member/connect/carol"
                style={{ fontSize: 12, fontWeight: 500, color: carolConnected ? "var(--text3, #9b9889)" : "#9dcc3a", textDecoration: "none", whiteSpace: "nowrap" }}
              >
                {carolConnected ? "Sync" : "Connect →"}
              </Link>
            </div>
          </div>

          {/* Fit3D */}
          <div style={{ ...rowStyle, borderBottom: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa" }}>FIT3D</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text, #edeae0)" }}>Fit3D Body Scanner</div>
                <div style={{ fontSize: 11, color: "var(--text3, #9b9889)", marginTop: 1 }}>Body composition scans</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "var(--text3, #9b9889)", border: "1px solid rgba(255,255,255,0.1)" }}>
                Coach synced
              </span>
            </div>
          </div>

        </div>

        <p style={{ fontSize: 11, color: "var(--text3, #9b9889)", lineHeight: 1.6, marginTop: -8 }}>
          Fit3D scans are imported by your coach after each scan session.
        </p>
      </div>

    </main>
  );
}
