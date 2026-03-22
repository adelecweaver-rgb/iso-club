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

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c09", color: "#edeae0", padding: 24 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 36 }}>Connect ARX</h1>
          <p style={{ marginTop: 8, color: "#9b9889" }}>
            Sync your ARX workout history directly into your Iso Club dashboard.
          </p>
        </div>

        <div style={{ background: "#111209", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: "#9b9889", marginBottom: 12 }}>
            Member: <span style={{ color: "#edeae0" }}>{memberName}</span>
          </div>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#9b9889" }}>ARX username (email)</span>
              <input
                type="email"
                value={arxUsername}
                onChange={(e) => setArxUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="you@email.com"
                style={{ background: "#181910", border: "1px solid rgba(255,255,255,0.14)", color: "#edeae0", borderRadius: 8, padding: "11px 12px" }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#9b9889" }}>
                ARX password
                {hasStoredUsername ? " (required each sync — credentials are not stored)" : ""}
              </span>
              <input
                type="password"
                value={arxPassword}
                onChange={(e) => setArxPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ background: "#181910", border: "1px solid rgba(255,255,255,0.14)", color: "#edeae0", borderRadius: 8, padding: "11px 12px" }}
              />
            </label>
            {hasStoredUsername && (
              <div style={{ fontSize: 12, color: "#afbda5" }}>
                Your ARX username is saved. Enter your password to sync your latest sessions.
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={isSyncing}
                style={{
                  background: "#c9f055",
                  border: "1px solid #c9f055",
                  color: "#0b0c09",
                  borderRadius: 10,
                  padding: "10px 18px",
                  fontWeight: 600,
                  cursor: isSyncing ? "not-allowed" : "pointer",
                  opacity: isSyncing ? 0.7 : 1,
                  fontSize: 13,
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
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#edeae0",
                  borderRadius: 10,
                  padding: "10px 18px",
                  fontSize: 13,
                }}
              >
                Back to Settings
              </Link>
            </div>
          </form>
        </div>

        {progress && (
          <div style={{ border: "1px solid rgba(201,240,85,0.35)", background: "rgba(201,240,85,0.08)", color: "#c9f055", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
            {progress}
          </div>
        )}

        {error && (
          <div style={{ border: "1px solid rgba(240,112,85,0.35)", background: "rgba(240,112,85,0.08)", color: "#f07055", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ border: "1px solid rgba(201,240,85,0.35)", background: "rgba(201,240,85,0.08)", color: "#edeae0", borderRadius: 8, padding: "14px 16px", display: "grid", gap: 8 }}>
            <div style={{ color: "#c9f055", fontWeight: 600, fontSize: 14 }}>
              ✓ Successfully synced {result.imported} sets across {result.pages} page{result.pages !== 1 ? "s" : ""}.
            </div>
            {result.exercises.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#9b9889", marginBottom: 4 }}>Exercises synced:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {result.exercises.map((ex) => (
                    <span key={ex} style={{ fontSize: 11, background: "rgba(201,240,85,0.1)", border: "1px solid rgba(201,240,85,0.25)", borderRadius: 4, padding: "2px 8px", color: "#c9f055" }}>
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Link href="/dashboard/settings" style={{ fontSize: 12, color: "#c9f055", textDecoration: "underline", display: "inline-block", marginTop: 4 }}>
              Back to Settings →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
