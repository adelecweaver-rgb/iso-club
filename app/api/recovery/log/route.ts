import { NextResponse } from "next/server";
import { asOptionalNumber, asRequiredString, getActorContext } from "@/lib/server/actor";

type Body = {
  modality?: string;
  duration_minutes?: number | string;
  temperature_f?: number | string;
  notes?: string;
  session_date?: string;
};

function normalizeModality(input: string): "cold_plunge" | "infrared_sauna" | "compression_therapy" | "nxpro" {
  const value = input.trim().toLowerCase();
  if (value === "cold_plunge" || value === "cold plunge") return "cold_plunge";
  if (value === "infrared_sauna" || value === "infrared sauna" || value === "sauna") {
    return "infrared_sauna";
  }
  if (value === "compression" || value === "compression_therapy" || value === "compression therapy") {
    return "compression_therapy";
  }
  if (value === "nxpro") return "nxpro";
  throw new Error("Unsupported modality.");
}

function normalizeSessionDate(input: string | undefined): string {
  if (!input || input.trim().length === 0) return new Date().toISOString();
  const trimmed = input.trim();
  // Allow YYYY-MM-DD from date input.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00.000Z`).toISOString();
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const modality = normalizeModality(asRequiredString(body.modality, "modality"));
    const durationRaw = asOptionalNumber(body.duration_minutes);
    if (durationRaw === null) {
      throw new Error("duration_minutes is required.");
    }
    const durationMinutes = Math.max(1, Math.round(durationRaw));
    const temperatureF = asOptionalNumber(body.temperature_f);
    const notes =
      typeof body.notes === "string" && body.notes.trim().length > 0
        ? body.notes.trim()
        : null;
    const sessionDate = normalizeSessionDate(body.session_date);
    const memberId = String(context.dbUser.id ?? "");
    if (!memberId) {
      throw new Error("Member user record is missing id.");
    }

    const insertResult = await context.supabase.from("recovery_sessions").insert({
      member_id: memberId,
      modality,
      duration_minutes: durationMinutes,
      temperature_f: temperatureF,
      notes,
      session_date: sessionDate,
      logged_by: "member",
    });

    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to log recovery session.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
