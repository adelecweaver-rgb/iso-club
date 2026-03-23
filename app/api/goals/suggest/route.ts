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

Analyze this member's Fit3D body scan results and their stated goals to suggest specific measurable targets for each goal.

Be conservative — targets should be achievable in 6-9 months with consistent effort at 2-3 sessions per week. Prioritize health and longevity over aesthetics. Base all reasoning on established exercise science.

Respond in JSON only:
{
  "goals": [
    {
      "type": "lose_fat",
      "current_value": 28.4,
      "target_value": 23.0,
      "unit": "%",
      "label": "Body fat",
      "reasoning": "28.4% is above the healthy range for this age group. 23% is achievable and reduces cardiovascular risk significantly."
    }
  ],
  "protocol": "Metabolic Reset",
  "protocol_reasoning": "Body fat is the primary concern. CAROL and ARX combination drives optimal fat loss while preserving lean mass."
}

Only suggest goals that are supported by the scan data. If lean mass is already excellent do not suggest a muscle gain goal. Let the data guide the recommendations.

Valid goal types: lose_fat (unit: %), gain_muscle (unit: lbs lean mass), improve_cardio (unit: MANP watts).`;

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
      .select("scan_date,body_fat_pct,lean_mass_lbs,fat_mass_lbs,weight_lbs,waist_in,hips_in")
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

    // Build the context string for the AI
    const scanDate = asStr(scan.scan_date).slice(0, 10);
    const bodyFat = asNum(scan.body_fat_pct);
    const leanMass = asNum(scan.lean_mass_lbs);
    const fatMass = asNum(scan.fat_mass_lbs);
    const weight = asNum(scan.weight_lbs);
    const waist = asNum(scan.waist_in);

    const primaryGoal = asStr(member.primary_goal).replace(/_/g, " ") || "not specified";
    const secondaryGoals = Array.isArray(member.secondary_goals) && member.secondary_goals.length > 0
      ? (member.secondary_goals as string[]).map((g) => g.replace(/_/g, " ")).join(", ")
      : "none";
    const statedGoals = activeGoalTypes.length > 0
      ? activeGoalTypes.map((g) => g.replace(/_/g, " ")).join(", ")
      : primaryGoal;

    const userMessage = `Member: ${asStr(member.full_name, "Member")}
Age: ${age ?? "unknown"}
Gender: ${asStr(member.gender, "not specified")}

Fit3D Scan (${scanDate}):
- Body fat: ${bodyFat !== null ? `${bodyFat.toFixed(1)}%` : "not measured"}
- Lean mass: ${leanMass !== null ? `${leanMass.toFixed(1)} lbs` : "not measured"}
- Fat mass: ${fatMass !== null ? `${fatMass.toFixed(1)} lbs` : "not measured"}
- Weight: ${weight !== null ? `${weight.toFixed(1)} lbs` : "not measured"}
- Waist: ${waist !== null ? `${waist.toFixed(1)} in` : "not measured"}

Primary goal: ${primaryGoal}
Secondary goals: ${secondaryGoals}
Explicitly set goals: ${statedGoals}

Based on this data, suggest specific measurable goals with targets achievable in 6-9 months.`;

    // Call Anthropic API
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
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
