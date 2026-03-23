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

function parseAiJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response did not include a JSON object.");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

const SYSTEM_PROMPT = `You are an expert health coach assistant at Iso Club, a premium longevity studio in Tulsa, Oklahoma.
You analyze member health data and suggest specific, achievable goals with measurable targets.
Respond in valid JSON only. No preamble. No markdown.`;

function buildUserPrompt(params: {
  age: number | null;
  gender: string;
  statedGoals: string;
  bodyFat: number | null;
  leanMass: number | null;
  weight: number | null;
  waist: number | null;
  bodyShapeRating: number | null;
  avgManp: number | null;
  peakPower: number | null;
}): string {
  const { age, gender, statedGoals, bodyFat, leanMass, weight, waist, bodyShapeRating, avgManp, peakPower } = params;
  return `Member data:
Age: ${age ?? "unknown"}
Gender: ${gender || "not specified"}
Stated goals from onboarding: ${statedGoals}

Most recent Fit3D scan:
Body fat %: ${bodyFat !== null ? `${bodyFat.toFixed(1)}%` : "not measured"}
Lean mass lbs: ${leanMass !== null ? `${leanMass.toFixed(1)} lbs` : "not measured"}
Weight lbs: ${weight !== null ? `${weight.toFixed(1)} lbs` : "not measured"}
Waist inches: ${waist !== null ? `${waist.toFixed(1)}"` : "not measured"}
Body shape rating: ${bodyShapeRating !== null ? bodyShapeRating.toFixed(1) : "not measured"}

Recent CAROL data:
Average MANP (last 30 days): ${avgManp !== null ? `${Math.round(avgManp)} W` : "no data"}
Peak power watts: ${peakPower !== null ? `${Math.round(peakPower)} W` : "no data"}

Based on this data suggest specific measurable goals with conservative targets achievable in 6-9 months with 2-3 sessions per week. Prioritize health and longevity over aesthetics. Only suggest goals supported by the data.

Respond in this exact JSON format:
{
  "goals": [
    {
      "type": "lose_fat",
      "label": "Body fat",
      "current_value": 28.4,
      "target_value": 23.0,
      "unit": "%",
      "reasoning": "28.4% is above healthy range for this age. 23% reduces cardiovascular risk significantly and is achievable in 6-8 months."
    },
    {
      "type": "gain_muscle",
      "label": "Lean mass",
      "current_value": 118.0,
      "target_value": 124.0,
      "unit": "lbs",
      "reasoning": "Modest 6 lb gain protects metabolism during fat loss and improves longevity markers."
    },
    {
      "type": "improve_cardio",
      "label": "Aerobic power (MANP)",
      "current_value": 280.0,
      "target_value": 340.0,
      "unit": "W",
      "reasoning": "Current MANP is below average for age group. 340W puts member in above-average range with meaningful longevity benefit."
    },
    {
      "type": "attendance",
      "label": "Monthly sessions",
      "current_value": 0,
      "target_value": 12,
      "unit": "sessions/month",
      "reasoning": "12 sessions per month builds the consistency habit while remaining achievable for a busy schedule."
    }
  ],
  "protocol": "Metabolic Reset",
  "protocol_reasoning": "Body fat reduction is the primary opportunity. CAROL and ARX combination drives optimal fat loss while preserving lean mass."
}`;
}

export async function POST(request: Request) {
  try {
    // Allow trusted internal calls (e.g. from fit3d import background job)
    const internalKey = request.headers.get("x-internal-service-key");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
    const isInternalCall = internalKey && serviceRoleKey && internalKey === serviceRoleKey;

    let memberId: string;

    if (isInternalCall) {
      const body = (await request.json()) as { member_id?: string };
      memberId = asStr(body.member_id);
      if (!memberId) {
        return NextResponse.json({ success: false, error: "member_id is required." }, { status: 400 });
      }
    } else {
      const { context, error } = await getActorContext();
      if (!context) {
        return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
      }
      // Allow coaches to trigger on behalf of a member, or members to trigger for themselves
      const body = (await request.json()) as { member_id?: string };
      memberId = asStr(body.member_id) || (isCoachRole(context.role) ? "" : asStr(context.dbUser.id));
      if (!memberId) {
        return NextResponse.json({ success: false, error: "member_id is required." }, { status: 400 });
      }
    }

    const anthropicKey = process.env.ANTHROPIC_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ success: false, error: "ANTHROPIC_KEY is not configured." }, { status: 500 });
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }

    // Fetch most recent Fit3D scan
    const scanRes = await supabase
      .from("fit3d_scans")
      .select("scan_date,body_fat_pct,lean_mass_lbs,fat_mass_lbs,weight_lbs,waist_in,body_shape_rating")
      .eq("member_id", memberId)
      .order("scan_date", { ascending: false })
      .limit(1);
    if (scanRes.error) throw new Error(scanRes.error.message);
    if (!scanRes.data || scanRes.data.length === 0) {
      return NextResponse.json({ success: false, error: "No Fit3D scan found for this member." }, { status: 404 });
    }
    const scan = scanRes.data[0] as Record<string, unknown>;

    // Fetch member info (age, gender, stated goals)
    const memberRes = await supabase
      .from("users")
      .select("full_name,date_of_birth,gender,primary_goal,secondary_goals")
      .eq("id", memberId)
      .single();
    if (memberRes.error) throw new Error(memberRes.error.message);
    const member = memberRes.data as Record<string, unknown>;

    // Compute age
    let age: number | null = null;
    if (typeof member.date_of_birth === "string" && member.date_of_birth) {
      const dob = new Date(member.date_of_birth);
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
    }

    // Fetch member_goals (explicitly set goals)
    const goalsRes = await supabase
      .from("member_goals")
      .select("goal_type,is_active")
      .eq("member_id", memberId)
      .eq("is_active", true);
    const activeGoalTypes = (Array.isArray(goalsRes.data) ? goalsRes.data : [])
      .map((g: Record<string, unknown>) => asStr(g.goal_type))
      .filter(Boolean);

    // Fetch recent CAROL data for MANP and peak power
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const carolRes = await supabase
      .from("carol_sessions")
      .select("manp,peak_power_watts,session_date")
      .eq("member_id", memberId)
      .gte("session_date", thirtyDaysAgo)
      .order("session_date", { ascending: false })
      .limit(20);
    const carolRows = Array.isArray(carolRes.data) ? (carolRes.data as Array<Record<string, unknown>>) : [];
    const manpVals = carolRows.map((r) => asNum(r.manp)).filter((v): v is number => v !== null && v > 0);
    const avgManp = manpVals.length > 0 ? manpVals.reduce((a, b) => a + b, 0) / manpVals.length : null;
    const peakPowerAll = carolRows.map((r) => asNum(r.peak_power_watts)).filter((v): v is number => v !== null && v > 0);
    const peakPower = peakPowerAll.length > 0 ? Math.max(...peakPowerAll) : null;

    // Build scan and member fields
    const bodyFat = asNum(scan.body_fat_pct);
    const leanMass = asNum(scan.lean_mass_lbs);
    const weight = asNum(scan.weight_lbs);
    const waist = asNum(scan.waist_in);
    const bodyShapeRating = asNum(scan.body_shape_rating);

    const primaryGoal = asStr(member.primary_goal).replace(/_/g, " ") || "not specified";
    const secondaryGoals = Array.isArray(member.secondary_goals) && member.secondary_goals.length > 0
      ? (member.secondary_goals as string[]).map((g) => g.replace(/_/g, " ")).join(", ")
      : "none";
    const statedGoals = activeGoalTypes.length > 0
      ? activeGoalTypes.map((g) => g.replace(/_/g, " ")).join(", ")
      : `${primaryGoal}${secondaryGoals !== "none" ? `, ${secondaryGoals}` : ""}`;

    const userMessage = buildUserPrompt({
      age,
      gender: asStr(member.gender, "not specified"),
      statedGoals,
      bodyFat,
      leanMass,
      weight,
      waist,
      bodyShapeRating,
      avgManp,
      peakPower,
    });

    // Call Anthropic API
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const failBody = await anthropicRes.text().catch(() => "");
      throw new Error(`Anthropic request failed (${anthropicRes.status}). ${failBody.slice(0, 400)}`);
    }

    const aiResult = (await anthropicRes.json()) as { content?: Array<{ type?: string; text?: string }> };
    const textContent = aiResult.content?.find((c) => c.type === "text")?.text ?? "";
    if (!textContent) throw new Error("AI returned no text content.");

    const parsed = parseAiJson(textContent);

    const suggestions = Array.isArray(parsed.goals) ? parsed.goals : [];
    const protocolSuggestion = asStr(parsed.protocol as unknown);
    const protocolReasoning = asStr(parsed.protocol_reasoning as unknown);

    // Insert into goal_suggestions
    const insertRes = await supabase
      .from("goal_suggestions")
      .insert({
        member_id: memberId,
        suggested_by: "ai",
        status: "pending",
        suggestions,
        protocol_suggestion: protocolSuggestion || null,
        protocol_reasoning: protocolReasoning || null,
      })
      .select("id")
      .single();
    if (insertRes.error) throw new Error(insertRes.error.message);

    // Notify coach
    const memberName = asStr(member.full_name, "A member");
    const notifRes = await supabase.from("coach_notifications").insert({
      member_id: memberId,
      type: "goal_suggestion_pending",
      message: `${memberName} has new AI goal suggestions ready for your review.`,
      is_read: false,
    });
    if (notifRes.error) {
      // Non-fatal: coach_notifications may not have member_name column
      console.error("coach_notifications insert error:", notifRes.error.message);
    }

    return NextResponse.json({
      success: true,
      suggestion_id: insertRes.data?.id,
      suggestions,
      protocol_suggestion: protocolSuggestion,
      protocol_reasoning: protocolReasoning,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to generate goal suggestions." },
      { status: 500 },
    );
  }
}
