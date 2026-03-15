"use client";

import { useMemo, useState } from "react";

type Props = {
  memberName: string;
};

const MODALITIES = [
  { value: "cold_plunge", label: "Cold Plunge" },
  { value: "infrared_sauna", label: "Infrared Sauna" },
  { value: "compression_therapy", label: "Compression Boots" },
  { value: "nxpro", label: "NxPro" },
];

function todayDateValue() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export function RecoverySelfLogForm({ memberName }: Props) {
  const [modality, setModality] = useState("cold_plunge");
  const [durationMinutes, setDurationMinutes] = useState("10");
  const [temperatureF, setTemperatureF] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionDate, setSessionDate] = useState(todayDateValue());
  const [status, setStatus] = useState<{ kind: "idle" | "success" | "error"; message: string }>(
    { kind: "idle", message: "" },
  );
  const [isSaving, setIsSaving] = useState(false);

  const showTempField = useMemo(
    () => modality === "cold_plunge" || modality === "infrared_sauna",
    [modality],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus({ kind: "idle", message: "" });
    try {
      const response = await fetch("/api/recovery/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modality,
          duration_minutes: durationMinutes,
          temperature_f: showTempField ? temperatureF : "",
          notes,
          session_date: sessionDate,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Could not save recovery session.");
      }

      setStatus({ kind: "success", message: "Recovery session logged successfully." });
      setNotes("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save recovery session.";
      setStatus({ kind: "error", message });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c09", color: "#edeae0", padding: 24 }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 34 }}>Recovery Self-Log</h1>
        <p style={{ color: "#9b9889", marginTop: 8, marginBottom: 22 }}>
          Log your recovery session and save it to your profile.
        </p>

        <div
          style={{
            background: "#111209",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#585750" }}>
            Member
          </div>
          <div style={{ marginTop: 4, fontSize: 16 }}>{memberName}</div>
        </div>

        <form
          onSubmit={onSubmit}
          style={{
            background: "#111209",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#9b9889" }}>Recovery type</span>
            <select
              value={modality}
              onChange={(event) => setModality(event.target.value)}
              style={{
                background: "#181910",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#edeae0",
                borderRadius: 8,
                padding: "11px 12px",
              }}
            >
              {MODALITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: showTempField ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#9b9889" }}>Duration (minutes)</span>
              <input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                required
                style={{
                  background: "#181910",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#edeae0",
                  borderRadius: 8,
                  padding: "11px 12px",
                }}
              />
            </label>

            {showTempField ? (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#9b9889" }}>Temperature (°F)</span>
                <input
                  type="number"
                  value={temperatureF}
                  onChange={(event) => setTemperatureF(event.target.value)}
                  placeholder="Optional"
                  style={{
                    background: "#181910",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#edeae0",
                    borderRadius: 8,
                    padding: "11px 12px",
                  }}
                />
              </label>
            ) : null}

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#9b9889" }}>Session date</span>
              <input
                type="date"
                value={sessionDate}
                onChange={(event) => setSessionDate(event.target.value)}
                required
                style={{
                  background: "#181910",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#edeae0",
                  borderRadius: 8,
                  padding: "11px 12px",
                }}
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#9b9889" }}>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="How did the session feel?"
              rows={4}
              style={{
                background: "#181910",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#edeae0",
                borderRadius: 8,
                padding: "11px 12px",
                resize: "vertical",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={isSaving}
            style={{
              background: "#c9f055",
              border: "1px solid #c9f055",
              color: "#0b0c09",
              borderRadius: 10,
              padding: "12px 14px",
              fontWeight: 600,
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? "Saving..." : "Save recovery session"}
          </button>
        </form>

        {status.message ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              color: status.kind === "error" ? "#f07055" : "#c9f055",
              background:
                status.kind === "error"
                  ? "rgba(240,112,85,0.08)"
                  : "rgba(201,240,85,0.08)",
              border:
                status.kind === "error"
                  ? "1px solid rgba(240,112,85,0.3)"
                  : "1px solid rgba(201,240,85,0.3)",
            }}
          >
            {status.message}
          </div>
        ) : null}
      </div>
    </main>
  );
}
