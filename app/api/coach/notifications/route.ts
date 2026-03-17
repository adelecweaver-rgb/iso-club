import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context || !isCoachRole(context.role)) {
      return NextResponse.json({ success: false, error: error ?? "Coach access required." }, { status: 403 });
    }
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });

    // Fetch notifications with member name via join
    const notifsRes = await supabase
      .from("coach_notifications")
      .select("id,member_id,type,message,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (notifsRes.error) throw new Error(notifsRes.error.message);

    const rows = notifsRes.data ?? [];
    const memberIds = [...new Set(rows.map((r) => asString(r.member_id as unknown)))].filter(Boolean);

    // Fetch member names
    const namesMap: Record<string, string> = {};
    if (memberIds.length > 0) {
      const usersRes = await supabase.from("users").select("id,full_name").in("id", memberIds);
      for (const u of usersRes.data ?? []) {
        namesMap[asString(u.id as unknown)] = asString(u.full_name as unknown, "Member");
      }
    }

    const notifications = rows.map((r) => ({
      id: asString(r.id as unknown),
      member_id: asString(r.member_id as unknown),
      member_name: namesMap[asString(r.member_id as unknown)] ?? "Member",
      type: asString(r.type as unknown, "general"),
      message: asString(r.message as unknown),
      is_read: (r.is_read as boolean) ?? false,
      created_at: asString(r.created_at as unknown),
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

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context || !isCoachRole(context.role)) {
      return NextResponse.json({ success: false, error: error ?? "Coach access required." }, { status: 403 });
    }
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    const body = (await request.json()) as { notification_id?: string; mark_all_read?: boolean };
    if (body.mark_all_read) {
      const res = await supabase.from("coach_notifications").update({ is_read: true }).eq("is_read", false);
      if (res.error) throw new Error(res.error.message);
    } else {
      const id = asString(body.notification_id);
      if (!id) return NextResponse.json({ success: false, error: "notification_id required." }, { status: 400 });
      const res = await supabase.from("coach_notifications").update({ is_read: true }).eq("id", id);
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
