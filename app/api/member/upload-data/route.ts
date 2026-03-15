import { NextResponse } from "next/server";
import { asOptionalNumber, asRequiredString, getActorContext } from "@/lib/server/actor";
import { sendLowRecoverySmsForMember } from "@/lib/server/sms-notifications";

type Body = {
  equipment?: string;
  extraction_data?: Record<string, unknown>;
  notes?: string;
  session_date?: string;
};

type UploadEquipment =
  | "arx"
  | "carol"
  | "whoop"
  | "oura"
  | "garmin"
  | "apple_health"
  | "other_wearable";

function normalizeEquipment(input: string): UploadEquipment {
  const value = input.trim().toLowerCase();
  if (value === "arx") return "arx";
  if (value === "carol") return "carol";
  if (value === "whoop") return "whoop";
  if (value === "oura") return "oura";
  if (value === "garmin" || value === "garmin_connect" || value === "garmin connect") {
    return "garmin";
  }
  if (value === "apple_health" || value === "apple health" || value === "applehealth") {
    return "apple_health";
  }
  if (value === "other_wearable" || value === "wearable" || value === "other wearable") {
    return "other_wearable";
  }
  throw new Error("Unsupported upload equipment.");
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
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

function normalizeSessionDate(input?: string): string {
  if (!input || input.trim().length === 0) return new Date().toISOString();
  const trimmed = input.trim();
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
    if (context.role !== "member") {
      return NextResponse.json(
        { success: false, error: "Only members can upload member wearable/machine data here." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;
    const equipment = normalizeEquipment(asRequiredString(body.equipment, "equipment"));
    const extraction =
      body.extraction_data && typeof body.extraction_data === "object"
        ? body.extraction_data
        : {};
    const extractedString = (key: string, fallback = "") =>
      asString(extraction[key], fallback);
    const extractedNumber = (key: string): number | null => asOptionalNumber(extraction[key]);

    const memberId = String(context.dbUser.id ?? "");
    if (!memberId) {
      throw new Error("Member user record is missing id.");
    }
    const sessionDate = normalizeSessionDate(body.session_date);
    const notes =
      typeof body.notes === "string" && body.notes.trim().length > 0
        ? body.notes.trim()
        : null;

    if (equipment === "arx") {
      const insert = await context.supabase.from("arx_sessions").insert({
        member_id: memberId,
        session_date: sessionDate.slice(0, 10),
        exercise: extractedString("exercise", "ARX Upload"),
        protocol: extractedString("protocol", "") || null,
        time_seconds: extractedNumber("time_seconds"),
        intensity: extractedNumber("intensity"),
        output: extractedNumber("output"),
        concentric_max: extractedNumber("concentric_max"),
        eccentric_max: extractedNumber("eccentric_max"),
        staff_notes: notes,
        location: "Member Upload",
        raw_data: {
          source: "member_upload_photo",
          logged_by: "member",
          exercise_type: extractedString("exercise_type", "") || null,
          speed: extractedString("speed", "") || null,
        },
      });
      if (insert.error) throw new Error(insert.error.message);
    } else if (equipment === "carol") {
      const rideType = normalizeRideType(extractedString("ride_type", "REHIT"));
      const durationMinutes =
        extractedNumber("duration_minutes") ??
        (() => {
          const durationText = extractedString("duration", "");
          const maybeNumber = asOptionalNumber(durationText.replace(/[^\d.]/g, ""));
          return maybeNumber;
        })();
      const insert = await context.supabase.from("carol_sessions").insert({
        member_id: memberId,
        session_date: sessionDate,
        ride_type: rideType,
        duration: durationMinutes !== null ? `${Math.round(durationMinutes)} min` : null,
        fitness_score: extractedNumber("fitness_score"),
        calories: extractedNumber("calories"),
        peak_power_watts: extractedNumber("peak_power") ?? extractedNumber("peak_power_watts"),
        max_hr: extractedNumber("max_hr"),
        raw_data: {
          source: "member_upload_photo",
          logged_by: "member",
          resistance_direction: extractedString("resistance_direction", "") || null,
          energy: extractedNumber("energy"),
          notes,
        },
      });
      if (insert.error) throw new Error(insert.error.message);
    } else {
      const deviceType =
        equipment === "other_wearable"
          ? extractedString("device_name", "other_wearable").toLowerCase()
          : equipment;
      const recoveryScore = extractedNumber("recovery_score");
      const wearablePayloadBase = {
        member_id: memberId,
        recorded_date: sessionDate,
        device_type: deviceType,
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
      };
      let insert = await context.supabase.from("wearable_data").insert({
        ...wearablePayloadBase,
        logged_by: "member",
      });
      if (
        insert.error &&
        /column ["']?logged_by["']? .*wearable_data.* does not exist|Could not find the 'logged_by' column/i.test(
          insert.error.message,
        )
      ) {
        insert = await context.supabase.from("wearable_data").insert(wearablePayloadBase);
      }
      if (insert.error) throw new Error(insert.error.message);
      if (recoveryScore !== null && recoveryScore < 50) {
        await sendLowRecoverySmsForMember(context.supabase, memberId, recoveryScore, deviceType);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to save uploaded data.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
