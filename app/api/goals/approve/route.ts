import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type GoalEdit = {
  type: string;
  target_value: number;
};

type ApproveBody = {
  suggestion_id: string;
  member_id: string;
  // If provided, override the AI targets with Dustin's edits
  edited_goals?: GoalEdit[];
  coach_notes?: string;
};

const VALID_GOALS = ["gain_muscle", "lose_fat", "improve_cardio", "attendance"] as const;
type ValidGoal = (typeof VALID_GOALS)[number];

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context || !isCoachRole(context.role)) {
      return NextResponse.json(
        { success: false, error: error ?? "Coach access required." },
        { status: 403 },
      );
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }

    const body = (await request.json()) as ApproveBody;
    const suggestionId = asStr(body.suggestion_id);
    const memberId = asStr(body.member_id);
    const coachId = asStr(context.dbUser.id);

    if (!suggestionId || !memberId) {
      return NextResponse.json({ success: false, error: "suggestion_id and member_id required." }, { status: 400 });
    }

    // Fetch the suggestion
    const suggRes = await supabase
      .from("goal_suggestions")
      .select("suggestions,protocol_suggestion")
      .eq("id", suggestionId)
      .single();
    if (suggRes.error) throw new Error(suggRes.error.message);

    const rawSuggestions = Array.isArray(suggRes.data?.suggestions) ? (suggRes.data.suggestions as Array<Record<string, unknown>>) : [];
    const protocolSuggestion = asStr(suggRes.data?.protocol_suggestion);

    // Merge in any edited targets from Dustin
    const editMap: Record<string, number> = {};
    if (Array.isArray(body.edited_goals)) {
      for (const eg of body.edited_goals) {
        if (eg.type && eg.target_value !== undefined) editMap[eg.type] = eg.target_value;
      }
    }
    const isModified = Object.keys(editMap).length > 0;

    // Upsert member_goals for each suggested goal
    for (const s of rawSuggestions) {
      const goalType = asStr(s.type as unknown);
      if (!VALID_GOALS.includes(goalType as ValidGoal)) continue;
      const targetValue = editMap[goalType] ?? asNum(s.target_value as unknown);

      const upsertData: Record<string, unknown> = {
        member_id: memberId,
        goal_type: goalType,
        is_active: true,
        set_by: coachId,
        updated_at: new Date().toISOString(),
      };
      if (targetValue !== null) {
        upsertData.target_value = targetValue;
      }

      const upsertRes = await supabase
        .from("member_goals")
        .upsert(upsertData, { onConflict: "member_id,goal_type" });
      if (upsertRes.error) {
        // target_value column may not exist yet — retry without it
        if (/target_value/i.test(upsertRes.error.message)) {
          delete upsertData.target_value;
          await supabase.from("member_goals").upsert(upsertData, { onConflict: "member_id,goal_type" });
        } else {
          throw new Error(upsertRes.error.message);
        }
      }
    }

    // Assign suggested protocol if present
    if (protocolSuggestion) {
      const protoRes = await supabase
        .from("protocols")
        .select("id")
        .ilike("name", `%${protocolSuggestion}%`)
        .limit(1);
      if (!protoRes.error && protoRes.data && protoRes.data.length > 0) {
        const protocolId = asStr((protoRes.data[0] as Record<string, unknown>).id);
        if (protocolId) {
          // Deactivate any existing active assignment
          await supabase
            .from("member_protocols")
            .update({ status: "completed" })
            .eq("member_id", memberId)
            .eq("status", "active");
          // Assign new protocol
          await supabase.from("member_protocols").insert({
            member_id: memberId,
            protocol_id: protocolId,
            assigned_by: coachId,
            start_date: new Date().toISOString().slice(0, 10),
            status: "active",
            coach_notes: body.coach_notes ?? null,
          });
        }
      }
    }

    // Update goal_suggestions status
    await supabase
      .from("goal_suggestions")
      .update({
        status: isModified ? "modified" : "approved",
        reviewed_by: coachId,
        reviewed_at: new Date().toISOString(),
        coach_notes: body.coach_notes ?? null,
      })
      .eq("id", suggestionId);

    // Notify member
    await supabase.from("member_notifications").insert({
      member_id: memberId,
      message: "Dustin has reviewed your scan and set up your personalized goals and plan.",
      is_read: false,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to approve suggestions." },
      { status: 500 },
    );
  }
}
