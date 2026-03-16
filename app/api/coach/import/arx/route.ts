import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ImportAction = "preview" | "import";

type Body = {
  action?: ImportAction;
  member_id?: string;
  csv_text?: string;
};

type MemberProfile = {
  id: string;
  full_name: string;
  role: string;
};

type ArxPreviewRow = {
  external_id: string;
  session_date: string;
  exercise: string;
  machine_type: string | null;
  concentric_max: number | null;
  eccentric_max: number | null;
  output: number | null;
};

type ArxPreparedRow = {
  external_id: string;
  session_date: string;
  machine_type: string | null;
  exercise: string;
  protocol: string | null;
  speed: string | null;
  concentric_max: number | null;
  eccentric_max: number | null;
  intensity: number | null;
  output: number | null;
  duration: string | null;
  staff_notes: string | null;
  raw_data: Record<string, unknown>;
};

type ArxSummary = {
  total_sets: number;
  exercise_count: number;
  date_start: string;
  date_end: string;
};

const ARX_HEADERS = [
  "ExerciseSetId",
  "ExerciseDate",
  "LocationName",
  "MachineId",
  "MachineType",
  "ExerciseType",
  "RangeId",
  "ElapsedTime",
  "Protocol",
  "ProtocolType",
  "ProtocolParameter",
  "Speed",
  "ConcentricMax",
  "EccentricMax",
  "Intensity",
  "Output",
  "RestTimerUsed",
  "RestTimer",
  "ComparisonSetId",
  "ConcentricInroad",
  "EccentricInroad",
  "Notes",
] as const;

const REQUIRED_IMPORT_COLUMNS = ["machine_type", "external_id", "duration", "speed"] as const;

function isCoachOrAdminRole(role: string): boolean {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "coach" || normalized === "admin";
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char === "\r") {
      continue;
    }
    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim().length > 0)) {
    rows.push(row);
  }
  return rows;
}

function parseArxDate(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || "0");

  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function validateHeaders(headers: string[]): string | null {
  if (headers.length !== ARX_HEADERS.length) {
    return `Expected ${ARX_HEADERS.length} columns, found ${headers.length}.`;
  }
  for (let index = 0; index < ARX_HEADERS.length; index += 1) {
    if (headers[index] !== ARX_HEADERS[index]) {
      return `Header mismatch at column ${index + 1}: expected "${ARX_HEADERS[index]}", got "${headers[index]}".`;
    }
  }
  return null;
}

function extractMissingColumnName(message: string): string | null {
  const relationMatch = message.match(/column ["']?([^"']+)["']? of relation .* does not exist/i);
  if (relationMatch?.[1]) return relationMatch[1];
  const genericMatch = message.match(/Could not find the ['"]?([^'"]+)['"]? column/i);
  if (genericMatch?.[1]) return genericMatch[1];
  return null;
}

async function hasColumn(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  column: string,
): Promise<boolean> {
  const result = await supabase.from("arx_sessions").select(column).limit(1);
  if (!result.error) return true;
  const missingColumn = extractMissingColumnName(result.error.message);
  if (missingColumn && missingColumn.toLowerCase() === column.toLowerCase()) {
    return false;
  }
  throw new Error(result.error.message);
}

async function detectOptionalColumns(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    REQUIRED_IMPORT_COLUMNS.map(async (column) => [column, await hasColumn(supabase, column)] as const),
  );
  return Object.fromEntries(entries);
}

function buildSummary(rows: ArxPreviewRow[]): ArxSummary {
  const dates = rows.map((row) => row.session_date).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const uniqueExercises = new Set(rows.map((row) => row.exercise).filter(Boolean));
  return {
    total_sets: rows.length,
    exercise_count: uniqueExercises.size,
    date_start: dates[0] || "",
    date_end: dates[dates.length - 1] || "",
  };
}

function prepareRows(csvText: string): {
  rows: ArxPreparedRow[];
  preview_rows: ArxPreviewRow[];
  summary: ArxSummary;
} {
  const parsed = parseCsv(csvText);
  if (!parsed.length) throw new Error("CSV file is empty.");

  const headers = parsed[0].map((header) => normalizeHeader(header));
  const headerError = validateHeaders(headers);
  if (headerError) throw new Error(`Invalid CSV header row. ${headerError}`);

  const dataRows = parsed.slice(1).filter((row) => row.some((cell) => String(cell || "").trim().length > 0));
  if (!dataRows.length) throw new Error("CSV has no data rows to import.");

  const preparedRows: ArxPreparedRow[] = [];
  const previewRows: ArxPreviewRow[] = [];

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    const values = ARX_HEADERS.map((_, headerIndex) => String(row[headerIndex] || "").trim());
    const record = Object.fromEntries(ARX_HEADERS.map((header, headerIndex) => [header, values[headerIndex]])) as Record<string, string>;

    const externalId = String(record.ExerciseSetId || "").trim();
    if (!externalId) throw new Error(`Missing ExerciseSetId on CSV row ${index + 2}.`);
    const sessionDateIso = parseArxDate(record.ExerciseDate);
    if (!sessionDateIso) {
      throw new Error(`Invalid ExerciseDate on CSV row ${index + 2}: "${record.ExerciseDate}".`);
    }
    const exercise = String(record.ExerciseType || "").trim() || "ARX Session";

    const prepared: ArxPreparedRow = {
      external_id: externalId,
      session_date: sessionDateIso,
      machine_type: asText(record.MachineType),
      exercise,
      protocol: asText(record.Protocol),
      speed: asText(record.Speed),
      concentric_max: asNumber(record.ConcentricMax),
      eccentric_max: asNumber(record.EccentricMax),
      intensity: asNumber(record.Intensity),
      output: asNumber(record.Output),
      duration: asText(record.ElapsedTime),
      staff_notes: asText(record.Notes),
      raw_data: {
        source: "arx_csv_import",
        external_id: externalId,
        location_name: asText(record.LocationName),
        machine_id: asText(record.MachineId),
        machine_type: asText(record.MachineType),
        range_id: asText(record.RangeId),
        elapsed_time: asText(record.ElapsedTime),
        protocol_type: asText(record.ProtocolType),
        protocol_parameter: asText(record.ProtocolParameter),
        speed: asText(record.Speed),
        rest_timer_used: asText(record.RestTimerUsed),
        rest_timer: asText(record.RestTimer),
        comparison_set_id: asText(record.ComparisonSetId),
        concentric_inroad: asNumber(record.ConcentricInroad),
        eccentric_inroad: asNumber(record.EccentricInroad),
      },
    };
    preparedRows.push(prepared);

    previewRows.push({
      external_id: externalId,
      session_date: sessionDateIso,
      exercise,
      machine_type: prepared.machine_type,
      concentric_max: prepared.concentric_max,
      eccentric_max: prepared.eccentric_max,
      output: prepared.output,
    });
  }

  previewRows.sort((a, b) => {
    const exerciseOrder = a.exercise.localeCompare(b.exercise);
    if (exerciseOrder !== 0) return exerciseOrder;
    return a.session_date.localeCompare(b.session_date);
  });
  return {
    rows: preparedRows,
    preview_rows: previewRows,
    summary: buildSummary(previewRows),
  };
}

async function findExistingExternalIds(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  memberId: string,
  externalIds: string[],
  columnSupport: Record<string, boolean>,
): Promise<Set<string>> {
  const ids = Array.from(new Set(externalIds.filter(Boolean)));
  const existing = new Set<string>();
  if (!ids.length) return existing;

  if (columnSupport.external_id) {
    for (let offset = 0; offset < ids.length; offset += 200) {
      const chunk = ids.slice(offset, offset + 200);
      const result = await supabase
        .from("arx_sessions")
        .select("external_id")
        .in("external_id", chunk);
      if (result.error) throw new Error(result.error.message);
      for (const row of Array.isArray(result.data) ? result.data : []) {
        const id = String(row.external_id || "").trim();
        if (id) existing.add(id);
      }
    }
    return existing;
  }

  const fallbackRows = await supabase
    .from("arx_sessions")
    .select("raw_data")
    .eq("member_id", memberId)
    .limit(10000);
  if (fallbackRows.error) return existing;
  for (const row of Array.isArray(fallbackRows.data) ? fallbackRows.data : []) {
    const raw = row.raw_data as Record<string, unknown> | null;
    const id = String(raw?.external_id ?? "").trim();
    if (id) existing.add(id);
  }
  return existing;
}

function buildInsertRows(
  memberId: string,
  rows: ArxPreparedRow[],
  existingIds: Set<string>,
  columnSupport: Record<string, boolean>,
): {
  insert_rows: Array<Record<string, unknown>>;
  imported_count: number;
  skipped_duplicates: number;
  exercise_count: number;
} {
  const inserts: Array<Record<string, unknown>> = [];
  const exerciseSet = new Set<string>();
  let skippedDuplicates = 0;

  for (const row of rows) {
    if (existingIds.has(row.external_id)) {
      skippedDuplicates += 1;
      continue;
    }
    existingIds.add(row.external_id);

    const insertRow: Record<string, unknown> = {
      member_id: memberId,
      session_date: row.session_date,
      exercise: row.exercise,
      protocol: row.protocol,
      intensity: row.intensity,
      output: row.output,
      concentric_max: row.concentric_max,
      eccentric_max: row.eccentric_max,
      staff_notes: row.staff_notes,
      raw_data: row.raw_data,
    };
    if (columnSupport.machine_type) insertRow.machine_type = row.machine_type;
    if (columnSupport.duration) insertRow.duration = row.duration;
    if (columnSupport.speed) insertRow.speed = row.speed;
    if (columnSupport.external_id) insertRow.external_id = row.external_id;

    inserts.push(insertRow);
    exerciseSet.add(row.exercise);
  }

  return {
    insert_rows: inserts,
    imported_count: inserts.length,
    skipped_duplicates: skippedDuplicates,
    exercise_count: exerciseSet.size,
  };
}

async function insertRowsWithMissingColumnFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  rows: Array<Record<string, unknown>>,
) {
  let workingRows = rows.map((row) => ({ ...row }));
  const removedColumns = new Set<string>();
  while (true) {
    const result = await supabase.from("arx_sessions").insert(workingRows);
    if (!result.error) return;
    const missing = extractMissingColumnName(result.error.message);
    if (!missing || removedColumns.has(missing)) {
      throw new Error(result.error.message);
    }
    removedColumns.add(missing);
    workingRows = workingRows.map((row) => {
      const next = { ...row };
      delete next[missing];
      return next;
    });
  }
}

export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachOrAdminRole(context.role)) {
      return NextResponse.json(
        { success: false, error: "Only coach/admin accounts can import ARX data." },
        { status: 403 },
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "SUPABASE_SERVICE_ROLE_KEY is required for ARX imports." },
        { status: 500 },
      );
    }

    const [membersResult, columnSupport] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id,full_name,role")
        .eq("role", "member")
        .order("full_name", { ascending: true }),
      detectOptionalColumns(supabaseAdmin),
    ]);
    if (membersResult.error) throw new Error(membersResult.error.message);

    const members = (Array.isArray(membersResult.data) ? membersResult.data : []).map((row) => ({
      id: String(row.id || ""),
      full_name: String(row.full_name || "Member"),
    }));
    const missing_columns = REQUIRED_IMPORT_COLUMNS.filter((column) => !columnSupport[column]);
    return NextResponse.json({ success: true, members, missing_columns });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load members.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachOrAdminRole(context.role)) {
      return NextResponse.json(
        { success: false, error: "Only coach/admin accounts can import ARX data." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;
    const action = body.action;
    if (action !== "preview" && action !== "import") {
      return NextResponse.json({ success: false, error: "action must be preview or import." }, { status: 400 });
    }
    const memberId = String(body.member_id || "").trim();
    if (!memberId) {
      return NextResponse.json({ success: false, error: "member_id is required." }, { status: 400 });
    }
    const csvText = String(body.csv_text || "");
    if (!csvText.trim()) {
      return NextResponse.json({ success: false, error: "CSV file content is required." }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "SUPABASE_SERVICE_ROLE_KEY is required for ARX imports." },
        { status: 500 },
      );
    }

    const [memberResult, columnSupport] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id,full_name,role")
        .eq("id", memberId)
        .limit(1),
      detectOptionalColumns(supabaseAdmin),
    ]);
    if (memberResult.error) throw new Error(memberResult.error.message);
    if (!Array.isArray(memberResult.data) || memberResult.data.length === 0) {
      return NextResponse.json({ success: false, error: "Selected member was not found." }, { status: 404 });
    }

    const memberRow = memberResult.data[0] as Record<string, unknown>;
    const member: MemberProfile = {
      id: String(memberRow.id || ""),
      full_name: String(memberRow.full_name || "Member"),
      role: String(memberRow.role || "member"),
    };
    if (member.role.toLowerCase() !== "member") {
      return NextResponse.json({ success: false, error: "Selected user is not a member." }, { status: 400 });
    }

    const prepared = prepareRows(csvText);
    const missing_columns = REQUIRED_IMPORT_COLUMNS.filter((column) => !columnSupport[column]);

    if (action === "preview") {
      return NextResponse.json({
        success: true,
        member: { id: member.id, full_name: member.full_name },
        row_count: prepared.rows.length,
        preview_rows: prepared.preview_rows,
        summary: prepared.summary,
        missing_columns,
      });
    }

    const existingExternalIds = await findExistingExternalIds(
      supabaseAdmin,
      member.id,
      prepared.rows.map((row) => row.external_id),
      columnSupport,
    );
    const importPlan = buildInsertRows(member.id, prepared.rows, existingExternalIds, columnSupport);

    if (importPlan.insert_rows.length > 0) {
      for (let offset = 0; offset < importPlan.insert_rows.length; offset += 250) {
        const chunk = importPlan.insert_rows.slice(offset, offset + 250);
        await insertRowsWithMissingColumnFallback(supabaseAdmin, chunk);
      }
    }

    return NextResponse.json({
      success: true,
      imported_count: importPlan.imported_count,
      skipped_duplicates: importPlan.skipped_duplicates,
      exercise_count: importPlan.exercise_count,
      member: { id: member.id, full_name: member.full_name },
      missing_columns,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to import ARX data.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
