"use client";

import Link from "next/link";
import { useState } from "react";

type SyncResult = {
  imported: number;
  types: Record<string, number>;
};

type Props = {
  userId: string;
  memberName: string;
  savedCarolUsername: string;
  hasStoredCarolToken: boolean;
};

export function MemberConnectCarolForm({
  userId,
  memberName,
  savedCarolUsername,
  hasStoredCarolToken,
}: Props) {
  const [carolUsername, setCarolUsername] = useState(savedCarolUsername);
  const [carolPassword, setCarolPassword] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSyncing(true);
    try {
      setProgress(carolPassword ? "Connecting to CAROL…" : "Syncing with saved CAROL session…");
      const response = await fetch("/api/carol/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carolUsername, carolPassword, userId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        if (payload.needs_reauth) setRequiresPassword(true);
        throw new Error(payload.error || "Unable to sync CAROL data.");
      }
      setProgress("Import complete.");
      setRequiresPassword(false);
      setResult({
        imported: Number(payload.imported || 0),
        types: (payload.types && typeof payload.types === "object" ? payload.types : {}) as Record<string, number>,
      });
      setCarolPassword("");
    } catch (syncError) {
      setProgress("");
      setError(syncError instanceof Error ? syncError.message : "Unable to sync CAROL data.");
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
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text, #edeae0)" }}>Connect CAROL</div>
          <div style={{ fontSize: 13, color: "var(--text3, #9b9889)", marginTop: 2 }}>Sync your ride history into Iso</div>
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
              <span style={{ fontSize: 11, color: "var(--text3, #9b9889)" }}>CAROL username</span>
              <input
                type="text"
                value={carolUsername}
                onChange={(e) => setCarolUsername(e.target.value)}
                required={!hasStoredCarolToken}
                autoComplete="username"
                placeholder="your@email.com"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 5, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: "var(--text3, #9b9889)" }}>
                CAROL password{hasStoredCarolToken ? " (only needed if token expired)" : ""}
              </span>
              <input
                type="password"
                value={carolPassword}
                onChange={(e) => setCarolPassword(e.target.value)}
                required={!hasStoredCarolToken || requiresPassword}
                autoComplete="current-password"
                style={inputStyle}
              />
            </label>

            {hasStoredCarolToken && (
              <div style={{ fontSize: 12, color: "var(--text3, #9b9889)", marginBottom: 14, lineHeight: 1.5 }}>
                Saved CAROL connection found. You can re-sync without entering your password unless CAROL requires re-authentication.
              </div>
            )}

            {requiresPassword && (
              <div style={{ fontSize: 12, color: "#e8a838", marginBottom: 14, lineHeight: 1.5 }}>
                CAROL session expired — please enter your password to re-authenticate.
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
              {isSyncing ? "Syncing…" : "Sync CAROL Data"}
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
            ✓ Successfully imported {result.imported} ride{result.imported !== 1 ? "s" : ""}.
          </div>
          {Object.keys(result.types).length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "var(--text3, #9b9889)", marginBottom: 8 }}>By ride type:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.entries(result.types).map(([type, count]) => (
                  <div key={type} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2, #c8c4b4)" }}>
                    <span>{type.replace(/_/g, " ")}</span>
                    <span style={{ fontWeight: 600, color: "var(--text, #edeae0)" }}>{count}</span>
                  </div>
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
