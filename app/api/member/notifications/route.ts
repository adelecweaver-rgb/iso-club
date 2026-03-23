import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (context.role !== "member") {
      return NextResponse.json({ success: false, error: "Member access required." }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }

    const memberId = asString(context.dbUser.id);
    if (!memberId) {
      return NextResponse.json({ success: false, error: "Member id missing." }, { status: 400 });
    }

    const res = await supabase
      .from("member_notifications")
      .select("id,type,message,is_read,created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (res.error) throw new Error(res.error.message);

    const notifications = (res.data ?? []).map((n: Record<string, unknown>) => ({
      id: asString(n.id),
      type: asString(n.type, "general"),
      message: asString(n.message),
      is_read: (n.is_read as boolean) ?? false,
      created_at: asString(n.created_at),
    }));

    const unread_count = notifications.filter((n) => !n.is_read).length;

    return NextResponse.json({ success: true, notifications, unread_count });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load notifications." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (context.role !== "member") {
      return NextResponse.json({ success: false, error: "Member access required." }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }

    const memberId = asString(context.dbUser.id);
    const body = (await request.json()) as { notification_id?: string; mark_all_read?: boolean };

    if (body.mark_all_read) {
      const res = await supabase
        .from("member_notifications")
        .update({ is_read: true })
        .eq("member_id", memberId)
        .eq("is_read", false);
      if (res.error) throw new Error(res.error.message);
    } else {
      const id = asString(body.notification_id);
      if (!id) {
        return NextResponse.json(
          { success: false, error: "notification_id required." },
          { status: 400 },
        );
      }
      const res = await supabase
        .from("member_notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("member_id", memberId);
      if (res.error) throw new Error(res.error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update notification." },
      { status: 500 },
    );
  }
}
