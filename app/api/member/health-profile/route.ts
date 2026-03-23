import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  type OnboardingAnswers,
  computeOnboardingDiff,
  recommendProtocol,
  emptyAnswers,
} from "@/lib/onboarding";

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

function asOptionalNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function rowToAnswers(userRow: Record<string, unknown>, goalsArray: string[]): OnboardingAnswers {
  return {
    goals: goalsArray,
    health_limitations: asStringArray(userRow.health_limitations),
    notes: asString(userRow.notes) || null,
    days_available_per_week: asOptionalNumber(userRow.days_available_per_week),
    contrast_therapy_pref: asString(userRow.contrast_therapy_pref) || null,
    motivation_style: asString(userRow.motivation_style) || null,
  };
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

    const [userRes, goalsRes, snapshotRes] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id,health_limitations,notes,days_available_per_week,contrast_therapy_pref,motivation_style,onboarding_submitted_at,onboarding_updated_at",
        )
        .eq("id", memberId)
        .limit(1),
      supabase
        .from("member_goals")
        .select("goal_type")
        .eq("member_id", memberId)
        .eq("is_active", true),
      supabase
        .from("onboarding_snapshots")
        .select("id,saved_at,review_requested,answers")
        .eq("member_id", memberId)
        .order("saved_at", { ascending: false })
        .limit(1),
    ]);

    if (userRes.error) throw new Error(userRes.error.message);
    if (goalsRes.error) throw new Error(goalsRes.error.message);

    const userRow =
      Array.isArray(userRes.data) && userRes.data.length > 0
        ? (userRes.data[0] as Record<string, unknown>)
        : null;

    const activeGoals = (goalsRes.data ?? []).map((g: Record<string, unknown>) =>
      asString(g.goal_type),
    );

    const answers: OnboardingAnswers = userRow
      ? rowToAnswers(userRow, activeGoals)
      : { ...emptyAnswers(), goals: activeGoals };

    const latestSnapshot =
      !snapshotRes.error && Array.isArray(snapshotRes.data) && snapshotRes.data.length > 0
        ? (snapshotRes.data[0] as Record<string, unknown>)
        : null;

    return NextResponse.json({
      success: true,
      answers,
      onboarding_submitted_at: asString(userRow?.onboarding_submitted_at) || null,
      onboarding_updated_at: asString(userRow?.onboarding_updated_at) || null,
      latest_snapshot_id: latestSnapshot ? asString(latestSnapshot.id) : null,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load health profile." },
      { status: 500 },
    );
  }
}

type PostBody = {
  answers: OnboardingAnswers;
  request_review: boolean;
};

export async function POST(request: Request) {
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

    const body = (await request.json()) as PostBody;
    const next = body.answers as OnboardingAnswers;
    const requestReview = body.request_review === true;

    // Validate shape
    if (!Array.isArray(next.goals) || !Array.isArray(next.health_limitations)) {
      return NextResponse.json({ success: false, error: "Invalid answers shape." }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Fetch previous snapshot for diff (do not reconstruct from live columns)
    const prevSnapshotRes = await supabase
      .from("onboarding_snapshots")
      .select("answers")
      .eq("member_id", memberId)
      .order("saved_at", { ascending: false })
      .limit(1);

    const prevAnswers: OnboardingAnswers | null =
      !prevSnapshotRes.error &&
      Array.isArray(prevSnapshotRes.data) &&
      prevSnapshotRes.data.length > 0
        ? (prevSnapshotRes.data[0] as Record<string, unknown>).answers as OnboardingAnswers
        : null;

    // 1. Update users table columns
    const updateUserRes = await supabase
      .from("users")
      .update({
        health_limitations: next.health_limitations,
        notes: next.notes ?? null,
        days_available_per_week: next.days_available_per_week ?? null,
        contrast_therapy_pref: next.contrast_therapy_pref ?? null,
        motivation_style: next.motivation_style ?? null,
        onboarding_updated_at: now,
        ...(requestReview ? { member_status: "review_requested" } : {}),
      })
      .eq("id", memberId);

    if (updateUserRes.error) throw new Error(updateUserRes.error.message);

    // Set onboarding_submitted_at only if not already set
    if (!asString(context.dbUser.onboarding_submitted_at)) {
      await supabase
        .from("users")
        .update({ onboarding_submitted_at: now })
        .eq("id", memberId)
        .is("onboarding_submitted_at", null);
    }

    // 2. Upsert member_goals
    const existingGoalsRes = await supabase
      .from("member_goals")
      .select("id,goal_type,is_active")
      .eq("member_id", memberId);

    const existingGoals = (existingGoalsRes.data ?? []) as Array<{
      id: string;
      goal_type: string;
      is_active: boolean;
    }>;

    const newGoalSet = new Set(next.goals);
    const existingByType = new Map(existingGoals.map((g) => [g.goal_type, g]));

    // Deactivate goals no longer selected
    const toDeactivate = existingGoals
      .filter((g) => g.is_active && !newGoalSet.has(g.goal_type))
      .map((g) => g.id);
    if (toDeactivate.length > 0) {
      await supabase
        .from("member_goals")
        .update({ is_active: false, updated_at: now })
        .in("id", toDeactivate);
    }

    // Activate or insert goals now selected
    for (const goalType of next.goals) {
      const existing = existingByType.get(goalType);
      if (existing) {
        if (!existing.is_active) {
          await supabase
            .from("member_goals")
            .update({ is_active: true, updated_at: now })
            .eq("id", existing.id);
        }
      } else {
        await supabase.from("member_goals").insert({
          member_id: memberId,
          goal_type: goalType,
          is_active: true,
          set_by: "member",
          created_at: now,
          updated_at: now,
        });
      }
    }

    // 3. Append snapshot
    const snapshotInsert = await supabase.from("onboarding_snapshots").insert({
      member_id: memberId,
      saved_at: now,
      review_requested: requestReview,
      answers: next,
    });
    if (snapshotInsert.error) throw new Error(snapshotInsert.error.message);

    // 4. If review requested, create coach notification with diff + recommendation
    if (requestReview) {
      const diff = prevAnswers ? computeOnboardingDiff(prevAnswers, next) : [];
      const rec = recommendProtocol(next.goals);

      const memberName = asString(context.dbUser.full_name) || context.fullName || "A member";

      await supabase.from("coach_notifications").insert({
        member_id: memberId,
        type: "protocol_review_requested",
        message: `${memberName} updated their health profile and requested a protocol review.`,
        is_read: false,
        created_at: now,
        payload: {
          diff,
          recommendation: rec.name,
          recommendation_reason: rec.reason,
        },
      });
    }

    return NextResponse.json({ success: true, request_review: requestReview });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to save health profile." },
      { status: 500 },
    );
  }
}
