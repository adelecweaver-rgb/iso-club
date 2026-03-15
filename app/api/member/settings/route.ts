import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type NotificationPreferences = {
  welcome_sms?: boolean;
  protocol_ready_sms?: boolean;
  scan_results_sms?: boolean;
  weekly_summary_sms?: boolean;
  session_reminder_sms?: boolean;
  low_recovery_sms?: boolean;
};

type Body = {
  full_name?: string;
  phone?: string;
  notification_preferences?: NotificationPreferences;
};

type AnyRow = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  if (typeof value === "number") return value === 1;
  return fallback;
}

function normalizePrefs(input: NotificationPreferences | undefined) {
  return {
    welcome_sms: asBoolean(input?.welcome_sms, true),
    protocol_ready_sms: asBoolean(input?.protocol_ready_sms, true),
    scan_results_sms: asBoolean(input?.scan_results_sms, true),
    weekly_summary_sms: asBoolean(input?.weekly_summary_sms, true),
    session_reminder_sms: asBoolean(input?.session_reminder_sms, true),
    low_recovery_sms: asBoolean(input?.low_recovery_sms, true),
  };
}

export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (context.role !== "member") {
      return NextResponse.json(
        { success: false, error: "Only members can view member settings." },
        { status: 403 },
      );
    }

    const memberId = asString(context.dbUser.id, "");
    if (!memberId) {
      return NextResponse.json(
        { success: false, error: "Member profile is missing id." },
        { status: 400 },
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "SUPABASE_SERVICE_ROLE_KEY is required." },
        { status: 500 },
      );
    }

    const [userRes, prefsRes] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id,full_name,phone")
        .eq("id", memberId)
        .limit(1),
      supabaseAdmin
        .from("member_notification_preferences")
        .select(
          "welcome_sms,protocol_ready_sms,scan_results_sms,weekly_summary_sms,session_reminder_sms,low_recovery_sms",
        )
        .eq("member_id", memberId)
        .limit(1),
    ]);

    const userRow =
      !userRes.error && Array.isArray(userRes.data) && userRes.data.length > 0
        ? (userRes.data[0] as AnyRow)
        : null;
    const prefsRow =
      !prefsRes.error && Array.isArray(prefsRes.data) && prefsRes.data.length > 0
        ? (prefsRes.data[0] as AnyRow)
        : null;

    return NextResponse.json({
      success: true,
      profile: {
        full_name: asString(userRow?.full_name, context.fullName),
        phone: asString(userRow?.phone, ""),
      },
      notification_preferences: normalizePrefs(prefsRow as NotificationPreferences | undefined),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load settings.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (context.role !== "member") {
      return NextResponse.json(
        { success: false, error: "Only members can update member settings." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;
    const memberId = asString(context.dbUser.id, "");
    if (!memberId) {
      return NextResponse.json(
        { success: false, error: "Member profile is missing id." },
        { status: 400 },
      );
    }

    const fullName = asString(body.full_name, context.fullName || "Member");
    const phone = asString(body.phone, "");
    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required for SMS notifications." },
        { status: 400 },
      );
    }
    const preferences = normalizePrefs(body.notification_preferences);

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "SUPABASE_SERVICE_ROLE_KEY is required." },
        { status: 500 },
      );
    }

    const [updateUserRes, upsertPrefsRes] = await Promise.all([
      supabaseAdmin
        .from("users")
        .update({
          full_name: fullName,
          phone,
        })
        .eq("id", memberId),
      supabaseAdmin
        .from("member_notification_preferences")
        .upsert(
          {
            member_id: memberId,
            ...preferences,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" },
        ),
    ]);

    if (updateUserRes.error) throw new Error(updateUserRes.error.message);
    if (
      upsertPrefsRes.error &&
      !/relation ["']?member_notification_preferences["']? does not exist|Could not find the table ["']?member_notification_preferences["']?/i.test(
        upsertPrefsRes.error.message,
      )
    ) {
      throw new Error(upsertPrefsRes.error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update settings.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
