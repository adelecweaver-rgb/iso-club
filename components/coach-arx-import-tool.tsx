"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type MemberOption = {
  id: string;
  full_name: string;
};

type PreviewRow = {
  external_id: string;
  session_date: string;
  exercise: string;
  machine_type: string | null;
  concentric_max: number | null;
  eccentric_max: number | null;
  output: number | null;
};

type Summary = {
  total_sets: number;
  exercise_count: number;
  date_start: string;
  date_end: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  members?: MemberOption[];
  member?: MemberOption;
  row_count?: number;
  preview_rows?: PreviewRow[];
  summary?: Summary;
  imported_count?: number;
  skipped_duplicates?: number;
  exercise_count?: number;
  missing_columns?: string[];
};

function formatDate(isoValue: string): string {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return isoValue;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return String(value);
}

export function CoachArxImportTool({ initialMembers }: { initialMembers: MemberOption[] }) {
  const [members] = useState<MemberOption[]>(initialMembers);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "info" | "error" | "success"; message: string }>({
    kind: "idle",
    message: "",
  });
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hasSuccessfulImport, setHasSuccessfulImport] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const groupedPreview = useMemo(() => {
    const group = new Map<string, PreviewRow[]>();
    for (const row of previewRows) {
      const key = row.exercise || "ARX Session";
      const existing = group.get(key) ?? [];
      existing.push(row);
      group.set(key, existing);
    }
    return Array.from(group.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [previewRows]);

  async function readCsvText(): Promise<string> {
    if (csvText.trim()) return csvText;
    if (!selectedFile) throw new Error("Please upload a CSV file first.");
    const text = await selectedFile.text();
    setCsvText(text);
    return text;
  }

  async function previewCsv() {
    try {
      if (!selectedMemberId) throw new Error("Select a member before previewing.");
      setIsPreviewing(true);
      setStatus({ kind: "info", message: "Parsing ARX CSV preview…" });
      const text = await readCsvText();
      const response = await fetch("/api/coach/import/arx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          member_id: selectedMemberId,
          csv_text: text,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Unable to preview ARX CSV.");
      }
      setPreviewRows(Array.isArray(payload.preview_rows) ? payload.preview_rows : []);
      setSummary(payload.summary ?? null);
      setMissingColumns(Array.isArray(payload.missing_columns) ? payload.missing_columns : []);
      setStatus({
        kind: "success",
        message: `Preview ready — ${Number(payload.row_count || 0)} sets detected.`,
      });
      setHasSuccessfulImport(false);
    } catch (error) {
      setPreviewRows([]);
      setSummary(null);
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to preview ARX CSV.",
      });
      setHasSuccessfulImport(false);
    } finally {
      setIsPreviewing(false);
    }
  }

  async function importCsv() {
    try {
      if (!selectedMemberId) throw new Error("Select a member before importing.");
      const text = await readCsvText();
      if (!text.trim()) throw new Error("CSV file is empty.");

      setIsImporting(true);
      setStatus({ kind: "info", message: "Importing ARX sets into Supabase…" });
      const response = await fetch("/api/coach/import/arx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          member_id: selectedMemberId,
          csv_text: text,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Unable to import ARX CSV.");
      }

      const importedCount = Number(payload.imported_count || 0);
      const exerciseCount = Number(payload.exercise_count || 0);
      const duplicateCount = Number(payload.skipped_duplicates || 0);
      setMissingColumns(Array.isArray(payload.missing_columns) ? payload.missing_columns : []);
      setStatus({
        kind: "success",
        message:
          `${importedCount} sets imported across ${exerciseCount} exercises` +
          (duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped).` : "."),
      });
      setHasSuccessfulImport(true);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to import ARX CSV.",
      });
      setHasSuccessfulImport(false);
    } finally {
      setIsImporting(false);
    }
  }

  function resetForm() {
    setSelectedMemberId("");
    setSelectedFile(null);
    setCsvText("");
    setPreviewRows([]);
    setSummary(null);
    setStatus({ kind: "idle", message: "" });
    setMissingColumns([]);
    setHasSuccessfulImport(false);
    setFileInputKey((previous) => previous + 1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c09", color: "#edeae0", padding: 24 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, fontFamily: "Georgia, serif" }}>ARX Historical Import</h1>
            <p style={{ marginTop: 8, color: "#9b9889" }}>
              One-time CSV import for historical ARX sets.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/coach/import/fit3d" className="btn btn-sm">
              Fit3D Import
            </Link>
            <Link href="/coach/import/arx" className="btn btn-sm btn-lime">
              ARX Import
            </Link>
          </div>
        </div>

        <div
          style={{
            background: "#111209",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#9b9889" }}>Member</label>
            <select
              value={selectedMemberId}
              onChange={(event) => {
                setSelectedMemberId(event.target.value);
                setStatus({ kind: "idle", message: "" });
              }}
              style={{
                background: "#181910",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#edeae0",
                borderRadius: 8,
                padding: "11px 12px",
              }}
            >
              <option value="">Select member…</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#9b9889" }}>ARX CSV file</label>
            <input
              key={fileInputKey}
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setCsvText("");
                setPreviewRows([]);
                setSummary(null);
                setStatus({ kind: "idle", message: "" });
                setHasSuccessfulImport(false);
              }}
              style={{
                background: "#181910",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#edeae0",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void previewCsv()}
              disabled={isPreviewing || !selectedFile || !selectedMemberId}
              style={{
                background: "#c9f055",
                border: "1px solid #c9f055",
                color: "#0b0c09",
                borderRadius: 10,
                padding: "10px 14px",
                fontWeight: 600,
                cursor: isPreviewing || !selectedFile || !selectedMemberId ? "not-allowed" : "pointer",
                opacity: isPreviewing || !selectedFile || !selectedMemberId ? 0.65 : 1,
              }}
            >
              {isPreviewing ? "Parsing…" : "Preview CSV"}
            </button>
            <button
              type="button"
              onClick={() => void importCsv()}
              disabled={isImporting || !selectedFile || !selectedMemberId || previewRows.length === 0}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#edeae0",
                borderRadius: 10,
                padding: "10px 14px",
                fontWeight: 600,
                cursor: isImporting || !selectedFile || !selectedMemberId || previewRows.length === 0 ? "not-allowed" : "pointer",
                opacity: isImporting || !selectedFile || !selectedMemberId || previewRows.length === 0 ? 0.55 : 1,
              }}
            >
              {isImporting ? "Importing…" : "Import"}
            </button>
          </div>

          {status.message ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  fontSize: 13,
                  borderRadius: 8,
                  padding: "10px 12px",
                  border:
                    status.kind === "error"
                      ? "1px solid rgba(240,112,85,0.35)"
                      : status.kind === "success"
                        ? "1px solid rgba(201,240,85,0.35)"
                        : "1px solid rgba(255,255,255,0.16)",
                  color:
                    status.kind === "error"
                      ? "#f07055"
                      : status.kind === "success"
                        ? "#c9f055"
                        : "#afbda5",
                  background:
                    status.kind === "error"
                      ? "rgba(240,112,85,0.08)"
                      : status.kind === "success"
                        ? "rgba(201,240,85,0.08)"
                        : "rgba(255,255,255,0.04)",
                }}
              >
                {status.message}
              </div>
              {hasSuccessfulImport ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-sm"
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.22)",
                      color: "#edeae0",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontWeight: 600,
                    }}
                  >
                    Import Another File
                  </button>
                  <Link
                    href="/coach"
                    className="btn btn-sm"
                    style={{
                      background: "#c9f055",
                      border: "1px solid #c9f055",
                      color: "#0b0c09",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Return to Dashboard
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {missingColumns.length ? (
            <div
              style={{
                fontSize: 12,
                color: "#f0b955",
                border: "1px solid rgba(240,185,85,0.4)",
                background: "rgba(240,185,85,0.08)",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              Missing recommended columns in arx_sessions: {missingColumns.join(", ")}. Import will still run with fallback, but dedupe and mapped fields work best after applying schema update.
            </div>
          ) : null}
        </div>

        <div
          style={{
            background: "#111209",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 16,
            overflowX: "auto",
            display: "grid",
            gap: 12,
          }}
        >
          {summary ? (
            <div style={{ fontSize: 12, color: "#afbda5" }}>
              {summary.total_sets} total sets across {summary.exercise_count} exercises from{" "}
              {summary.date_start ? formatDate(summary.date_start) : "—"} to{" "}
              {summary.date_end ? formatDate(summary.date_end) : "—"}.
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#9b9889" }}>
              Preview will show grouped ARX sets and date range summary.
            </div>
          )}

          {groupedPreview.length ? (
            groupedPreview.map(([exercise, rows]) => (
              <div key={exercise} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ background: "rgba(255,255,255,0.04)", padding: "8px 10px", fontSize: 12, fontWeight: 600 }}>
                  {exercise} ({rows.length})
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", fontSize: 11, color: "#9b9889", borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "8px 6px" }}>Date</th>
                      <th style={{ textAlign: "left", fontSize: 11, color: "#9b9889", borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "8px 6px" }}>Machine</th>
                      <th style={{ textAlign: "left", fontSize: 11, color: "#9b9889", borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "8px 6px" }}>Concentric max</th>
                      <th style={{ textAlign: "left", fontSize: 11, color: "#9b9889", borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "8px 6px" }}>Eccentric max</th>
                      <th style={{ textAlign: "left", fontSize: 11, color: "#9b9889", borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "8px 6px" }}>Output</th>
                      <th style={{ textAlign: "left", fontSize: 11, color: "#9b9889", borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "8px 6px" }}>External ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.external_id}>
                        <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 6px", fontSize: 13 }}>{formatDate(row.session_date)}</td>
                        <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 6px", fontSize: 13 }}>{row.machine_type || "—"}</td>
                        <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 6px", fontSize: 13 }}>{formatNumber(row.concentric_max)}</td>
                        <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 6px", fontSize: 13 }}>{formatNumber(row.eccentric_max)}</td>
                        <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 6px", fontSize: 13 }}>{formatNumber(row.output)}</td>
                        <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 6px", fontSize: 12, color: "#9b9889" }}>{row.external_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: "#9b9889" }}>
              Upload CSV and click Preview CSV to inspect grouped ARX sets before import.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
