import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLowRecoverySmsTemplate,
  buildProtocolReadySmsTemplate,
  buildScanResultsSmsTemplate,
  buildSessionReminderSmsTemplate,
  buildWeeklySummarySmsTemplate,
  buildWelcomeSmsTemplate,
} from "@/lib/server/sms-templates";
import { sendIsoClubSms, type SmsResult } from "@/lib/server/sms";

type AnyRow = Record<string, unknown>;

type MessageType =
  | "welcome"
  | "protocol_ready"
  | "scan_results_ready"
  | "weekly_summary"
  | "session_reminder"
  | "low_recovery_flag";

export type NotificationResult = SmsResult & {
  memberId?: string;
  messageType?: MessageType;
};

type MemberContact = {
  memberId: string;
  fullName: string;
  phone: string;
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatSignedDelta(delta: number, digits = 1): string {
  const rounded = Math.abs(delta).toFixed(digits);
  if (delta > 0) return `+${rounded}`;
  if (delta < 0) return `-${rounded}`;
  return "0.0";
}

function statusFromResult(result: SmsResult): string {
  if (result.success) return "sent";
  if (result.skipped) {
    return `skipped${result.error ? `: ${result.error}` : ""}`.slice(0, 250);
  }
  return `failed${result.error ? `: ${result.error}` : ""}`.slice(0, 250);
}

async function appendSmsLog(
  supabase: SupabaseClient,
  entry: {
    memberId: string;
    messageType: MessageType;
    messageBody: string;
    status: string;
  },
): Promise<void> {
  try {
    await supabase.from("sms_log").insert({
      member_id: entry.memberId,
      message_type: entry.messageType,
      message_body: entry.messageBody,
      sent_at: new Date().toISOString(),
      status: entry.status,
    });
  } catch {
    // Never crash the request if sms_log write fails.
  }
}

async function sendAndLog(
  supabase: SupabaseClient,
  memberId: string,
  messageType: MessageType,
  phone: string,
  messageBody: string,
): Promise<NotificationResult> {
  const result = await sendIsoClubSms(phone, messageBody);
  await appendSmsLog(supabase, {
    memberId,
    messageType,
    messageBody,
    status: statusFromResult(result),
  });
  return { ...result, memberId, messageType };
}

async function loadMemberContact(
  supabase: SupabaseClient,
  memberId: string,
): Promise<MemberContact | null> {
  const lookup = await supabase
    .from("users")
    .select("id,full_name,phone")
    .eq("id", memberId)
    .limit(1);
  if (lookup.error || !Array.isArray(lookup.data) || lookup.data.length === 0) {
    return null;
  }
  const row = lookup.data[0] as AnyRow;
  return {
    memberId: asString(row.id, memberId),
    fullName: asString(row.full_name, "Member"),
    phone: asString(row.phone, ""),
  };
}

export async function wasSmsSentRecently(
  supabase: SupabaseClient,
  memberId: string,
  messageType: MessageType,
  sinceIso: string,
): Promise<boolean> {
  const recent = await supabase
    .from("sms_log")
    .select("id")
    .eq("member_id", memberId)
    .eq("message_type", messageType)
    .gte("sent_at", sinceIso)
    .limit(1);
  return !recent.error && Array.isArray(recent.data) && recent.data.length > 0;
}

export async function sendWelcomeSms(
  supabase: SupabaseClient,
  memberId: string,
  fullName: string,
  phone: string,
): Promise<NotificationResult> {
  const messageBody = buildWelcomeSmsTemplate(fullName);
  return sendAndLog(supabase, memberId, "welcome", phone, messageBody);
}

export async function sendProtocolReadySmsForMember(
  supabase: SupabaseClient,
  memberId: string,
  primaryGoal: string,
): Promise<NotificationResult> {
  const contact = await loadMemberContact(supabase, memberId);
  if (!contact?.phone) {
    const messageBody = buildProtocolReadySmsTemplate("Member", primaryGoal);
    const skipped: NotificationResult = {
      success: false,
      skipped: true,
      error: "Member phone not available.",
      memberId,
      messageType: "protocol_ready",
    };
    await appendSmsLog(supabase, {
      memberId,
      messageType: "protocol_ready",
      messageBody,
      status: statusFromResult(skipped),
    });
    return skipped;
  }
  const messageBody = buildProtocolReadySmsTemplate(contact.fullName, primaryGoal);
  return sendAndLog(
    supabase,
    contact.memberId,
    "protocol_ready",
    contact.phone,
    messageBody,
  );
}

function buildScanHeadline(currentScan: AnyRow | null, previousScan: AnyRow | null): string {
  const currentBodyFat = asNumber(currentScan?.body_fat_pct);
  const previousBodyFat = asNumber(previousScan?.body_fat_pct);
  if (currentBodyFat !== null) {
    if (previousBodyFat !== null) {
      const delta = currentBodyFat - previousBodyFat;
      return `${currentBodyFat.toFixed(2)}% body fat (${formatSignedDelta(delta, 2)} vs last scan)`;
    }
    return `${currentBodyFat.toFixed(2)}% body fat`;
  }

  const currentLean = asNumber(currentScan?.lean_mass_lbs);
  const previousLean = asNumber(previousScan?.lean_mass_lbs);
  if (currentLean !== null) {
    if (previousLean !== null) {
      const delta = currentLean - previousLean;
      return `${currentLean.toFixed(1)} lbs lean mass (${formatSignedDelta(delta)} vs last scan)`;
    }
    return `${currentLean.toFixed(1)} lbs lean mass`;
  }

  const currentWeight = asNumber(currentScan?.weight_lbs);
  if (currentWeight !== null) {
    return `${currentWeight.toFixed(1)} lbs body weight`;
  }

  return "new metrics available";
}

export async function sendScanResultsSmsForMember(
  supabase: SupabaseClient,
  memberId: string,
  scanRow?: AnyRow | null,
): Promise<NotificationResult> {
  const contact = await loadMemberContact(supabase, memberId);
  if (!contact?.phone) {
    const messageBody = buildScanResultsSmsTemplate("Member", "new metrics available");
    const skipped: NotificationResult = {
      success: false,
      skipped: true,
      error: "Member phone not available.",
      memberId,
      messageType: "scan_results_ready",
    };
    await appendSmsLog(supabase, {
      memberId,
      messageType: "scan_results_ready",
      messageBody,
      status: statusFromResult(skipped),
    });
    return skipped;
  }

  let currentScan = scanRow ?? null;
  let previousScan: AnyRow | null = null;
  if (!currentScan) {
    const scans = await supabase
      .from("fit3d_scans")
      .select("body_fat_pct,lean_mass_lbs,weight_lbs,scan_date")
      .eq("member_id", memberId)
      .order("scan_date", { ascending: false })
      .limit(2);
    if (!scans.error && Array.isArray(scans.data) && scans.data.length > 0) {
      currentScan = scans.data[0] as AnyRow;
      previousScan = scans.data[1] as AnyRow | null;
    }
  } else {
    const previous = await supabase
      .from("fit3d_scans")
      .select("body_fat_pct,lean_mass_lbs,weight_lbs,scan_date")
      .eq("member_id", memberId)
      .order("scan_date", { ascending: false })
      .range(1, 1);
    if (!previous.error && Array.isArray(previous.data) && previous.data.length > 0) {
      previousScan = previous.data[0] as AnyRow;
    }
  }

  const headline = buildScanHeadline(currentScan, previousScan);
  const messageBody = buildScanResultsSmsTemplate(contact.fullName, headline);
  return sendAndLog(
    supabase,
    contact.memberId,
    "scan_results_ready",
    contact.phone,
    messageBody,
  );
}

async function countSessionsCompletedLast7Days(
  supabase: SupabaseClient,
  memberId: string,
  now: Date,
): Promise<number> {
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const startIso = weekStart.toISOString();
  const endIso = now.toISOString();

  const [arx, carol, manual, recovery] = await Promise.all([
    supabase
      .from("arx_sessions")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .gte("session_date", startIso)
      .lt("session_date", endIso),
    supabase
      .from("carol_sessions")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .gte("session_date", startIso)
      .lt("session_date", endIso),
    supabase
      .from("manual_workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .gte("session_date", startIso)
      .lt("session_date", endIso),
    supabase
      .from("recovery_sessions")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .gte("session_date", startIso)
      .lt("session_date", endIso),
  ]);
  return (arx.count ?? 0) + (carol.count ?? 0) + (manual.count ?? 0) + (recovery.count ?? 0);
}

function healthspanOverallFromRow(row: AnyRow | null): number | null {
  if (!row) return null;
  const direct = asNumber(row.overall_score);
  if (direct !== null) return direct;
  const scores = [
    asNumber(row.muscle_score),
    asNumber(row.cardio_score),
    asNumber(row.metabolic_score),
    asNumber(row.structural_score),
    asNumber(row.recovery_score),
  ].filter((value): value is number => value !== null);
  if (scores.length === 0) return null;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

async function loadHealthspanSummary(
  supabase: SupabaseClient,
  memberId: string,
): Promise<{ score: string; trend: "up" | "down" | "flat" }> {
  const res = await supabase
    .from("healthspan_scores")
    .select(
      "overall_score,muscle_score,cardio_score,metabolic_score,structural_score,recovery_score,recorded_at",
    )
    .eq("member_id", memberId)
    .order("recorded_at", { ascending: false })
    .limit(2);
  if (res.error || !Array.isArray(res.data) || res.data.length === 0) {
    return { score: "--", trend: "flat" };
  }
  const latest = healthspanOverallFromRow(res.data[0] as AnyRow);
  const previous = healthspanOverallFromRow((res.data[1] as AnyRow | undefined) ?? null);
  if (latest === null) {
    return { score: "--", trend: "flat" };
  }
  const diff = previous === null ? 0 : latest - previous;
  const trend: "up" | "down" | "flat" =
    diff > 0.3 ? "up" : diff < -0.3 ? "down" : "flat";
  return { score: Math.round(latest).toString(), trend };
}

async function loadWeeklyHighlight(
  supabase: SupabaseClient,
  memberId: string,
): Promise<string> {
  const wearable = await supabase
    .from("wearable_data")
    .select("recovery_score,recorded_date")
    .eq("member_id", memberId)
    .order("recorded_date", { ascending: false })
    .limit(1);
  const latestWearable =
    !wearable.error && Array.isArray(wearable.data) && wearable.data.length > 0
      ? (wearable.data[0] as AnyRow)
      : null;
  const recovery = asNumber(latestWearable?.recovery_score);
  if (recovery !== null && recovery >= 70) {
    return "Recovery trend is strong heading into next week";
  }

  const nextBooking = await supabase
    .from("bookings")
    .select("scheduled_at,title,session_type,status")
    .eq("member_id", memberId)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1);
  const booking =
    !nextBooking.error && Array.isArray(nextBooking.data) && nextBooking.data.length > 0
      ? (nextBooking.data[0] as AnyRow)
      : null;
  if (booking) {
    const title = asString(booking.title, "") || asString(booking.session_type, "session");
    return `Next up: ${title}`;
  }
  return "You built consistency this week";
}

export async function sendWeeklySummarySmsForMember(
  supabase: SupabaseClient,
  memberId: string,
  fullName: string,
  phone: string,
  now: Date,
): Promise<NotificationResult> {
  const sessionsCompleted = await countSessionsCompletedLast7Days(supabase, memberId, now);
  const healthspan = await loadHealthspanSummary(supabase, memberId);
  const highlight = await loadWeeklyHighlight(supabase, memberId);
  const messageBody = buildWeeklySummarySmsTemplate(
    fullName,
    sessionsCompleted,
    healthspan.score,
    healthspan.trend,
    highlight,
  );
  return sendAndLog(supabase, memberId, "weekly_summary", phone, messageBody);
}

export async function sendSessionReminderSmsForMember(
  supabase: SupabaseClient,
  memberId: string,
  sessionName: string,
  sessionTimeLabel: string,
  keyFocus: string,
): Promise<NotificationResult> {
  const contact = await loadMemberContact(supabase, memberId);
  if (!contact?.phone) {
    const messageBody = buildSessionReminderSmsTemplate(
      "Member",
      sessionName,
      sessionTimeLabel,
      keyFocus,
    );
    const skipped: NotificationResult = {
      success: false,
      skipped: true,
      error: "Member phone not available.",
      memberId,
      messageType: "session_reminder",
    };
    await appendSmsLog(supabase, {
      memberId,
      messageType: "session_reminder",
      messageBody,
      status: statusFromResult(skipped),
    });
    return skipped;
  }
  const messageBody = buildSessionReminderSmsTemplate(
    contact.fullName,
    sessionName,
    sessionTimeLabel,
    keyFocus,
  );
  return sendAndLog(
    supabase,
    contact.memberId,
    "session_reminder",
    contact.phone,
    messageBody,
  );
}

export async function sendLowRecoverySmsForMember(
  supabase: SupabaseClient,
  memberId: string,
  recoveryScore: number,
): Promise<NotificationResult> {
  const contact = await loadMemberContact(supabase, memberId);
  if (!contact?.phone) {
    const messageBody = buildLowRecoverySmsTemplate("Member", recoveryScore);
    const skipped: NotificationResult = {
      success: false,
      skipped: true,
      error: "Member phone not available.",
      memberId,
      messageType: "low_recovery_flag",
    };
    await appendSmsLog(supabase, {
      memberId,
      messageType: "low_recovery_flag",
      messageBody,
      status: statusFromResult(skipped),
    });
    return skipped;
  }
  const messageBody = buildLowRecoverySmsTemplate(
    contact.fullName,
    recoveryScore,
  );
  return sendAndLog(
    supabase,
    contact.memberId,
    "low_recovery_flag",
    contact.phone,
    messageBody,
  );
}
