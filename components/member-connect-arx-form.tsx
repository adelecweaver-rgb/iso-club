"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type ImportResult = {
  imported: number;
  exercises: string[];
};

type Props = {
  memberName: string;
};

export function MemberConnectArxForm({ memberName }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please select a CSV file to upload.");
      return;
    }
    setError("");
    setResult(null);
    setIsUploading(true);
    setProgress("Uploading and parsing CSV…");

    try {
      const formData = new FormData();
      formData.append("csv", file);

      const response = await fetch("/api/arx/sync", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Unable to import ARX data.");
      }
      setProgress("Import complete.");
      setResult({
        imported: Number(payload.imported || 0),
        exercises: Array.isArray(payload.exercises) ? payload.exercises : [],
      });
      if (fileRef.current) fileRef.current.value = "";
      setFileName("");
    } catch (err) {
      setProgress("");
      setError(err instanceof Error ? err.message : "Unable to import ARX data.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c09", color: "#edeae0", padding: 24 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 36 }}>Connect ARX</h1>
          <p style={{ marginTop: 8, color: "#9b9889" }}>
            Import your ARX workout history into your Iso Club dashboard.
          </p>
        </div>

        {/* How-to instructions */}
        <div style={{ background: "#111209", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#c9f055", marginBottom: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            How to export your ARX data
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
            {[
              <>Log in to your ARX account at <a href="https://app.arxfit.com" target="_blank" rel="noreferrer" style={{ color: "#c9f055" }}>app.arxfit.com</a></>,
              <>Navigate to your <b style={{ color: "#edeae0" }}>Workout History</b> or <b style={{ color: "#edeae0" }}>Profile</b></>,
              <>Click <b style={{ color: "#edeae0" }}>Export</b> or <b style={{ color: "#edeae0" }}>Download CSV</b> to save your workout data</>,
              "Upload the downloaded CSV file below",
            ].map((step, i) => (
              <li key={i} style={{ fontSize: 13, color: "#9b9889", lineHeight: 1.6 }}>{step}</li>
            ))}
          </ol>
        </div>

        {/* Upload form */}
        <div style={{ background: "#111209", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: "#9b9889", marginBottom: 12 }}>
            Member: <span style={{ color: "#edeae0" }}>{memberName}</span>
          </div>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#9b9889" }}>ARX workout history CSV</span>
              <div
                style={{
                  border: `2px dashed ${fileName ? "rgba(201,240,85,0.5)" : "rgba(255,255,255,0.15)"}`,
                  borderRadius: 10,
                  padding: "20px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 0.2s",
                }}
                onClick={() => fileRef.current?.click()}
              >
                <div style={{ fontSize: 13, color: fileName ? "#c9f055" : "#9b9889" }}>
                  {fileName || "Click to select CSV file"}
                </div>
                {!fileName && (
                  <div style={{ fontSize: 11, color: "#6b6a5e", marginTop: 4 }}>
                    or drag and drop your .csv file here
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={isUploading || !fileName}
                style={{
                  background: isUploading || !fileName ? "rgba(201,240,85,0.4)" : "#c9f055",
                  border: "1px solid #c9f055",
                  color: "#0b0c09",
                  borderRadius: 10,
                  padding: "10px 18px",
                  fontWeight: 600,
                  cursor: isUploading || !fileName ? "not-allowed" : "pointer",
                  fontSize: 13,
                }}
              >
                {isUploading ? "Importing…" : "Import ARX Data"}
              </button>
              <Link
                href="/dashboard?section=arx"
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
                Back to Dashboard
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
              ✓ Successfully imported {result.imported} sets across {result.exercises.length} exercise{result.exercises.length !== 1 ? "s" : ""}.
            </div>
            {result.exercises.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#9b9889", marginBottom: 4 }}>Exercises imported:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {result.exercises.map((ex) => (
                    <span key={ex} style={{ fontSize: 11, background: "rgba(201,240,85,0.1)", border: "1px solid rgba(201,240,85,0.25)", borderRadius: 4, padding: "2px 8px", color: "#c9f055" }}>
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Link href="/dashboard?section=arx" style={{ fontSize: 12, color: "#c9f055", textDecoration: "underline", display: "inline-block", marginTop: 4 }}>
              View your ARX data →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
