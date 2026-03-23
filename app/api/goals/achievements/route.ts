import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

// GET — member fetches uncelebrated achievements
export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    const memberId = asStr(context.dbUser.id);
    if (!memberId) {
      return NextResponse.json({ success: false, error: "Could not resolve member ID." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }

    const res = await supabase
      .from("goal_achievements")
      .select("id,goal_id,achieved_at,final_value,target_value,months_to_achieve,celebration_shown,member_goals(goal_type)")
      .eq("member_id", memberId)
      .eq("celebration_shown", false)
      .order("achieved_at", { ascending: false })
      .limit(5);
    if (res.error) throw new Error(res.error.message);

    return NextResponse.json({ success: true, achievements: res.data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load achievements." },
      { status: 500 },
    );
  }
}

// PATCH — mark an achievement's celebration as shown
export async function PATCH(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    const memberId = asStr(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }

    const body = (await request.json()) as { achievement_id?: string; mark_all?: boolean; new_target?: number; goal_id?: string };

    if (body.mark_all) {
      await supabase
        .from("goal_achievements")
        .update({ celebration_shown: true })
        .eq("member_id", memberId)
        .eq("celebration_shown", false);
    } else if (body.achievement_id) {
      await supabase
        .from("goal_achievements")
        .update({ celebration_shown: true })
        .eq("id", body.achievement_id)
        .eq("member_id", memberId);
    }

    // Handle "Set new target" — updates target_value on the member_goals row
    if (body.goal_id && body.new_target !== undefined) {
      await supabase
        .from("member_goals")
        .update({ target_value: body.new_target, updated_at: new Date().toISOString() })
        .eq("id", body.goal_id)
        .eq("member_id", memberId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update achievement." },
      { status: 500 },
    );
  }
}
