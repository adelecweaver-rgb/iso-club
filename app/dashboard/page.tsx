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
  | "schedule"
  | "goals";

type CoachSection = "morning" | "members" | "messages" | "log" | "protocols";

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
  };
  carolHistory: Array<{ label: string; value: string }>;
  carolSessions: Array<{
    sessionDate: string;
    rideType: string;
    peakPowerWatts: string;
    manp: string;
    avgSprintPower: string;
    caloriesInclEpoc: string;
    heartRateMax: string;
    sequentialNumber: string;
  }>;
  arxHistory: Array<{ label: string; value: string }>;
  vitalityAge: {
    estimated: number | null;
    chronological: number | null;
    difference: number | null;
    trend: number | null;
    hasEnoughData: boolean;
  };
  wins: Array<{ label: string; isMilestone: boolean; icon: string }>;
  goalDetails: {
    gain_muscle: { sinceJoining: string; sinceJoiningDir: "up" | "down" | "none"; thisMonth: string; thisMonthDir: "up" | "down" | "none"; status: string; statusLabel: string; encouragement: string | null };
    lose_fat: { sinceJoining: string; sinceJoiningDir: "up" | "down" | "none"; thisMonth: string; thisMonthDir: "up" | "down" | "none"; status: string; statusLabel: string; encouragement: string | null };
    improve_cardio: { sinceJoining: string; sinceJoiningDir: "up" | "down" | "none"; thisMonth: string; thisMonthDir: "up" | "down" | "none"; status: string; statusLabel: string; encouragement: string | null };
    attendance: { sinceJoining: string; sinceJoiningDir: "up" | "down" | "none"; thisMonth: string; thisMonthDir: "up" | "down" | "none"; status: string; statusLabel: string; encouragement: string | null };
  };
  sessionNote: { text: string; date: string; coachName: string } | null;
  coachAtRisk: Array<{ id: string; name: string; reasons: string[]; recovery: string }>;
  memberSince: string;
  bonusActivitiesThisWeek: number;
  todaysPlan: {
    hasProtocol: boolean;
    protocolName: string;
    dayName: string;
    dayTheme: string;
    dayDescription: string;
    isRestDay: boolean;
    activities: Array<{
      id: string; order: number; type: string; name: string; durationMinutes: number;
      description: string; whyItMatters: string; steps: string[];
      isBookable: boolean; bookingUrl: string | null;
      isOptional: boolean; alternativeActivity: string | null;
    }>;
    totalMinutes: number;
    sessionsThisWeek: number;
  } | null;
  longestStreakWeeks: number;
  milestones: Array<{ dateLabel: string; icon: string; label: string }>;
  arxSessions: Array<{
    sessionDate: string;
    exercise: string;
    output: number | null;
    concentricMax: number | null;
    eccentricMax: number | null;
  }>;
  scan: {
    scanDate: string;
    bodyFatPct: string;
    weightLbs: string;
    leanMassLbs: string;
    fatMassLbs: string;
    bodyShapeRating: string;
    waistIn: string;
    hipsIn: string;
    headForwardIn: string;
    shoulderForwardIn: string;
    hipForwardIn: string;
  };
  scanHistory: Array<{
    scanDate: string;
    bodyFatPct: string;
    weightLbs: string;
    leanMassLbs: string;
    fatMassLbs: string;
    bodyShapeRating: string;
    waistIn: string;
    hipsIn: string;
    bodyFatPctRaw: number | null;
    weightLbsRaw: number | null;
    leanMassLbsRaw: number | null;
    fatMassLbsRaw: number | null;
    bodyShapeRatingRaw: number | null;
    waistInRaw: number | null;
    hipsInRaw: number | null;
  }>;
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
    id: string;
    targetSystem: string;
    arxPerWeek: number;
    carolPerWeek: number;
    recoveryPerMonth: number;
    carolRideTypes: string[];
    arxExercises: string[];
    coachNotes: string;
    customizationNotes: string;
    startDate: string;
    compliance: { arxThisWeek: number; carolThisWeek: number; recoveryThisMonth: number };
  };
  checklistCompletions: {
    arxWeekDates: string[];
    carolWeekTypes: string[];
    recoveryWeekModalities: string[];
    arxTodayLogged: boolean;
    carolTodayTypes: string[];
    recoveryTodayModalities: string[];
    todayDate: string;
    weekStartDate: string;
  };
  bookings: Array<{ label: string; status: string }>;
  reports: Array<{ title: string }>;
  goals: {
    activeGoals: string[];
    progress: {
      gain_muscle: { status: string; display: string; direction: "positive" | "neutral" | "negative" | "no_data"; current?: number; target?: number };
      lose_fat: { status: string; display: string; direction: "positive" | "neutral" | "negative" | "no_data"; current?: number; target?: number };
      improve_cardio: { status: string; display: string; direction: "positive" | "neutral" | "negative" | "no_data"; current?: number; target?: number };
      attendance: { status: string; display: string; direction: "positive" | "neutral" | "negative" | "no_data"; current: number; target: number };
    };
  };
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
    value === "schedule" ||
    value === "goals"
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
    },
    carolHistory: [],
    carolSessions: [],
    arxHistory: [],
    arxSessions: [],
    vitalityAge: { estimated: null, chronological: null, difference: null, trend: null, hasEnoughData: false },
    wins: [],
    goalDetails: {
      gain_muscle: { sinceJoining: "--", sinceJoiningDir: "none", thisMonth: "--", thisMonthDir: "none", status: "no_data", statusLabel: "No data", encouragement: null },
      lose_fat: { sinceJoining: "--", sinceJoiningDir: "none", thisMonth: "--", thisMonthDir: "none", status: "no_data", statusLabel: "No data", encouragement: null },
      improve_cardio: { sinceJoining: "--", sinceJoiningDir: "none", thisMonth: "--", thisMonthDir: "none", status: "no_data", statusLabel: "No data", encouragement: null },
      attendance: { sinceJoining: "--", sinceJoiningDir: "none", thisMonth: "--", thisMonthDir: "none", status: "no_data", statusLabel: "No data", encouragement: null },
    },
    sessionNote: null,
    coachAtRisk: [],
    memberSince: "",
    bonusActivitiesThisWeek: 0,
    todaysPlan: null,
    longestStreakWeeks: 0,
    milestones: [],
    scan: {
      scanDate: "",
      bodyFatPct: "--",
      weightLbs: "--",
      leanMassLbs: "--",
      fatMassLbs: "--",
      bodyShapeRating: "--",
      waistIn: "--",
      hipsIn: "--",
      headForwardIn: "--",
      shoulderForwardIn: "--",
      hipForwardIn: "--",
    },
    scanHistory: [],
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
      id: "",
      targetSystem: "",
      arxPerWeek: 0,
      carolPerWeek: 0,
      recoveryPerMonth: 0,
      carolRideTypes: [],
      arxExercises: [],
      coachNotes: "",
      customizationNotes: "",
      startDate: "",
      compliance: { arxThisWeek: 0, carolThisWeek: 0, recoveryThisMonth: 0 },
    },
    bookings: [],
    reports: [],
    goals: {
      activeGoals: [],
      progress: {
        gain_muscle: { status: "no_data", display: "Complete a body scan to track progress.", direction: "no_data" },
        lose_fat: { status: "no_data", display: "Complete a body scan to track progress.", direction: "no_data" },
        improve_cardio: { status: "no_data", display: "Log CAROL sessions to track progress.", direction: "no_data" },
        attendance: { status: "no_data", display: "No protocol assigned.", direction: "no_data", current: 0, target: 0 },
      },
    },
    checklistCompletions: {
      arxWeekDates: [],
      carolWeekTypes: [],
      recoveryWeekModalities: [],
      arxTodayLogged: false,
      carolTodayTypes: [],
      recoveryTodayModalities: [],
      todayDate: new Date().toISOString().slice(0, 10),
      weekStartDate: new Date().toISOString().slice(0, 10),
    },
    coach: {
      todayCount: "0",
      lowRecoveryCount: "0",
      readyCount: "0",
      alerts: [],
      members: [],
    },
  };
}

export async function loadPrototypeStyles(): Promise<string> {
  const prototype = await loadPrototypeFromFiles(["iso-club-v2.html"], "Iso Club Dashboard");
  return prototype.styles;
}

export async function loadDashboardLiveData(userId: string, authRole: AppRole): Promise<DashboardPayload> {
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

  const [
    carolRes,
    arxRes,
    scanRes,
    whoopRes,
    ouraRes,
    healthspanRes,
    recoveryRes,
    manualRes,
    bookingRes,
    protocolRes,
    reportRes,
    carolCountRes,
    arxCountRes,
    recoveryCountRes,
    sessionNoteRes,
  ] = await Promise.all([
    supabase
      .from("carol_sessions")
      .select("session_date,ride_number,ride_type,fitness_score,octane_score,peak_power_watts,calories,max_hr,manp,avg_sprint_power,calories_incl_epoc,heart_rate_max,sequential_number")
      .eq("member_id", memberId)
      .order("session_date", { ascending: false })
      .limit(60),
    supabase
      .from("arx_sessions")
      .select("session_date,exercise,output,concentric_max,eccentric_max")
      .eq("member_id", memberId)
      .order("session_date", { ascending: false })
      .limit(1200),
    supabase
      .from("fit3d_scans")
      .select("scan_date,body_fat_pct,weight_lbs,lean_mass_lbs,fat_mass_lbs,body_shape_rating,waist_in,hips_in,posture_head_forward_in,posture_shoulder_forward_in,posture_hip_forward_in")
      .eq("member_id", memberId)
      .order("scan_date", { ascending: false })
      .limit(120),
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
      .select("session_date,modality")
      .eq("member_id", memberId)
      .gte("session_date", monthStartIso)
      .lt("session_date", monthEndIso),
    supabase
      .from("manual_workout_sessions")
      .select("equipment,is_bonus,session_date")
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
    // Try new assignment system first; fall back to old per-member protocols table
    (async () => {
      const newRes = await supabase
        .from("member_protocols")
        .select("id,start_date,coach_notes,protocols(id,name,description,target_system,arx_frequency_per_week,carol_frequency_per_week,recovery_target_per_month,carol_ride_types,arx_exercises,notes)")
        .eq("member_id", memberId)
        .eq("status", "active")
        .order("assigned_at", { ascending: false })
        .limit(1);
      if (!newRes.error) return newRes;
      return supabase
        .from("protocols")
        .select("id,name,week_current,week_total")
        .eq("member_id", memberId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1);
    })(),
    supabase.from("reports").select("title").eq("member_id", memberId).order("created_at", { ascending: false }).limit(3),
    supabase.from("carol_sessions").select("id", { count: "exact", head: true }).eq("member_id", memberId),
    supabase.from("arx_sessions").select("id", { count: "exact", head: true }).eq("member_id", memberId),
    supabase.from("recovery_sessions").select("id", { count: "exact", head: true }).eq("member_id", memberId),
    supabase.from("session_notes").select("note,created_at,coach_id").eq("member_id", memberId).order("created_at", { ascending: false }).limit(1),
  ]);

  const carolRows = Array.isArray(carolRes.data) ? (carolRes.data as Array<Record<string, unknown>>) : [];
  const arxRows = Array.isArray(arxRes.data) ? (arxRes.data as Array<Record<string, unknown>>) : [];
  const scanRows = Array.isArray(scanRes.data) ? (scanRes.data as Array<Record<string, unknown>>) : [];
  const scanRow = scanRows.length ? (scanRows[0] as Record<string, unknown>) : null;
  const whoopRow = Array.isArray(whoopRes.data) && whoopRes.data.length ? (whoopRes.data[0] as Record<string, unknown>) : null;
  const ouraRow = Array.isArray(ouraRes.data) && ouraRes.data.length ? (ouraRes.data[0] as Record<string, unknown>) : null;
  const healthRow =
    Array.isArray(healthspanRes.data) && healthspanRes.data.length
      ? (healthspanRes.data[0] as Record<string, unknown>)
      : null;
  const recoveryRows = Array.isArray(recoveryRes.data) ? (recoveryRes.data as Array<Record<string, unknown>>) : [];
  const manualRows = Array.isArray(manualRes.data) ? (manualRes.data as Array<Record<string, unknown>>) : [];
  const bookingRows = Array.isArray(bookingRes.data) ? (bookingRes.data as Array<Record<string, unknown>>) : [];
  const reportRows = Array.isArray(reportRes.data) ? (reportRes.data as Array<Record<string, unknown>>) : [];

  const arxLatest = arxRows[0] ?? null;
  const carolFitnessRow = carolRows.find(
    (row) => hasValue(row.manp) || hasValue(row.fitness_score) || hasValue(row.octane_score),
  );
  payload.metrics.carolFitness = carolFitnessRow
    ? Math.round(
        numberOr(
          hasValue(carolFitnessRow.manp)
            ? carolFitnessRow.manp
            : hasValue(carolFitnessRow.fitness_score)
              ? carolFitnessRow.fitness_score
              : carolFitnessRow.octane_score,
          0,
        ),
      ).toString()
    : "--";
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
  };

  payload.carolHistory = carolRows.slice(0, 3).map((row) => ({
    label: `${formatDateForLabel(row.session_date)} · Ride #${stringOr(row.sequential_number, "") || stringOr(row.ride_number, "—")}`,
    value: hasValue(row.manp)
      ? Math.round(numberOr(row.manp, 0)).toString()
      : hasValue(row.fitness_score)
        ? Math.round(numberOr(row.fitness_score, 0)).toString()
        : hasValue(row.octane_score)
          ? Math.round(numberOr(row.octane_score, 0)).toString()
          : "--",
  }));
  payload.carolSessions = carolRows.map((row) => ({
    sessionDate: stringOr(row.session_date, ""),
    rideType: stringOr(row.ride_type, "REHIT"),
    peakPowerWatts: hasValue(row.peak_power_watts) ? Math.round(numberOr(row.peak_power_watts, 0)).toString() : "--",
    manp: hasValue(row.manp)
      ? Math.round(numberOr(row.manp, 0)).toString()
      : hasValue(row.fitness_score)
        ? Math.round(numberOr(row.fitness_score, 0)).toString()
        : "--",
    avgSprintPower: hasValue(row.avg_sprint_power) ? Math.round(numberOr(row.avg_sprint_power, 0)).toString() : "--",
    caloriesInclEpoc: hasValue(row.calories_incl_epoc)
      ? Math.round(numberOr(row.calories_incl_epoc, 0)).toString()
      : hasValue(row.calories)
        ? Math.round(numberOr(row.calories, 0)).toString()
        : "--",
    heartRateMax: hasValue(row.heart_rate_max)
      ? Math.round(numberOr(row.heart_rate_max, 0)).toString()
      : hasValue(row.max_hr)
        ? Math.round(numberOr(row.max_hr, 0)).toString()
        : "--",
    sequentialNumber: stringOr(row.sequential_number, "") || stringOr(row.ride_number, "—"),
  }));
  payload.arxHistory = arxRows.map((row) => ({
    label: `${formatDateForLabel(row.session_date)} · ${stringOr(row.exercise, "ARX exercise")}`,
    value: Math.round(numberOr(row.concentric_max, numberOr(row.output, 0))).toString(),
  }));
  payload.arxSessions = arxRows.map((row) => ({
    sessionDate: stringOr(row.session_date, ""),
    exercise: stringOr(row.exercise, "ARX exercise"),
    output: hasValue(row.output) ? numberOr(row.output, 0) : null,
    concentricMax: hasValue(row.concentric_max) ? numberOr(row.concentric_max, 0) : null,
    eccentricMax: hasValue(row.eccentric_max) ? numberOr(row.eccentric_max, 0) : null,
  }));

  payload.scan = {
    scanDate: scanRow ? formatDateForLabel(scanRow.scan_date) : "",
    bodyFatPct: scanRow && hasValue(scanRow.body_fat_pct) ? numberOr(scanRow.body_fat_pct, 0).toFixed(1) : "--",
    weightLbs: scanRow && hasValue(scanRow.weight_lbs) ? numberOr(scanRow.weight_lbs, 0).toFixed(1) : "--",
    leanMassLbs: scanRow && hasValue(scanRow.lean_mass_lbs) ? numberOr(scanRow.lean_mass_lbs, 0).toFixed(1) : "--",
    fatMassLbs: scanRow && hasValue(scanRow.fat_mass_lbs) ? numberOr(scanRow.fat_mass_lbs, 0).toFixed(1) : "--",
    bodyShapeRating: scanRow && hasValue(scanRow.body_shape_rating) ? numberOr(scanRow.body_shape_rating, 0).toFixed(1) : "--",
    waistIn: scanRow && hasValue(scanRow.waist_in) ? numberOr(scanRow.waist_in, 0).toFixed(1) : "--",
    hipsIn: scanRow && hasValue(scanRow.hips_in) ? numberOr(scanRow.hips_in, 0).toFixed(1) : "--",
    headForwardIn:
      scanRow && hasValue(scanRow.posture_head_forward_in) ? numberOr(scanRow.posture_head_forward_in, 0).toFixed(1) : "--",
    shoulderForwardIn:
      scanRow && hasValue(scanRow.posture_shoulder_forward_in) ? numberOr(scanRow.posture_shoulder_forward_in, 0).toFixed(1) : "--",
    hipForwardIn:
      scanRow && hasValue(scanRow.posture_hip_forward_in) ? numberOr(scanRow.posture_hip_forward_in, 0).toFixed(1) : "--",
  };
  payload.scanHistory = scanRows.map((row) => ({
    scanDate: formatDateForLabel(row.scan_date),
    bodyFatPct: hasValue(row.body_fat_pct) ? numberOr(row.body_fat_pct, 0).toFixed(1) : "--",
    weightLbs: hasValue(row.weight_lbs) ? numberOr(row.weight_lbs, 0).toFixed(1) : "--",
    leanMassLbs: hasValue(row.lean_mass_lbs) ? numberOr(row.lean_mass_lbs, 0).toFixed(1) : "--",
    fatMassLbs: hasValue(row.fat_mass_lbs) ? numberOr(row.fat_mass_lbs, 0).toFixed(1) : "--",
    bodyShapeRating: hasValue(row.body_shape_rating) ? numberOr(row.body_shape_rating, 0).toFixed(1) : "--",
    waistIn: hasValue(row.waist_in) ? numberOr(row.waist_in, 0).toFixed(1) : "--",
    hipsIn: hasValue(row.hips_in) ? numberOr(row.hips_in, 0).toFixed(1) : "--",
    bodyFatPctRaw: hasValue(row.body_fat_pct) ? numberOr(row.body_fat_pct, 0) : null,
    weightLbsRaw: hasValue(row.weight_lbs) ? numberOr(row.weight_lbs, 0) : null,
    leanMassLbsRaw: hasValue(row.lean_mass_lbs) ? numberOr(row.lean_mass_lbs, 0) : null,
    fatMassLbsRaw: hasValue(row.fat_mass_lbs) ? numberOr(row.fat_mass_lbs, 0) : null,
    bodyShapeRatingRaw: hasValue(row.body_shape_rating) ? numberOr(row.body_shape_rating, 0) : null,
    waistInRaw: hasValue(row.waist_in) ? numberOr(row.waist_in, 0) : null,
    hipsInRaw: hasValue(row.hips_in) ? numberOr(row.hips_in, 0) : null,
  }));

  const modalityCounts: Record<string, number> = {};
  for (const row of recoveryRows) {
    const key = stringOr(row.modality, "").toLowerCase();
    if (!key) continue;
    modalityCounts[key] = (modalityCounts[key] ?? 0) + 1;
  }
  const equipmentCounts: Record<string, number> = {};
  for (const row of manualRows) {
    const key = stringOr(row.equipment, "").toLowerCase();
    if (!key) continue;
    equipmentCounts[key] = (equipmentCounts[key] ?? 0) + 1;
  }
  payload.recoveryCounts = {
    infraredSauna: String((modalityCounts.infrared_sauna ?? 0) + (modalityCounts["infrared sauna"] ?? 0)),
    coldPlunge: String((modalityCounts.cold_plunge ?? 0) + (modalityCounts["cold plunge"] ?? 0)),
    nxpro: String(modalityCounts.nxpro ?? 0),
    compression: String((modalityCounts.compression_therapy ?? 0) + (modalityCounts.compression ?? 0)),
    vasper: String(equipmentCounts.vasper ?? 0),
    katalyst: String(equipmentCounts.katalyst ?? 0),
    proteus: String(equipmentCounts.proteus ?? 0),
    quickboard: String(equipmentCounts.quickboard ?? 0),
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

  // Compliance: current week (Monday-based) and current month
  const todayDate = new Date();
  const daysFromMonday = todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1;
  const weekStartDate = new Date(todayDate);
  weekStartDate.setDate(todayDate.getDate() - daysFromMonday);
  weekStartDate.setHours(0, 0, 0, 0);
  const weekStartIso = weekStartDate.toISOString().slice(0, 10);
  const arxDatesThisWeek = new Set(
    arxRows
      .filter((row) => stringOr(row.session_date, "").slice(0, 10) >= weekStartIso)
      .map((row) => stringOr(row.session_date, "").slice(0, 10)),
  );
  const carolThisWeek = carolRows.filter((row) => stringOr(row.session_date, "").slice(0, 10) >= weekStartIso).length;
  payload.protocol.compliance = {
    arxThisWeek: arxDatesThisWeek.size,
    carolThisWeek,
    recoveryThisMonth: recoveryRows.length,
  };
  payload.bonusActivitiesThisWeek = manualRows.filter(
    (row) => (row.is_bonus as boolean) === true && stringOr(row.session_date, "").slice(0, 10) >= weekStartIso,
  ).length;

  const todayIso = todayDate.toISOString().slice(0, 10);
  const arxWeekDates = arxRows
    .filter((row) => stringOr(row.session_date, "").slice(0, 10) >= weekStartIso)
    .map((row) => stringOr(row.session_date, "").slice(0, 10));
  const carolWeekRows = carolRows.filter((row) => stringOr(row.session_date, "").slice(0, 10) >= weekStartIso);
  const recoveryWeekRows = recoveryRows.filter((row) => stringOr(row.session_date, "").slice(0, 10) >= weekStartIso);
  payload.checklistCompletions = {
    arxWeekDates,
    carolWeekTypes: carolWeekRows.map((row) => stringOr(row.ride_type, "")),
    recoveryWeekModalities: recoveryWeekRows.map((row) => stringOr(row.modality, "")),
    arxTodayLogged: arxWeekDates.includes(todayIso),
    carolTodayTypes: carolRows
      .filter((row) => stringOr(row.session_date, "").slice(0, 10) === todayIso)
      .map((row) => stringOr(row.ride_type, "")),
    recoveryTodayModalities: recoveryRows
      .filter((row) => stringOr(row.session_date, "").slice(0, 10) === todayIso)
      .map((row) => stringOr(row.modality, "")),
    todayDate: todayIso,
    weekStartDate: weekStartIso,
  };
  if (payload.todaysPlan) {
    payload.todaysPlan.sessionsThisWeek = arxDatesThisWeek.size + carolThisWeek + recoveryWeekRows.length;
  }

  // ─── Goal progress ───────────────────────────────────────────────────────────
  // member_goals query (after main Promise.all to avoid blocking)
  const goalsRes = await supabase.from("member_goals").select("goal_type,is_active").eq("member_id", memberId);
  const activeGoals = (Array.isArray(goalsRes.data) ? (goalsRes.data as Array<Record<string, unknown>>) : [])
    .filter((g) => g.is_active !== false)
    .map((g) => stringOr(g.goal_type, ""))
    .filter(Boolean);
  payload.goals.activeGoals = activeGoals;

  // gain_muscle: compare last two scan lean_mass_lbs
  const lean0 = scanRows.length >= 1 && hasValue(scanRows[0].lean_mass_lbs) ? numberOr(scanRows[0].lean_mass_lbs, 0) : null;
  const lean1 = scanRows.length >= 2 && hasValue(scanRows[1].lean_mass_lbs) ? numberOr(scanRows[1].lean_mass_lbs, 0) : null;
  if (lean0 !== null && lean1 !== null) {
    const diff = lean0 - lean1;
    const sign = diff >= 0 ? "+" : "";
    if (diff > 0.5) payload.goals.progress.gain_muscle = { status: "gaining", display: `Lean mass: ${sign}${diff.toFixed(1)} lbs since last scan`, direction: "positive" };
    else if (diff < -0.5) payload.goals.progress.gain_muscle = { status: "losing", display: `Lean mass: ${diff.toFixed(1)} lbs since last scan`, direction: "negative" };
    else payload.goals.progress.gain_muscle = { status: "maintaining", display: `Lean mass: ${sign}${diff.toFixed(1)} lbs since last scan`, direction: "neutral" };
  }

  // lose_fat: compare last two scan body_fat_pct
  const fat0 = scanRows.length >= 1 && hasValue(scanRows[0].body_fat_pct) ? numberOr(scanRows[0].body_fat_pct, 0) : null;
  const fat1 = scanRows.length >= 2 && hasValue(scanRows[1].body_fat_pct) ? numberOr(scanRows[1].body_fat_pct, 0) : null;
  if (fat0 !== null && fat1 !== null) {
    const diff = fat0 - fat1;
    const sign = diff >= 0 ? "+" : "";
    if (diff < -0.2) payload.goals.progress.lose_fat = { status: "improving", display: `Body fat: ${diff.toFixed(1)}% since last scan`, direction: "positive" };
    else if (diff > 0.2) payload.goals.progress.lose_fat = { status: "increasing", display: `Body fat: ${sign}${diff.toFixed(1)}% since last scan`, direction: "negative" };
    else payload.goals.progress.lose_fat = { status: "maintaining", display: `Body fat: ${sign}${diff.toFixed(1)}% since last scan`, direction: "neutral" };
  }

  // improve_cardio: last-30-days vs prior-30-days MANP (or peak_power_watts fallback)
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sixtyDaysAgoIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const getCardioVal = (row: Record<string, unknown>) =>
    hasValue(row.manp) ? numberOr(row.manp, 0) : hasValue(row.peak_power_watts) ? numberOr(row.peak_power_watts, 0) : null;
  const recentVals = carolRows.filter((r) => stringOr(r.session_date, "").slice(0, 10) >= thirtyDaysAgoIso).map(getCardioVal).filter((v): v is number => v !== null);
  const priorVals = carolRows.filter((r) => { const d = stringOr(r.session_date, "").slice(0, 10); return d >= sixtyDaysAgoIso && d < thirtyDaysAgoIso; }).map(getCardioVal).filter((v): v is number => v !== null);
  if (recentVals.length >= 2 && priorVals.length >= 1) {
    const recentAvg = recentVals.reduce((a, b) => a + b, 0) / recentVals.length;
    const priorAvg = priorVals.reduce((a, b) => a + b, 0) / priorVals.length;
    const pctChange = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;
    const sign = pctChange >= 0 ? "+" : "";
    if (pctChange > 2) payload.goals.progress.improve_cardio = { status: "improving", display: `Cardio power: ${sign}${pctChange.toFixed(0)}% over last 30 days`, direction: "positive" };
    else if (pctChange < -2) payload.goals.progress.improve_cardio = { status: "declining", display: `Cardio power: ${pctChange.toFixed(0)}% over last 30 days`, direction: "negative" };
    else payload.goals.progress.improve_cardio = { status: "maintaining", display: `Cardio power: ${sign}${pctChange.toFixed(0)}% over last 30 days`, direction: "neutral" };
  } else if (recentVals.length >= 1) {
    payload.goals.progress.improve_cardio = { status: "no_data", display: "Need more sessions to compare periods.", direction: "no_data" };
  }

  // attendance: sessions this month vs protocol target
  const arxMonthCount = arxRows.filter((r) => stringOr(r.session_date, "").slice(0, 10) >= monthStartIso).length;
  const carolMonthCount = carolRows.filter((r) => stringOr(r.session_date, "").slice(0, 10) >= monthStartIso).length;
  const recoveryMonthCount = recoveryRows.length;
  const totalThisMonth = arxMonthCount + carolMonthCount + recoveryMonthCount;

  const protocolRow =
    Array.isArray(protocolRes.data) && protocolRes.data.length
      ? (protocolRes.data[0] as Record<string, unknown>)
      : null;
  const protocolLib = protocolRow ? (protocolRow.protocols as Record<string, unknown> | null | undefined) : null;

  if (protocolLib) {
    // New-style: member_protocols → protocols library
    payload.protocol.id = stringOr(protocolLib.id, "");
    payload.protocol.name = stringOr(protocolLib.name, "");
    payload.protocol.targetSystem = stringOr(protocolLib.target_system, "");
    payload.protocol.arxPerWeek = Math.round(numberOr(protocolLib.arx_frequency_per_week, 0));
    payload.protocol.carolPerWeek = Math.round(numberOr(protocolLib.carol_frequency_per_week, 0));
    payload.protocol.recoveryPerMonth = Math.round(numberOr(protocolLib.recovery_target_per_month, 0));
    payload.protocol.carolRideTypes = Array.isArray(protocolLib.carol_ride_types) ? (protocolLib.carol_ride_types as string[]) : [];
    payload.protocol.arxExercises = Array.isArray(protocolLib.arx_exercises) ? (protocolLib.arx_exercises as string[]) : [];
    payload.protocol.coachNotes = stringOr(protocolRow!.coach_notes, "");
    payload.protocol.startDate = stringOr(protocolRow!.start_date, "");
    // Fetch customization_notes separately — column may not exist if migration hasn't run
    try {
      const cnRes = await supabase.from("member_protocols").select("customization_notes").eq("id", stringOr(protocolRow!.id, "")).limit(1);
      if (!cnRes.error && cnRes.data?.length) {
        payload.protocol.customizationNotes = stringOr((cnRes.data[0] as Record<string, unknown>).customization_notes, "");
      }
    } catch { /* column may not exist */ }
  } else if (protocolRow) {
    // Legacy: old per-member protocols table
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

  // ─── Session note ────────────────────────────────────────────────────────────
  const noteRow = Array.isArray(sessionNoteRes.data) && sessionNoteRes.data.length
    ? (sessionNoteRes.data[0] as Record<string, unknown>) : null;
  if (noteRow) {
    payload.sessionNote = {
      text: stringOr(noteRow.note, ""),
      date: formatDateForLabel(noteRow.created_at),
      coachName: "Dustin",
    };
  }

  // ─── Vitality age calculation ─────────────────────────────────────────────
  const dob = stringOr(userRow?.date_of_birth, "");
  const gender = stringOr(userRow?.gender, "").toLowerCase();
  const chronologicalAge = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  if (chronologicalAge !== null && chronologicalAge > 0) {
    let adj = 0;
    let markerCount = 0;
    const leanPct = scanRow && hasValue(scanRow.lean_mass_lbs) && hasValue(scanRow.weight_lbs)
      ? (numberOr(scanRow.lean_mass_lbs, 0) / Math.max(1, numberOr(scanRow.weight_lbs, 0))) * 100 : null;
    if (leanPct !== null) {
      markerCount++;
      if (leanPct > 45) adj -= 3;
      else if (leanPct >= 38) adj -= 1;
      else if (leanPct >= 30) adj += 0;
      else if (leanPct >= 22) adj += 1;
      else adj += 3;
    }
    const bfPct = scanRow && hasValue(scanRow.body_fat_pct) ? numberOr(scanRow.body_fat_pct, 0) : null;
    if (bfPct !== null) {
      markerCount++;
      const isMale = gender.startsWith("m");
      if (isMale) { if (bfPct < 18) adj -= 3; else if (bfPct <= 24) adj -= 1; else if (bfPct <= 29) adj += 0; else if (bfPct <= 34) adj += 1; else adj += 3; }
      else { if (bfPct < 25) adj -= 3; else if (bfPct <= 31) adj -= 1; else if (bfPct <= 37) adj += 0; else if (bfPct <= 42) adj += 1; else adj += 3; }
    }
    const thirtyDaysAgoIso2 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const recentCarol = carolRows.filter((r) => stringOr(r.session_date, "").slice(0, 10) >= thirtyDaysAgoIso2);
    const cardioVals = recentCarol.map((r) => hasValue(r.manp) ? numberOr(r.manp, 0) : hasValue(r.peak_power_watts) ? numberOr(r.peak_power_watts, 0) : null).filter((v): v is number => v !== null);
    if (cardioVals.length > 0) {
      markerCount++;
      const avgCardio = cardioVals.reduce((a, b) => a + b, 0) / cardioVals.length;
      const benchmark = chronologicalAge < 40 ? 380 : chronologicalAge < 50 ? 340 : chronologicalAge < 60 ? 300 : 260;
      const ratio = avgCardio / benchmark;
      if (ratio > 1.3) adj -= 3; else if (ratio > 1.0) adj -= 1; else if (ratio >= 0.85) adj += 0; else if (ratio >= 0.7) adj += 1; else adj += 3;
    }
    const arxMonthC = arxRows.filter((r) => stringOr(r.session_date, "").slice(0, 10) >= monthStartIso).length;
    const carolMonthC = carolRows.filter((r) => stringOr(r.session_date, "").slice(0, 10) >= monthStartIso).length;
    const totalMonthC = arxMonthC + carolMonthC + recoveryRows.length;
    const monthTarget30 = Math.round((payload.protocol.arxPerWeek + payload.protocol.carolPerWeek) * 4 + payload.protocol.recoveryPerMonth);
    if (monthTarget30 > 0) {
      markerCount++;
      const pct = (totalMonthC / monthTarget30) * 100;
      if (pct >= 90) adj -= 2; else if (pct >= 75) adj -= 1; else if (pct >= 50) adj += 0; else adj += 2;
    }
    const estimated = chronologicalAge + adj;
    payload.vitalityAge = { estimated, chronological: chronologicalAge, difference: chronologicalAge - estimated, trend: null, hasEnoughData: markerCount >= 2 };
    // Store in healthspan_scores for trend tracking
    if (markerCount >= 2) {
      void supabase.from("healthspan_scores").insert({ member_id: memberId, vitality_age: estimated, chronological_age: chronologicalAge, recorded_at: new Date().toISOString() }).then(() => {});
      // Compute trend from previous entry
      const prevScoreRes = await supabase.from("healthspan_scores").select("vitality_age").eq("member_id", memberId).not("vitality_age", "is", null).order("recorded_at", { ascending: false }).limit(2);
      if (!prevScoreRes.error && Array.isArray(prevScoreRes.data) && prevScoreRes.data.length >= 2) {
        const prev = numberOr((prevScoreRes.data[1] as Record<string, unknown>).vitality_age, estimated);
        payload.vitalityAge.trend = prev - estimated; // positive = improved (got younger)
      }
    }
  }

  // ─── Wins detection ───────────────────────────────────────────────────────
  const carolTotal = carolCountRes.count ?? 0;
  const arxTotal = arxCountRes.count ?? 0;
  const recoveryTotal = recoveryCountRes.count ?? 0;
  const wins: typeof payload.wins = [];
  // New CAROL peak power PR
  const carolPeaks = carolRows.map((r) => numberOr(r.peak_power_watts, 0)).filter((v) => v > 0);
  if (carolPeaks.length >= 2 && carolPeaks[0] > Math.max(...carolPeaks.slice(1))) {
    wins.push({ label: `New CAROL peak power — ${Math.round(carolPeaks[0])}W personal best`, isMilestone: false, icon: "↑" });
  }
  // New ARX per-exercise record
  const arxByExercise: Record<string, number[]> = {};
  for (const row of arxRows) {
    const ex = stringOr(row.exercise, ""); const conc = numberOr(row.concentric_max, 0);
    if (ex && conc > 0) { if (!arxByExercise[ex]) arxByExercise[ex] = []; arxByExercise[ex].push(conc); }
  }
  for (const [ex, vals] of Object.entries(arxByExercise)) {
    if (vals.length >= 2 && vals[0] > Math.max(...vals.slice(1))) {
      wins.push({ label: `New ARX ${ex.toLowerCase().replace(/_/g, " ")} record — ${Math.round(vals[0])} lbs`, isMilestone: false, icon: "↑" });
    }
  }
  // Body composition wins
  if (scanRows.length >= 2) {
    const lD = numberOr(scanRows[0].lean_mass_lbs, 0) - numberOr(scanRows[1].lean_mass_lbs, 0);
    if (lD > 0.2) wins.push({ label: `Lean mass up ${lD.toFixed(1)} lbs since last scan`, isMilestone: false, icon: "↑" });
    const fD = numberOr(scanRows[1].body_fat_pct, 0) - numberOr(scanRows[0].body_fat_pct, 0);
    if (fD > 0.1) wins.push({ label: `Body fat down ${fD.toFixed(1)}% since last scan`, isMilestone: false, icon: "↓" });
  }
  // Full protocol week
  const lastWeekArx = arxRows.filter((r) => stringOr(r.session_date, "").slice(0, 10) >= weekStartIso).length;
  const lastWeekCarol = carolRows.filter((r) => stringOr(r.session_date, "").slice(0, 10) >= weekStartIso).length;
  if (payload.protocol.arxPerWeek > 0 && payload.protocol.carolPerWeek > 0 && lastWeekArx >= payload.protocol.arxPerWeek && lastWeekCarol >= payload.protocol.carolPerWeek) {
    wins.push({ label: "Full protocol completed this week", isMilestone: false, icon: "✓" });
  }
  // Milestones
  for (const m of [1, 5, 10, 25, 50, 100, 200]) {
    if (carolTotal === m) { wins.push({ label: `${m} CAROL session${m > 1 ? "s" : ""} milestone`, isMilestone: true, icon: "🎯" }); break; }
  }
  for (const m of [1, 5, 10, 25, 50, 100]) {
    if (arxTotal === m) { wins.push({ label: `${m} ARX session${m > 1 ? "s" : ""} milestone`, isMilestone: true, icon: "🎯" }); break; }
  }
  // Member duration milestones
  const joinedAt = stringOr(userRow?.created_at, "");
  if (joinedAt) {
    const daysMember = Math.floor((Date.now() - new Date(joinedAt).getTime()) / (24 * 3600 * 1000));
    for (const d of [30, 90, 180, 365]) {
      if (daysMember === d || daysMember === d + 1) { wins.push({ label: `${d}-day member milestone — welcome to the club`, isMilestone: true, icon: "🎯" }); break; }
    }
  }
  payload.wins = wins;

  // ─── Goal details (since joining + this month) ────────────────────────────
  const thirtyDaysAgoIso3 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const dir = (v: number | null): "up" | "down" | "none" => v === null ? "none" : v > 0 ? "up" : v < 0 ? "down" : "none";
  const sign = (v: number) => (v >= 0 ? "+" : "");
  // Lean mass
  const latestLean = scanRow && hasValue(scanRow.lean_mass_lbs) ? numberOr(scanRow.lean_mass_lbs, 0) : null;
  const oldestLean = scanRows.length >= 2 && hasValue(scanRows[scanRows.length - 1].lean_mass_lbs) ? numberOr(scanRows[scanRows.length - 1].lean_mass_lbs, 0) : null;
  const monthAgoScan = scanRows.find((r) => stringOr(r.scan_date, "").slice(0, 10) <= thirtyDaysAgoIso3);
  const monthAgoLean = monthAgoScan && hasValue(monthAgoScan.lean_mass_lbs) ? numberOr(monthAgoScan.lean_mass_lbs, 0) : null;
  const lSJ = latestLean !== null && oldestLean !== null ? latestLean - oldestLean : null;
  const lTM = latestLean !== null && monthAgoLean !== null ? latestLean - monthAgoLean : null;
  payload.goalDetails.gain_muscle = {
    sinceJoining: lSJ !== null ? `${sign(lSJ)}${lSJ.toFixed(1)} lbs lean mass` : "--",
    sinceJoiningDir: dir(lSJ), thisMonth: lTM !== null ? `${sign(lTM)}${lTM.toFixed(1)} lbs` : "--",
    thisMonthDir: dir(lTM),
    status: lTM === null ? "no_data" : lTM > 0.2 ? "on_track" : lTM >= -0.2 ? "maintaining" : "declining",
    statusLabel: lTM === null ? "No data" : lTM > 0.2 ? "On Track" : lTM >= -0.2 ? "Maintaining" : "Declining",
    encouragement: lTM !== null && lTM < -0.2 ? "Increase ARX frequency this week to protect muscle" : null,
  };
  // Body fat
  const latestFat = scanRow && hasValue(scanRow.body_fat_pct) ? numberOr(scanRow.body_fat_pct, 0) : null;
  const oldestFat = scanRows.length >= 2 && hasValue(scanRows[scanRows.length - 1].body_fat_pct) ? numberOr(scanRows[scanRows.length - 1].body_fat_pct, 0) : null;
  const monthAgoFat = monthAgoScan && hasValue(monthAgoScan.body_fat_pct) ? numberOr(monthAgoScan.body_fat_pct, 0) : null;
  const fSJ = latestFat !== null && oldestFat !== null ? oldestFat - latestFat : null; // positive = good (fat down)
  const fTM = latestFat !== null && monthAgoFat !== null ? monthAgoFat - latestFat : null;
  payload.goalDetails.lose_fat = {
    sinceJoining: fSJ !== null ? `${sign(fSJ)}${Math.abs(fSJ).toFixed(1)}% body fat` : "--",
    sinceJoiningDir: dir(fSJ), thisMonth: fTM !== null ? `${sign(fTM)}${Math.abs(fTM).toFixed(1)}%` : "--",
    thisMonthDir: dir(fTM),
    status: fTM === null ? "no_data" : fTM > 0.2 ? "on_track" : fTM >= -0.2 ? "maintaining" : "declining",
    statusLabel: fTM === null ? "No data" : fTM > 0.2 ? "Improving" : fTM >= -0.2 ? "Maintaining" : "Increasing",
    encouragement: fTM !== null && fTM < -0.2 ? "Your strength numbers are strong — let's focus on nutrition timing" : null,
  };
  // Cardio
  const recentCardio = carolRows.filter((r) => stringOr(r.session_date, "").slice(0, 10) >= thirtyDaysAgoIso3);
  const oldCarol = carolRows.slice(-10);
  const getManp = (r: Record<string, unknown>) => hasValue(r.manp) ? numberOr(r.manp, 0) : hasValue(r.peak_power_watts) ? numberOr(r.peak_power_watts, 0) : null;
  const recentCardioVals = recentCardio.map(getManp).filter((v): v is number => v !== null);
  const oldCardioVals = oldCarol.map(getManp).filter((v): v is number => v !== null);
  const cRecent = recentCardioVals.length ? recentCardioVals.reduce((a, b) => a + b) / recentCardioVals.length : null;
  const cOld = oldCardioVals.length ? oldCardioVals.reduce((a, b) => a + b) / oldCardioVals.length : null;
  const cSJpct = cRecent !== null && cOld !== null && cOld > 0 ? ((cRecent - cOld) / cOld) * 100 : null;
  const monthAgoCarol = carolRows.find((r) => stringOr(r.session_date, "").slice(0, 10) <= thirtyDaysAgoIso3);
  const cMonthAgoVal = monthAgoCarol ? getManp(monthAgoCarol) : null;
  const cTMpct = cRecent !== null && cMonthAgoVal !== null && cMonthAgoVal > 0 ? ((cRecent - cMonthAgoVal) / cMonthAgoVal) * 100 : null;
  payload.goalDetails.improve_cardio = {
    sinceJoining: cSJpct !== null ? `${sign(cSJpct)}${cSJpct.toFixed(0)}% cardio power` : "--",
    sinceJoiningDir: dir(cSJpct), thisMonth: cTMpct !== null ? `${sign(cTMpct)}${cTMpct.toFixed(0)}%` : "--",
    thisMonthDir: dir(cTMpct),
    status: cTMpct === null ? "no_data" : cTMpct > 2 ? "improving" : cTMpct >= -2 ? "maintaining" : "declining",
    statusLabel: cTMpct === null ? "No data" : cTMpct > 2 ? "Improving" : cTMpct >= -2 ? "Maintaining" : "Declining",
    encouragement: cTMpct !== null && cTMpct < -2 ? "One CAROL session this week gets you back on track" : null,
  };
  // Attendance
  const attSinceJoining = carolTotal + arxTotal + recoveryTotal;
  const attThisMonth = totalThisMonth;
  const attTarget30 = Math.round((payload.protocol.arxPerWeek + payload.protocol.carolPerWeek) * 4 + payload.protocol.recoveryPerMonth);
  const attPct = attTarget30 > 0 ? (attThisMonth / attTarget30) * 100 : null;
  const attRemaining = attTarget30 > attThisMonth ? attTarget30 - attThisMonth : 0;
  payload.goalDetails.attendance = {
    sinceJoining: `${attSinceJoining} total sessions`, sinceJoiningDir: "up",
    thisMonth: attTarget30 > 0 ? `${attThisMonth} of ${attTarget30} sessions` : `${attThisMonth} sessions`,
    thisMonthDir: attPct !== null ? (attPct >= 80 ? "up" : attPct >= 50 ? "none" : "down") : "none",
    status: attPct === null ? "no_data" : attPct >= 80 ? "on_track" : attPct >= 50 ? "behind" : "off_track",
    statusLabel: attPct === null ? "No data" : attPct >= 80 ? "On Track" : attPct >= 50 ? "Behind" : "Off Track",
    encouragement: attPct !== null && attPct < 80 ? `${attRemaining} session${attRemaining !== 1 ? "s" : ""} remaining this month — you've got this` : null,
  };

  // ─── Today's plan ────────────────────────────────────────────────────────
  {
    const hasProto = !!payload.protocol.id;
    payload.todaysPlan = { hasProtocol: hasProto, protocolName: payload.protocol.name, dayName: "", dayTheme: "", dayDescription: "", isRestDay: false, activities: [], totalMinutes: 0, sessionsThisWeek: 0 };
    if (hasProto) {
      try {
        const jsDay = new Date().getDay();
        const dowSunday7 = jsDay === 0 ? 7 : jsDay;
        // Check for schedule overrides for this week
        const d = new Date(); const ddow = d.getDay(); const diff = ddow === 0 ? -6 : 1 - ddow;
        d.setDate(d.getDate() + diff); d.setHours(0,0,0,0);
        const weekStartStr = d.toISOString().slice(0, 10);
        let targetDayRes: Awaited<ReturnType<typeof supabase.from>> | null = null;
        const overrideRes = await supabase.from("member_schedule_overrides").select("protocol_day_id,override_day_of_week").eq("member_id", memberId).eq("week_start", weekStartStr).eq("override_day_of_week", dowSunday7).limit(1);
        if (!overrideRes.error && overrideRes.data?.length) {
          // Today has an override — fetch the overridden day directly by protocol_day_id
          const overriddenDayId = stringOr((overrideRes.data[0] as Record<string, unknown>).protocol_day_id, "");
          if (overriddenDayId) {
            targetDayRes = await supabase.from("protocol_days").select("id,day_name,day_theme,day_description").eq("id", overriddenDayId).limit(1) as unknown as typeof targetDayRes;
          }
        }
        const dayRes = targetDayRes ?? await supabase.from("protocol_days").select("id,day_name,day_theme,day_description").eq("protocol_id", payload.protocol.id).eq("day_of_week", dowSunday7).limit(1);
        if (!dayRes.error && dayRes.data?.length) {
          const dr = dayRes.data[0] as Record<string, unknown>;
          const actRes = await supabase.from("protocol_day_activities").select("*").eq("protocol_day_id", dr.id).order("activity_order");
          payload.todaysPlan.dayName = stringOr(dr.day_name, "");
          payload.todaysPlan.dayTheme = stringOr(dr.day_theme, "");
          payload.todaysPlan.dayDescription = stringOr(dr.day_description, "");
          payload.todaysPlan.isRestDay = stringOr(dr.day_theme, "").toLowerCase().includes("rest");
          if (!actRes.error) {
            payload.todaysPlan.activities = (actRes.data ?? []).map((row) => {
              const r = row as Record<string, unknown>;
              return { id: stringOr(r.id, ""), order: numberOr(r.activity_order, 0), type: stringOr(r.activity_type, ""), name: stringOr(r.activity_name, ""), durationMinutes: Math.round(numberOr(r.duration_minutes, 0)), description: stringOr(r.description, ""), whyItMatters: stringOr(r.why_it_matters, ""), steps: Array.isArray(r.steps) ? (r.steps as string[]) : [], isBookable: r.is_bookable === true, bookingUrl: r.booking_url ? stringOr(r.booking_url, "") : null, isOptional: r.is_optional === true, alternativeActivity: r.alternative_activity ? stringOr(r.alternative_activity, "") : null };
            });
            payload.todaysPlan.totalMinutes = payload.todaysPlan.activities.reduce((s, a) => s + a.durationMinutes, 0);
          }
        }
      } catch { /* tables may not exist yet */ }
    }
  }

  // ─── Member since + milestones + streak ──────────────────────────────────
  payload.memberSince = joinedAt
    ? new Date(joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  // Combined sessions ascending (for milestone dates and streak)
  const combined = [
    ...carolRows.map((r) => ({ dateIso: stringOr(r.session_date, "").slice(0, 10), type: "carol", power: numberOr(r.peak_power_watts, 0) })),
    ...arxRows.map((r) => ({ dateIso: stringOr(r.session_date, "").slice(0, 10), type: "arx", power: 0 })),
  ].filter((s) => s.dateIso).sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  // Longest weekly streak
  let maxStreak = 0; let currentStreak = 0;
  const nowMs = Date.now();
  for (let w = 51; w >= 0; w--) {
    const ws = new Date(nowMs - (w + 1) * 7 * 86400000).toISOString().slice(0, 10);
    const we = new Date(nowMs - w * 7 * 86400000).toISOString().slice(0, 10);
    const has = combined.some((s) => s.dateIso >= ws && s.dateIso < we);
    if (has) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); } else currentStreak = 0;
  }
  payload.longestStreakWeeks = maxStreak;

  // Milestones
  const mlabelDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
  const mls: typeof payload.milestones = [];
  // Member duration
  if (joinedAt) {
    const jd = new Date(joinedAt);
    for (const [days, icon, label] of [[365, "📅", "1 year as a member"], [180, "📅", "6 month member"], [90, "📅", "90 day member"], [30, "📅", "30 day member"]] as [number, string, string][]) {
      const diffDays = Math.floor((nowMs - jd.getTime()) / 86400000);
      if (diffDays >= days) mls.push({ dateLabel: mlabelDate(new Date(jd.getTime() + days * 86400000).toISOString()), icon, label });
    }
  }
  // Session count milestones
  for (const [n, icon] of [[100, "🏋️"], [50, "🏋️"], [25, "🏋️"], [10, "🏋️"]] as [number, string][]) {
    if (combined.length >= n) mls.push({ dateLabel: mlabelDate(combined[n - 1].dateIso), icon, label: `${n}th session completed` });
  }
  // CAROL peak power all-time record
  const allPowers = carolRows.map((r) => ({ val: numberOr(r.peak_power_watts, 0), date: stringOr(r.session_date, "").slice(0, 10) })).filter((p) => p.val > 0);
  if (allPowers.length) {
    const pr = allPowers.reduce((best, p) => (p.val > best.val ? p : best));
    mls.push({ dateLabel: mlabelDate(pr.date), icon: "↑", label: `New CAROL peak power ${Math.round(pr.val)}W` });
  }
  // First scan
  if (scanRows.length > 0) {
    const firstScan = scanRows[scanRows.length - 1];
    mls.push({ dateLabel: mlabelDate(stringOr(firstScan.scan_date, "")), icon: "📊", label: "First Fit3D body scan" });
  }
  // Sort most recent first (best effort — dateLabel format "Jan 2025")
  payload.milestones = mls
    .filter((m, i, arr) => arr.findIndex((x) => x.label === m.label) === i) // dedupe
    .sort((a, b) => b.dateLabel.localeCompare(a.dateLabel))
    .slice(0, 8);

  // Attendance goal: compare month sessions to protocol target
  const arxWeekTarget = payload.protocol.arxPerWeek || 0;
  const carolWeekTarget = payload.protocol.carolPerWeek || 0;
  const recoveryMonthTarget = payload.protocol.recoveryPerMonth || 0;
  const monthTarget = Math.round(arxWeekTarget * 4 + carolWeekTarget * 4 + recoveryMonthTarget);
  if (monthTarget > 0) {
    const ratio = totalThisMonth / monthTarget;
    const display = `${totalThisMonth} of ${monthTarget} sessions completed this month`;
    if (ratio >= 0.8) payload.goals.progress.attendance = { status: "on_track", display, direction: "positive", current: totalThisMonth, target: monthTarget };
    else if (ratio >= 0.5) payload.goals.progress.attendance = { status: "behind", display, direction: "neutral", current: totalThisMonth, target: monthTarget };
    else payload.goals.progress.attendance = { status: "off_track", display, direction: "negative", current: totalThisMonth, target: monthTarget };
  } else {
    payload.goals.progress.attendance = { status: "no_data", display: `${totalThisMonth} total sessions this month`, direction: "no_data", current: totalThisMonth, target: 0 };
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

    // At-risk members (recovery < 40 or no recent session data)
    payload.coachAtRisk = payload.coach.members
      .filter((member) => Number(member.recovery) < 40)
      .map((member) => ({
        id: member.id,
        name: member.name,
        reasons: [`Recovery ${member.recovery}% — flagged for follow-up`],
        recovery: member.recovery,
      }));
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
        actorRole={authState.role}
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
