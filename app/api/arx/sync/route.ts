import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ─── CSV parsing (mirrors coach ARX import logic) ───────────────────────────

const ARX_HEADERS = [
  "ExerciseSetId", "ExerciseDate", "LocationName", "MachineId", "MachineType",
  "ExerciseType", "RangeId", "ElapsedTime", "Protocol", "ProtocolType",
  "ProtocolParameter", "Speed", "ConcentricMax", "EccentricMax", "Intensity",
  "Output", "RestTimerUsed", "RestTimer", "ComparisonSetId", "ConcentricInroad",
  "EccentricInroad", "Notes",
] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { field += char; }
      continue;
    }
    if (char === '"') { inQuotes = true; continue; }
    if (char === ",") { row.push(field); field = ""; continue; }
    if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    if (char === "\r") continue;
    field += char;
  }
  row.push(field);
  if (row.some((v) => v.trim().length > 0)) rows.push(row);
  return rows;
}

function parseArxDate(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, m, d, y, h, min, sec] = match.map(Number);
  const year = y < 100 ? 2000 + y : y;
  const parsed = new Date(Date.UTC(year, m - 1, d, h, min, sec || 0));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const n = Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function extractMissingColumn(msg: string): string | null {
  return (
    msg.match(/column ["']?([^"']+)["']? of relation .* does not exist/i)?.[1] ??
    msg.match(/Could not find the ['"]?([^'"]+)['"]? column/i)?.[1] ??
    null
  );
}

type PreparedRow = Record<string, unknown>;

function parseRows(csvText: string): { rows: PreparedRow[]; error: string | null } {
  const all = parseCsv(csvText.trim());
  if (all.length < 2) return { rows: [], error: "CSV has no data rows." };

  const rawHeaders = all[0].map((h) => h.replace(/^\uFEFF/, "").trim());
  if (rawHeaders.length !== ARX_HEADERS.length) {
    return { rows: [], error: `Expected ${ARX_HEADERS.length} columns, found ${rawHeaders.length}. Make sure you exported the full ARX workout history CSV.` };
  }
  for (let i = 0; i < ARX_HEADERS.length; i++) {
    if (rawHeaders[i] !== ARX_HEADERS[i]) {
      return { rows: [], error: `Column mismatch at position ${i + 1}: expected "${ARX_HEADERS[i]}", got "${rawHeaders[i]}".` };
    }
  }

  const rows: PreparedRow[] = [];
  for (let r = 1; r < all.length; r++) {
    const cells = all[r];
    const get = (col: string) => cells[ARX_HEADERS.indexOf(col as typeof ARX_HEADERS[number])] ?? "";

    const externalId = asText(get("ExerciseSetId"));
    const sessionDate = parseArxDate(get("ExerciseDate"));
    if (!externalId || !sessionDate) continue;

    rows.push({
      external_id: externalId,
      session_date: sessionDate,
      machine_type: asText(get("MachineType")),
      exercise: asText(get("ExerciseType")) ?? "Unknown",
      protocol: asText(get("Protocol")),
      speed: asText(get("Speed")),
      concentric_max: asNum(get("ConcentricMax")),
      eccentric_max: asNum(get("EccentricMax")),
      intensity: asNum(get("Intensity")),
      output: asNum(get("Output")),
      duration: asText(get("ElapsedTime")),
      staff_notes: asText(get("Notes")),
      raw_data: {
        source: "member_arx_csv_upload",
        location: asText(get("LocationName")),
        machine_id: asText(get("MachineId")),
        protocol_type: asText(get("ProtocolType")),
        protocol_parameter: asText(get("ProtocolParameter")),
        rest_timer_used: asText(get("RestTimerUsed")),
        rest_timer: asText(get("RestTimer")),
      },
    });
  }

  return { rows, error: null };
}

async function upsertRows(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  rows: PreparedRow[],
): Promise<void> {
  const CHUNK = 200;
  const stripped = new Set<string>();

  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    const chunk = rows.slice(offset, offset + CHUNK);
    let working = chunk.map((r) => {
      const copy = { ...r };
      for (const col of stripped) delete copy[col];
      return copy;
    });

    let attempts = 0;
    while (attempts < 8) {
      const res = await supabase.from("arx_sessions").upsert(working, { onConflict: "external_id" });
      if (!res.error) break;

      const missing = extractMissingColumn(res.error.message);
      if (missing && !stripped.has(missing)) {
        stripped.add(missing);
        working = working.map((r) => { const c = { ...r }; delete c[missing]; return c; });
        attempts++;
        continue;
      }
      if (/no unique or exclusion constraint/i.test(res.error.message)) {
        // Fallback: manual upsert by external_id
        const ids = working.map((r) => String(r.external_id)).filter(Boolean);
        const existing = await supabase.from("arx_sessions").select("external_id").in("external_id", ids);
        const existingSet = new Set((existing.data ?? []).map((r: Record<string, unknown>) => String(r.external_id)));
        const toInsert = working.filter((r) => !existingSet.has(String(r.external_id)));
        const toUpdate = working.filter((r) => existingSet.has(String(r.external_id)));
        if (toInsert.length) await supabase.from("arx_sessions").insert(toInsert);
        for (const row of toUpdate) {
          const id = String(row.external_id);
          const payload = { ...row };
          delete payload.external_id;
          await supabase.from("arx_sessions").update(payload).eq("external_id", id);
        }
        break;
      }
      throw new Error(res.error.message);
    }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }

    const memberId = String(context.dbUser.id ?? "").trim();
    if (!memberId) {
      return NextResponse.json({ success: false, error: "Could not resolve member ID." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase admin client unavailable." }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("csv") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: "No CSV file provided." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ success: false, error: "File must be a .csv file." }, { status: 400 });
    }

    const csvText = await file.text();
    const { rows, error: parseError } = parseRows(csvText);
    if (parseError) {
      return NextResponse.json({ success: false, error: parseError }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "No valid rows found in the CSV." }, { status: 400 });
    }

    // Stamp every row with the authenticated member's ID
    const stamped = rows.map((row) => ({ ...row, member_id: memberId }));
    await upsertRows(supabase, stamped);

    const exercises = new Set(stamped.map((r) => String((r as Record<string, unknown>).exercise ?? "")).filter(Boolean));
    return NextResponse.json({
      success: true,
      imported: stamped.length,
      exercises: Array.from(exercises),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Import failed." },
      { status: 500 },
    );
  }
}
