import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VALID_GOALS = ["gain_muscle", "lose_fat", "improve_cardio", "attendance"] as const;
type GoalType = (typeof VALID_GOALS)[number];

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

    // Fetch active goals with target values
    const goalsRes = await supabase
      .from("member_goals")
      .select("goal_type,is_active,target_value")
      .eq("member_id", memberId);

    // Fetch pending goal suggestion for this member
    const suggRes = await supabase
      .from("goal_suggestions")
      .select("id,suggestions,protocol_suggestion,protocol_reasoning,created_at,status")
      .eq("member_id", memberId)
      .in("status", ["pending"])
      .order("created_at", { ascending: false })
      .limit(1);

    // Fetch most recent fit3d scan (for current values + "has scan" flag)
    const scanRes = await supabase
      .from("fit3d_scans")
      .select("scan_date,body_fat_pct,lean_mass_lbs")
      .eq("member_id", memberId)
      .order("scan_date", { ascending: false })
      .limit(1);

    const hasScan = !scanRes.error && Array.isArray(scanRes.data) && scanRes.data.length > 0;
    const latestScan = hasScan ? (scanRes.data![0] as Record<string, unknown>) : null;

    // Build current_values map from latest scan
    const currentValues: Record<string, number | null> = {};
    if (latestScan) {
      if (latestScan.body_fat_pct !== null && latestScan.body_fat_pct !== undefined) {
        currentValues.lose_fat = asNum(latestScan.body_fat_pct);
      }
      if (latestScan.lean_mass_lbs !== null && latestScan.lean_mass_lbs !== undefined) {
        currentValues.gain_muscle = asNum(latestScan.lean_mass_lbs);
      }
    }

    const pendingSuggestion =
      !suggRes.error && Array.isArray(suggRes.data) && suggRes.data.length > 0
        ? suggRes.data[0]
        : null;

    return NextResponse.json({
      success: true,
      goals: (goalsRes.data ?? []).map((g: Record<string, unknown>) => ({
        goal_type: asString(g.goal_type),
        is_active: g.is_active !== false,
        target_value: asNum(g.target_value),
      })),
      has_scan: hasScan,
      current_values: currentValues,
      pending_suggestion: pendingSuggestion,
    });
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
    const body = (await request.json()) as { member_id?: string; goal_type?: string; is_active?: boolean; target_value?: number | null };
    const memberId = asString(body.member_id);
    const goalType = asString(body.goal_type) as GoalType;
    if (!memberId) return NextResponse.json({ success: false, error: "member_id required." }, { status: 400 });
    if (!VALID_GOALS.includes(goalType)) return NextResponse.json({ success: false, error: "Invalid goal_type." }, { status: 400 });
    const isActive = body.is_active !== false;

    const upsertData: Record<string, unknown> = {
      member_id: memberId,
      goal_type: goalType,
      is_active: isActive,
      set_by: coachId,
      updated_at: new Date().toISOString(),
    };
    if (body.target_value !== undefined && body.target_value !== null) {
      upsertData.target_value = body.target_value;
    }

    const res = await supabase.from("member_goals").upsert(upsertData, { onConflict: "member_id,goal_type" });
    if (res.error) {
      // target_value column may not exist yet — retry without it
      if (/target_value/i.test(res.error.message)) {
        delete upsertData.target_value;
        const retry = await supabase.from("member_goals").upsert(upsertData, { onConflict: "member_id,goal_type" });
        if (retry.error) throw new Error(retry.error.message);
      } else {
        throw new Error(res.error.message);
      }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
