import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

export async function GET(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context || !isCoachRole(context.role)) {
      return NextResponse.json({ success: false, error: error ?? "Coach access required." }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const memberId = asString(searchParams.get("member_id"));
    if (!memberId) return NextResponse.json({ success: false, error: "member_id required." }, { status: 400 });
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    const res = await supabase
      .from("session_notes")
      .select("id,note,created_at,coach_id")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ success: true, notes: res.data ?? [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context || !isCoachRole(context.role)) {
      return NextResponse.json({ success: false, error: error ?? "Coach access required." }, { status: 403 });
    }
    const coachId = asString(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    const body = (await request.json()) as { member_id?: string; note?: string };
    const memberId = asString(body.member_id);
    const note = asString(body.note);
    if (!memberId || !note) return NextResponse.json({ success: false, error: "member_id and note required." }, { status: 400 });
    const res = await supabase.from("session_notes").insert({ member_id: memberId, coach_id: coachId, note });
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
