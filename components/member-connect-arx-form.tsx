"use client";

import Link from "next/link";
import { useState } from "react";

type SyncResult = {
  imported: number;
  exercises: string[];
  pages: number;
};

type Props = {
  memberName: string;
  savedArxUsername: string;
  hasStoredUsername: boolean;
};

export function MemberConnectArxForm({ memberName, savedArxUsername, hasStoredUsername }: Props) {
  const [arxUsername, setArxUsername] = useState(savedArxUsername);
  const [arxPassword, setArxPassword] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSyncing(true);
    setProgress("Connecting to ARX…");
    try {
      setProgress("Logging in to my.arxfit.com…");
      const response = await fetch("/api/arx/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arxUsername, arxPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Unable to sync ARX data.");
      }
      setProgress("Import complete.");
      setResult({
        imported: Number(payload.imported || 0),
        exercises: Array.isArray(payload.exercises) ? payload.exercises : [],
        pages: Number(payload.pages || 1),
      });
      setArxPassword("");
    } catch (syncError) {
      setProgress("");
      setError(syncError instanceof Error ? syncError.message : "Unable to sync ARX data.");
    } finally {
      setIsSyncing(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--bg3, #1a1b14)",
    border: "1px solid var(--border, rgba(255,255,255,0.12))",
    color: "var(--text, #edeae0)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg, #0b0c09)", color: "var(--text, #edeae0)", maxWidth: 520, margin: "0 auto", padding: "28px 20px 60px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text, #edeae0)" }}>Connect ARX</div>
          <div style={{ fontSize: 13, color: "var(--text3, #9b9889)", marginTop: 2 }}>Sync your strength sessions into Iso</div>
        </div>
        <Link href="/dashboard/settings" style={{ fontSize: 12, color: "var(--text3, #9b9889)", textDecoration: "none" }}>
          ← Settings
        </Link>
      </div>

      {/* Form card */}
      <div style={{ background: "var(--bg2, #111209)", border: "1px solid var(--border, rgba(255,255,255,0.1))", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
        <form onSubmit={onSubmit}>
          <div style={{ padding: "18px 18px 0" }}>
            <div style={{ fontSize: 11, color: "var(--text3, #9b9889)", marginBottom: 14 }}>
              Member: <span style={{ color: "var(--text, #edeae0)", fontWeight: 500 }}>{memberName}</span>
            </div>

            <label style={{ display: "grid", gap: 5, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "var(--text3, #9b9889)" }}>ARX username (email)</span>
              <input
                type="email"
                value={arxUsername}
                onChange={(e) => setArxUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="you@email.com"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 5, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: "var(--text3, #9b9889)" }}>
                ARX password{hasStoredUsername ? " (required each sync — not stored)" : ""}
              </span>
              <input
                type="password"
                value={arxPassword}
                onChange={(e) => setArxPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </label>

            {hasStoredUsername && (
              <div style={{ fontSize: 12, color: "var(--text3, #9b9889)", marginBottom: 14, lineHeight: 1.5 }}>
                Your ARX username is saved. Enter your password to sync your latest sessions.
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border, rgba(255,255,255,0.08))", padding: "14px 18px", display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={isSyncing}
              style={{
                background: "#9dcc3a",
                border: "none",
                color: "#0b0c09",
                borderRadius: 8,
                padding: "10px 20px",
                fontWeight: 600,
                fontSize: 13,
                cursor: isSyncing ? "not-allowed" : "pointer",
                opacity: isSyncing ? 0.7 : 1,
              }}
            >
              {isSyncing ? "Syncing…" : "Sync ARX Data"}
            </button>
            <Link
              href="/dashboard/settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                background: "transparent",
                border: "1px solid var(--border, rgba(255,255,255,0.15))",
                color: "var(--text2, #c8c4b4)",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13,
              }}
            >
              Back to Settings
            </Link>
          </div>
        </form>
      </div>

      {/* Progress */}
      {progress && (
        <div style={{ border: "1px solid rgba(157,204,58,0.3)", background: "rgba(157,204,58,0.07)", color: "#9dcc3a", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {progress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ border: "1px solid rgba(224,82,82,0.3)", background: "rgba(224,82,82,0.07)", color: "#e05252", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Success */}
      {result && (
        <div style={{ border: "1px solid rgba(157,204,58,0.3)", background: "rgba(157,204,58,0.07)", borderRadius: 10, padding: "14px 18px", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#9dcc3a", marginBottom: 10 }}>
            ✓ Synced {result.imported} set{result.imported !== 1 ? "s" : ""} across {result.pages} page{result.pages !== 1 ? "s" : ""}.
          </div>
          {result.exercises.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "var(--text3, #9b9889)", marginBottom: 8 }}>Exercises synced:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.exercises.map((ex) => (
                  <span key={ex} style={{ fontSize: 11, background: "rgba(157,204,58,0.1)", border: "1px solid rgba(157,204,58,0.25)", borderRadius: 4, padding: "2px 8px", color: "#9dcc3a" }}>
                    {ex}
                  </span>
                ))}
              </div>
            </>
          )}
          <Link href="/dashboard/settings" style={{ display: "inline-block", marginTop: 12, fontSize: 12, color: "#9dcc3a", textDecoration: "none", fontWeight: 500 }}>
            Back to Settings →
          </Link>
        </div>
      )}

    </main>
  );
}
