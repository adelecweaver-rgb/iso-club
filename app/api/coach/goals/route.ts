import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VALID_GOALS = ["gain_muscle", "lose_fat", "improve_cardio", "attendance"] as const;
type GoalType = (typeof VALID_GOALS)[number];

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
    const res = await supabase.from("member_goals").select("goal_type,is_active").eq("member_id", memberId);
    return NextResponse.json({ success: true, goals: res.data ?? [] });
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
    const body = (await request.json()) as { member_id?: string; goal_type?: string; is_active?: boolean };
    const memberId = asString(body.member_id);
    const goalType = asString(body.goal_type) as GoalType;
    if (!memberId) return NextResponse.json({ success: false, error: "member_id required." }, { status: 400 });
    if (!VALID_GOALS.includes(goalType)) return NextResponse.json({ success: false, error: "Invalid goal_type." }, { status: 400 });
    const isActive = body.is_active !== false;
    const res = await supabase.from("member_goals").upsert(
      { member_id: memberId, goal_type: goalType, is_active: isActive, set_by: coachId, updated_at: new Date().toISOString() },
      { onConflict: "member_id,goal_type" },
    );
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
