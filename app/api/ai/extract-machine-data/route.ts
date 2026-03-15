import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";

type SupportedMachine =
  | "arx"
  | "carol"
  | "fit3d"
  | "vasper"
  | "katalyst"
  | "proteus"
  | "quickboard"
  | "nxpro"
  | "infrared_sauna"
  | "cold_plunge"
  | "compression"
  | "other";

function normalizeMachine(value: string): SupportedMachine | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "arx") return "arx";
  if (normalized === "carol") return "carol";
  if (normalized === "fit3d" || normalized === "fit 3d") return "fit3d";
  if (normalized === "vasper") return "vasper";
  if (normalized === "katalyst") return "katalyst";
  if (normalized === "proteus") return "proteus";
  if (normalized === "quickboard") return "quickboard";
  if (normalized === "nxpro") return "nxpro";
  if (normalized === "infrared_sauna" || normalized === "infrared sauna") {
    return "infrared_sauna";
  }
  if (normalized === "cold_plunge" || normalized === "cold plunge") return "cold_plunge";
  if (normalized === "compression" || normalized === "compression_therapy") {
    return "compression";
  }
  if (normalized === "other") return "other";
  return null;
}

function promptForMachine(machine: SupportedMachine): string {
  if (machine === "arx") {
    return [
      "This image is from an ARX fitness machine.",
      "Extract all visible values and return ONLY valid JSON with this exact shape:",
      "{",
      '  "exercise": string|null,',
      '  "exercise_type": string|null,',
      '  "protocol": string|null,',
      '  "speed": string|null,',
      '  "time_seconds": number|null,',
      '  "intensity": number|null,',
      '  "output": number|null,',
      '  "concentric_max": number|null,',
      '  "eccentric_max": number|null',
      "}",
      "If a field is not visible, set it to null. Return JSON only.",
    ].join("\n");
  }

  if (machine === "carol") {
    return [
      "This image is from a CAROL bike.",
      "Extract all visible values and return ONLY valid JSON with this exact shape:",
      "{",
      '  "ride_type": string|null,',
      '  "fitness_score": number|null,',
      '  "calories": number|null,',
      '  "peak_power": number|null,',
      '  "energy": number|null,',
      '  "max_hr": number|null,',
      '  "resistance_direction": string|null',
      "}",
      "If a field is not visible, set it to null. Return JSON only.",
    ].join("\n");
  }

  if (machine === "fit3d") {
    return [
      "This image is from a Fit3D scan report.",
      "Extract all visible body composition, measurement, posture, and balance data.",
      "Return ONLY valid JSON with this exact shape:",
      "{",
      '  "body_fat_pct": number|null,',
      '  "weight_lbs": number|null,',
      '  "lean_mass_lbs": number|null,',
      '  "fat_mass_lbs": number|null,',
      '  "bmr": number|null,',
      '  "visceral_fat": number|null,',
      '  "bmi": number|null,',
      '  "body_shape_rating": string|null,',
      '  "posture_head_forward_in": number|null,',
      '  "posture_shoulder_forward_in": number|null,',
      '  "posture_hip_forward_in": number|null,',
      '  "balance_left_pct": number|null,',
      '  "balance_right_pct": number|null,',
      '  "chest_in": number|null,',
      '  "waist_in": number|null,',
      '  "hips_in": number|null,',
      '  "bicep_l_in": number|null,',
      '  "bicep_r_in": number|null,',
      '  "thigh_l_in": number|null,',
      '  "thigh_r_in": number|null,',
      '  "calf_l_in": number|null,',
      '  "calf_r_in": number|null',
      "}",
      "If a field is not visible, set it to null. Return JSON only.",
    ].join("\n");
  }

  if (machine === "infrared_sauna" || machine === "cold_plunge" || machine === "compression") {
    return [
      `This image is from a ${machine.replace("_", " ")} recovery session display.`,
      "Extract all visible values and return ONLY valid JSON with this exact shape:",
      "{",
      '  "duration_minutes": number|null,',
      '  "temperature_f": number|null,',
      '  "visible_output_numbers": string[]|null',
      "}",
      "If a field is not visible, set it to null. Return JSON only.",
    ].join("\n");
  }

  return [
    `This image is from a ${machine} machine.`,
    "Extract all visible values and return ONLY valid JSON with this exact shape:",
    "{",
    '  "duration_minutes": number|null,',
    '  "visible_output_numbers": string[]|null',
    "}",
    "If a field is not visible, set it to null. Return JSON only.",
  ].join("\n");
}

function parseModelJson(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Claude may return fenced JSON; extract the first object.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Claude response did not include a JSON object.");
    }
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachRole(context.role)) {
      return NextResponse.json(
        { success: false, error: "Only coach/staff accounts can extract machine photo data." },
        { status: 403 },
      );
    }

    const anthropicKey = process.env.ANTHROPIC_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_KEY is not configured." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const equipmentRaw = String(formData.get("equipment") ?? "").trim();
    const machine = normalizeMachine(equipmentRaw);
    if (!machine) {
      return NextResponse.json(
        { success: false, error: "Unsupported machine/equipment type." },
        { status: 400 },
      );
    }

    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Image file is required." },
        { status: 400 },
      );
    }

    const mime = file.type || "image/jpeg";
    if (!mime.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Only image uploads are supported." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const base64ImageData = Buffer.from(bytes).toString("base64");

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mime,
                  data: base64ImageData,
                },
              },
              {
                type: "text",
                text: promptForMachine(machine),
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const failureBody = await anthropicResponse.text().catch(() => "");
      throw new Error(
        `Anthropic request failed (${anthropicResponse.status}). ${failureBody.slice(0, 500)}`,
      );
    }

    const modelResult = (await anthropicResponse.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const textContent =
      modelResult.content?.find((item) => item.type === "text")?.text ?? "";
    if (!textContent) {
      throw new Error("Claude returned no text content.");
    }

    const extracted = parseModelJson(textContent);
    return NextResponse.json({
      success: true,
      machine,
      extracted,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to extract data from image.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
