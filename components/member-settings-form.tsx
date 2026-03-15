"use client";

import { useEffect, useMemo, useState } from "react";

type SubmitState =
  | { kind: "idle"; message: string }
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

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

function statusColor(kind: SubmitState["kind"]) {
  if (kind === "success") return "#9dff73";
  if (kind === "error") return "#ff7d7d";
  return "#afbda5";
}

export function MemberSettingsForm() {
  const [state, setState] = useState<SubmitState>({ kind: "idle", message: "" });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        setState({ kind: "loading", message: "Loading settings…" });
        const res = await fetch("/api/member/settings", { method: "GET" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload.success === false) {
          throw new Error(payload.error || "Unable to load settings.");
        }
        if (!active) return;
        setFullName(String(payload.profile?.full_name ?? ""));
        setPhone(String(payload.profile?.phone ?? ""));
        setPrefs({
          ...defaultPreferences,
          ...(payload.notification_preferences ?? {}),
        });
        setState({ kind: "idle", message: "" });
        setLoaded(true);
      } catch (error) {
        if (!active) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to load settings.",
        });
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  const notificationRows = useMemo(
    () => [
      { key: "welcome_sms" as const, label: "Welcome SMS" },
      { key: "protocol_ready_sms" as const, label: "Protocol Ready SMS" },
      { key: "scan_results_sms" as const, label: "Scan Results SMS" },
      { key: "weekly_summary_sms" as const, label: "Weekly Summary SMS" },
      { key: "session_reminder_sms" as const, label: "Session Reminder SMS" },
      { key: "low_recovery_sms" as const, label: "Low Recovery Flag SMS" },
    ],
    [],
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (!phone.trim()) {
        throw new Error("Phone number is required for SMS notifications.");
      }
      setState({ kind: "loading", message: "Saving settings…" });
      const res = await fetch("/api/member/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          notification_preferences: prefs,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.success === false) {
        throw new Error(payload.error || "Unable to save settings.");
      }
      setState({ kind: "success", message: "Settings saved." });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to save settings.",
      });
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 14, marginTop: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Full name
          </span>
          <input
            className="btn secondary"
            style={{ textAlign: "left", background: "transparent" }}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your name"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Phone (required for SMS)
          </span>
          <input
            className="btn secondary"
            style={{ textAlign: "left", background: "transparent" }}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(555) 555-1234"
            required
          />
        </label>
      </div>

      <div
        style={{
          border: "1px solid rgba(175, 189, 165, 0.22)",
          borderRadius: 12,
          padding: 14,
          display: "grid",
          gap: 10,
        }}
      >
        <strong style={{ fontSize: 14 }}>Notification preferences</strong>
        {notificationRows.map((row) => (
          <label
            key={row.key}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
          >
            <span className="muted" style={{ fontSize: 13 }}>
              {row.label}
            </span>
            <input
              type="checkbox"
              checked={prefs[row.key]}
              onChange={(event) =>
                setPrefs((current) => ({
                  ...current,
                  [row.key]: event.target.checked,
                }))
              }
            />
          </label>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button className="btn" type="submit" disabled={state.kind === "loading" || !loaded}>
          Save settings
        </button>
        <p style={{ margin: 0, fontSize: 12, color: statusColor(state.kind) }}>{state.message}</p>
      </div>
    </form>
  );
}
