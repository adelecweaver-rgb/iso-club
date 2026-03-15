import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  sendScanResultsSmsForMember,
  sendSessionReminderSmsForMember,
  sendWeeklySummarySms,
} from "@/lib/server/sms-notifications";

export const runtime = "nodejs";

type AnyRow = Record<string, unknown>;

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
    const sessionName = asString(booking.title, "") || asString(booking.session_type, "Session");
    const scheduledAt = asString(booking.scheduled_at, "");
    const dateLabel = formatSessionDateLabel(scheduledAt, timezone);
    const smsResult = await sendSessionReminderSmsForMember(
      supabase,
      memberId,
      sessionName,
      dateLabel,
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
    .select("id,member_id,dustin_reviewed,updated_at")
    .eq("dustin_reviewed", true)
    .gte("updated_at", scanLookback.toISOString())
    .lt("updated_at", now.toISOString())
    .limit(200);
  const scansRows = Array.isArray(scansQuery.data) ? (scansQuery.data as AnyRow[]) : [];
  for (const scan of scansRows) {
    summary.scanResults.scanned += 1;
    const memberId = asString(scan.member_id, "");
    if (!memberId) {
      summary.scanResults.skipped += 1;
      continue;
    }
    const smsResult = await sendScanResultsSmsForMember(supabase, memberId);
    if (smsResult.success) {
      summary.scanResults.sent += 1;
    } else if (smsResult.skipped) {
      summary.scanResults.skipped += 1;
    } else {
      summary.scanResults.failed += 1;
    }
  }

  const local = localTimeParts(now, timezone);
  if (local.weekday === "Sun" && local.hour === 8) {
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

      const [wearableRes, bookingRes] = await Promise.all([
        supabase
          .from("wearable_data")
          .select("recovery_score,recorded_date")
          .eq("member_id", memberId)
          .order("recorded_date", { ascending: false })
          .limit(1),
        supabase
          .from("bookings")
          .select("scheduled_at,title,session_type,status")
          .eq("member_id", memberId)
          .gte("scheduled_at", now.toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1),
      ]);
      const wearableRow =
        Array.isArray(wearableRes.data) && wearableRes.data.length > 0
          ? (wearableRes.data[0] as AnyRow)
          : null;
      const bookingRow =
        Array.isArray(bookingRes.data) && bookingRes.data.length > 0
          ? (bookingRes.data[0] as AnyRow)
          : null;
      const recoveryScore = asNumber(wearableRow?.recovery_score);
      const recoveryLabel =
        recoveryScore !== null ? Math.round(recoveryScore).toString() : "--";
      const nextSessionLabel = bookingRow
        ? formatSessionDateLabel(asString(bookingRow.scheduled_at, ""), timezone)
        : "none scheduled";

      const smsResult = await sendWeeklySummarySms(
        fullName,
        phone,
        recoveryLabel,
        nextSessionLabel,
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
