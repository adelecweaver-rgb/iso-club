import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLowRecoverySms,
  buildProtocolReadySms,
  buildScanResultsSms,
  buildSessionReminderSms,
  buildWeeklySummarySms,
  buildWelcomeSms,
} from "@/lib/server/sms-templates";
import { sendIsoClubSms, type SmsResult } from "@/lib/server/sms";

type AnyRow = Record<string, unknown>;

export type NotificationResult = SmsResult & {
  memberId?: string;
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

export async function sendWelcomeSms(
  fullName: string,
  phone: string,
): Promise<NotificationResult> {
  const message = buildWelcomeSms(fullName);
  return sendIsoClubSms(phone, message);
}

export async function sendProtocolReadySmsForMember(
  supabase: SupabaseClient,
  memberId: string,
  protocolName: string,
): Promise<NotificationResult> {
  const contact = await loadMemberContact(supabase, memberId);
  if (!contact?.phone) {
    return { success: false, skipped: true, error: "Member phone not available.", memberId };
  }
  const message = buildProtocolReadySms(contact.fullName, protocolName);
  const result = await sendIsoClubSms(contact.phone, message);
  return { ...result, memberId: contact.memberId };
}

export async function sendScanResultsSmsForMember(
  supabase: SupabaseClient,
  memberId: string,
): Promise<NotificationResult> {
  const contact = await loadMemberContact(supabase, memberId);
  if (!contact?.phone) {
    return { success: false, skipped: true, error: "Member phone not available.", memberId };
  }
  const message = buildScanResultsSms(contact.fullName);
  const result = await sendIsoClubSms(contact.phone, message);
  return { ...result, memberId: contact.memberId };
}

export async function sendWeeklySummarySms(
  fullName: string,
  phone: string,
  recoveryScore: string,
  nextSession: string,
): Promise<NotificationResult> {
  const message = buildWeeklySummarySms(fullName, recoveryScore, nextSession);
  return sendIsoClubSms(phone, message);
}

export async function sendSessionReminderSmsForMember(
  supabase: SupabaseClient,
  memberId: string,
  sessionName: string,
  sessionTimeLabel: string,
): Promise<NotificationResult> {
  const contact = await loadMemberContact(supabase, memberId);
  if (!contact?.phone) {
    return { success: false, skipped: true, error: "Member phone not available.", memberId };
  }
  const message = buildSessionReminderSms(contact.fullName, sessionName, sessionTimeLabel);
  const result = await sendIsoClubSms(contact.phone, message);
  return { ...result, memberId: contact.memberId };
}

export async function sendLowRecoverySmsForMember(
  supabase: SupabaseClient,
  memberId: string,
  recoveryScore: number,
  deviceType: string,
): Promise<NotificationResult> {
  const contact = await loadMemberContact(supabase, memberId);
  if (!contact?.phone) {
    return { success: false, skipped: true, error: "Member phone not available.", memberId };
  }
  const message = buildLowRecoverySms(
    contact.fullName,
    Math.round(recoveryScore).toString(),
    deviceType,
  );
  const result = await sendIsoClubSms(contact.phone, message);
  return { ...result, memberId: contact.memberId };
}
