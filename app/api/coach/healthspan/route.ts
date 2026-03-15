import { NextResponse } from "next/server";
import { asOptionalNumber, asRequiredString, getActorContext, isCoachRole } from "@/lib/server/actor";

type Body = {
  member_id?: string;
  muscle_score?: number | string;
  cardio_score?: number | string;
  metabolic_score?: number | string;
  structural_score?: number | string;
  recovery_score?: number | string;
  dustin_notes?: string;
};

function clampScore(value: number | null, label: string): number {
  if (value === null) throw new Error(`${label} is required.`);
  const rounded = Math.round(value);
  return Math.max(0, Math.min(100, rounded));
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachRole(context.role)) {
      return NextResponse.json(
        { success: false, error: "Only coach/staff accounts can update Healthspan scores." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;
    const memberId = asRequiredString(body.member_id, "member_id");
    const muscleScore = clampScore(asOptionalNumber(body.muscle_score), "muscle_score");
    const cardioScore = clampScore(asOptionalNumber(body.cardio_score), "cardio_score");
    const metabolicScore = clampScore(asOptionalNumber(body.metabolic_score), "metabolic_score");
    const structuralScore = clampScore(asOptionalNumber(body.structural_score), "structural_score");
    const recoveryScore = clampScore(asOptionalNumber(body.recovery_score), "recovery_score");
    const overallScore = Math.round(
      (muscleScore + cardioScore + metabolicScore + structuralScore + recoveryScore) / 5,
    );
    const dustinNotes = typeof body.dustin_notes === "string" ? body.dustin_notes.trim() : null;

    const inserted = await context.supabase.from("healthspan_scores").insert({
      member_id: memberId,
      muscle_score: muscleScore,
      cardio_score: cardioScore,
      metabolic_score: metabolicScore,
      structural_score: structuralScore,
      recovery_score: recoveryScore,
      overall_score: overallScore,
      dustin_notes: dustinNotes,
    });

    if (inserted.error) throw new Error(inserted.error.message);

    return NextResponse.json({ success: true, overall_score: overallScore });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update Healthspan scores.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
