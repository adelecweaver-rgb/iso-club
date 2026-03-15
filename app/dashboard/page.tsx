import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isClerkConfigured, safeAuth, safeCurrentUser } from "@/lib/server/clerk";

type PrototypeParts = {
  styles: string;
  body: string;
  script: string;
};

type DashboardPayload = {
  role: "member" | "coach";
  memberId: string | null;
  coachId: string | null;
  displayName: string;
  initials: string;
  tier: string;
  memberOptions: Array<{ id: string; name: string }>;
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
      recovery: string;
      muscle: string;
      session: string;
    }>;
  };
};

async function loadPrototypeParts(): Promise<PrototypeParts> {
  try {
    const html = await fs.readFile(path.join(process.cwd(), "index.html"), "utf8");

    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
    const bodyMatch = html.match(/<body>([\s\S]*?)<script>/i);
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);

    if (!styleMatch || !bodyMatch || !scriptMatch) {
      throw new Error("Could not parse prototype index.html.");
    }

    return {
      styles: styleMatch[1],
      body: bodyMatch[1],
      script: scriptMatch[1],
    };
  } catch {
    return {
      styles: "",
      body: `
        <main style="min-height:100vh;padding:24px;background:#1e2b1b;color:#f2e8dd;font-family:Arial,Helvetica,sans-serif;">
          <h2 style="margin:0 0 8px 0;">Dashboard template missing</h2>
          <p style="margin:0;">Could not load <code>/index.html</code>.</p>
        </main>
      `,
      script: "",
    };
  }
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

function makeDefaultPayload(clerkName: string): DashboardPayload {
  return {
    role: "member",
    memberId: null,
    coachId: null,
    displayName: clerkName || "Member",
    initials: initialsFromName(clerkName || "Member"),
    tier: "Premier",
    memberOptions: [],
    metrics: {
      carolFitness: "36.5",
      arxOutput: "699",
      leanMass: "159.6",
      whoopRecovery: "74",
    },
    healthspan: {
      muscle: "78",
      cardio: "65",
      metabolic: "71",
      structural: "58",
      recovery: "82",
    },
    carolHistory: [],
    arxHistory: [],
    scan: {
      bodyFatPct: "29.17",
      weightLbs: "225.3",
      leanMassLbs: "159.6",
      headForwardIn: "5.0",
      shoulderForwardIn: "3.5",
      hipForwardIn: "1.7",
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
      whoopRecovery: "74",
      ouraReadiness: "81",
      hrvMs: "68",
      sleepHours: "7.4",
    },
    protocol: {
      name: "Strength Foundation Track",
      weekCurrent: "7",
      weekTotal: "12",
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

async function loadDashboardLiveData(userId: string): Promise<DashboardPayload> {
  const user = await safeCurrentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const clerkName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    "Member";

  const payload = makeDefaultPayload(clerkName);
  const supabase = await createSupabaseServerClient();
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
  const isCoach =
    userRole.includes("coach") ||
    metadataRole.toLowerCase().includes("coach") ||
    email.toLowerCase().includes("dustin");
  payload.role = isCoach ? "coach" : "member";

  payload.memberId = stringOr(userRow?.id, "");
  payload.coachId = payload.memberId;
  payload.displayName = stringOr(userRow?.full_name, clerkName);
  payload.initials = initialsFromName(payload.displayName);
  payload.tier = stringOr(
    userRow?.membership_tier,
    payload.role === "coach" ? "Head Coach" : "Premier",
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

  payload.metrics.carolFitness = numberOr(carolLatest?.fitness_score, 36.5).toFixed(1);
  payload.metrics.arxOutput = Math.round(
    numberOr(arxLatest?.concentric_max, numberOr(arxLatest?.output, 699)),
  ).toString();
  payload.metrics.leanMass = numberOr(scanRow?.lean_mass_lbs, 159.6).toFixed(1);
  payload.metrics.whoopRecovery = Math.round(
    numberOr(whoopRow?.recovery_score, 74),
  ).toString();

  payload.healthspan = {
    muscle: Math.round(numberOr(healthRow?.muscle_score, 78)).toString(),
    cardio: Math.round(numberOr(healthRow?.cardio_score, 65)).toString(),
    metabolic: Math.round(numberOr(healthRow?.metabolic_score, 71)).toString(),
    structural: Math.round(numberOr(healthRow?.structural_score, 58)).toString(),
    recovery: Math.round(numberOr(healthRow?.recovery_score, 82)).toString(),
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
    bodyFatPct: numberOr(scanRow?.body_fat_pct, 29.17).toFixed(2),
    weightLbs: numberOr(scanRow?.weight_lbs, 225.3).toFixed(1),
    leanMassLbs: numberOr(scanRow?.lean_mass_lbs, 159.6).toFixed(1),
    headForwardIn: numberOr(scanRow?.posture_head_forward_in, 5.0).toFixed(1),
    shoulderForwardIn: numberOr(scanRow?.posture_shoulder_forward_in, 3.5).toFixed(1),
    hipForwardIn: numberOr(scanRow?.posture_hip_forward_in, 1.7).toFixed(1),
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
    whoopRecovery: Math.round(numberOr(whoopRow?.recovery_score, 74)).toString(),
    ouraReadiness: Math.round(numberOr(ouraRow?.readiness_score, 81)).toString(),
    hrvMs: Math.round(numberOr(whoopRow?.hrv_ms, 68)).toString(),
    sleepHours: numberOr(
      whoopRow?.sleep_duration_hrs,
      numberOr(ouraRow?.sleep_duration_hrs, 7.4),
    ).toFixed(1),
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
      numberOr(protocolRow.week_current, Number(payload.protocol.weekCurrent)),
    ).toString();
    payload.protocol.weekTotal = Math.round(
      numberOr(protocolRow.week_total, Number(payload.protocol.weekTotal)),
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
            .select("id,full_name,membership_tier")
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
        .select("id,full_name")
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
}: {
  route: "dashboard" | "coach";
}) {
  const clerkConfigured = isClerkConfigured();
  const { userId } = await safeAuth();
  const prototype = await loadPrototypeParts();

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

  if (!userId) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Please sign in</h1>
          <p className="muted">Sign in to access your dashboard.</p>
          <Link className="btn" href="/sign-in">
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  const livePayload = await loadDashboardLiveData(userId);
  if (route === "dashboard" && livePayload.role === "coach") {
    redirect("/coach");
  }
  if (route === "coach" && livePayload.role !== "coach") {
    redirect("/dashboard");
  }
  const payload = JSON.stringify(livePayload).replace(/</g, "\\u003c");
  const bootstrapScript = `
    (() => {
      const payload = ${payload};
      const role = payload.role === "coach" ? "coach" : "member";
      const data = payload || {};

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

      const wireMemberMessageReply = () => {
        const submit = document.getElementById("member-message-send");
        if (!submit) return;
        submit.addEventListener("click", async () => {
          try {
            setStatus("member-message-status", "info", "Sending…");
            submit.setAttribute("disabled", "true");
            const input = document.getElementById("member-message-input");
            const bodyText = input && "value" in input ? input.value : "";
            if (!bodyText.trim()) {
              throw new Error("Message cannot be empty.");
            }
            await postJson("/api/messages/send", { body: bodyText });
            setStatus("member-message-status", "success", "Message sent.");
            if (input && "value" in input) input.value = "";
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not send message.";
            setStatus("member-message-status", "error", message);
          } finally {
            submit.removeAttribute("disabled");
          }
        });
      };

      if (typeof setMode === "function") {
        setMode(role);
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
          const label = row.querySelector(".metric-label");
          const value = row.querySelector(".metric-val");
          if (label) label.textContent = member.name + " · " + member.tier;
          if (value) value.textContent = "Recovery " + member.recovery;
        });
      }

      if (role === "coach") {
        fillMemberSelects();
        wireLogSessionForm();
        wireHealthspanForm();
        wireProtocolForm();
        wireCoachMessageForm();
      }
      wireMemberMessageReply();
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
