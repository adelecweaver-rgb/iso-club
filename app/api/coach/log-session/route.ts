import { NextResponse } from "next/server";
import {
  asOptionalNumber,
  asRequiredString,
  getActorContext,
  isCoachRole,
} from "@/lib/server/actor";

type Body = {
  member_id?: string;
  equipment?: string;
  duration_minutes?: number | string;
  protocol_or_exercise?: string;
  staff_notes?: string;
  perceived_effort?: number | string;
  completed?: boolean;
  ride_type?: string;
  temperature_f?: number | string;
};

function normalizeEquipment(input: string) {
  const normalized = input.trim().toLowerCase();
  if (normalized === "arx") return { kind: "arx" as const };
  if (normalized === "carol") return { kind: "carol" as const };

  const manualMap: Record<string, string> = {
    vasper: "vasper",
    katalyst: "katalyst",
    proteus: "proteus",
    quickboard: "quickboard",
    other: "other",
  };
  if (manualMap[normalized]) {
    return { kind: "manual" as const, equipment: manualMap[normalized] };
  }

  const recoveryMap: Record<string, string> = {
    infrared_sauna: "infrared_sauna",
    "infrared sauna": "infrared_sauna",
    cold_plunge: "cold_plunge",
    "cold plunge": "cold_plunge",
    nxpro: "nxpro",
    compression_therapy: "compression_therapy",
    compression: "compression_therapy",
    "compression therapy": "compression_therapy",
  };
  if (recoveryMap[normalized]) {
    return { kind: "recovery" as const, modality: recoveryMap[normalized] };
  }

  return { kind: "unknown" as const };
}

function normalizeRideType(
  input: string,
): "REHIT" | "Fat Burn" | "Free & Custom" | "Fitness Test" {
  const value = input.trim().toLowerCase();
  if (value === "fat burn") return "Fat Burn";
  if (value === "free & custom" || value === "free and custom") return "Free & Custom";
  if (value === "fitness test") return "Fitness Test";
  return "REHIT";
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachRole(context.role)) {
      return NextResponse.json(
        { success: false, error: "Only coach/staff accounts can log sessions." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;
    const memberId = asRequiredString(body.member_id, "member_id");
    const equipmentInput = asRequiredString(body.equipment, "equipment");
    const protocolOrExercise = typeof body.protocol_or_exercise === "string"
      ? body.protocol_or_exercise.trim()
      : "";
    const staffNotes = typeof body.staff_notes === "string" ? body.staff_notes.trim() : null;
    const durationMinutes = Math.max(0, Math.round(asOptionalNumber(body.duration_minutes) ?? 0));
    const perceivedEffortRaw = asOptionalNumber(body.perceived_effort);
    const perceivedEffort =
      perceivedEffortRaw !== null ? Math.max(0, Math.min(10, Math.round(perceivedEffortRaw))) : null;
    const completed = body.completed ?? true;
    const temperatureF = asOptionalNumber(body.temperature_f);

    const equipment = normalizeEquipment(equipmentInput);
    if (equipment.kind === "unknown") {
      return NextResponse.json(
        { success: false, error: "Unsupported equipment/modality selection." },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    const actorId = String(context.dbUser.id ?? "");
    if (!actorId) {
      return NextResponse.json(
        { success: false, error: "Coach user record is missing id." },
        { status: 400 },
      );
    }

    if (equipment.kind === "arx") {
      const insertResult = await context.supabase.from("arx_sessions").insert({
        member_id: memberId,
        session_date: nowIso.slice(0, 10),
        exercise: protocolOrExercise || "ARX Session",
        protocol: protocolOrExercise || null,
        time_seconds: durationMinutes > 0 ? durationMinutes * 60 : null,
        intensity: perceivedEffort,
        staff_notes: staffNotes,
        location: "Iso Club in Tulsa, OK",
        raw_data: {
          source: "coach_log_form",
          completed,
        },
      });
      if (insertResult.error) throw new Error(insertResult.error.message);
    } else if (equipment.kind === "carol") {
      const rideTypeSource = body.ride_type ?? (protocolOrExercise || "REHIT");
      const insertResult = await context.supabase.from("carol_sessions").insert({
        member_id: memberId,
        session_date: nowIso,
        ride_type: normalizeRideType(rideTypeSource),
        duration: durationMinutes > 0 ? `${durationMinutes} min` : null,
        raw_data: {
          source: "coach_log_form",
          protocol_or_exercise: protocolOrExercise || null,
          staff_notes: staffNotes,
          perceived_effort: perceivedEffort,
          completed,
        },
      });
      if (insertResult.error) throw new Error(insertResult.error.message);
    } else if (equipment.kind === "manual") {
      const insertResult = await context.supabase.from("manual_workout_sessions").insert({
        member_id: memberId,
        session_date: nowIso,
        equipment: equipment.equipment,
        duration_minutes: durationMinutes > 0 ? durationMinutes : null,
        protocol_notes: protocolOrExercise || null,
        staff_notes: staffNotes,
        perceived_effort: perceivedEffort,
        completed,
        logged_by: "staff",
        staff_id: actorId,
      });
      if (insertResult.error) throw new Error(insertResult.error.message);
    } else if (equipment.kind === "recovery") {
      const insertResult = await context.supabase.from("recovery_sessions").insert({
        member_id: memberId,
        session_date: nowIso,
        modality: equipment.modality,
        duration_minutes: durationMinutes > 0 ? durationMinutes : null,
        temperature_f: temperatureF,
        notes: staffNotes,
        logged_by: "staff",
        staff_id: actorId,
      });
      if (insertResult.error) throw new Error(insertResult.error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to log session.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
