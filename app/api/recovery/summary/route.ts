import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";

type RecoveryModality = "cold_plunge" | "infrared_sauna" | "compression_therapy" | "nxpro";

type RecoveryGoals = {
  cold_plunge: number;
  infrared_sauna: number;
  compression_therapy: number;
  nxpro: number;
};

const DEFAULT_RECOVERY_GOALS: RecoveryGoals = {
  cold_plunge: 6,
  infrared_sauna: 8,
  compression_therapy: 4,
  nxpro: 4,
};

const RECOVERY_GOAL_PRESETS: Record<string, RecoveryGoals> = {
  "strength foundation": {
    cold_plunge: 6,
    infrared_sauna: 8,
    compression_therapy: 4,
    nxpro: 4,
  },
  "metabolic reset": {
    cold_plunge: 8,
    infrared_sauna: 8,
    compression_therapy: 6,
    nxpro: 4,
  },
  "cardio focus": {
    cold_plunge: 6,
    infrared_sauna: 8,
    compression_therapy: 6,
    nxpro: 4,
  },
  "longevity protocol": {
    cold_plunge: 8,
    infrared_sauna: 12,
    compression_therapy: 8,
    nxpro: 6,
  },
  "recovery phase": {
    cold_plunge: 4,
    infrared_sauna: 12,
    compression_therapy: 8,
    nxpro: 8,
  },
  "exercise performance": {
    cold_plunge: 8,
    infrared_sauna: 8,
    compression_therapy: 8,
    nxpro: 4,
  },
};

function resolveMonthBounds(monthParam: string | null): {
  monthKey: string;
  monthLabel: string;
  monthStartIso: string;
  monthEndIso: string;
} {
  const valid = typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null;
  const now = new Date();
  const year = valid ? Number(valid.slice(0, 4)) : now.getUTCFullYear();
  const monthIndex = valid ? Number(valid.slice(5, 7)) - 1 : now.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  return {
    monthKey: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
    monthLabel: monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    monthStartIso: monthStart.toISOString().slice(0, 10),
    monthEndIso: monthEnd.toISOString().slice(0, 10),
  };
}

function normalizeRecoveryModality(value: unknown): RecoveryModality | null {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return null;
  if (key === "cold_plunge" || key === "cold plunge") return "cold_plunge";
  if (key === "infrared_sauna" || key === "infrared sauna" || key === "sauna") return "infrared_sauna";
  if (key === "compression_therapy" || key === "compression therapy" || key === "compression") return "compression_therapy";
  if (key === "nxpro") return "nxpro";
  return null;
}

function parseRecoveryGoals(value: unknown): RecoveryGoals | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const coldPlunge = Number(row.cold_plunge ?? row.coldPlunge ?? row["cold plunge"] ?? row["cold-plunge"]);
  const infraredSauna = Number(row.infrared_sauna ?? row.infraredSauna ?? row.sauna ?? row["infrared sauna"]);
  const compression = Number(
    row.compression_therapy ?? row.compressionTherapy ?? row.compression ?? row["compression boots"],
  );
  const nxpro = Number(row.nxpro ?? row.nxPro);
  if (
    !Number.isFinite(coldPlunge) ||
    !Number.isFinite(infraredSauna) ||
    !Number.isFinite(compression) ||
    !Number.isFinite(nxpro)
  ) {
    return null;
  }
  return {
    cold_plunge: Math.max(0, Math.round(coldPlunge)),
    infrared_sauna: Math.max(0, Math.round(infraredSauna)),
    compression_therapy: Math.max(0, Math.round(compression)),
    nxpro: Math.max(0, Math.round(nxpro)),
  };
}

function goalsForProtocol(protocolName: string, overrideGoals: unknown): RecoveryGoals {
  const override = parseRecoveryGoals(overrideGoals);
  if (override) return override;
  const preset = RECOVERY_GOAL_PRESETS[protocolName.trim().toLowerCase()];
  return preset ?? DEFAULT_RECOVERY_GOALS;
}

function toDateKey(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }

    const memberId = String(context.dbUser.id ?? "");
    if (!memberId) {
      return NextResponse.json({ success: false, error: "Member user record is missing id." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const { monthKey, monthLabel, monthStartIso, monthEndIso } = resolveMonthBounds(searchParams.get("month"));

    const [recoveryRes, protocolRes] = await Promise.all([
      context.supabase
        .from("recovery_sessions")
        .select("modality,session_date")
        .eq("member_id", memberId)
        .gte("session_date", monthStartIso)
        .lt("session_date", monthEndIso),
      context.supabase
        .from("protocols")
        .select("name,recovery_goals")
        .eq("member_id", memberId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

    if (recoveryRes.error) {
      throw new Error(recoveryRes.error.message);
    }
    if (protocolRes.error) {
      throw new Error(protocolRes.error.message);
    }

    const protocolRow =
      Array.isArray(protocolRes.data) && protocolRes.data.length
        ? (protocolRes.data[0] as Record<string, unknown>)
        : null;
    const protocolName = String(protocolRow?.name ?? "").trim();
    const goals = goalsForProtocol(protocolName, protocolRow?.recovery_goals);

    const counts: Record<RecoveryModality, number> = {
      cold_plunge: 0,
      infrared_sauna: 0,
      compression_therapy: 0,
      nxpro: 0,
    };
    const dayModalities = new Map<string, RecoveryModality[]>();
    const rows = Array.isArray(recoveryRes.data) ? (recoveryRes.data as Array<Record<string, unknown>>) : [];
    for (const row of rows) {
      const modality = normalizeRecoveryModality(row.modality);
      if (!modality) continue;
      counts[modality] = (counts[modality] ?? 0) + 1;
      const date = toDateKey(row.session_date);
      if (!date) continue;
      const modalities = dayModalities.get(date) ?? [];
      modalities.push(modality);
      dayModalities.set(date, modalities);
    }

    return NextResponse.json({
      success: true,
      summary: {
        month: monthKey,
        month_label: monthLabel,
        protocol_name: protocolName,
        goals,
        counts,
        days: Array.from(dayModalities.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, modalities]) => ({ date, modalities })),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load recovery summary.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
