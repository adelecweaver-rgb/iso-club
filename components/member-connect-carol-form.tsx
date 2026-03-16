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
};

export function MemberConnectCarolForm({ userId, memberName }: Props) {
  const [carolUsername, setCarolUsername] = useState("");
  const [carolPassword, setCarolPassword] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSyncing(true);
    try {
      setProgress("Connecting to CAROL…");
      const response = await fetch("/api/carol/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carolUsername,
          carolPassword,
          userId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Unable to sync CAROL data.");
      }
      setProgress("Import complete.");
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

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c09", color: "#edeae0", padding: 24 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 36 }}>Connect CAROL</h1>
          <p style={{ marginTop: 8, color: "#9b9889" }}>
            Sync your CAROL bike workout history into your Iso Club dashboard.
          </p>
        </div>

        <div
          style={{
            background: "#111209",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, color: "#9b9889", marginBottom: 10 }}>
            Member: <span style={{ color: "#edeae0" }}>{memberName}</span>
          </div>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#9b9889" }}>CAROL username</span>
              <input
                type="text"
                value={carolUsername}
                onChange={(event) => setCarolUsername(event.target.value)}
                required
                autoComplete="username"
                style={{
                  background: "#181910",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#edeae0",
                  borderRadius: 8,
                  padding: "11px 12px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#9b9889" }}>CAROL password</span>
              <input
                type="password"
                value={carolPassword}
                onChange={(event) => setCarolPassword(event.target.value)}
                required
                autoComplete="current-password"
                style={{
                  background: "#181910",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#edeae0",
                  borderRadius: 8,
                  padding: "11px 12px",
                }}
              />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={isSyncing}
                style={{
                  background: "#c9f055",
                  border: "1px solid #c9f055",
                  color: "#0b0c09",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 600,
                  cursor: isSyncing ? "not-allowed" : "pointer",
                  opacity: isSyncing ? 0.7 : 1,
                }}
              >
                {isSyncing ? "Syncing…" : "Sync CAROL Data"}
              </button>
              <Link
                href="/dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#edeae0",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                Back to Dashboard
              </Link>
            </div>
          </form>
        </div>

        {progress ? (
          <div
            style={{
              border: "1px solid rgba(201,240,85,0.35)",
              background: "rgba(201,240,85,0.08)",
              color: "#c9f055",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {progress}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              border: "1px solid rgba(240,112,85,0.35)",
              background: "rgba(240,112,85,0.08)",
              color: "#f07055",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        {result ? (
          <div
            style={{
              border: "1px solid rgba(201,240,85,0.35)",
              background: "rgba(201,240,85,0.08)",
              color: "#edeae0",
              borderRadius: 8,
              padding: "12px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: "#c9f055", fontWeight: 600 }}>
              Successfully imported {result.imported} rides.
            </div>
            <div style={{ fontSize: 12, color: "#afbda5" }}>By ride type:</div>
            <div style={{ display: "grid", gap: 4 }}>
              {Object.entries(result.types).map(([type, count]) => (
                <div key={type} style={{ fontSize: 12.5 }}>
                  {type}: {count}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
