"use client";

import { useMemo, useState } from "react";

type MemberOption = {
  id: string;
  full_name: string;
};

type PreviewRow = {
  scan_date: string;
  weight_lbs: number | null;
  body_fat_pct: number | null;
  lean_mass_lbs: number | null;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  members?: MemberOption[];
  row_count?: number;
  preview_rows?: PreviewRow[];
  member?: MemberOption;
  imported_count?: number;
};

function formatScanDate(isoValue: string): string {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return isoValue;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMaybeNumber(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function CoachFit3dImportTool({ initialMembers }: { initialMembers: MemberOption[] }) {
  const [members] = useState<MemberOption[]>(initialMembers);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [status, setStatus] = useState<{ kind: "idle" | "info" | "error" | "success"; message: string }>({
    kind: "idle",
    message: "",
  });
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  async function readCsvText(): Promise<string> {
    if (csvText.trim()) return csvText;
    if (!selectedFile) throw new Error("Please upload a CSV file first.");
    const text = await selectedFile.text();
    setCsvText(text);
    return text;
  }

  async function previewCsv() {
    try {
      if (!selectedMemberId) {
        throw new Error("Select a member before previewing.");
      }
      setIsPreviewing(true);
      setStatus({ kind: "info", message: "Parsing CSV preview…" });
      const text = await readCsvText();
      const response = await fetch("/api/coach/import/fit3d", {
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
        throw new Error(payload.error || "Unable to preview CSV.");
      }
      setPreviewRows(Array.isArray(payload.preview_rows) ? payload.preview_rows : []);
      setPreviewCount(Number(payload.row_count || 0));
      setStatus({
        kind: "success",
        message: `Preview ready — ${Number(payload.row_count || 0)} scans detected.`,
      });
    } catch (error) {
      setPreviewRows([]);
      setPreviewCount(0);
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to preview CSV.",
      });
    } finally {
      setIsPreviewing(false);
    }
  }

  async function importCsv() {
    try {
      if (!selectedMemberId) {
        throw new Error("Select a member before importing.");
      }
      const text = await readCsvText();
      if (!text.trim()) {
        throw new Error("CSV file is empty.");
      }
      setIsImporting(true);
      setStatus({ kind: "info", message: "Importing scans into Supabase…" });
      const response = await fetch("/api/coach/import/fit3d", {
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
        throw new Error(payload.error || "Unable to import CSV.");
      }
      const importedCount = Number(payload.imported_count || 0);
      const memberName = payload.member?.full_name || selectedMember?.full_name || "member";
      setStatus({
        kind: "success",
        message: `${importedCount} scans imported for ${memberName}.`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to import CSV.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c09", color: "#edeae0", padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, fontFamily: "Georgia, serif" }}>Fit3D Historical Import</h1>
          <p style={{ marginTop: 8, color: "#9b9889" }}>
            One-time CSV import for historical Fit3D scans.
          </p>
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
            <label style={{ fontSize: 12, color: "#9b9889" }}>Fit3D CSV file</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setCsvText("");
                setPreviewRows([]);
                setPreviewCount(0);
                setStatus({ kind: "idle", message: "" });
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
          ) : null}
        </div>

        <div
          style={{
            background: "#111209",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 16,
            overflowX: "auto",
          }}
        >
          <div style={{ fontSize: 12, color: "#9b9889", marginBottom: 10 }}>
            Preview ({previewCount} rows): date, weight, body fat %, lean mass
          </div>
          {previewRows.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 11, color: "#9b9889", borderBottom: "1px solid rgba(255,255,255,0.14)", padding: "8px 6px" }}>
                    Scan date
                  </th>
                  <th style={{ textAlign: "left", fontSize: 11, color: "#9b9889", borderBottom: "1px solid rgba(255,255,255,0.14)", padding: "8px 6px" }}>
                    Weight (lbs)
                  </th>
                  <th style={{ textAlign: "left", fontSize: 11, color: "#9b9889", borderBottom: "1px solid rgba(255,255,255,0.14)", padding: "8px 6px" }}>
                    Body fat %
                  </th>
                  <th style={{ textAlign: "left", fontSize: 11, color: "#9b9889", borderBottom: "1px solid rgba(255,255,255,0.14)", padding: "8px 6px" }}>
                    Lean mass (lbs)
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`${row.scan_date}-${index}`}>
                    <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 6px", fontSize: 13 }}>
                      {formatScanDate(row.scan_date)}
                    </td>
                    <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 6px", fontSize: 13 }}>
                      {formatMaybeNumber(row.weight_lbs)}
                    </td>
                    <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 6px", fontSize: 13 }}>
                      {formatMaybeNumber(row.body_fat_pct, 2)}
                    </td>
                    <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 6px", fontSize: 13 }}>
                      {formatMaybeNumber(row.lean_mass_lbs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 13, color: "#9b9889" }}>
              Upload CSV and click Preview CSV to inspect all rows before import.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
