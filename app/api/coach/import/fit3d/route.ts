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
  date_of_birth: string | null;
  gender: string | null;
  height_inches: number | null;
};

type Fit3dPreparedRow = {
  scan_date: string;
  height_in: number | null;
  weight_lbs: number | null;
  body_shape_rating: number | null;
  body_fat_pct: number | null;
  lean_mass_lbs: number | null;
  fat_mass_lbs: number | null;
  neck_in: number | null;
  bust_in: number | null;
  chest_in: number | null;
  waist_in: number | null;
  top_hip_in: number | null;
  hips_in: number | null;
  thigh_left_in: number | null;
  thigh_right_in: number | null;
  calf_left_in: number | null;
  calf_right_in: number | null;
  bicep_left_in: number | null;
  bicep_right_in: number | null;
  bmr: number | null;
  measurements_raw: Record<string, unknown>;
};

function isCoachOrAdminRole(role: string): boolean {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "coach" || normalized === "admin";
}

const FIT3D_HEADERS = [
  "Scan Date",
  "Height",
  "Weight",
  "Body Shape Rating",
  "Body Fat Percent",
  "Lean Mass",
  "Fat Mass",
  "Sbsi",
  "Absi",
  "Trunk To Leg Vol Ratio",
  "Neck",
  "Bust",
  "Chest",
  "Waist",
  "Top Hip",
  "Hips",
  "Thigh Left",
  "Thigh Right",
  "Calf Left",
  "Calf Right",
  "Biceps Left",
  "Biceps Right",
  "Forearm Left",
  "Forearm Right",
  "Wrist Left",
  "Wrist Right",
  "Overarm",
  "Underbust",
  "Waist Max",
  "Belly Max",
  "Waist Natural",
  "Hips Max",
  "Hips At Max Width",
  "Knee Left Two Inches Above",
  "Knee Right Two Inches Above",
  "Knee Left",
  "Knee Right",
  "Chest Width",
  "Waist Width",
  "Hips Width",
  "Total Volume",
  "Torso Volume",
  "Arm Left Volume",
  "Arm Right Volume",
  "Leg Left Volume",
  "Leg Right Volume",
  "Shoulder To Shoulder Length",
  "Armscye Left",
  "Armscye Right",
  "Shoulder Left To Wrist Length",
  "Shoudler Right To Wrist Length",
  "Crotch Height",
  "Inseam Left",
  "Inseam Right",
  "Outseam Left",
  "Outseam Right",
  "Torso Sagittal",
  "U Rise",
  "Center Back Length",
] as const;

const DIRECT_MAPPED_HEADERS = new Set<string>([
  "Scan Date",
  "Height",
  "Weight",
  "Body Shape Rating",
  "Body Fat Percent",
  "Lean Mass",
  "Fat Mass",
  "Neck",
  "Bust",
  "Chest",
  "Waist",
  "Top Hip",
  "Hips",
  "Thigh Left",
  "Thigh Right",
  "Calf Left",
  "Calf Right",
  "Biceps Left",
  "Biceps Right",
]);

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

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function asHeightInches(value: unknown): number | null {
  if (typeof value !== "string") return asNumber(value);
  const raw = value.trim();
  if (!raw) return null;
  const feetInches = raw.match(/^(\d+)\s*'\s*(\d+)$/);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = Number(feetInches[2]);
    if (Number.isFinite(feet) && Number.isFinite(inches)) return feet * 12 + inches;
  }
  return asNumber(raw);
}

function parseScanDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  const match = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i,
  );
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  let hour = Number(match[4] || "0");
  const minute = Number(match[5] || "0");
  const second = Number(match[6] || "0");
  const meridiem = (match[7] || "").toUpperCase();

  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  const isoDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (Number.isNaN(isoDate.getTime())) return null;
  return isoDate.toISOString();
}

function isFemale(gender: string | null): boolean {
  const value = String(gender || "").trim().toLowerCase();
  return value.includes("female") || value === "f" || value.includes("woman");
}

function ageOnDate(dateOfBirth: string | null, atIso: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const at = new Date(atIso);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(at.getTime())) return null;

  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = at.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && at.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  if (!Number.isFinite(age) || age < 0 || age > 120) return null;
  return age;
}

function calculateBmr(params: {
  weightLbs: number | null;
  heightIn: number | null;
  age: number | null;
  female: boolean;
}): number | null {
  const { weightLbs, heightIn, age, female } = params;
  if (weightLbs === null || heightIn === null) return null;
  const effectiveAge = age ?? 35;
  const weightKg = weightLbs * 0.45359237;
  const heightCm = heightIn * 2.54;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * effectiveAge;
  return Number((base + (female ? -161 : 5)).toFixed(1));
}

function toMeasurementValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = asNumber(trimmed);
  if (numeric !== null) return numeric;
  return trimmed;
}

function validateHeaders(headers: string[]): string | null {
  if (headers.length !== FIT3D_HEADERS.length) {
    return `Expected ${FIT3D_HEADERS.length} columns, found ${headers.length}.`;
  }
  for (let index = 0; index < FIT3D_HEADERS.length; index += 1) {
    if (headers[index] !== FIT3D_HEADERS[index]) {
      return `Header mismatch at column ${index + 1}: expected "${FIT3D_HEADERS[index]}", got "${headers[index]}".`;
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

async function insertFit3dRowsWithFallback(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  rows: Array<Record<string, unknown>>,
) {
  if (!supabase) {
    throw new Error("Supabase admin client is not configured.");
  }
  let workingRows = rows.map((row) => ({ ...row }));
  const removedColumns = new Set<string>();

  while (true) {
    const insertResult = await supabase.from("fit3d_scans").insert(workingRows);
    if (!insertResult.error) {
      return;
    }

    const missingColumn = extractMissingColumnName(insertResult.error.message);
    if (!missingColumn || removedColumns.has(missingColumn)) {
      throw new Error(insertResult.error.message);
    }
    removedColumns.add(missingColumn);
    workingRows = workingRows.map((row) => {
      const next = { ...row };
      delete next[missingColumn];
      return next;
    });
  }
}

async function updateUserProteinGoalWithFallback(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  memberId: string,
  proteinGoalGrams: number,
) {
  if (!supabase) return;
  const payload: Record<string, unknown> = {
    protein_goal_g: proteinGoalGrams,
  };

  while (Object.keys(payload).length > 0) {
    const updateResult = await supabase
      .from("users")
      .update(payload)
      .eq("id", memberId);

    if (!updateResult.error) return;

    const missingColumn = extractMissingColumnName(updateResult.error.message);
    if (!missingColumn || !(missingColumn in payload)) return;
    delete payload[missingColumn];
  }
}

function prepareRows(
  csvText: string,
  member: MemberProfile,
): {
  rows: Fit3dPreparedRow[];
  preview: Array<{ scan_date: string; weight_lbs: number | null; body_fat_pct: number | null; lean_mass_lbs: number | null }>;
} {
  const parsed = parseCsv(csvText);
  if (!parsed.length) {
    throw new Error("CSV file is empty.");
  }

  const headers = parsed[0].map((header) => normalizeHeader(header));
  const headerError = validateHeaders(headers);
  if (headerError) {
    throw new Error(`Invalid CSV header row. ${headerError}`);
  }

  const dataRows = parsed.slice(1).filter((row) => row.some((cell) => String(cell || "").trim().length > 0));
  if (!dataRows.length) {
    throw new Error("CSV has no data rows to import.");
  }

  const rows: Fit3dPreparedRow[] = [];
  const preview: Array<{ scan_date: string; weight_lbs: number | null; body_fat_pct: number | null; lean_mass_lbs: number | null }> = [];
  const female = isFemale(member.gender);

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    const values = FIT3D_HEADERS.map((_, headerIndex) => String(row[headerIndex] || "").trim());
    const record = Object.fromEntries(FIT3D_HEADERS.map((header, headerIndex) => [header, values[headerIndex]])) as Record<string, string>;

    const scanDateIso = parseScanDate(record["Scan Date"]);
    if (!scanDateIso) {
      throw new Error(`Invalid Scan Date on CSV row ${index + 2}: "${record["Scan Date"]}".`);
    }

    const heightIn = asHeightInches(record["Height"]) ?? member.height_inches ?? null;
    const weightLbs = asNumber(record["Weight"]);
    const age = ageOnDate(member.date_of_birth, scanDateIso);
    const bmr = calculateBmr({
      weightLbs,
      heightIn,
      age,
      female,
    });

    const measurementsRaw: Record<string, unknown> = {};
    for (const header of FIT3D_HEADERS) {
      if (DIRECT_MAPPED_HEADERS.has(header)) continue;
      measurementsRaw[header] = toMeasurementValue(record[header]);
    }

    const prepared: Fit3dPreparedRow = {
      scan_date: scanDateIso,
      height_in: heightIn,
      weight_lbs: weightLbs,
      body_shape_rating: asNumber(record["Body Shape Rating"]),
      body_fat_pct: asNumber(record["Body Fat Percent"]),
      lean_mass_lbs: asNumber(record["Lean Mass"]),
      fat_mass_lbs: asNumber(record["Fat Mass"]),
      neck_in: asNumber(record["Neck"]),
      bust_in: asNumber(record["Bust"]),
      chest_in: asNumber(record["Chest"]),
      waist_in: asNumber(record["Waist"]),
      top_hip_in: asNumber(record["Top Hip"]),
      hips_in: asNumber(record["Hips"]),
      thigh_left_in: asNumber(record["Thigh Left"]),
      thigh_right_in: asNumber(record["Thigh Right"]),
      calf_left_in: asNumber(record["Calf Left"]),
      calf_right_in: asNumber(record["Calf Right"]),
      bicep_left_in: asNumber(record["Biceps Left"]),
      bicep_right_in: asNumber(record["Biceps Right"]),
      bmr,
      measurements_raw: measurementsRaw,
    };

    rows.push(prepared);
    preview.push({
      scan_date: prepared.scan_date,
      weight_lbs: prepared.weight_lbs,
      body_fat_pct: prepared.body_fat_pct,
      lean_mass_lbs: prepared.lean_mass_lbs,
    });
  }

  return { rows, preview };
}

export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachOrAdminRole(context.role)) {
      return NextResponse.json(
        { success: false, error: "Only coach/admin accounts can import Fit3D data." },
        { status: 403 },
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "SUPABASE_SERVICE_ROLE_KEY is required for Fit3D imports." },
        { status: 500 },
      );
    }
    const client = supabaseAdmin;
    const membersResult = await client
      .from("users")
      .select("id,full_name,role")
      .eq("role", "member")
      .order("full_name", { ascending: true });
    if (membersResult.error) {
      throw new Error(membersResult.error.message);
    }

    const members = (Array.isArray(membersResult.data) ? membersResult.data : []).map((row) => ({
      id: String(row.id || ""),
      full_name: String(row.full_name || "Member"),
    }));

    return NextResponse.json({ success: true, members });
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
        { success: false, error: "Only coach/admin accounts can import Fit3D data." },
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
    const client = supabaseAdmin ?? context.supabase;
    const memberResult = await client
      .from("users")
      .select("id,full_name,role,date_of_birth,gender,height_inches")
      .eq("id", memberId)
      .limit(1);

    if (memberResult.error) throw new Error(memberResult.error.message);
    if (!Array.isArray(memberResult.data) || memberResult.data.length === 0) {
      return NextResponse.json({ success: false, error: "Selected member was not found." }, { status: 404 });
    }

    const member = memberResult.data[0] as Record<string, unknown>;
    const memberProfile: MemberProfile = {
      id: String(member.id || ""),
      full_name: String(member.full_name || "Member"),
      role: String(member.role || "member"),
      date_of_birth: typeof member.date_of_birth === "string" ? member.date_of_birth : null,
      gender: typeof member.gender === "string" ? member.gender : null,
      height_inches: asNumber(member.height_inches),
    };
    if (memberProfile.role.toLowerCase() !== "member") {
      return NextResponse.json({ success: false, error: "Selected user is not a member." }, { status: 400 });
    }

    const prepared = prepareRows(csvText, memberProfile);

    if (action === "preview") {
      return NextResponse.json({
        success: true,
        member: {
          id: memberProfile.id,
          full_name: memberProfile.full_name,
        },
        row_count: prepared.rows.length,
        preview_rows: prepared.preview,
      });
    }

    const rowsToInsert = prepared.rows.map((row) => ({
      member_id: memberProfile.id,
      ...row,
    })) as Array<Record<string, unknown>>;
    await insertFit3dRowsWithFallback(supabaseAdmin, rowsToInsert);

    const latestScan = prepared.rows
      .slice()
      .sort((a, b) => String(b.scan_date).localeCompare(String(a.scan_date)))[0];
    if (latestScan?.lean_mass_lbs !== null && latestScan?.lean_mass_lbs !== undefined) {
      const proteinGoal = Math.max(0, Math.round(Number(latestScan.lean_mass_lbs)));
      await updateUserProteinGoalWithFallback(supabaseAdmin, memberProfile.id, proteinGoal);
    }

    return NextResponse.json({
      success: true,
      imported_count: prepared.rows.length,
      member: {
        id: memberProfile.id,
        full_name: memberProfile.full_name,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to import Fit3D data.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
