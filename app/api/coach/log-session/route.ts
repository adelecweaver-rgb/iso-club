import { NextResponse } from "next/server";
import {
  asOptionalNumber,
  asRequiredString,
  getActorContext,
  isCoachRole,
} from "@/lib/server/actor";
import {
  sendLowRecoverySmsForMember,
  sendScanResultsSmsForMember,
} from "@/lib/server/sms-notifications";

type Body = {
  member_id?: string;
  member_name?: string;
  equipment?: string;
  duration_minutes?: number | string;
  protocol_or_exercise?: string;
  staff_notes?: string;
  perceived_effort?: number | string;
  completed?: boolean;
  ride_type?: string;
  temperature_f?: number | string;
  extraction_data?: Record<string, unknown>;
};

function normalizeEquipment(input: string) {
  const normalized = input.trim().toLowerCase();
  if (normalized === "arx") return { kind: "arx" as const };
  if (normalized === "carol") return { kind: "carol" as const };
  if (normalized === "fit3d" || normalized === "fit 3d") {
    return { kind: "fit3d" as const };
  }
  if (normalized === "whoop") return { kind: "wearable" as const, device: "whoop" };
  if (normalized === "oura") return { kind: "wearable" as const, device: "oura" };

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
    const extraction =
      body.extraction_data && typeof body.extraction_data === "object"
        ? body.extraction_data
        : {};
    const extractedString = (key: string, fallback = ""): string => {
      const value = extraction[key];
      if (typeof value === "string" && value.trim().length > 0) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      return fallback;
    };
    const extractedNumber = (key: string): number | null =>
      asOptionalNumber(extraction[key]);
    const extractedBoolean = (key: string): boolean => {
      const value = extraction[key];
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "true" || normalized === "1" || normalized === "yes";
      }
      if (typeof value === "number") return value === 1;
      return false;
    };

    let memberId = typeof body.member_id === "string" ? body.member_id.trim() : "";
    if (!memberId) {
      const memberName =
        typeof body.member_name === "string" ? body.member_name.trim() : "";
      if (!memberName) {
        throw new Error("member_id or member_name is required.");
      }
      const memberLookup = await context.supabase
        .from("users")
        .select("id")
        .eq("full_name", memberName)
        .eq("role", "member")
        .eq("is_active", true)
        .limit(1);
      if (memberLookup.error || !Array.isArray(memberLookup.data) || !memberLookup.data[0]?.id) {
        throw new Error(`Could not find active member record for "${memberName}".`);
      }
      memberId = String(memberLookup.data[0].id);
    }
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
      const extractedTimeSeconds = extractedNumber("time_seconds");
      const arxTimeSeconds =
        extractedTimeSeconds !== null
          ? Math.max(0, Math.round(extractedTimeSeconds))
          : durationMinutes > 0
            ? durationMinutes * 60
            : null;
      const output = extractedNumber("output");
      const concentricMax = extractedNumber("concentric_max");
      const eccentricMax = extractedNumber("eccentric_max");
      const arxIntensity = extractedNumber("intensity") ?? perceivedEffort;
      const arxExercise =
        extractedString("exercise") || protocolOrExercise || "ARX Session";
      const arxProtocol = extractedString("protocol") || protocolOrExercise || null;

      const insertResult = await context.supabase.from("arx_sessions").insert({
        member_id: memberId,
        session_date: nowIso.slice(0, 10),
        exercise: arxExercise,
        protocol: arxProtocol,
        time_seconds: arxTimeSeconds,
        intensity: arxIntensity,
        output,
        concentric_max: concentricMax,
        eccentric_max: eccentricMax,
        staff_notes: staffNotes,
        location: "Iso Club in Tulsa, OK",
        raw_data: {
          source: "coach_log_form",
          completed,
          exercise_type: extractedString("exercise_type") || null,
          speed: extractedString("speed") || null,
        },
      });
      if (insertResult.error) throw new Error(insertResult.error.message);
    } else if (equipment.kind === "carol") {
      const rideTypeSource =
        extractedString("ride_type") ||
        (typeof body.ride_type === "string" ? body.ride_type : "") ||
        (protocolOrExercise || "REHIT");
      const externalRideId =
        extractedString("external_id") ||
        extractedString("ride_id") ||
        extractedString("carol_ride_id") ||
        null;
      const carolPayload = {
        member_id: memberId,
        external_id: externalRideId,
        session_date: nowIso,
        ride_type: normalizeRideType(rideTypeSource),
        duration: durationMinutes > 0 ? `${durationMinutes} min` : null,
        fitness_score: extractedNumber("fitness_score"),
        calories: extractedNumber("calories"),
        peak_power_watts: extractedNumber("peak_power"),
        max_hr: extractedNumber("max_hr"),
        raw_data: {
          source: "coach_log_form",
          protocol_or_exercise: protocolOrExercise || null,
          staff_notes: staffNotes,
          perceived_effort: perceivedEffort,
          completed,
          resistance_direction: extractedString("resistance_direction") || null,
          energy: extractedNumber("energy"),
        },
      };
      let insertResult =
        externalRideId !== null
          ? await context.supabase
              .from("carol_sessions")
              .upsert(carolPayload, { onConflict: "external_id" })
          : await context.supabase.from("carol_sessions").insert(carolPayload);
      if (
        insertResult.error &&
        /no unique or exclusion constraint matching the ON CONFLICT specification|column ["']?external_id["']?.*does not exist|Could not find the 'external_id' column/i.test(
          insertResult.error.message,
        )
      ) {
        const fallbackPayload = { ...carolPayload };
        delete fallbackPayload.external_id;
        insertResult = await context.supabase.from("carol_sessions").insert(fallbackPayload);
      }
      if (insertResult.error) throw new Error(insertResult.error.message);
    } else if (equipment.kind === "fit3d") {
      const fit3dPayload = {
        member_id: memberId,
        scan_date: nowIso,
        body_fat_pct: extractedNumber("body_fat_pct"),
        weight_lbs: extractedNumber("weight_lbs"),
        lean_mass_lbs: extractedNumber("lean_mass_lbs"),
        body_shape_rating: extractedString("body_shape_rating") || null,
        posture_head_forward_in: extractedNumber("posture_head_forward_in"),
        posture_shoulder_forward_in: extractedNumber("posture_shoulder_forward_in"),
        posture_hip_forward_in: extractedNumber("posture_hip_forward_in"),
        dustin_reviewed: extractedBoolean("dustin_reviewed"),
      };
      let fit3dInsert = await context.supabase.from("fit3d_scans").insert(fit3dPayload);
      if (
        fit3dInsert.error &&
        /column ["']?dustin_reviewed["']? .*fit3d_scans.* does not exist|Could not find the 'dustin_reviewed' column/i.test(
          fit3dInsert.error.message,
        )
      ) {
        const { dustin_reviewed, ...payloadWithoutReviewed } = fit3dPayload;
        void dustin_reviewed;
        fit3dInsert = await context.supabase
          .from("fit3d_scans")
          .insert(payloadWithoutReviewed);
      }
      if (fit3dInsert.error) throw new Error(fit3dInsert.error.message);
      if (extractedBoolean("dustin_reviewed")) {
        await sendScanResultsSmsForMember(context.supabase, memberId, fit3dPayload);
      }
    } else if (equipment.kind === "wearable") {
      const recoveryScore = extractedNumber("recovery_score");
      const wearableInsert = await context.supabase.from("wearable_data").insert({
        member_id: memberId,
        recorded_date: nowIso,
        device_type: equipment.device,
        recovery_score: recoveryScore,
        readiness_score: extractedNumber("readiness_score"),
        hrv_ms: extractedNumber("hrv_ms"),
        resting_hr: extractedNumber("resting_hr"),
        sleep_score: extractedNumber("sleep_score"),
        sleep_duration_hrs: extractedNumber("sleep_duration_hrs"),
        deep_sleep_hrs: extractedNumber("deep_sleep_hrs"),
        rem_sleep_hrs: extractedNumber("rem_sleep_hrs"),
        strain_score: extractedNumber("strain_score"),
        spo2_pct: extractedNumber("spo2_pct"),
      });
      if (wearableInsert.error) throw new Error(wearableInsert.error.message);
      if (recoveryScore !== null && recoveryScore < 50) {
        await sendLowRecoverySmsForMember(
          context.supabase,
          memberId,
          recoveryScore,
        );
      }
    } else if (equipment.kind === "manual") {
      const extractedDuration = extractedNumber("duration_minutes");
      const outputNumbers = extraction.visible_output_numbers;
      const parsedOutput =
        typeof outputNumbers === "string" && outputNumbers.trim().length > 0
          ? outputNumbers.trim()
          : Array.isArray(outputNumbers) || (outputNumbers && typeof outputNumbers === "object")
            ? JSON.stringify(outputNumbers)
            : "";
      const enhancedNotes = [
        staffNotes,
        parsedOutput ? `AI visible outputs: ${parsedOutput}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      const insertResult = await context.supabase.from("manual_workout_sessions").insert({
        member_id: memberId,
        session_date: nowIso,
        equipment: equipment.equipment,
        duration_minutes:
          extractedDuration !== null
            ? Math.max(0, Math.round(extractedDuration))
            : durationMinutes > 0
              ? durationMinutes
              : null,
        protocol_notes: protocolOrExercise || null,
        staff_notes: enhancedNotes || null,
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
        duration_minutes:
          extractedNumber("duration_minutes") !== null
            ? Math.max(0, Math.round(extractedNumber("duration_minutes") ?? 0))
            : durationMinutes > 0
              ? durationMinutes
              : null,
        temperature_f: extractedNumber("temperature_f") ?? temperatureF,
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
