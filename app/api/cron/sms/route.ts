import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  sendScanResultsSmsForMember,
  sendSessionReminderSmsForMember,
  sendWeeklySummarySmsForMember,
  wasSmsSentRecently,
} from "@/lib/server/sms-notifications";

export const runtime = "nodejs";

type AnyRow = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function localTimeParts(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { weekday, hour, minute };
}

function formatSessionDateLabel(iso: string, timezone: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "tomorrow";
  return parsed.toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function loadProtocolFocus(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  memberId: string,
): Promise<string> {
  const protocol = await supabase
    .from("protocols")
    .select("primary_goal")
    .eq("member_id", memberId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (protocol.error || !Array.isArray(protocol.data) || protocol.data.length === 0) {
    return "quality movement and controlled intensity";
  }
  return asString(protocol.data[0]?.primary_goal, "quality movement and controlled intensity");
}

function isCronAuthorized(request: Request): boolean {
  const expected = (process.env.SMS_CRON_SECRET ?? process.env.CRON_SECRET ?? "").trim();
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const xCronSecret = request.headers.get("x-cron-secret") ?? "";
  const tokenFromQuery = new URL(request.url).searchParams.get("secret") ?? "";
  return (
    authHeader === `Bearer ${expected}` ||
    xCronSecret === expected ||
    tokenFromQuery === expected
  );
}

async function runCron(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized cron request." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      {
        success: false,
        error: "SUPABASE_SERVICE_ROLE_KEY is required for SMS cron automation.",
      },
      { status: 500 },
    );
  }

  const timezone = process.env.ISO_CLUB_TIMEZONE?.trim() || "America/Chicago";
  const now = new Date();
  const summary = {
    sessionReminder: { scanned: 0, sent: 0, skipped: 0, failed: 0 },
    scanResults: { scanned: 0, sent: 0, skipped: 0, failed: 0 },
    weeklySummary: { scanned: 0, sent: 0, skipped: 0, failed: 0, ran: false },
  };

  const reminderWindowStart = new Date(now.getTime() + (24 * 60 - 15) * 60 * 1000);
  const reminderWindowEnd = new Date(now.getTime() + (24 * 60 + 15) * 60 * 1000);
  const reminderBookings = await supabase
    .from("bookings")
    .select("id,member_id,scheduled_at,session_type,title,status")
    .gte("scheduled_at", reminderWindowStart.toISOString())
    .lt("scheduled_at", reminderWindowEnd.toISOString())
    .limit(200);
  const reminderRows = Array.isArray(reminderBookings.data)
    ? (reminderBookings.data as AnyRow[])
    : [];
  for (const booking of reminderRows) {
    summary.sessionReminder.scanned += 1;
    const status = asString(booking.status, "").toLowerCase();
    if (status === "cancelled" || status === "canceled") {
      summary.sessionReminder.skipped += 1;
      continue;
    }
    const memberId = asString(booking.member_id, "");
    if (!memberId) {
      summary.sessionReminder.skipped += 1;
      continue;
    }
    const alreadySent = await wasSmsSentRecently(
      supabase,
      memberId,
      "session_reminder",
      new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
    );
    if (alreadySent) {
      summary.sessionReminder.skipped += 1;
      continue;
    }
    const sessionName = asString(booking.title, "") || asString(booking.session_type, "Session");
    const scheduledAt = asString(booking.scheduled_at, "");
    const dateLabel = formatSessionDateLabel(scheduledAt, timezone);
    const keyFocus = await loadProtocolFocus(supabase, memberId);
    const smsResult = await sendSessionReminderSmsForMember(
      supabase,
      memberId,
      sessionName,
      dateLabel,
      keyFocus,
    );
    if (smsResult.success) {
      summary.sessionReminder.sent += 1;
    } else if (smsResult.skipped) {
      summary.sessionReminder.skipped += 1;
    } else {
      summary.sessionReminder.failed += 1;
    }
  }

  const scanLookback = new Date(now.getTime() - 65 * 60 * 1000);
  const scansQuery = await supabase
    .from("fit3d_scans")
    .select(
      "id,member_id,dustin_reviewed,updated_at,scan_date,body_fat_pct,lean_mass_lbs,weight_lbs",
    )
    .eq("dustin_reviewed", true)
    .gte("updated_at", scanLookback.toISOString())
    .lt("updated_at", now.toISOString())
    .limit(200);
  const scansRows = Array.isArray(scansQuery.data) ? (scansQuery.data as AnyRow[]) : [];
  for (const scan of scansRows) {
    summary.scanResults.scanned += 1;
    const memberId = asString(scan.member_id, "");
    const updatedAt = asString(scan.updated_at, "");
    if (!memberId) {
      summary.scanResults.skipped += 1;
      continue;
    }
    const dedupeSince = updatedAt || scanLookback.toISOString();
    const alreadySent = await wasSmsSentRecently(
      supabase,
      memberId,
      "scan_results_ready",
      dedupeSince,
    );
    if (alreadySent) {
      summary.scanResults.skipped += 1;
      continue;
    }
    const smsResult = await sendScanResultsSmsForMember(supabase, memberId, scan);
    if (smsResult.success) {
      summary.scanResults.sent += 1;
    } else if (smsResult.skipped) {
      summary.scanResults.skipped += 1;
    } else {
      summary.scanResults.failed += 1;
    }
  }

  const local = localTimeParts(now, timezone);
  if (local.weekday === "Sun" && local.hour === 8 && local.minute < 30) {
    summary.weeklySummary.ran = true;
    const members = await supabase
      .from("users")
      .select("id,full_name,phone")
      .eq("role", "member")
      .eq("is_active", true)
      .limit(500);
    const memberRows = Array.isArray(members.data) ? (members.data as AnyRow[]) : [];
    for (const member of memberRows) {
      summary.weeklySummary.scanned += 1;
      const memberId = asString(member.id, "");
      const fullName = asString(member.full_name, "Member");
      const phone = asString(member.phone, "");
      if (!memberId || !phone) {
        summary.weeklySummary.skipped += 1;
        continue;
      }
      const alreadySent = await wasSmsSentRecently(
        supabase,
        memberId,
        "weekly_summary",
        new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
      );
      if (alreadySent) {
        summary.weeklySummary.skipped += 1;
        continue;
      }
      const smsResult = await sendWeeklySummarySmsForMember(
        supabase,
        memberId,
        fullName,
        phone,
        now,
      );
      if (smsResult.success) {
        summary.weeklySummary.sent += 1;
      } else if (smsResult.skipped) {
        summary.weeklySummary.skipped += 1;
      } else {
        summary.weeklySummary.failed += 1;
      }
    }
  }

  return NextResponse.json({ success: true, timezone, summary });
}

export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}
