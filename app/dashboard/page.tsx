import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardReactClient } from "@/components/dashboard-react-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isClerkConfigured, safeCurrentUser } from "@/lib/server/clerk";
import { loadPrototypeFromFiles } from "@/lib/server/prototype";
import { getCurrentAuthState, routeForRole, type AppRole } from "@/lib/server/roles";

type MemberSection =
  | "dashboard"
  | "protocol"
  | "carol"
  | "arx"
  | "scans"
  | "recovery"
  | "wearables"
  | "messages"
  | "reports"
  | "schedule";

type CoachSection = "morning" | "members" | "messages" | "log" | "protocols";

type RecoveryModality = "cold_plunge" | "infrared_sauna" | "compression_therapy" | "nxpro";

type RecoveryGoals = {
  cold_plunge: number;
  infrared_sauna: number;
  compression_therapy: number;
  nxpro: number;
};

type RecoveryMonthSummary = {
  month: string;
  monthLabel: string;
  protocolName: string;
  goals: RecoveryGoals;
  counts: RecoveryGoals;
  days: Array<{
    date: string;
    modalities: RecoveryModality[];
  }>;
};

type DashboardPayload = {
  role: "member" | "coach";
  memberId: string | null;
  coachId: string | null;
  displayName: string;
  initials: string;
  tier: string;
  metrics: {
    carolFitness: string;
    arxOutput: string;
    leanMass: string;
    whoopRecovery: string;
  };
  healthspan: {
    muscle: string;
    cardio: string;
    metabolic: string;
    structural: string;
    recovery: string;
    overall: string;
  };
  carolHistory: Array<{ label: string; value: string }>;
  carolSessions: Array<{
    sessionDate: string;
    rideNumber: string;
    rideType: string;
    fitnessScore: string;
    peakPowerWatts: string;
    avgSprintPower: string;
    manp: string;
    caloriesInclEpoc: string;
    caloriesActive: string;
    heartRateMax: string;
    heartRateAvg: string;
    durationSeconds: string;
    calories: string;
    maxHr: string;
  }>;
  arxHistory: Array<{ label: string; value: string }>;
  scan: {
    bodyFatPct: string;
    weightLbs: string;
    leanMassLbs: string;
    headForwardIn: string;
    shoulderForwardIn: string;
    hipForwardIn: string;
  };
  recoveryCounts: {
    infraredSauna: string;
    coldPlunge: string;
    nxpro: string;
    compression: string;
    vasper: string;
    katalyst: string;
    proteus: string;
    quickboard: string;
  };
  recoverySummary: RecoveryMonthSummary;
  wearables: {
    whoopRecovery: string;
    ouraReadiness: string;
    hrvMs: string;
    sleepHours: string;
  };
  protocol: {
    name: string;
    weekCurrent: string;
    weekTotal: string;
    sessions: Array<{ name: string; detail: string; duration: string; status: string }>;
  };
  bookings: Array<{ label: string; status: string }>;
  reports: Array<{ title: string }>;
  coach: {
    todayCount: string;
    lowRecoveryCount: string;
    readyCount: string;
    alerts: string[];
    members: Array<{
      id: string;
      name: string;
      initials: string;
      tier: string;
      phoneMissing: boolean;
      recovery: string;
      muscle: string;
      session: string;
    }>;
  };
};

const DEFAULT_RECOVERY_GOALS: RecoveryGoals = {
  cold_plunge: 6,
  infrared_sauna: 8,
  compression_therapy: 4,
  nxpro: 4,
};

const RECOVERY_GOAL_PRESETS: Record<string, RecoveryGoals> = {
  "strength foundation": {
    cold_plunge: 6,
    infrared_sauna: 8,
    compression_therapy: 4,
    nxpro: 4,
  },
  "metabolic reset": {
    cold_plunge: 8,
    infrared_sauna: 8,
    compression_therapy: 6,
    nxpro: 4,
  },
  "cardio focus": {
    cold_plunge: 6,
    infrared_sauna: 8,
    compression_therapy: 6,
    nxpro: 4,
  },
  "longevity protocol": {
    cold_plunge: 8,
    infrared_sauna: 12,
    compression_therapy: 8,
    nxpro: 6,
  },
  "recovery phase": {
    cold_plunge: 4,
    infrared_sauna: 12,
    compression_therapy: 8,
    nxpro: 8,
  },
  "exercise performance": {
    cold_plunge: 8,
    infrared_sauna: 8,
    compression_therapy: 8,
    nxpro: 4,
  },
};

function initialsFromName(name: string): string {
  const parts = String(name || "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "MB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function stringOr(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && `${value}`.trim().length > 0;
}

function formatDateForLabel(value: unknown): string {
  if (typeof value !== "string" || !value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function monthKeyFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabelFromDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function normalizeRecoveryModality(value: unknown): RecoveryModality | null {
  const key = stringOr(value, "").toLowerCase();
  if (!key) return null;
  if (key === "cold_plunge" || key === "cold plunge") return "cold_plunge";
  if (key === "infrared_sauna" || key === "infrared sauna" || key === "sauna") return "infrared_sauna";
  if (key === "compression_therapy" || key === "compression therapy" || key === "compression") return "compression_therapy";
  if (key === "nxpro") return "nxpro";
  return null;
}

function normalizeRecoveryGoals(value: unknown): RecoveryGoals | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;

  const coldPlunge = numberOr(
    row.cold_plunge ?? row.coldPlunge ?? row["cold plunge"] ?? row["cold-plunge"],
    Number.NaN,
  );
  const infraredSauna = numberOr(
    row.infrared_sauna ?? row.infraredSauna ?? row.sauna ?? row["infrared sauna"],
    Number.NaN,
  );
  const compression = numberOr(
    row.compression_therapy ?? row.compressionTherapy ?? row.compression ?? row["compression boots"],
    Number.NaN,
  );
  const nxpro = numberOr(row.nxpro ?? row.nxPro, Number.NaN);

  if (
    !Number.isFinite(coldPlunge) ||
    !Number.isFinite(infraredSauna) ||
    !Number.isFinite(compression) ||
    !Number.isFinite(nxpro)
  ) {
    return null;
  }

  return {
    cold_plunge: Math.max(0, Math.round(coldPlunge)),
    infrared_sauna: Math.max(0, Math.round(infraredSauna)),
    compression_therapy: Math.max(0, Math.round(compression)),
    nxpro: Math.max(0, Math.round(nxpro)),
  };
}

function goalsForProtocol(protocolName: string, overrideGoals: unknown): RecoveryGoals {
  const override = normalizeRecoveryGoals(overrideGoals);
  if (override) return override;

  const normalizedName = protocolName.trim().toLowerCase();
  if (normalizedName && RECOVERY_GOAL_PRESETS[normalizedName]) {
    return RECOVERY_GOAL_PRESETS[normalizedName];
  }
  return DEFAULT_RECOVERY_GOALS;
}

function formatMetricValue(value: unknown, decimals = 0): string {
  if (!hasValue(value)) return "--";
  const numeric = numberOr(value, Number.NaN);
  if (!Number.isFinite(numeric)) return "--";
  if (decimals > 0) return numeric.toFixed(decimals);
  return Math.round(numeric).toString();
}

function extractHealthspanScoreValue(data: unknown): number | null {
  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data === "string") {
    const parsed = Number(data);
    if (Number.isFinite(parsed)) return parsed;
    return null;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const nested = extractHealthspanScoreValue(item);
      if (nested !== null) return nested;
    }
    return null;
  }
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    for (const key of ["calculate_healthspan_score", "healthspan_score", "overall_score", "score", "value"]) {
      const nested = extractHealthspanScoreValue(row[key]);
      if (nested !== null) return nested;
    }
  }
  return null;
}

async function loadCalculatedHealthspanScore(
  supabase: {
    rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> | unknown;
  },
  memberId: string,
): Promise<string | null> {
  const argVariants: Array<Record<string, unknown>> = [
    { member_id: memberId },
    { p_member_id: memberId },
    { member_uuid: memberId },
    {},
  ];

  for (const args of argVariants) {
    const result = (await supabase.rpc("calculate_healthspan_score", args)) as {
      data: unknown;
      error: { message: string } | null;
    };
    if (result.error) continue;
    const score = extractHealthspanScoreValue(result.data);
    if (score !== null) {
      return Number.isInteger(score) ? `${score}` : score.toFixed(1);
    }
  }
  return null;
}

function normalizeMemberSection(input: string | undefined): MemberSection {
  const value = String(input || "").trim().toLowerCase();
  if (
    value === "dashboard" ||
    value === "protocol" ||
    value === "carol" ||
    value === "arx" ||
    value === "scans" ||
    value === "recovery" ||
    value === "wearables" ||
    value === "messages" ||
    value === "reports" ||
    value === "schedule"
  ) {
    return value;
  }
  return "dashboard";
}

function normalizeCoachSection(input: string | undefined): CoachSection {
  const value = String(input || "").trim().toLowerCase();
  if (
    value === "morning" ||
    value === "members" ||
    value === "messages" ||
    value === "log" ||
    value === "protocols"
  ) {
    return value;
  }
  return "morning";
}

function makeDefaultPayload(clerkName: string): DashboardPayload {
  const monthDate = new Date();
  const month = monthKeyFromDate(monthDate);
  const monthLabel = monthLabelFromDate(monthDate);
  return {
    role: "member",
    memberId: null,
    coachId: null,
    displayName: clerkName || "Member",
    initials: initialsFromName(clerkName || "Member"),
    tier: "Member",
    metrics: {
      carolFitness: "--",
      arxOutput: "--",
      leanMass: "--",
      whoopRecovery: "--",
    },
    healthspan: {
      muscle: "--",
      cardio: "--",
      metabolic: "--",
      structural: "--",
      recovery: "--",
      overall: "--",
    },
    carolHistory: [],
    carolSessions: [],
    arxHistory: [],
    scan: {
      bodyFatPct: "--",
      weightLbs: "--",
      leanMassLbs: "--",
      headForwardIn: "--",
      shoulderForwardIn: "--",
      hipForwardIn: "--",
    },
    recoveryCounts: {
      infraredSauna: "0",
      coldPlunge: "0",
      nxpro: "0",
      compression: "0",
      vasper: "0",
      katalyst: "0",
      proteus: "0",
      quickboard: "0",
    },
    recoverySummary: {
      month,
      monthLabel,
      protocolName: "",
      goals: { ...DEFAULT_RECOVERY_GOALS },
      counts: {
        cold_plunge: 0,
        infrared_sauna: 0,
        compression_therapy: 0,
        nxpro: 0,
      },
      days: [],
    },
    wearables: {
      whoopRecovery: "--",
      ouraReadiness: "--",
      hrvMs: "--",
      sleepHours: "--",
    },
    protocol: {
      name: "",
      weekCurrent: "--",
      weekTotal: "--",
      sessions: [],
    },
    bookings: [],
    reports: [],
    coach: {
      todayCount: "0",
      lowRecoveryCount: "0",
      readyCount: "0",
      alerts: [],
      members: [],
    },
  };
}

async function loadPrototypeStyles(): Promise<string> {
  const prototype = await loadPrototypeFromFiles(["iso-club-v2.html"], "Iso Club Dashboard");
  return prototype.styles;
}

async function loadDashboardLiveData(userId: string, authRole: AppRole): Promise<DashboardPayload> {
  const clerkUser = await safeCurrentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const clerkName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser?.username ||
    "Member";

  const payload = makeDefaultPayload(clerkName);
  const supabase = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
  if (!supabase) return payload;

  let userRow: Record<string, unknown> | null = null;
  const byClerk = await supabase.from("users").select("*").eq("clerk_id", userId).limit(1);
  if (!byClerk.error && byClerk.data?.length) {
    userRow = byClerk.data[0] as Record<string, unknown>;
  } else if (email) {
    const byEmail = await supabase.from("users").select("*").eq("email", email).limit(1);
    if (!byEmail.error && byEmail.data?.length) {
      userRow = byEmail.data[0] as Record<string, unknown>;
    }
  }

  const userRole = stringOr(userRow?.role, "").toLowerCase();
  const authRoleValue = String(authRole || "unknown").toLowerCase();
  const isCoach =
    userRole === "coach" ||
    userRole === "admin" ||
    userRole === "staff" ||
    authRoleValue === "coach" ||
    authRoleValue === "admin" ||
    authRoleValue === "staff";

  payload.role = isCoach ? "coach" : "member";
  payload.memberId = stringOr(userRow?.id, "");
  payload.coachId = payload.memberId;
  payload.displayName = stringOr(userRow?.full_name, clerkName);
  payload.initials = initialsFromName(payload.displayName);
  payload.tier = stringOr(userRow?.membership_tier, payload.role === "coach" ? "Head Coach" : "Member");

  const memberId = payload.memberId || "__missing_member__";
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const monthEndIso = monthEnd.toISOString().slice(0, 10);

  const carolPrimarySelect =
    "session_date,ride_number,ride_type,fitness_score,peak_power_watts,avg_sprint_power,manp,calories_incl_epoc,calories_active,heart_rate_max,heart_rate_avg,duration_seconds,calories,max_hr";
  const carolFallbackSelect = "session_date,ride_number,ride_type,fitness_score,peak_power_watts,calories,max_hr";
  let carolRes = (await supabase
    .from("carol_sessions")
    .select(carolPrimarySelect)
    .eq("member_id", memberId)
    .order("session_date", { ascending: false })
    .limit(300)) as unknown as {
    data: unknown;
    error: { message: string } | null;
  };
  if (carolRes.error && /column .* does not exist/i.test(carolRes.error.message || "")) {
    carolRes = (await supabase
      .from("carol_sessions")
      .select(carolFallbackSelect)
      .eq("member_id", memberId)
      .order("session_date", { ascending: false })
      .limit(300)) as unknown as {
      data: unknown;
      error: { message: string } | null;
    };
  }

  const [arxRes, scanRes, whoopRes, ouraRes, healthspanRes, recoveryRes, manualRes, bookingRes, protocolRes, reportRes] =
    await Promise.all([
    supabase
      .from("arx_sessions")
      .select("session_date,exercise,output,concentric_max,eccentric_max")
      .eq("member_id", memberId)
      .order("session_date", { ascending: false })
      .limit(10),
    supabase
      .from("fit3d_scans")
      .select("body_fat_pct,weight_lbs,lean_mass_lbs,posture_head_forward_in,posture_shoulder_forward_in,posture_hip_forward_in")
      .eq("member_id", memberId)
      .order("scan_date", { ascending: false })
      .limit(1),
    supabase
      .from("wearable_data")
      .select("recovery_score,hrv_ms,sleep_duration_hrs")
      .eq("member_id", memberId)
      .ilike("device_type", "%whoop%")
      .order("recorded_date", { ascending: false })
      .limit(1),
    supabase
      .from("wearable_data")
      .select("readiness_score,sleep_duration_hrs")
      .eq("member_id", memberId)
      .ilike("device_type", "%oura%")
      .order("recorded_date", { ascending: false })
      .limit(1),
    supabase
      .from("healthspan_scores")
      .select("muscle_score,cardio_score,metabolic_score,structural_score,recovery_score")
      .eq("member_id", memberId)
      .order("recorded_at", { ascending: false })
      .limit(1),
    supabase
      .from("recovery_sessions")
      .select("modality,session_date")
      .eq("member_id", memberId)
      .gte("session_date", monthStartIso)
      .lt("session_date", monthEndIso),
    supabase
      .from("manual_workout_sessions")
      .select("equipment")
      .eq("member_id", memberId)
      .gte("session_date", monthStartIso)
      .lt("session_date", monthEndIso),
    supabase
      .from("bookings")
      .select("scheduled_at,session_type,title,status")
      .eq("member_id", memberId)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase
      .from("protocols")
      .select("id,name,week_current,week_total,recovery_goals")
      .eq("member_id", memberId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase.from("reports").select("title").eq("member_id", memberId).order("created_at", { ascending: false }).limit(3),
  ]);

  const carolRows = Array.isArray(carolRes.data) ? (carolRes.data as Array<Record<string, unknown>>) : [];
  const arxRows = Array.isArray(arxRes.data) ? (arxRes.data as Array<Record<string, unknown>>) : [];
  const scanRow = Array.isArray(scanRes.data) && scanRes.data.length ? (scanRes.data[0] as Record<string, unknown>) : null;
  const whoopRow = Array.isArray(whoopRes.data) && whoopRes.data.length ? (whoopRes.data[0] as Record<string, unknown>) : null;
  const ouraRow = Array.isArray(ouraRes.data) && ouraRes.data.length ? (ouraRes.data[0] as Record<string, unknown>) : null;
  const healthRow =
    Array.isArray(healthspanRes.data) && healthspanRes.data.length
      ? (healthspanRes.data[0] as Record<string, unknown>)
      : null;
  const recoveryRows = Array.isArray(recoveryRes.data) ? (recoveryRes.data as Array<Record<string, unknown>>) : [];
  const manualRows = Array.isArray(manualRes.data) ? (manualRes.data as Array<Record<string, unknown>>) : [];
  const bookingRows = Array.isArray(bookingRes.data) ? (bookingRes.data as Array<Record<string, unknown>>) : [];
  const protocolRow =
    Array.isArray(protocolRes.data) && protocolRes.data.length
      ? (protocolRes.data[0] as Record<string, unknown>)
      : null;
  const reportRows = Array.isArray(reportRes.data) ? (reportRes.data as Array<Record<string, unknown>>) : [];

  const arxLatest = arxRows[0] ?? null;
  const carolLatest = carolRows[0] ?? null;
  payload.metrics.carolFitness = carolLatest && hasValue(carolLatest.fitness_score) ? numberOr(carolLatest.fitness_score, 0).toFixed(1) : "--";
  payload.metrics.arxOutput =
    arxLatest && (hasValue(arxLatest.concentric_max) || hasValue(arxLatest.output))
      ? Math.round(numberOr(arxLatest.concentric_max, numberOr(arxLatest.output, 0))).toString()
      : "--";
  payload.metrics.leanMass = scanRow && hasValue(scanRow.lean_mass_lbs) ? numberOr(scanRow.lean_mass_lbs, 0).toFixed(1) : "--";
  payload.metrics.whoopRecovery =
    whoopRow && hasValue(whoopRow.recovery_score) ? Math.round(numberOr(whoopRow.recovery_score, 0)).toString() : "--";

  payload.healthspan = {
    muscle: healthRow && hasValue(healthRow.muscle_score) ? Math.round(numberOr(healthRow.muscle_score, 0)).toString() : "--",
    cardio: healthRow && hasValue(healthRow.cardio_score) ? Math.round(numberOr(healthRow.cardio_score, 0)).toString() : "--",
    metabolic:
      healthRow && hasValue(healthRow.metabolic_score) ? Math.round(numberOr(healthRow.metabolic_score, 0)).toString() : "--",
    structural:
      healthRow && hasValue(healthRow.structural_score) ? Math.round(numberOr(healthRow.structural_score, 0)).toString() : "--",
    recovery:
      healthRow && hasValue(healthRow.recovery_score) ? Math.round(numberOr(healthRow.recovery_score, 0)).toString() : "--",
    overall: "--",
  };
  if (payload.memberId) {
    const calculatedHealthspanScore = await loadCalculatedHealthspanScore(
      supabase as unknown as {
        rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> | unknown;
      },
      payload.memberId,
    );
    if (calculatedHealthspanScore) {
      payload.healthspan.overall = calculatedHealthspanScore;
    }
  }

  payload.carolHistory = carolRows.slice(0, 3).map((row) => ({
    label: `${formatDateForLabel(row.session_date)} · Ride #${stringOr(row.ride_number, "—")}`,
    value: numberOr(row.fitness_score, 0).toFixed(1),
  }));
  payload.carolSessions = carolRows.map((row) => ({
    sessionDate: stringOr(row.session_date, ""),
    rideNumber: stringOr(row.ride_number, "—"),
    rideType: stringOr(row.ride_type, "REHIT"),
    fitnessScore: hasValue(row.fitness_score) ? numberOr(row.fitness_score, 0).toFixed(1) : "--",
    peakPowerWatts: formatMetricValue(row.peak_power_watts),
    avgSprintPower: formatMetricValue(row.avg_sprint_power),
    manp: formatMetricValue(row.manp),
    caloriesInclEpoc: hasValue(row.calories_incl_epoc) ? formatMetricValue(row.calories_incl_epoc, 1) : "--",
    caloriesActive: hasValue(row.calories_active) ? formatMetricValue(row.calories_active) : formatMetricValue(row.calories),
    heartRateMax: hasValue(row.heart_rate_max) ? formatMetricValue(row.heart_rate_max) : formatMetricValue(row.max_hr),
    heartRateAvg: formatMetricValue(row.heart_rate_avg),
    durationSeconds: formatMetricValue(row.duration_seconds),
    calories: hasValue(row.calories) ? formatMetricValue(row.calories) : formatMetricValue(row.calories_active),
    maxHr: hasValue(row.max_hr) ? formatMetricValue(row.max_hr) : formatMetricValue(row.heart_rate_max),
  }));
  payload.arxHistory = arxRows.slice(0, 6).map((row) => ({
    label: `${formatDateForLabel(row.session_date)} · ${stringOr(row.exercise, "ARX exercise")}`,
    value: Math.round(numberOr(row.concentric_max, numberOr(row.output, 0))).toString(),
  }));

  payload.scan = {
    bodyFatPct: scanRow && hasValue(scanRow.body_fat_pct) ? numberOr(scanRow.body_fat_pct, 0).toFixed(2) : "--",
    weightLbs: scanRow && hasValue(scanRow.weight_lbs) ? numberOr(scanRow.weight_lbs, 0).toFixed(1) : "--",
    leanMassLbs: scanRow && hasValue(scanRow.lean_mass_lbs) ? numberOr(scanRow.lean_mass_lbs, 0).toFixed(1) : "--",
    headForwardIn:
      scanRow && hasValue(scanRow.posture_head_forward_in) ? numberOr(scanRow.posture_head_forward_in, 0).toFixed(1) : "--",
    shoulderForwardIn:
      scanRow && hasValue(scanRow.posture_shoulder_forward_in) ? numberOr(scanRow.posture_shoulder_forward_in, 0).toFixed(1) : "--",
    hipForwardIn:
      scanRow && hasValue(scanRow.posture_hip_forward_in) ? numberOr(scanRow.posture_hip_forward_in, 0).toFixed(1) : "--",
  };

  const modalityCounts: Record<RecoveryModality, number> = {
    cold_plunge: 0,
    infrared_sauna: 0,
    compression_therapy: 0,
    nxpro: 0,
  };
  const dayModalitiesMap = new Map<string, RecoveryModality[]>();
  for (const row of recoveryRows) {
    const key = normalizeRecoveryModality(row.modality);
    if (!key) continue;
    modalityCounts[key] = (modalityCounts[key] ?? 0) + 1;

    const rawDate = stringOr(row.session_date, "");
    const parsed = rawDate ? new Date(rawDate) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) continue;
    const dayKey = parsed.toISOString().slice(0, 10);
    const existing = dayModalitiesMap.get(dayKey) ?? [];
    existing.push(key);
    dayModalitiesMap.set(dayKey, existing);
  }
  const equipmentCounts: Record<string, number> = {};
  for (const row of manualRows) {
    const key = stringOr(row.equipment, "").toLowerCase();
    if (!key) continue;
    equipmentCounts[key] = (equipmentCounts[key] ?? 0) + 1;
  }
  payload.recoveryCounts = {
    infraredSauna: String(modalityCounts.infrared_sauna ?? 0),
    coldPlunge: String(modalityCounts.cold_plunge ?? 0),
    nxpro: String(modalityCounts.nxpro ?? 0),
    compression: String(modalityCounts.compression_therapy ?? 0),
    vasper: String(equipmentCounts.vasper ?? 0),
    katalyst: String(equipmentCounts.katalyst ?? 0),
    proteus: String(equipmentCounts.proteus ?? 0),
    quickboard: String(equipmentCounts.quickboard ?? 0),
  };
  const protocolName = stringOr(protocolRow?.name, "");
  const recoveryGoals = goalsForProtocol(protocolName, protocolRow?.recovery_goals);
  payload.recoverySummary = {
    month: monthStartIso.slice(0, 7),
    monthLabel: monthLabelFromDate(monthStart),
    protocolName,
    goals: recoveryGoals,
    counts: {
      cold_plunge: modalityCounts.cold_plunge ?? 0,
      infrared_sauna: modalityCounts.infrared_sauna ?? 0,
      compression_therapy: modalityCounts.compression_therapy ?? 0,
      nxpro: modalityCounts.nxpro ?? 0,
    },
    days: Array.from(dayModalitiesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, modalities]) => ({ date, modalities })),
  };

  payload.wearables = {
    whoopRecovery:
      whoopRow && hasValue(whoopRow.recovery_score) ? Math.round(numberOr(whoopRow.recovery_score, 0)).toString() : "--",
    ouraReadiness:
      ouraRow && hasValue(ouraRow.readiness_score) ? Math.round(numberOr(ouraRow.readiness_score, 0)).toString() : "--",
    hrvMs: whoopRow && hasValue(whoopRow.hrv_ms) ? Math.round(numberOr(whoopRow.hrv_ms, 0)).toString() : "--",
    sleepHours:
      whoopRow && hasValue(whoopRow.sleep_duration_hrs)
        ? numberOr(whoopRow.sleep_duration_hrs, 0).toFixed(1)
        : ouraRow && hasValue(ouraRow.sleep_duration_hrs)
          ? numberOr(ouraRow.sleep_duration_hrs, 0).toFixed(1)
          : "--",
  };

  payload.bookings = bookingRows.map((row) => ({
    label: `${formatDateForLabel(row.scheduled_at)} · ${stringOr(row.title, stringOr(row.session_type, "Session"))}`,
    status: stringOr(row.status, "scheduled"),
  }));
  payload.reports = reportRows.map((row) => ({ title: stringOr(row.title, "Report") }));

  if (protocolRow) {
    payload.protocol.name = stringOr(protocolRow.name, "");
    payload.protocol.weekCurrent = Math.round(numberOr(protocolRow.week_current, 1)).toString();
    payload.protocol.weekTotal = Math.round(numberOr(protocolRow.week_total, 12)).toString();
    const protocolId = stringOr(protocolRow.id, "");
    if (protocolId) {
      const sessionsRes = await supabase
        .from("protocol_sessions")
        .select("name,description,duration_minutes,status,order_index")
        .eq("protocol_id", protocolId)
        .order("order_index", { ascending: true })
        .limit(8);
      if (!sessionsRes.error && Array.isArray(sessionsRes.data)) {
        payload.protocol.sessions = (sessionsRes.data as Array<Record<string, unknown>>).map((row) => ({
          name: stringOr(row.name, "Session"),
          detail: stringOr(row.description, ""),
          duration: Math.round(numberOr(row.duration_minutes, 20)).toString(),
          status: stringOr(row.status, "upcoming"),
        }));
      }
    }
  }

  if (payload.role === "coach") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const todaysBookingsRes = await supabase
      .from("bookings")
      .select("member_id,scheduled_at,session_type,title")
      .gte("scheduled_at", todayStart.toISOString())
      .lt("scheduled_at", tomorrowStart.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20);
    const todaysBookings = Array.isArray(todaysBookingsRes.data)
      ? (todaysBookingsRes.data as Array<Record<string, unknown>>)
      : [];
    const memberIds = Array.from(new Set(todaysBookings.map((row) => stringOr(row.member_id, "")).filter(Boolean)));
    const [usersRes, wearableRes, healthRes] = await Promise.all([
      memberIds.length ? supabase.from("users").select("id,full_name,membership_tier,phone").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
      memberIds.length
        ? supabase.from("wearable_data").select("member_id,recovery_score,readiness_score,recorded_date").in("member_id", memberIds).order("recorded_date", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      memberIds.length
        ? supabase.from("healthspan_scores").select("member_id,muscle_score,recorded_at").in("member_id", memberIds).order("recorded_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    const users = Array.isArray(usersRes.data) ? (usersRes.data as Array<Record<string, unknown>>) : [];
    const wearables = Array.isArray(wearableRes.data) ? (wearableRes.data as Array<Record<string, unknown>>) : [];
    const healthRows = Array.isArray(healthRes.data) ? (healthRes.data as Array<Record<string, unknown>>) : [];

    const wearableByMember = new Map<string, Record<string, unknown>>();
    wearables.forEach((row) => {
      const id = stringOr(row.member_id, "");
      if (id && !wearableByMember.has(id)) wearableByMember.set(id, row);
    });
    const healthByMember = new Map<string, Record<string, unknown>>();
    healthRows.forEach((row) => {
      const id = stringOr(row.member_id, "");
      if (id && !healthByMember.has(id)) healthByMember.set(id, row);
    });

    payload.coach.members = users.map((member) => {
      const id = stringOr(member.id, "");
      const booking = todaysBookings.find((item) => stringOr(item.member_id, "") === id);
      const wearable = wearableByMember.get(id);
      const health = healthByMember.get(id);
      const recovery = Math.round(numberOr(wearable?.recovery_score, numberOr(wearable?.readiness_score, 60))).toString();
      return {
        id,
        name: stringOr(member.full_name, "Member"),
        initials: initialsFromName(stringOr(member.full_name, "Member")),
        tier: stringOr(member.membership_tier, "Member"),
        phoneMissing: stringOr(member.phone, "").length === 0,
        recovery,
        muscle: Math.round(numberOr(health?.muscle_score, 70)).toString(),
        session: stringOr(booking?.title, stringOr(booking?.session_type, "Session")),
      };
    });
    payload.coach.todayCount = payload.coach.members.length.toString();
    payload.coach.lowRecoveryCount = payload.coach.members.filter((member) => Number(member.recovery) < 50).length.toString();
    payload.coach.readyCount = payload.coach.members.filter((member) => Number(member.recovery) >= 70).length.toString();
    payload.coach.alerts = payload.coach.members
      .filter((member) => Number(member.recovery) < 50)
      .slice(0, 3)
      .map((member) => `⚠ ${member.name} — recovery ${member.recovery}.`);
  }

  return payload;
}

export async function DashboardPageView({
  route,
  initialSection,
}: {
  route: "dashboard" | "coach";
  initialSection?: string;
}) {
  const clerkConfigured = isClerkConfigured();
  const styles = await loadPrototypeStyles();
  const initialMemberView = normalizeMemberSection(route === "dashboard" ? initialSection : undefined);
  const initialCoachView = normalizeCoachSection(route === "coach" ? initialSection : undefined);

  if (!clerkConfigured) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Authentication not configured</h1>
          <p className="muted">
            Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> in Vercel, then redeploy.
          </p>
          <Link className="btn" href="/">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const authState = await getCurrentAuthState();
  if (!authState.isAuthenticated || !authState.userId) {
    redirect("/sign-in");
  }

  if (route === "dashboard") {
    if (authState.role !== "member") redirect(routeForRole(authState.role));
    if (!authState.onboardingComplete) redirect("/onboarding");
  } else {
    if (authState.role === "member" || authState.role === "unknown") redirect(routeForRole(authState.role));
    if (authState.role === "staff" && initialCoachView === "morning") redirect("/coach/log");
  }

  const payload = await loadDashboardLiveData(authState.userId, authState.role);
  const uiRole = authState.role === "member" ? "member" : "coach";

  return (
    <>
      <style>{styles}</style>
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(30,43,27,0.9)",
          border: "1px solid rgba(175,189,165,0.22)",
          borderRadius: 999,
          padding: "6px 10px",
          backdropFilter: "blur(2px)",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#afbda5",
            textDecoration: "none",
            fontSize: 12,
            letterSpacing: "0.04em",
          }}
        >
          Back
        </Link>
        <div style={{ width: 1, height: 14, background: "rgba(175,189,165,0.25)" }} />
        {clerkConfigured ? <UserButton /> : null}
      </div>

      <DashboardReactClient
        payload={payload}
        role={uiRole}
        route={route}
        initialMemberView={initialMemberView}
        initialCoachView={initialCoachView}
      />
    </>
  );
}

export default async function DashboardPage() {
  return <DashboardPageView route="dashboard" />;
}
