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
  scan: {
    bodyFatPct: string;
    weightLbs: string;
    leanMassLbs: string;
    headForwardIn: string;
    shoulderForwardIn: string;
    hipForwardIn: string;
  };
  scanHistory: Array<{
    scanDate: string;
    bodyFatPct: string;
    weightLbs: string;
    leanMassLbs: string;
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
    scan: {
      bodyFatPct: "--",
      weightLbs: "--",
      leanMassLbs: "--",
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
  ] = await Promise.all([
    supabase
      .from("carol_sessions")
      .select("session_date,ride_type,peak_power_watts,manp,avg_sprint_power,calories_incl_epoc,heart_rate_max,sequential_number")
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
      .select("scan_date,body_fat_pct,weight_lbs,lean_mass_lbs,posture_head_forward_in,posture_shoulder_forward_in,posture_hip_forward_in")
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
      .select("modality")
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
      .select("id,name,week_current,week_total")
      .eq("member_id", memberId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase.from("reports").select("title").eq("member_id", memberId).order("created_at", { ascending: false }).limit(3),
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
  const protocolRow =
    Array.isArray(protocolRes.data) && protocolRes.data.length
      ? (protocolRes.data[0] as Record<string, unknown>)
      : null;
  const reportRows = Array.isArray(reportRes.data) ? (reportRes.data as Array<Record<string, unknown>>) : [];

  const arxLatest = arxRows[0] ?? null;
  const carolLatest = carolRows[0] ?? null;
  payload.metrics.carolFitness = carolLatest && hasValue(carolLatest.manp) ? Math.round(numberOr(carolLatest.manp, 0)).toString() : "--";
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
    label: `${formatDateForLabel(row.session_date)} · Ride #${stringOr(row.sequential_number, "—")}`,
    value: hasValue(row.manp) ? Math.round(numberOr(row.manp, 0)).toString() : "--",
  }));
  payload.carolSessions = carolRows.map((row) => ({
    sessionDate: stringOr(row.session_date, ""),
    rideType: stringOr(row.ride_type, "REHIT"),
    peakPowerWatts: hasValue(row.peak_power_watts) ? Math.round(numberOr(row.peak_power_watts, 0)).toString() : "--",
    manp: hasValue(row.manp) ? Math.round(numberOr(row.manp, 0)).toString() : "--",
    avgSprintPower: hasValue(row.avg_sprint_power) ? Math.round(numberOr(row.avg_sprint_power, 0)).toString() : "--",
    caloriesInclEpoc: hasValue(row.calories_incl_epoc) ? Math.round(numberOr(row.calories_incl_epoc, 0)).toString() : "--",
    heartRateMax: hasValue(row.heart_rate_max) ? Math.round(numberOr(row.heart_rate_max, 0)).toString() : "--",
    sequentialNumber: stringOr(row.sequential_number, "—"),
  }));
  payload.arxHistory = arxRows.map((row) => ({
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
  payload.scanHistory = scanRows.map((row) => ({
    scanDate: formatDateForLabel(row.scan_date),
    bodyFatPct: hasValue(row.body_fat_pct) ? numberOr(row.body_fat_pct, 0).toFixed(2) : "--",
    weightLbs: hasValue(row.weight_lbs) ? numberOr(row.weight_lbs, 0).toFixed(1) : "--",
    leanMassLbs: hasValue(row.lean_mass_lbs) ? numberOr(row.lean_mass_lbs, 0).toFixed(1) : "--",
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
