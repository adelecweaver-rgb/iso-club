"use client";

import { useRef, useState } from "react";

type UploadKind =
  | "whoop"
  | "oura"
  | "garmin"
  | "apple_health"
  | "other_wearable"
  | "carol"
  | "arx";

const OPTIONS: Array<{
  value: UploadKind;
  label: string;
  subtitle: string;
}> = [
  { value: "whoop", label: "Whoop", subtitle: "Recovery / HRV / sleep data" },
  { value: "oura", label: "Oura", subtitle: "Readiness / sleep / HRV data" },
  { value: "garmin", label: "Garmin", subtitle: "Body Battery / readiness / sleep metrics" },
  { value: "apple_health", label: "Apple Health", subtitle: "Sleep / HRV / resting heart rate metrics" },
  { value: "other_wearable", label: "Other Wearable", subtitle: "Generic wearable screenshot" },
  { value: "carol", label: "CAROL", subtitle: "Ride screenshot (fitness/power/HR)" },
  { value: "arx", label: "ARX", subtitle: "Session screenshot (output/max/intensity)" },
];

export function MemberUploadDataForm({ memberName }: { memberName: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [kind, setKind] = useState<UploadKind>("whoop");
  const [file, setFile] = useState<File | null>(null);
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [extractedJson, setExtractedJson] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function extractFromPhoto() {
    if (!file) {
      setError("Select an image first.");
      return;
    }
    setError("");
    setStatus("Uploading image and extracting with Claude…");
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("equipment", kind);
      formData.append("image", file);
      const response = await fetch("/api/ai/extract-machine-data", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Could not extract data from image.");
      }
      setExtractedJson(JSON.stringify(payload.extracted ?? {}, null, 2));
      setStatus("Photo analyzed ✓ Review extracted data and save.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extraction failed.";
      setError(message);
      setStatus("");
    } finally {
      setIsExtracting(false);
    }
  }

  async function saveExtractedData() {
    if (!extractedJson.trim()) {
      setError("Extract data first.");
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractedJson) as Record<string, unknown>;
    } catch {
      setError("Extracted JSON is invalid. Fix it before saving.");
      return;
    }

    setError("");
    setStatus("Saving data to your profile…");
    setIsSaving(true);
    try {
      const response = await fetch("/api/member/upload-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment: kind,
          extraction_data: parsed,
          notes,
          session_date: sessionDate,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Unable to save uploaded data.");
      }
      setStatus("Saved successfully ✓");
      setNotes("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      setError(message);
      setStatus("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c09", color: "#edeae0", padding: 24 }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 34 }}>Upload Data</h1>
        <p style={{ color: "#9b9889", marginTop: 8, marginBottom: 20 }}>
          Upload Whoop, Oura, Garmin, Apple Health, CAROL, or ARX screenshots to auto-extract
          data with Claude.
        </p>
        <div
          style={{
            background: "#111209",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "#585750", textTransform: "uppercase" }}>
            Member
          </div>
          <div style={{ fontSize: 16, marginTop: 4 }}>{memberName}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {OPTIONS.map((option) => {
            const selected = kind === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                style={{
                  textAlign: "left",
                  borderRadius: 10,
                  padding: 12,
                  cursor: "pointer",
                  border: selected
                    ? "1px solid rgba(201,240,85,0.75)"
                    : "1px solid rgba(255,255,255,0.12)",
                  background: selected ? "rgba(201,240,85,0.08)" : "#111209",
                  color: "#edeae0",
                }}
              >
                <div style={{ fontWeight: 600 }}>{option.label}</div>
                <div style={{ fontSize: 12, color: "#9b9889", marginTop: 4 }}>{option.subtitle}</div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            background: "#111209",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{
                background: "#181910",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#edeae0",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              Upload / Capture Image
            </button>
            <span style={{ fontSize: 13, color: "#9b9889" }}>{file ? file.name : "No image selected"}</span>
            <button
              type="button"
              onClick={extractFromPhoto}
              disabled={isExtracting || !file}
              style={{
                background: "#c9f055",
                border: "1px solid #c9f055",
                color: "#0b0c09",
                borderRadius: 8,
                padding: "10px 14px",
                fontWeight: 600,
                cursor: isExtracting || !file ? "not-allowed" : "pointer",
                opacity: isExtracting || !file ? 0.7 : 1,
              }}
            >
              {isExtracting ? "Extracting…" : "Extract with Claude"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#9b9889" }}>Session date</span>
              <input
                type="date"
                value={sessionDate}
                onChange={(event) => setSessionDate(event.target.value)}
                style={{
                  background: "#181910",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#edeae0",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#9b9889" }}>Notes (optional)</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add context for this upload"
                style={{
                  background: "#181910",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#edeae0",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#9b9889" }}>Extracted data (editable JSON)</span>
            <textarea
              value={extractedJson}
              onChange={(event) => setExtractedJson(event.target.value)}
              placeholder="Extracted JSON appears here…"
              style={{
                width: "100%",
                minHeight: 260,
                background: "#181910",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#edeae0",
                borderRadius: 8,
                padding: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
              }}
            />
          </label>

          <button
            type="button"
            onClick={saveExtractedData}
            disabled={isSaving || !extractedJson}
            style={{
              background: "#c9f055",
              border: "1px solid #c9f055",
              color: "#0b0c09",
              borderRadius: 10,
              padding: "12px 14px",
              fontWeight: 600,
              cursor: isSaving || !extractedJson ? "not-allowed" : "pointer",
              opacity: isSaving || !extractedJson ? 0.7 : 1,
            }}
          >
            {isSaving ? "Saving…" : "Save extracted data"}
          </button>
        </div>

        {status ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 8,
              color: "#c9f055",
              background: "rgba(201,240,85,0.08)",
              border: "1px solid rgba(201,240,85,0.3)",
              fontSize: 13,
            }}
          >
            {status}
          </div>
        ) : null}
        {error ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 8,
              color: "#f07055",
              background: "rgba(240,112,85,0.08)",
              border: "1px solid rgba(240,112,85,0.3)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}
      </div>
    </main>
  );
}
