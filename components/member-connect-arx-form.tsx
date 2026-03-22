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

const C = {
  bg:        "#F5F0E8",
  bg2:       "#EDE8DE",
  white:     "#ffffff",
  text:      "#1C2B1E",
  text2:     "#3D4F3F",
  text3:     "#6B7B6E",
  border:    "rgba(28,43,30,0.12)",
  border2:   "rgba(28,43,30,0.22)",
  green:     "#3A6347",
  greenDim:  "rgba(58,99,71,0.1)",
  coral:     "#b84040",
  coralDim:  "rgba(184,64,64,0.08)",
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
    background: C.white,
    border: `1px solid ${C.border2}`,
    color: C.text,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, maxWidth: 520, margin: "0 auto", padding: "28px 20px 60px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Connect ARX</div>
          <div style={{ fontSize: 13, color: C.text3, marginTop: 2 }}>Sync your strength sessions into Iso</div>
        </div>
        <Link href="/dashboard/settings" style={{ fontSize: 12, color: C.text3, textDecoration: "none" }}>
          ← Settings
        </Link>
      </div>

      {/* Form card */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
        <form onSubmit={onSubmit}>
          <div style={{ padding: "16px 18px 4px" }}>
            <div style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
              Member: <span style={{ color: C.text, fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>{memberName}</span>
            </div>

            <label style={{ display: "grid", gap: 5, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.1em" }}>ARX username (email)</span>
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

            <label style={{ display: "grid", gap: 5, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                ARX password{hasStoredUsername ? " (required each sync)" : ""}
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
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 14, lineHeight: 1.5, padding: "10px 12px", background: C.bg2, borderRadius: 8 }}>
                Your ARX username is saved. Enter your password to sync your latest sessions. Credentials are not stored.
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 18px", display: "flex", gap: 10, background: C.bg2 }}>
            <button
              type="submit"
              disabled={isSyncing}
              style={{ background: C.green, border: "none", color: "#fff", borderRadius: 8, padding: "10px 22px", fontWeight: 600, fontSize: 13, cursor: isSyncing ? "not-allowed" : "pointer", opacity: isSyncing ? 0.7 : 1, fontFamily: "inherit" }}
            >
              {isSyncing ? "Syncing…" : "Sync ARX Data"}
            </button>
            <Link
              href="/dashboard/settings"
              style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", background: "transparent", border: `1px solid ${C.border2}`, color: C.text2, borderRadius: 8, padding: "10px 16px", fontSize: 13 }}
            >
              Back to Settings
            </Link>
          </div>
        </form>
      </div>

      {/* Progress */}
      {progress && (
        <div style={{ border: `1px solid rgba(58,99,71,0.3)`, background: C.greenDim, color: C.green, borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {progress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ border: `1px solid rgba(184,64,64,0.25)`, background: C.coralDim, color: C.coral, borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Success */}
      {result && (
        <div style={{ border: `1px solid rgba(58,99,71,0.3)`, background: C.greenDim, borderRadius: 10, padding: "14px 18px", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.green, marginBottom: 10 }}>
            ✓ Synced {result.imported} set{result.imported !== 1 ? "s" : ""} across {result.pages} page{result.pages !== 1 ? "s" : ""}.
          </div>
          {result.exercises.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Exercises synced</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.exercises.map((ex) => (
                  <span key={ex} style={{ fontSize: 11, background: "rgba(58,99,71,0.12)", border: "1px solid rgba(58,99,71,0.25)", borderRadius: 4, padding: "2px 8px", color: C.green }}>
                    {ex}
                  </span>
                ))}
              </div>
            </>
          )}
          <Link href="/dashboard/settings" style={{ display: "inline-block", marginTop: 12, fontSize: 12, color: C.green, textDecoration: "none", fontWeight: 600 }}>
            Back to Settings →
          </Link>
        </div>
      )}

    </main>
  );
}
