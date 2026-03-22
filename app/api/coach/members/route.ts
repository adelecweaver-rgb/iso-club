import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachRole(context.role)) {
      return NextResponse.json({ success: false, error: "Coach access required." }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient() ?? context.supabase;

    const res = await supabase
      .from("users")
      .select(
        "id,full_name,membership_tier,status,primary_goal,secondary_goals,health_conditions,injury_notes,days_available,contrast_therapy_preference,motivation_style,age_range",
      )
      .eq("role", "member")
      .eq("is_active", true)
      .order("full_name");

    if (res.error) throw new Error(res.error.message);

    return NextResponse.json({
      success: true,
      members: (res.data ?? []).map((m: Record<string, unknown>) => ({
        id: asStr(m.id),
        name: asStr(m.full_name, "Member"),
        tier: asStr(m.membership_tier),
        status: asStr(m.status, "active"),
        primaryGoal: asStr(m.primary_goal),
        secondaryGoals: asStrArray(m.secondary_goals),
        healthConditions: asStrArray(m.health_conditions),
        injuryNotes: asStr(m.injury_notes),
        daysAvailable: asNum(m.days_available),
        contrastTherapyPreference: asStr(m.contrast_therapy_preference),
        motivationStyle: asStr(m.motivation_style),
        ageRange: asStr(m.age_range),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load members." },
      { status: 500 },
    );
  }
}
