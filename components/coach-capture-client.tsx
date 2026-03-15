"use client";

import { useMemo, useRef, useState } from "react";

type MemberOption = {
  id: string;
  name: string;
};

type Props = {
  members: MemberOption[];
};

type MachineOption = {
  value: string;
  label: string;
  description: string;
};

const MACHINE_OPTIONS: MachineOption[] = [
  { value: "arx", label: "ARX", description: "Strength machine screenshot" },
  { value: "carol", label: "CAROL", description: "Ride/session metrics screen" },
  { value: "fit3d", label: "Fit3D", description: "Body composition report" },
  { value: "vasper", label: "Vasper", description: "Duration/output capture" },
  { value: "katalyst", label: "Katalyst", description: "Duration/output capture" },
  { value: "proteus", label: "Proteus", description: "Duration/output capture" },
  { value: "quickboard", label: "Quickboard", description: "Duration/output capture" },
  { value: "infrared_sauna", label: "IR Sauna", description: "Recovery screen values" },
  { value: "cold_plunge", label: "Cold Plunge", description: "Recovery screen values" },
  { value: "compression", label: "Compression", description: "Recovery screen values" },
  { value: "nxpro", label: "NxPro", description: "Recovery screen values" },
];

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function CoachCaptureClient({ members }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [memberId, setMemberId] = useState<string>(members[0]?.id ?? "");
  const [machine, setMachine] = useState<string>("arx");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [extractedJson, setExtractedJson] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === memberId) ?? null,
    [members, memberId],
  );

  async function handleExtract() {
    if (!imageFile) {
      setError("Select an image first.");
      return;
    }
    setError("");
    setStatus("Uploading image and extracting with Claude…");
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("equipment", machine);
      formData.append("image", imageFile);
      const response = await fetch("/api/ai/extract-machine-data", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Failed to extract machine data.");
      }
      setExtractedJson(JSON.stringify(payload.extracted ?? {}, null, 2));
      setStatus("Photo uploaded ✓ Review extracted data and confirm save.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extraction failed.";
      setError(message);
      setStatus("");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleSave() {
    if (!memberId) {
      setError("Select a member.");
      return;
    }
    let extracted: Record<string, unknown>;
    try {
      extracted = extractedJson ? (JSON.parse(extractedJson) as Record<string, unknown>) : {};
    } catch {
      setError("Extracted JSON is invalid. Please fix it before saving.");
      return;
    }

    const durationFromExtraction =
      asNumber(extracted.duration_minutes) ??
      (() => {
        const seconds = asNumber(extracted.time_seconds);
        return seconds !== null ? Math.max(1, Math.round(seconds / 60)) : null;
      })();
    const protocolOrExercise =
      typeof extracted.exercise === "string"
        ? extracted.exercise
        : typeof extracted.protocol === "string"
          ? extracted.protocol
          : machine === "fit3d"
            ? "Fit3D scan"
            : machine === "carol"
              ? "CAROL session"
              : "Session";
    const perceivedEffort = asNumber(extracted.intensity);
    const temperatureF = asNumber(extracted.temperature_f);
    const rideType =
      typeof extracted.ride_type === "string" ? extracted.ride_type : undefined;

    setError("");
    setStatus("Saving to Supabase…");
    setIsSaving(true);
    try {
      const response = await fetch("/api/coach/log-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          equipment: machine,
          duration_minutes: durationFromExtraction ?? "",
          protocol_or_exercise: protocolOrExercise,
          perceived_effort: perceivedEffort ?? "",
          completed: true,
          ride_type: rideType,
          temperature_f: temperatureF ?? "",
          extraction_data: extracted,
          staff_notes: `Captured via /coach/capture${selectedMember ? ` for ${selectedMember.name}` : ""}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Failed to save extracted data.");
      }
      setStatus("Saved successfully ✓ Data has been written to Supabase.");
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
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontFamily: "Georgia, serif" }}>
          AI Photo Capture
        </h1>
        <p style={{ color: "#9b9889", marginTop: 8, marginBottom: 20 }}>
          Upload machine photos, extract metrics with Claude Vision, confirm, then save.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#9b9889" }}>Member</span>
            <select
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              style={{
                background: "#111209",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#edeae0",
                padding: "10px 12px",
                borderRadius: 8,
              }}
            >
              {members.length === 0 ? (
                <option value="">No members found</option>
              ) : (
                members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#9b9889" }}>Machine type</span>
            <select
              value={machine}
              onChange={(event) => setMachine(event.target.value)}
              style={{
                background: "#111209",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#edeae0",
                padding: "10px 12px",
                borderRadius: 8,
              }}
            >
              {MACHINE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} — {option.description}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
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
            Upload / Capture Photo
          </button>
          <span style={{ color: "#9b9889", fontSize: 13 }}>
            {imageFile ? imageFile.name : "No image selected"}
          </span>
          <button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting || !imageFile}
            style={{
              background: "#c9f055",
              border: "1px solid #c9f055",
              color: "#0b0c09",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: isExtracting || !imageFile ? "not-allowed" : "pointer",
              opacity: isExtracting || !imageFile ? 0.7 : 1,
              fontWeight: 600,
            }}
          >
            {isExtracting ? "Extracting…" : "Extract with Claude"}
          </button>
        </div>

        {status ? (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(201,240,85,0.08)",
              border: "1px solid rgba(201,240,85,0.3)",
              color: "#c9f055",
              fontSize: 13,
            }}
          >
            {status}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(240,112,85,0.08)",
              border: "1px solid rgba(240,112,85,0.3)",
              color: "#f07055",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            background: "#111209",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>Confirmation</h2>
          <p style={{ marginTop: 0, marginBottom: 10, color: "#9b9889", fontSize: 13 }}>
            Review and edit extracted JSON before saving.
          </p>
          <textarea
            value={extractedJson}
            onChange={(event) => setExtractedJson(event.target.value)}
            placeholder="Extracted JSON will appear here…"
            style={{
              width: "100%",
              minHeight: 280,
              background: "#181910",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "#edeae0",
              borderRadius: 8,
              padding: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !extractedJson}
              style={{
                background: "#c9f055",
                border: "1px solid #c9f055",
                color: "#0b0c09",
                borderRadius: 8,
                padding: "10px 14px",
                fontWeight: 600,
                cursor: isSaving || !extractedJson ? "not-allowed" : "pointer",
                opacity: isSaving || !extractedJson ? 0.7 : 1,
              }}
            >
              {isSaving ? "Saving…" : "Confirm & Save"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
