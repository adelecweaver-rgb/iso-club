import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isClerkConfigured, safeCurrentUser } from "@/lib/server/clerk";
import { getCurrentAuthState, routeForRole, type AppRole } from "@/lib/server/roles";
import { loadPrototypeFromFiles, type PrototypeParts } from "@/lib/server/prototype";

type DashboardPayload = {
  role: "member" | "coach";
  memberId: string | null;
  coachId: string | null;
  displayName: string;
  initials: string;
  tier: string;
  memberOptions: Array<{ id: string; name: string; phone: string }>;
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

type CoachSection = "morning" | "members" | "log" | "protocols";

async function loadPrototypeParts(): Promise<PrototypeParts> {
  return loadPrototypeFromFiles(["iso-club-v2.html"], "Iso Club Dashboard");
}

function initialsFromName(name: string): string {
  const parts = name
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

function fmtDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function formatDateForLabel(value: unknown): string {
  if (typeof value !== "string" || !value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function normalizeMemberSection(input: string | undefined): MemberSection {
  const value = (input ?? "").trim().toLowerCase();
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
  const value = (input ?? "").trim().toLowerCase();
  if (value === "morning" || value === "members" || value === "log" || value === "protocols") {
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
    memberOptions: [],
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
      infraredSauna: "8",
      coldPlunge: "6",
      nxpro: "4",
      compression: "5",
      vasper: "4",
      katalyst: "2",
      proteus: "3",
      quickboard: "5",
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

async function loadDashboardLiveData(userId: string, authRole: AppRole): Promise<DashboardPayload> {
  const user = await safeCurrentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const clerkName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    "Member";

  const payload = makeDefaultPayload(clerkName);
  const supabase = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
  if (!supabase) return payload;

  let userRow: Record<string, unknown> | null = null;
  const userByClerk = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", userId)
    .limit(1);
  if (!userByClerk.error && userByClerk.data && userByClerk.data.length > 0) {
    userRow = userByClerk.data[0] as Record<string, unknown>;
  } else if (email) {
    const userByEmail = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .limit(1);
    if (!userByEmail.error && userByEmail.data && userByEmail.data.length > 0) {
      userRow = userByEmail.data[0] as Record<string, unknown>;
    }
  }

  const metadataRole = stringOr(
    (user?.publicMetadata as Record<string, unknown> | undefined)?.role ??
      (user?.unsafeMetadata as Record<string, unknown> | undefined)?.role ??
      "",
    "",
  );
  const userRole = stringOr(userRow?.role, "").toLowerCase();
  const authRoleValue = (authRole ?? "unknown").toLowerCase();
  const isCoach =
    userRole === "coach" ||
    userRole === "admin" ||
    userRole === "staff" ||
    userRole.includes("coach") ||
    authRoleValue === "coach" ||
    authRoleValue === "admin" ||
    authRoleValue === "staff" ||
    metadataRole.toLowerCase().includes("coach") ||
    email.toLowerCase().includes("dustin");
  payload.role = isCoach ? "coach" : "member";

  payload.memberId = stringOr(userRow?.id, "");
  payload.coachId = payload.memberId;
  payload.displayName = stringOr(userRow?.full_name, clerkName);
  payload.initials = initialsFromName(payload.displayName);
  payload.tier = stringOr(
    userRow?.membership_tier,
    payload.role === "coach" ? "Head Coach" : "Member",
  );

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
      .select("session_date,ride_number,fitness_score,peak_power_watts,calories,max_hr")
      .eq("member_id", memberId)
      .order("session_date", { ascending: false })
      .limit(6),
    supabase
      .from("arx_sessions")
      .select("session_date,exercise,output,concentric_max,eccentric_max")
      .eq("member_id", memberId)
      .order("session_date", { ascending: false })
      .limit(6),
    supabase
      .from("fit3d_scans")
      .select(
        "scan_date,body_fat_pct,weight_lbs,lean_mass_lbs,body_shape_rating,posture_head_forward_in,posture_shoulder_forward_in,posture_hip_forward_in",
      )
      .eq("member_id", memberId)
      .order("scan_date", { ascending: false })
      .limit(1),
    supabase
      .from("wearable_data")
      .select("recorded_date,recovery_score,hrv_ms,resting_hr,sleep_duration_hrs,strain_score")
      .eq("member_id", memberId)
      .ilike("device_type", "%whoop%")
      .order("recorded_date", { ascending: false })
      .limit(1),
    supabase
      .from("wearable_data")
      .select("recorded_date,readiness_score,sleep_duration_hrs,deep_sleep_hrs,rem_sleep_hrs,spo2_pct")
      .eq("member_id", memberId)
      .ilike("device_type", "%oura%")
      .order("recorded_date", { ascending: false })
      .limit(1),
    supabase
      .from("healthspan_scores")
      .select("muscle_score,cardio_score,metabolic_score,structural_score,recovery_score,overall_score,recorded_at")
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
      .select("equipment,session_date")
      .eq("member_id", memberId)
      .gte("session_date", monthStartIso)
      .lt("session_date", monthEndIso),
    supabase
      .from("bookings")
      .select("scheduled_at,session_type,title,status,duration_minutes")
      .eq("member_id", memberId)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(3),
    supabase
      .from("protocols")
      .select("id,name,week_current,week_total,primary_goal,is_active,updated_at")
      .eq("member_id", memberId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("reports")
      .select("title,created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const carolRows = Array.isArray(carolRes.data)
    ? (carolRes.data as Array<Record<string, unknown>>)
    : [];
  const arxRows = Array.isArray(arxRes.data)
    ? (arxRes.data as Array<Record<string, unknown>>)
    : [];
  const scanRow =
    Array.isArray(scanRes.data) && scanRes.data.length > 0
      ? (scanRes.data[0] as Record<string, unknown>)
      : null;
  const whoopRow =
    Array.isArray(whoopRes.data) && whoopRes.data.length > 0
      ? (whoopRes.data[0] as Record<string, unknown>)
      : null;
  const ouraRow =
    Array.isArray(ouraRes.data) && ouraRes.data.length > 0
      ? (ouraRes.data[0] as Record<string, unknown>)
      : null;
  const healthRow =
    Array.isArray(healthspanRes.data) && healthspanRes.data.length > 0
      ? (healthspanRes.data[0] as Record<string, unknown>)
      : null;
  const recoveryRows = Array.isArray(recoveryRes.data)
    ? (recoveryRes.data as Array<Record<string, unknown>>)
    : [];
  const manualRows = Array.isArray(manualRes.data)
    ? (manualRes.data as Array<Record<string, unknown>>)
    : [];
  const bookingRows = Array.isArray(bookingRes.data)
    ? (bookingRes.data as Array<Record<string, unknown>>)
    : [];
  const protocolRow =
    Array.isArray(protocolRes.data) && protocolRes.data.length > 0
      ? (protocolRes.data[0] as Record<string, unknown>)
      : null;
  const reportRows = Array.isArray(reportRes.data)
    ? (reportRes.data as Array<Record<string, unknown>>)
    : [];

  const legPress = arxRows.find((row) =>
    stringOr(row.exercise, "").toLowerCase().includes("leg press"),
  );
  const arxLatest = legPress ?? arxRows[0] ?? null;
  const carolLatest = carolRows[0] ?? null;

  payload.metrics.carolFitness =
    carolLatest && hasValue(carolLatest.fitness_score)
      ? numberOr(carolLatest.fitness_score, 0).toFixed(1)
      : "--";
  payload.metrics.arxOutput =
    arxLatest && (hasValue(arxLatest.concentric_max) || hasValue(arxLatest.output))
      ? Math.round(numberOr(arxLatest.concentric_max, numberOr(arxLatest.output, 0))).toString()
      : "--";
  payload.metrics.leanMass =
    scanRow && hasValue(scanRow.lean_mass_lbs)
      ? numberOr(scanRow.lean_mass_lbs, 0).toFixed(1)
      : "--";
  payload.metrics.whoopRecovery =
    whoopRow && hasValue(whoopRow.recovery_score)
      ? Math.round(numberOr(whoopRow.recovery_score, 0)).toString()
      : "--";

  payload.healthspan = {
    muscle:
      healthRow && hasValue(healthRow.muscle_score)
        ? Math.round(numberOr(healthRow.muscle_score, 0)).toString()
        : "--",
    cardio:
      healthRow && hasValue(healthRow.cardio_score)
        ? Math.round(numberOr(healthRow.cardio_score, 0)).toString()
        : "--",
    metabolic:
      healthRow && hasValue(healthRow.metabolic_score)
        ? Math.round(numberOr(healthRow.metabolic_score, 0)).toString()
        : "--",
    structural:
      healthRow && hasValue(healthRow.structural_score)
        ? Math.round(numberOr(healthRow.structural_score, 0)).toString()
        : "--",
    recovery:
      healthRow && hasValue(healthRow.recovery_score)
        ? Math.round(numberOr(healthRow.recovery_score, 0)).toString()
        : "--",
  };

  payload.carolHistory = carolRows.slice(0, 3).map((row) => ({
    label: `${fmtDate(row.session_date)} · Ride #${stringOr(row.ride_number, "—")}`,
    value: numberOr(row.fitness_score, 0).toFixed(1),
  }));

  payload.arxHistory = arxRows.slice(0, 3).map((row) => ({
    label: `${fmtDate(row.session_date)} · ${stringOr(row.exercise, "ARX exercise")}`,
    value: Math.round(numberOr(row.concentric_max, numberOr(row.output, 0))).toString(),
  }));

  payload.scan = {
    bodyFatPct:
      scanRow && hasValue(scanRow.body_fat_pct)
        ? numberOr(scanRow.body_fat_pct, 0).toFixed(2)
        : "--",
    weightLbs:
      scanRow && hasValue(scanRow.weight_lbs)
        ? numberOr(scanRow.weight_lbs, 0).toFixed(1)
        : "--",
    leanMassLbs:
      scanRow && hasValue(scanRow.lean_mass_lbs)
        ? numberOr(scanRow.lean_mass_lbs, 0).toFixed(1)
        : "--",
    headForwardIn:
      scanRow && hasValue(scanRow.posture_head_forward_in)
        ? numberOr(scanRow.posture_head_forward_in, 0).toFixed(1)
        : "--",
    shoulderForwardIn:
      scanRow && hasValue(scanRow.posture_shoulder_forward_in)
        ? numberOr(scanRow.posture_shoulder_forward_in, 0).toFixed(1)
        : "--",
    hipForwardIn:
      scanRow && hasValue(scanRow.posture_hip_forward_in)
        ? numberOr(scanRow.posture_hip_forward_in, 0).toFixed(1)
        : "--",
  };

  const modalityCounts: Record<string, number> = {};
  for (const row of recoveryRows) {
    const modality = stringOr(row.modality, "").toLowerCase();
    if (!modality) continue;
    modalityCounts[modality] = (modalityCounts[modality] ?? 0) + 1;
  }
  const equipmentCounts: Record<string, number> = {};
  for (const row of manualRows) {
    const equipment = stringOr(row.equipment, "").toLowerCase();
    if (!equipment) continue;
    equipmentCounts[equipment] = (equipmentCounts[equipment] ?? 0) + 1;
  }
  const countModality = (keys: string[]) =>
    keys.reduce((sum, key) => sum + (modalityCounts[key] ?? 0), 0).toString();
  const countEquipment = (keys: string[]) =>
    keys.reduce((sum, key) => sum + (equipmentCounts[key] ?? 0), 0).toString();
  payload.recoveryCounts = {
    infraredSauna: countModality(["infrared_sauna", "infrared sauna"]),
    coldPlunge: countModality(["cold_plunge", "cold plunge"]),
    nxpro: countModality(["nxpro"]),
    compression: countModality(["compression_therapy", "compression"]),
    vasper: countEquipment(["vasper"]),
    katalyst: countEquipment(["katalyst"]),
    proteus: countEquipment(["proteus"]),
    quickboard: countEquipment(["quickboard"]),
  };

  payload.wearables = {
    whoopRecovery:
      whoopRow && hasValue(whoopRow.recovery_score)
        ? Math.round(numberOr(whoopRow.recovery_score, 0)).toString()
        : "--",
    ouraReadiness:
      ouraRow && hasValue(ouraRow.readiness_score)
        ? Math.round(numberOr(ouraRow.readiness_score, 0)).toString()
        : "--",
    hrvMs:
      whoopRow && hasValue(whoopRow.hrv_ms)
        ? Math.round(numberOr(whoopRow.hrv_ms, 0)).toString()
        : "--",
    sleepHours:
      whoopRow && hasValue(whoopRow.sleep_duration_hrs)
        ? numberOr(whoopRow.sleep_duration_hrs, 0).toFixed(1)
        : ouraRow && hasValue(ouraRow.sleep_duration_hrs)
          ? numberOr(ouraRow.sleep_duration_hrs, 0).toFixed(1)
          : "--",
  };

  payload.bookings = bookingRows.slice(0, 3).map((row) => {
    const scheduledAt = stringOr(row.scheduled_at, "");
    const dateLabel = formatDateForLabel(scheduledAt);
    const title =
      stringOr(row.title, "") || stringOr(row.session_type, "Session");
    const status = stringOr(row.status, "scheduled");
    return {
      label: `${dateLabel} · ${title}`,
      status,
    };
  });

  payload.reports = reportRows.slice(0, 3).map((row) => ({
    title: stringOr(row.title, "Report"),
  }));

  if (protocolRow) {
    payload.protocol.name = stringOr(protocolRow.name, payload.protocol.name);
    payload.protocol.weekCurrent = Math.round(
      numberOr(protocolRow.week_current, 1),
    ).toString();
    payload.protocol.weekTotal = Math.round(
      numberOr(protocolRow.week_total, 12),
    ).toString();

    const protocolId = stringOr(protocolRow.id, "");
    if (protocolId) {
      const protocolSessionsRes = await supabase
        .from("protocol_sessions")
        .select("name,description,duration_minutes,status,order_index")
        .eq("protocol_id", protocolId)
        .order("order_index", { ascending: true })
        .limit(5);
      if (!protocolSessionsRes.error && Array.isArray(protocolSessionsRes.data)) {
        payload.protocol.sessions = (
          protocolSessionsRes.data as Array<Record<string, unknown>>
        ).map((row) => ({
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

    const bookingsTodayRes = await supabase
      .from("bookings")
      .select("member_id,scheduled_at,session_type,title,status")
      .gte("scheduled_at", todayStart.toISOString())
      .lt("scheduled_at", tomorrowStart.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(12);

    const bookingsToday = Array.isArray(bookingsTodayRes.data)
      ? (bookingsTodayRes.data as Array<Record<string, unknown>>)
      : [];
    const memberIds = Array.from(
      new Set(
        bookingsToday
          .map((row) => stringOr(row.member_id, ""))
          .filter((id) => id.length > 0),
      ),
    );

    const [usersRes, coachWearableRes, coachHealthRes, memberOptionsRes] = await Promise.all([
      memberIds.length
        ? supabase
            .from("users")
            .select("id,full_name,membership_tier,phone")
            .in("id", memberIds)
        : Promise.resolve({ data: [], error: null }),
      memberIds.length
        ? supabase
            .from("wearable_data")
            .select("member_id,recovery_score,readiness_score,recorded_date")
            .in("member_id", memberIds)
            .order("recorded_date", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      memberIds.length
        ? supabase
            .from("healthspan_scores")
            .select("member_id,muscle_score,recorded_at")
            .in("member_id", memberIds)
            .order("recorded_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("users")
        .select("id,full_name,phone")
        .eq("is_active", true)
        .eq("role", "member")
        .order("full_name", { ascending: true })
        .limit(100),
    ]);

    const users = usersRes && Array.isArray(usersRes.data)
      ? (usersRes.data as Array<Record<string, unknown>>)
      : [];
    const wearableRows = coachWearableRes && Array.isArray(coachWearableRes.data)
      ? (coachWearableRes.data as Array<Record<string, unknown>>)
      : [];
    const coachHealthRows = coachHealthRes && Array.isArray(coachHealthRes.data)
      ? (coachHealthRes.data as Array<Record<string, unknown>>)
      : [];
    const memberOptionsRows =
      memberOptionsRes && Array.isArray(memberOptionsRes.data)
        ? (memberOptionsRes.data as Array<Record<string, unknown>>)
        : [];
    payload.memberOptions = memberOptionsRows.map((member) => ({
      id: stringOr(member.id, ""),
      name: stringOr(member.full_name, "Member"),
      phone: stringOr(member.phone, ""),
    })).filter((member) => member.id && member.name);

    const latestWearableByMember = new Map<string, Record<string, unknown>>();
    for (const row of wearableRows) {
      const id = stringOr(row.member_id, "");
      if (!id || latestWearableByMember.has(id)) continue;
      latestWearableByMember.set(id, row);
    }
    const latestHealthByMember = new Map<string, Record<string, unknown>>();
    for (const row of coachHealthRows) {
      const id = stringOr(row.member_id, "");
      if (!id || latestHealthByMember.has(id)) continue;
      latestHealthByMember.set(id, row);
    }

    const members = users.map((member) => {
      const id = stringOr(member.id, "");
      const wearable = latestWearableByMember.get(id);
      const health = latestHealthByMember.get(id);
      const booking = bookingsToday.find((row) => stringOr(row.member_id, "") === id);
      const name = stringOr(member.full_name, "Member");
      const sessionName =
        stringOr(booking?.title, "") ||
        stringOr(booking?.session_type, "Session");
      const scheduledAt = stringOr(booking?.scheduled_at, "");
      const timeLabel = scheduledAt
        ? new Date(scheduledAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        : "Today";
      return {
        id,
        name,
        initials: initialsFromName(name),
        tier: stringOr(member.membership_tier, "Member"),
        phoneMissing: stringOr(member.phone, "").length === 0,
        recovery: Math.round(
          numberOr(wearable?.recovery_score, numberOr(wearable?.readiness_score, 60)),
        ).toString(),
        muscle: Math.round(numberOr(health?.muscle_score, 70)).toString(),
        session: `${timeLabel} · ${sessionName}`,
      };
    });

    const lowRecoveryCount = members.filter((m) => Number(m.recovery) < 50).length;
    const readyCount = members.filter((m) => Number(m.recovery) >= 70).length;
    payload.coach = {
      todayCount: members.length.toString(),
      lowRecoveryCount: lowRecoveryCount.toString(),
      readyCount: readyCount.toString(),
      alerts: members
        .filter((m) => Number(m.recovery) < 50)
        .slice(0, 3)
        .map(
          (m) =>
            `⚠ ${m.name} — recovery ${m.recovery}. Scheduled ${m.session}. Review before training.`,
        ),
      members: members.slice(0, 6),
    };
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
  const prototype = await loadPrototypeParts();
  const initialMemberView = normalizeMemberSection(
    route === "dashboard" ? initialSection : undefined,
  );
  const initialCoachView = normalizeCoachSection(
    route === "coach" ? initialSection : undefined,
  );

  if (!clerkConfigured) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Authentication not configured</h1>
          <p className="muted">
            Set
            {" "}
            <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
            {" "}
            and
            {" "}
            <code>CLERK_SECRET_KEY</code>
            {" "}
            in Vercel, then redeploy.
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
    if (authState.role !== "member") {
      redirect(routeForRole(authState.role));
    }
    if (!authState.onboardingComplete) {
      redirect("/onboarding");
    }
  } else if (route === "coach") {
    if (authState.role === "member" || authState.role === "unknown") {
      redirect(routeForRole(authState.role));
    }
    if (authState.role === "staff" && initialCoachView === "morning") {
      redirect("/coach/log");
    }
  }

  const livePayload = await loadDashboardLiveData(authState.userId, authState.role);
  const uiRole = authState.role === "member" ? "member" : "coach";
  const payload = JSON.stringify(livePayload).replace(/</g, "\\u003c");
  const bootstrapScript = `
    (() => {
      const payload = ${payload};
      const role = ${JSON.stringify(uiRole)};
      const data = payload || {};
      const initialMemberView = ${JSON.stringify(initialMemberView)};
      const initialCoachView = ${JSON.stringify(initialCoachView)};

      const firstName = (name) => {
        if (!name || typeof name !== "string") return "Member";
        return name.trim().split(" ")[0] || "Member";
      };

      const setText = (selector, value) => {
        if (!value) return;
        const el = document.querySelector(selector);
        if (el) el.textContent = String(value);
      };

      const setStatCardValue = (labelFragment, value) => {
        if (!value) return;
        const cards = Array.from(document.querySelectorAll(".stat-card"));
        const card = cards.find((item) => {
          const label = item.querySelector(".stat-label");
          const text = label && label.textContent ? label.textContent.toLowerCase() : "";
          return text.includes(labelFragment.toLowerCase());
        });
        if (!card) return;
        const valueEl = card.querySelector(".stat-val");
        if (valueEl) valueEl.textContent = String(value);
      };

      const findCard = (titleFragment) => {
        const cards = Array.from(document.querySelectorAll(".card"));
        return cards.find((card) => {
          const title = card.querySelector(".card-title");
          const text = title && title.textContent ? title.textContent.toLowerCase() : "";
          return text.includes(titleFragment.toLowerCase());
        });
      };

      const setMetricInCard = (cardTitle, labelFragment, value) => {
        if (!value) return;
        const card = findCard(cardTitle);
        if (!card) return;
        const rows = Array.from(card.querySelectorAll(".metric-row"));
        const row = rows.find((r) => {
          const l = r.querySelector(".metric-label");
          const t = l && l.textContent ? l.textContent.toLowerCase() : "";
          return t.includes(labelFragment.toLowerCase());
        });
        if (!row) return;
        const val = row.querySelector(".metric-val");
        if (val) {
          val.textContent = String(value);
        } else {
          const current = row.lastElementChild;
          if (current) current.textContent = String(value);
        }
      };

      const fillRows = (cardTitle, rows) => {
        if (!rows || !rows.length) return;
        const card = findCard(cardTitle);
        if (!card) return;
        const elements = Array.from(card.querySelectorAll(".metric-row"));
        rows.forEach((row, index) => {
          const el = elements[index];
          if (!el) return;
          const label = el.querySelector(".metric-label");
          const value = el.querySelector(".metric-val");
          if (label) label.textContent = row.label;
          if (value) value.textContent = row.value;
        });
      };

      const setStatus = (elementId, kind, message) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.textContent = message || "";
        if (kind === "success") {
          el.style.color = "var(--lime)";
        } else if (kind === "error") {
          el.style.color = "var(--coral)";
        } else {
          el.style.color = "var(--text3)";
        }
      };

      const postJson = async (url, body) => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload.success === false) {
          throw new Error(payload.error || "Request failed.");
        }
        return payload;
      };

      const getJson = async (url) => {
        const res = await fetch(url, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload.success === false) {
          throw new Error(payload.error || "Request failed.");
        }
        return payload;
      };

      const memberOptions = Array.isArray(data.memberOptions) && data.memberOptions.length
        ? data.memberOptions
        : Array.isArray(data.coach && data.coach.members)
          ? data.coach.members
          : [];
      const fillMemberSelects = () => {
        if (!memberOptions.length) return;
        const selectIds = [
          "log-member-select",
          "health-member-select",
          "protocol-member-select",
          "message-recipient-select",
        ];
        selectIds.forEach((id) => {
          const select = document.getElementById(id);
          if (!select || select.tagName !== "SELECT") return;
          const previousValue = select.value;
          select.innerHTML = "";
          memberOptions.forEach((member) => {
            const option = document.createElement("option");
            option.value = String(member.id || "");
            option.textContent = String(member.name || "Member");
            select.appendChild(option);
          });
          const hasPrevious = Array.from(select.options).some(
            (option) => option.value === previousValue,
          );
          if (hasPrevious) {
            select.value = previousValue;
          }
        });
      };

      const wireLogSessionForm = () => {
        const submit = document.getElementById("log-session-submit");
        if (!submit) return;
        submit.addEventListener("click", async () => {
          try {
            setStatus("log-session-status", "info", "Saving session…");
            submit.setAttribute("disabled", "true");
            const member = document.getElementById("log-member-select");
            const equipment = document.getElementById("log-equipment-select");
            const duration = document.getElementById("log-duration-input");
            const effort = document.getElementById("log-effort-input");
            const completed = document.getElementById("log-completed-select");
            const protocol = document.getElementById("log-protocol-input");
            const notes = document.getElementById("log-notes-input");

            const memberId = member && "value" in member ? member.value : "";
            const equipmentValue = equipment && "value" in equipment ? equipment.value : "";
            if (!memberId || !equipmentValue) {
              throw new Error("Please choose a member and equipment.");
            }

            await postJson("/api/coach/log-session", {
              member_id: memberId,
              equipment: equipmentValue,
              duration_minutes: duration && "value" in duration ? duration.value : "",
              perceived_effort: effort && "value" in effort ? effort.value : "",
              completed: completed && "value" in completed ? completed.value === "true" : true,
              protocol_or_exercise: protocol && "value" in protocol ? protocol.value : "",
              staff_notes: notes && "value" in notes ? notes.value : "",
            });
            setStatus("log-session-status", "success", "Session logged.");
            if (notes && "value" in notes) notes.value = "";
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not log session.";
            setStatus("log-session-status", "error", message);
          } finally {
            submit.removeAttribute("disabled");
          }
        });
      };

      const wireHealthspanForm = () => {
        const submit = document.getElementById("health-submit");
        if (!submit) return;
        submit.addEventListener("click", async () => {
          try {
            setStatus("health-status", "info", "Saving scores…");
            submit.setAttribute("disabled", "true");
            const member = document.getElementById("health-member-select");
            const muscle = document.getElementById("health-muscle-input");
            const cardio = document.getElementById("health-cardio-input");
            const metabolic = document.getElementById("health-metabolic-input");
            const structural = document.getElementById("health-structural-input");
            const recovery = document.getElementById("health-recovery-input");
            const notes = document.getElementById("health-notes-input");
            const memberId = member && "value" in member ? member.value : "";
            if (!memberId) throw new Error("Please choose a member.");

            const result = await postJson("/api/coach/healthspan", {
              member_id: memberId,
              muscle_score: muscle && "value" in muscle ? muscle.value : "",
              cardio_score: cardio && "value" in cardio ? cardio.value : "",
              metabolic_score: metabolic && "value" in metabolic ? metabolic.value : "",
              structural_score: structural && "value" in structural ? structural.value : "",
              recovery_score: recovery && "value" in recovery ? recovery.value : "",
              dustin_notes: notes && "value" in notes ? notes.value : "",
            });
            setStatus(
              "health-status",
              "success",
              "Scores updated. Overall " + String(result.overall_score || "") + ".",
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not update scores.";
            setStatus("health-status", "error", message);
          } finally {
            submit.removeAttribute("disabled");
          }
        });
      };

      const wireProtocolForm = () => {
        const submit = document.getElementById("protocol-submit");
        if (!submit) return;
        submit.addEventListener("click", async () => {
          try {
            setStatus("protocol-status", "info", "Creating protocol…");
            submit.setAttribute("disabled", "true");
            const member = document.getElementById("protocol-member-select");
            const name = document.getElementById("protocol-name-input");
            const primaryGoal = document.getElementById("protocol-primary-goal-input");
            const secondaryGoal = document.getElementById("protocol-secondary-goal-input");
            const weekCurrent = document.getElementById("protocol-week-current-input");
            const weekTotal = document.getElementById("protocol-week-total-input");
            const description = document.getElementById("protocol-description-input");
            const sessionsInput = document.getElementById("protocol-sessions-input");
            const notes = document.getElementById("protocol-notes-input");
            const memberId = member && "value" in member ? member.value : "";
            const protocolName = name && "value" in name ? name.value : "";
            if (!memberId || !protocolName) {
              throw new Error("Please choose a member and protocol name.");
            }

            const sessionLines = sessionsInput && "value" in sessionsInput
              ? String(sessionsInput.value || "")
                  .split("\\n")
                  .map((line) => line.trim())
                  .filter((line) => line.length > 0)
              : [];
            const sessions = sessionLines.map((line, index) => {
              const parts = line.split("|").map((part) => part.trim());
              return {
                name: parts[0] || "Session " + String(index + 1),
                description: parts[1] || "",
                equipment: parts[2] || "other",
                duration_minutes: parts[3] || "20",
                order_index: index + 1,
                status: "pending",
              };
            });
            if (!sessions.length) {
              sessions.push({
                name: "Session 1",
                description: "Auto-generated from protocol form",
                equipment: "other",
                duration_minutes: "20",
                order_index: 1,
                status: "pending",
              });
            }

            await postJson("/api/coach/protocols", {
              member_id: memberId,
              name: protocolName,
              primary_goal: primaryGoal && "value" in primaryGoal ? primaryGoal.value : "",
              secondary_goal: secondaryGoal && "value" in secondaryGoal ? secondaryGoal.value : "",
              week_current: weekCurrent && "value" in weekCurrent ? weekCurrent.value : "1",
              week_total: weekTotal && "value" in weekTotal ? weekTotal.value : "12",
              description: description && "value" in description ? description.value : "",
              dustin_notes: notes && "value" in notes ? notes.value : "",
              sessions,
            });
            setStatus("protocol-status", "success", "Protocol created.");
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not create protocol.";
            setStatus("protocol-status", "error", message);
          } finally {
            submit.removeAttribute("disabled");
          }
        });
      };

      const wireCoachMessageForm = () => {
        const submit = document.getElementById("message-submit");
        if (!submit) return;
        submit.addEventListener("click", async () => {
          try {
            setStatus("message-status", "info", "Sending message…");
            submit.setAttribute("disabled", "true");
            const recipient = document.getElementById("message-recipient-select");
            const body = document.getElementById("message-body-input");
            const recipientId = recipient && "value" in recipient ? recipient.value : "";
            const bodyText = body && "value" in body ? body.value : "";
            if (!recipientId || !bodyText.trim()) {
              throw new Error("Please choose a member and write a message.");
            }
            await postJson("/api/messages/send", {
              recipient_id: recipientId,
              body: bodyText,
            });
            setStatus("message-status", "success", "Message sent.");
            if (body && "value" in body) body.value = "";
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not send message.";
            setStatus("message-status", "error", message);
          } finally {
            submit.removeAttribute("disabled");
          }
        });
      };

      const memberMessagesState = {
        coachId: "",
        coachName: "Dustin · Coach",
        supportsReadTracking: false,
        unreadCount: 0,
        messages: [],
        initialized: false,
      };

      const setMemberUnreadBadge = (count) => {
        const navBadge = document.querySelector("#member-nav .notif-wrap .nav-badge");
        if (navBadge) {
          if (count > 0) {
            navBadge.textContent = String(count);
            navBadge.style.display = "inline-flex";
          } else {
            navBadge.textContent = "0";
            navBadge.style.display = "none";
          }
        }
        const topbarDot = document.querySelector(".topbar-right .notif-dot");
        if (topbarDot) {
          topbarDot.style.display = count > 0 ? "inline-block" : "none";
        }
      };

      const formatMessageTime = (isoValue) => {
        if (!isoValue) return "";
        const parsed = new Date(isoValue);
        if (Number.isNaN(parsed.getTime())) return "";
        return parsed.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      };

      const ensureMemberMessagesDom = () => {
        const view = document.getElementById("view-messages");
        if (!view) return null;
        const card = view.querySelector(".card");
        if (!card || card.children.length < 2) return null;
        const inboxCol = card.children[0];
        const convoCol = card.children[1];
        if (!inboxCol || !convoCol) return null;
        if (!document.getElementById("member-messages-inbox-list")) {
          inboxCol.innerHTML = [
            '<div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text3)">Inbox</div>',
            '<div id="member-messages-inbox-list"></div>',
          ].join("");
        }
        if (!document.getElementById("member-messages-thread")) {
          convoCol.innerHTML = [
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--border)">',
            '  <div class="msg-av" id="member-messages-coach-av" style="width:36px;height:36px;font-size:13px;background:var(--amber-dim);color:var(--amber)">D</div>',
            '  <div><div id="member-messages-coach-name" style="font-size:13.5px;font-weight:500;color:var(--text)">Dustin</div><div style="font-size:11px;color:var(--text3)">Head Coach · Iso Club</div></div>',
            "</div>",
            '<div id="member-messages-thread" style="flex:1;overflow:auto;max-height:360px"></div>',
            '<div style="margin-top:16px;display:flex;gap:8px;padding-top:14px;border-top:1px solid var(--border)">',
            '  <input id="member-message-input" type="text" placeholder="Reply to Dustin…" class="form-input" style="flex:1">',
            '  <button id="member-message-send" class="btn btn-lime">Send</button>',
            "</div>",
            '<div id="member-message-status" style="margin-top:8px;font-size:12px;color:var(--text3)"></div>',
          ].join("");
        }
        return {
          inboxList: document.getElementById("member-messages-inbox-list"),
          thread: document.getElementById("member-messages-thread"),
          input: document.getElementById("member-message-input"),
          send: document.getElementById("member-message-send"),
          status: document.getElementById("member-message-status"),
          coachName: document.getElementById("member-messages-coach-name"),
          coachAv: document.getElementById("member-messages-coach-av"),
        };
      };

      const renderMemberMessages = () => {
        const refs = ensureMemberMessagesDom();
        if (!refs) return;
        if (refs.coachName) {
          refs.coachName.textContent = memberMessagesState.coachName || "Dustin";
        }
        if (refs.coachAv) {
          const initials = (memberMessagesState.coachName || "D")
            .split(" ")
            .map((part) => part.trim().charAt(0))
            .join("")
            .slice(0, 2)
            .toUpperCase();
          refs.coachAv.textContent = initials || "D";
        }

        if (refs.inboxList) {
          const latest = memberMessagesState.messages[memberMessagesState.messages.length - 1];
          const preview = latest && latest.body ? latest.body : "No messages yet";
          const unread = Number(memberMessagesState.unreadCount || 0);
          refs.inboxList.innerHTML = [
            `<div class="msg-thread ${unread > 0 ? "unread" : ""}" style="cursor:default">`,
            '  <div class="msg-av" style="background:var(--amber-dim);color:var(--amber)">D</div>',
            '  <div style="flex:1;min-width:0">',
            `    <div class="msg-from">${memberMessagesState.coachName || "Dustin · Coach"}</div>`,
            `    <div class="msg-preview">${String(preview).slice(0, 56)}</div>`,
            "  </div>",
            `  <div class="msg-time">${latest ? formatMessageTime(latest.created_at) : ""}</div>`,
            "</div>",
          ].join("");
        }

        if (refs.thread) {
          refs.thread.innerHTML = "";
          if (!memberMessagesState.messages.length) {
            const empty = document.createElement("div");
            empty.style.fontSize = "12px";
            empty.style.color = "var(--text3)";
            empty.textContent = "No messages yet. Send Dustin a note to start the thread.";
            refs.thread.appendChild(empty);
          } else {
            memberMessagesState.messages.forEach((message) => {
              const outbound = String(message.sender_id || "") === String(data.memberId || "");
              const row = document.createElement("div");
              row.style.display = "flex";
              row.style.justifyContent = outbound ? "flex-end" : "flex-start";
              row.style.marginBottom = "10px";

              const bubble = document.createElement("div");
              bubble.style.background = outbound ? "rgba(201,240,85,0.12)" : "var(--bg3)";
              bubble.style.border = `1px solid ${outbound ? "rgba(201,240,85,0.35)" : "var(--border)"}`;
              bubble.style.borderRadius = "var(--r-sm)";
              bubble.style.padding = "10px 12px";
              bubble.style.maxWidth = "460px";
              bubble.innerHTML = [
                `<p style="font-size:12.5px;color:${outbound ? "var(--text)" : "var(--text2)"};line-height:1.65;margin:0 0 6px 0">${String(message.body || "")}</p>`,
                `<div style="font-size:10px;color:var(--text3);text-align:${outbound ? "right" : "left"}">${formatMessageTime(message.created_at)}</div>`,
              ].join("");
              row.appendChild(bubble);
              refs.thread.appendChild(row);
            });
            refs.thread.scrollTop = refs.thread.scrollHeight;
          }
        }

        setMemberUnreadBadge(Number(memberMessagesState.unreadCount || 0));
      };

      const loadMemberMessages = async (markRead) => {
        try {
          const payload = await getJson(`/api/messages/inbox${markRead ? "?mark_read=1" : ""}`);
          memberMessagesState.coachId = String(payload.coach?.id || "");
          memberMessagesState.coachName = String(payload.coach?.full_name || "Dustin");
          memberMessagesState.unreadCount = Number(payload.unread_count || 0);
          memberMessagesState.supportsReadTracking = Boolean(payload.supports_read_tracking);
          memberMessagesState.messages = Array.isArray(payload.messages) ? payload.messages : [];
          memberMessagesState.initialized = true;
          renderMemberMessages();
          if (markRead) {
            memberMessagesState.unreadCount = 0;
            setMemberUnreadBadge(0);
          }
        } catch (error) {
          const refs = ensureMemberMessagesDom();
          if (refs?.status) {
            refs.status.textContent = error instanceof Error ? error.message : "Unable to load messages.";
            refs.status.style.color = "var(--coral)";
          }
        }
      };

      const wireMemberMessageReply = () => {
        const refs = ensureMemberMessagesDom();
        if (!refs || !refs.send || !refs.input) return;
        if (refs.send.getAttribute("data-wired") === "true") return;
        refs.send.setAttribute("data-wired", "true");

        refs.send.addEventListener("click", async () => {
          try {
            const bodyText = "value" in refs.input ? String(refs.input.value || "").trim() : "";
            if (!bodyText) {
              throw new Error("Message cannot be empty.");
            }
            if (refs.status) {
              refs.status.textContent = "Sending…";
              refs.status.style.color = "var(--text3)";
            }
            refs.send.setAttribute("disabled", "true");

            const latestThreadId =
              memberMessagesState.messages
                .map((msg) => String(msg.thread_id || ""))
                .filter((value) => value.length > 0)
                .slice(-1)[0] || "";

            const sendPayload = {
              body: bodyText,
              recipient_id: memberMessagesState.coachId || undefined,
              thread_id: latestThreadId || undefined,
            };
            const response = await postJson("/api/messages/send", sendPayload);
            const sentMessage = response && response.message ? response.message : null;
            if (sentMessage) {
              memberMessagesState.messages.push(sentMessage);
            }
            memberMessagesState.unreadCount = 0;
            renderMemberMessages();
            if ("value" in refs.input) refs.input.value = "";
            if (refs.status) {
              refs.status.textContent = "Message sent.";
              refs.status.style.color = "var(--lime)";
            }
          } catch (error) {
            if (refs.status) {
              refs.status.textContent =
                error instanceof Error ? error.message : "Could not send message.";
              refs.status.style.color = "var(--coral)";
            }
          } finally {
            refs.send.removeAttribute("disabled");
          }
        });
      };

      const injectMemberRecoveryLogLink = () => {
        const header = document.querySelector("#view-recovery .sec-header");
        if (!header) return;
        if (document.getElementById("member-recovery-log-link")) return;

        const link = document.createElement("a");
        link.id = "member-recovery-log-link";
        link.href = "/dashboard/recovery";
        link.textContent = "Log recovery session";
        link.className = "btn btn-lime btn-sm";
        link.style.textDecoration = "none";
        link.style.display = "inline-flex";
        link.style.alignItems = "center";
        header.appendChild(link);
      };

      const injectMemberUploadDataButton = () => {
        const topbarRight = document.querySelector(".topbar-right");
        if (!topbarRight) return;
        if (document.getElementById("member-upload-data-link")) return;

        const link = document.createElement("a");
        link.id = "member-upload-data-link";
        link.href = "/dashboard/upload";
        link.textContent = "Upload Data";
        link.className = "btn btn-sm";
        link.style.textDecoration = "none";
        link.style.display = "inline-flex";
        link.style.alignItems = "center";
        topbarRight.insertBefore(link, topbarRight.firstChild);
      };

      const injectMemberSettingsButton = () => {
        const topbarRight = document.querySelector(".topbar-right");
        if (!topbarRight) return;
        if (document.getElementById("member-settings-link")) return;

        const link = document.createElement("a");
        link.id = "member-settings-link";
        link.href = "/dashboard/settings";
        link.textContent = "Settings";
        link.className = "btn btn-sm";
        link.style.textDecoration = "none";
        link.style.display = "inline-flex";
        link.style.alignItems = "center";
        topbarRight.insertBefore(link, topbarRight.firstChild);
      };

      const injectMemberSettingsSidebarLink = () => {
        const memberNav = document.getElementById("member-nav");
        if (!memberNav) return;
        if (document.getElementById("member-settings-sidebar-link")) return;

        const link = document.createElement("a");
        link.id = "member-settings-sidebar-link";
        link.href = "/dashboard/settings";
        link.className = "nav-item";
        link.style.textDecoration = "none";
        link.innerHTML = [
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
          '  <circle cx="12" cy="12" r="3.2"></circle>',
          '  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .15 1.7 1.7 0 0 0-1 1.56V21.2a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1-.15 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.15-1 1.7 1.7 0 0 0-1.56-1H2.8a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0 .15-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.15 1.7 1.7 0 0 0 1-1.56V2.8a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1 .15 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c0 .35.05.69.15 1a1.7 1.7 0 0 0 1.56 1h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1c-.1.31-.15.65-.15 1z"></path>',
          "</svg>",
          '<span class="nav-label">Settings</span>',
        ].join("");
        memberNav.appendChild(link);
      };

      const injectCoachPhoneEditor = () => {
        const root = document.getElementById("coach-members");
        if (!root) return;
        if (document.getElementById("coach-phone-editor")) return;

        const card = document.createElement("div");
        card.id = "coach-phone-editor";
        card.className = "card";
        card.style.marginTop = "16px";
        card.innerHTML = [
          '<div class="sec-header">',
          '  <div class="sec-title">Member contact editor</div>',
          '  <span class="tag tag-lime">SMS required</span>',
          "</div>",
          '<div class="form-grid">',
          '  <div class="form-field"><div class="form-label">Member</div><select id="coach-phone-member-select" class="form-select"></select></div>',
          '  <div class="form-field"><div class="form-label">Full name</div><input id="coach-phone-name-input" class="form-input" placeholder="Member name"></div>',
          "</div>",
          '<div class="form-field"><div class="form-label">Phone number</div><input id="coach-phone-input" class="form-input" placeholder="(555) 555-1234"></div>',
          '<div style="display:flex;align-items:center;gap:10px;margin-top:10px">',
          '  <button id="coach-phone-save" class="btn btn-lime">Save contact</button>',
          '  <span id="coach-phone-status" style="font-size:12px;color:var(--text3)"></span>',
          "</div>",
        ].join("");
        root.appendChild(card);

        const select = document.getElementById("coach-phone-member-select");
        const nameInput = document.getElementById("coach-phone-name-input");
        const phoneInput = document.getElementById("coach-phone-input");
        const status = document.getElementById("coach-phone-status");
        const saveButton = document.getElementById("coach-phone-save");
        if (!select || !nameInput || !phoneInput || !saveButton) return;

        const members = Array.isArray(memberOptions) ? memberOptions : [];
        select.innerHTML = "";
        members.forEach((member) => {
          const option = document.createElement("option");
          option.value = String(member.id || "");
          option.textContent = String(member.name || "Member");
          select.appendChild(option);
        });

        const setStatus = (message, kind) => {
          if (!status) return;
          status.textContent = message || "";
          if (kind === "error") status.style.color = "var(--coral)";
          else if (kind === "success") status.style.color = "var(--lime)";
          else status.style.color = "var(--text3)";
        };

        const syncInputs = () => {
          const selected = members.find((member) => String(member.id) === String(select.value));
          if (!selected) return;
          if ("value" in nameInput) nameInput.value = String(selected.name || "");
          if ("value" in phoneInput) phoneInput.value = String(selected.phone || "");
        };
        select.addEventListener("change", syncInputs);
        syncInputs();

        saveButton.addEventListener("click", async () => {
          try {
            setStatus("Saving…", "info");
            saveButton.setAttribute("disabled", "true");
            const memberId = "value" in select ? String(select.value || "") : "";
            const fullName = "value" in nameInput ? String(nameInput.value || "").trim() : "";
            const phone = "value" in phoneInput ? String(phoneInput.value || "").trim() : "";
            if (!memberId || !phone) {
              throw new Error("Member and phone are required.");
            }
            await postJson("/api/coach/members/contact", {
              member_id: memberId,
              full_name: fullName,
              phone,
            });
            const selected = members.find((member) => String(member.id) === memberId);
            if (selected) {
              selected.name = fullName || selected.name;
              selected.phone = phone;
            }
            setStatus("Contact updated.", "success");
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Unable to save.", "error");
          } finally {
            saveButton.removeAttribute("disabled");
          }
        });
      };

      const memberPathByView = {
        dashboard: "/dashboard",
        protocol: "/dashboard/protocol",
        carol: "/dashboard/carol",
        arx: "/dashboard/arx",
        scans: "/dashboard/scans",
        recovery: "/dashboard/recovery",
        wearables: "/dashboard/wearables",
        messages: "/dashboard/messages",
        reports: "/dashboard/reports",
        schedule: "/dashboard/schedule",
      };
      const coachPathByView = {
        morning: "/coach",
        members: "/coach/members",
        log: "/coach/log",
        protocols: "/coach/protocols",
      };
      const originalShowView = typeof window.showView === "function"
        ? window.showView.bind(window)
        : null;
      const originalShowCoachView = typeof window.showCoachView === "function"
        ? window.showCoachView.bind(window)
        : null;

      if (originalShowView) {
        window.showView = (name) => {
          originalShowView(name);
          if (role === "member" && name === "messages") {
            wireMemberMessageReply();
            loadMemberMessages(true);
          }
          const targetPath = memberPathByView[name] || "/dashboard";
          if (window.location.pathname !== targetPath) {
            window.history.pushState({}, "", targetPath);
          }
        };
      }

      if (originalShowCoachView) {
        window.showCoachView = (name) => {
          originalShowCoachView(name);
          const targetPath = coachPathByView[name] || "/coach";
          if (window.location.pathname !== targetPath) {
            window.history.pushState({}, "", targetPath);
          }
        };
      }

      const applyRoleBasedToggleVisibility = () => {
        const toggle = document.querySelector(".view-toggle");
        if (!toggle) return;
        if (role === "member") {
          toggle.style.display = "none";
        } else {
          toggle.style.display = "flex";
        }
      };
      applyRoleBasedToggleVisibility();

      if (typeof setMode === "function") {
        setMode(role);
      }
      if (role === "member" && typeof showView === "function") {
        showView(initialMemberView);
      }
      if (role === "coach" && typeof showCoachView === "function") {
        showCoachView(initialCoachView);
      }

      setText("#user-name", data.displayName);
      setText("#user-av", data.initials);
      setText("#user-tier", data.tier);
      setText("#top-title", "Good morning, " + firstName(data.displayName) + ".");

      if (data.metrics) {
        setStatCardValue("CAROL fitness score", data.metrics.carolFitness);
        setStatCardValue("ARX leg press output", data.metrics.arxOutput);
        setStatCardValue("Lean mass", data.metrics.leanMass);
        setStatCardValue("Whoop recovery", data.metrics.whoopRecovery);
      }

      if (data.healthspan) {
        setMetricInCard("Healthspan OS", "Muscle", data.healthspan.muscle);
        setMetricInCard("Healthspan OS", "Cardio", data.healthspan.cardio);
        setMetricInCard("Healthspan OS", "Metabolic", data.healthspan.metabolic);
        setMetricInCard("Healthspan OS", "Structural", data.healthspan.structural);
        setMetricInCard("Healthspan OS", "Recovery", data.healthspan.recovery);
      }

      fillRows("REHIT ride history", data.carolHistory || []);
      fillRows("Exercise history", data.arxHistory || []);

      if (data.scan) {
        setMetricInCard("Body composition", "Body fat", data.scan.bodyFatPct);
        setMetricInCard("Body composition", "Weight", data.scan.weightLbs);
        setMetricInCard("Body composition", "Lean mass", data.scan.leanMassLbs);
        setMetricInCard("Posture analysis", "Head forward", data.scan.headForwardIn + "\"");
        setMetricInCard("Posture analysis", "Shoulder forward", data.scan.shoulderForwardIn + "\"");
        setMetricInCard("Posture analysis", "Hip forward", data.scan.hipForwardIn + "\"");
      }

      if (data.recoveryCounts) {
        setMetricInCard("Recovery sessions", "Infrared sauna", data.recoveryCounts.infraredSauna);
        setMetricInCard("Recovery sessions", "Cold plunge", data.recoveryCounts.coldPlunge);
        setMetricInCard("Recovery sessions", "NxPro", data.recoveryCounts.nxpro);
        setMetricInCard("Recovery sessions", "Compression", data.recoveryCounts.compression);
        setMetricInCard("Other sessions", "Vasper", data.recoveryCounts.vasper);
        setMetricInCard("Other sessions", "Katalyst", data.recoveryCounts.katalyst);
        setMetricInCard("Other sessions", "Proteus", data.recoveryCounts.proteus);
        setMetricInCard("Other sessions", "Quickboard", data.recoveryCounts.quickboard);
      }

      if (data.wearables) {
        setMetricInCard("Today's data", "Whoop recovery", data.wearables.whoopRecovery);
        setMetricInCard("Today's data", "Oura readiness", data.wearables.ouraReadiness);
        setMetricInCard("Today's data", "HRV", data.wearables.hrvMs + "ms");
        setMetricInCard("Today's data", "Sleep", data.wearables.sleepHours + "h");
      }

      if (data.protocol) {
        const track = document.querySelector("#view-dashboard .track-name");
        if (track) track.textContent = data.protocol.name;
        const trackMeta = document.querySelector("#view-dashboard .track-meta");
        if (trackMeta) {
          trackMeta.textContent =
            "Prescribed by Dustin · Week " +
            data.protocol.weekCurrent +
            " of " +
            data.protocol.weekTotal +
            " · 20 min sessions";
        }
        const sessions = Array.from(
          document.querySelectorAll("#view-dashboard .session-item"),
        );
        (data.protocol.sessions || []).forEach((session, index) => {
          const row = sessions[index];
          if (!row) return;
          const name = row.querySelector(".s-name");
          const detail = row.querySelector(".s-detail");
          const dur = row.querySelector(".s-dur");
          if (name) name.textContent = session.name;
          if (detail) detail.textContent = session.detail || "";
          if (dur) dur.textContent = (session.duration || "20") + " min";
        });
      }

      if (Array.isArray(data.bookings) && data.bookings.length) {
        const card = findCard("Upcoming");
        if (card) {
          const rows = Array.from(card.querySelectorAll(".metric-row"));
          data.bookings.forEach((booking, index) => {
            const row = rows[index];
            if (!row) return;
            const label = row.querySelector(".metric-label");
            if (label) label.textContent = booking.label;
            const tag = row.querySelector(".tag");
            if (tag) tag.textContent = booking.status;
          });
        }
      }

      if (Array.isArray(data.reports) && data.reports.length) {
        const card = findCard("Reports from Dustin");
        if (card) {
          const rows = Array.from(card.querySelectorAll(".metric-row"));
          data.reports.forEach((report, index) => {
            const row = rows[index];
            if (!row) return;
            const label = row.querySelector(".metric-label");
            if (label) label.textContent = report.title;
          });
        }
      }

      if (role === "coach" && data.coach) {
        const cmStats = Array.from(
          document.querySelectorAll("#coach-morning .cm-stats .stat-val"),
        );
        if (cmStats[0]) cmStats[0].textContent = data.coach.todayCount || "0";
        if (cmStats[1]) cmStats[1].textContent = data.coach.lowRecoveryCount || "0";
        if (cmStats[2]) cmStats[2].textContent = data.coach.readyCount || "0";

        const alerts = Array.from(document.querySelectorAll("#coach-morning .alert"));
        (data.coach.alerts || []).forEach((alert, index) => {
          if (alerts[index]) alerts[index].textContent = alert;
        });

        const cards = Array.from(
          document.querySelectorAll("#coach-morning .member-card"),
        );
        (data.coach.members || []).forEach((member, index) => {
          const card = cards[index];
          if (!card) return;
          const av = card.querySelector(".mc-av");
          const name = card.querySelector(".mc-name");
          const tier = card.querySelector(".card-sub");
          const score = card.querySelector(".mc-score");
          const rows = card.querySelectorAll(".mc-row");
          if (av) av.textContent = member.initials;
          if (name) name.textContent = member.name;
          if (tier) tier.textContent = member.tier;
          if (score) score.textContent = member.recovery;
          if (rows[0]) rows[0].lastElementChild.textContent = member.session;
          if (rows[1]) rows[1].lastElementChild.textContent = member.muscle;
        });

        const allRows = Array.from(document.querySelectorAll("#coach-members .metric-row"));
        (data.coach.members || []).forEach((member, index) => {
          const row = allRows[index];
          if (!row) return;
          const cells = Array.from(row.children);
          const memberCell = cells[0];
          const tierCell = cells[1];
          const recoveryCell = cells[2];
          const muscleCell = cells[3];
          const sessionCell = cells[4];

          if (memberCell) {
            const avatar = memberCell.querySelector(".mc-av");
            if (avatar) avatar.textContent = member.initials;

            const nameNode =
              memberCell.querySelector(".mc-name") ||
              memberCell.querySelector(".metric-label") ||
              memberCell.querySelector("div div");
            if (nameNode) nameNode.textContent = member.name;

            const existingBadge = memberCell.querySelector('[data-phone-missing-badge="true"]');
            if (existingBadge) existingBadge.remove();
            if (member.phoneMissing) {
              const badge = document.createElement("span");
              badge.setAttribute("data-phone-missing-badge", "true");
              badge.textContent = "Phone missing";
              badge.style.display = "inline-block";
              badge.style.marginLeft = "8px";
              badge.style.padding = "2px 6px";
              badge.style.borderRadius = "999px";
              badge.style.border = "1px solid var(--coral)";
              badge.style.background = "rgba(240,112,85,0.12)";
              badge.style.color = "var(--coral)";
              badge.style.fontSize = "10px";
              badge.style.letterSpacing = "0.04em";
              badge.style.textTransform = "uppercase";
              const parent = nameNode?.parentElement ?? memberCell;
              parent.appendChild(badge);
            }
          }

          if (tierCell) {
            const tag = tierCell.querySelector(".tag");
            if (tag) tag.textContent = member.tier;
          }
          if (recoveryCell) {
            recoveryCell.textContent = member.recovery;
            recoveryCell.style.color = Number(member.recovery) < 50 ? "var(--coral)" : "var(--lime)";
          }
          if (muscleCell) {
            muscleCell.textContent = member.muscle;
          }
          if (sessionCell) {
            sessionCell.textContent = member.session;
          }
        });
      }

      if (role === "coach") {
        fillMemberSelects();
        wireLogSessionForm();
        wireHealthspanForm();
        wireProtocolForm();
        wireCoachMessageForm();
        injectCoachPhoneEditor();
      }
      if (role === "member") {
        injectMemberRecoveryLogLink();
        injectMemberUploadDataButton();
        injectMemberSettingsButton();
        injectMemberSettingsSidebarLink();
        loadMemberMessages(initialMemberView === "messages");
        wireMemberMessageReply();
      }
    })();
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: prototype.styles }} />
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

      <div dangerouslySetInnerHTML={{ __html: prototype.body }} />
      {prototype.script ? (
        <script
          // This script powers prototype view switching and date rendering.
          dangerouslySetInnerHTML={{ __html: prototype.script }}
        />
      ) : null}
      <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
    </>
  );
}

export default async function DashboardPage() {
  return <DashboardPageView route="dashboard" />;
}
