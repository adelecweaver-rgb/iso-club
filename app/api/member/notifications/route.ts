import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

// GET — member fetches their own in-app notifications
export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    const memberId = asString(context.dbUser.id);
    if (!memberId) {
      return NextResponse.json({ success: false, error: "Could not resolve member ID." }, { status: 400 });
    }
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }
    const res = await supabase
      .from("member_notifications")
      .select("id,message,is_read,created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (res.error) throw new Error(res.error.message);
    const notifications = res.data ?? [];
    const unread_count = notifications.filter((n: Record<string, unknown>) => !n.is_read).length;
    return NextResponse.json({ success: true, notifications, unread_count });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load notifications." },
      { status: 500 },
    );
  }
}

// PATCH — mark one or all notifications as read
export async function PATCH(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    const memberId = asString(context.dbUser.id);
    if (!memberId) {
      return NextResponse.json({ success: false, error: "Could not resolve member ID." }, { status: 400 });
    }
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }
    const body = (await request.json()) as { notification_id?: string; mark_all_read?: boolean };
    if (body.mark_all_read) {
      await supabase
        .from("member_notifications")
        .update({ is_read: true })
        .eq("member_id", memberId)
        .eq("is_read", false);
    } else if (body.notification_id) {
      await supabase
        .from("member_notifications")
        .update({ is_read: true })
        .eq("id", body.notification_id)
        .eq("member_id", memberId);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update notification." },
      { status: 500 },
    );
  }
}

// POST — member sends a notification TO the coach (original behaviour preserved)
export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    const memberId = asString(context.dbUser.id);
    if (!memberId) {
      return NextResponse.json({ success: false, error: "Could not resolve member ID." }, { status: 400 });
    }
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }
    const body = (await request.json()) as { type?: string; message?: string };
    const type = asString(body.type, "general");
    const message = asString(body.message);
    if (!message) {
      return NextResponse.json({ success: false, error: "Message is required." }, { status: 400 });
    }
    const res = await supabase.from("coach_notifications").insert({
      member_id: memberId,
      type,
      message,
      is_read: false,
    });
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to send notification." },
      { status: 500 },
    );
  }
}
