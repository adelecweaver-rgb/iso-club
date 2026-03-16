import { NextResponse } from "next/server";
import { safeAuth } from "@/lib/server/clerk";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CAROL_TYPES = ["REHIT", "FAT_BURN_30", "FAT_BURN_45", "FAT_BURN_60", "ENERGISER"] as const;

class CarolApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function parseUnixToIso(value: unknown): string | null {
  const numeric = asNumber(value);
  if (numeric === null) return null;
  const asMilliseconds = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(asMilliseconds);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function extractMissingColumnName(message: string): string | null {
  const text = String(message || "");
  const match =
    text.match(/column ["']?([a-zA-Z0-9_]+)["']? does not exist/i) ||
    text.match(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column/i);
  return match?.[1] ?? null;
}

function extractToken(payload: Record<string, unknown>): string {
  const direct = asString(payload.accessToken || payload.token || payload.jwt, "");
  if (direct) return direct;
  const nested = payload.data && typeof payload.data === "object"
    ? (payload.data as Record<string, unknown>)
    : null;
  const nestedToken = asString(nested?.accessToken || nested?.token || nested?.jwt, "");
  if (nestedToken) return nestedToken;
  throw new CarolApiError(502, "CAROL login response missing access token.");
}

function extractRiderId(payload: Record<string, unknown>): string {
  const direct = asString(payload.riderId || payload.rider_id || payload.id, "");
  if (direct) return direct;
  const rider = payload.rider && typeof payload.rider === "object"
    ? (payload.rider as Record<string, unknown>)
    : null;
  const riderId = asString(rider?.id || rider?.riderId, "");
  if (riderId) return riderId;
  const nested = payload.data && typeof payload.data === "object"
    ? (payload.data as Record<string, unknown>)
    : null;
  const nestedRiderId = asString(nested?.riderId || nested?.rider_id || nested?.id, "");
  if (nestedRiderId) return nestedRiderId;
  throw new CarolApiError(502, "CAROL login response missing rider ID.");
}

async function loginToCarol(params: {
  username: string;
  password: string;
}): Promise<{ token: string; riderId: string }> {
  const response = await fetch("https://i.carolbike.com/rider-api/auth/login?v=3.4.27", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      username: params.username,
      password: params.password,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new CarolApiError(
      response.status,
      asString(payload.message || payload.error, "") || "CAROL authentication failed.",
    );
  }

  return {
    token: extractToken(payload),
    riderId: extractRiderId(payload),
  };
}

async function fetchCarolRidesForType(params: {
  token: string;
  riderId: string;
  type: (typeof CAROL_TYPES)[number];
}): Promise<Array<Record<string, unknown>>> {
  const rides: Array<Record<string, unknown>> = [];
  let page = 0;
  const size = 100;

  while (true) {
    const response = await fetch(
      `https://i.carolbike.com/rider-api/rider/${params.riderId}/ride/type/${params.type}?page=${page}&size=${size}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${params.token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new CarolApiError(
        response.status,
        asString(payload.message || payload.error, "") || `Unable to fetch ${params.type} rides.`,
      );
    }

    const content =
      Array.isArray(payload.content)
        ? payload.content
        : Array.isArray(payload.rides)
          ? payload.rides
          : Array.isArray(payload.data)
            ? payload.data
            : [];
    rides.push(
      ...content
        .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")),
    );

    const isLastPage = Boolean(payload.last) || content.length < size;
    if (isLastPage) break;
    page += 1;
    if (page > 500) break;
  }

  return rides;
}

async function collectCarolRides(params: {
  token: string;
  riderId: string;
}): Promise<{
  ridesByType: Record<string, Array<Record<string, unknown>>>;
  failedTypes: Record<string, string>;
  unauthorizedFailures: number;
}> {
  const ridesByType: Record<string, Array<Record<string, unknown>>> = {};
  const failedTypes: Record<string, string> = {};
  let unauthorizedFailures = 0;

  for (const type of CAROL_TYPES) {
    try {
      ridesByType[type] = await fetchCarolRidesForType({
        token: params.token,
        riderId: params.riderId,
        type,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to sync ${type}`;
      failedTypes[type] = message;
      if (error instanceof CarolApiError && (error.status === 401 || error.status === 403)) {
        unauthorizedFailures += 1;
      }
      ridesByType[type] = [];
    }
  }

  return { ridesByType, failedTypes, unauthorizedFailures };
}

async function upsertCarolRowsWithFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  rows: Array<Record<string, unknown>>,
) {
  let workingRows = rows.map((row) => ({ ...row }));
  const removedColumns = new Set<string>();

  while (true) {
    // Requirement: conflict resolution must use external_id.
    const result = await supabase.from("carol_sessions").upsert(workingRows, { onConflict: "external_id" });
    if (!result.error) return;

    const missingColumn = extractMissingColumnName(result.error.message);
    if (missingColumn && !removedColumns.has(missingColumn)) {
      removedColumns.add(missingColumn);
      workingRows = workingRows.map((row) => {
        const next = { ...row };
        delete next[missingColumn];
        return next;
      });
      continue;
    }

    throw new Error(result.error.message);
  }
}

async function updateUserCarolAuthWithFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  memberId: string,
  values: Record<string, unknown>,
) {
  const workingValues = { ...values };
  const removedColumns = new Set<string>();

  while (true) {
    const update = await supabase.from("users").update(workingValues).eq("id", memberId);
    if (!update.error) return;

    const missingColumn = extractMissingColumnName(update.error.message);
    if (missingColumn && !removedColumns.has(missingColumn)) {
      removedColumns.add(missingColumn);
      delete workingValues[missingColumn];
      continue;
    }
    throw new Error(update.error.message);
  }
}

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await safeAuth();
    if (!clerkUserId) {
      return NextResponse.json({ success: false, error: "Not authenticated." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase admin client is not configured." }, { status: 500 });
    }

    const profileRes = await supabase
      .from("users")
      .select("id,clerk_id,carol_token,carol_rider_id,carol_username")
      .eq("clerk_id", clerkUserId)
      .limit(1);
    if (profileRes.error) {
      throw new Error(profileRes.error.message);
    }
    if (!Array.isArray(profileRes.data) || profileRes.data.length === 0) {
      return NextResponse.json(
        { success: false, error: "No matching users row found for this Clerk user." },
        { status: 404 },
      );
    }

    // Critical fix: this UUID from users.id is the only value used for carol_sessions.member_id.
    const userRow = profileRes.data[0] as Record<string, unknown>;
    const memberId = asString(userRow.id, "");
    if (!memberId) {
      return NextResponse.json({ success: false, error: "Resolved user record is missing id." }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const providedUsername = asString(body.carolUsername, "");
    const providedPassword = asString(body.carolPassword, "");

    const activeUsername = providedUsername || asString(userRow.carol_username, "");
    let activeToken = asString(userRow.carol_token, "");
    let activeRiderId = asString(userRow.carol_rider_id, "");

    if (!activeUsername) {
      return NextResponse.json(
        { success: false, error: "CAROL username is required for initial sync." },
        { status: 400 },
      );
    }

    let collection: Awaited<ReturnType<typeof collectCarolRides>> | null = null;
    if (activeToken && activeRiderId && !providedPassword) {
      collection = await collectCarolRides({ token: activeToken, riderId: activeRiderId });
      if (
        collection.unauthorizedFailures >= CAROL_TYPES.length &&
        Object.keys(collection.ridesByType).every((type) => (collection?.ridesByType[type] ?? []).length === 0)
      ) {
        return NextResponse.json({
          success: false,
          needs_reauth: true,
          error: "Stored CAROL token expired. Re-enter your CAROL password to re-authenticate.",
        });
      }
    }

    if (!collection) {
      if (!providedPassword) {
        return NextResponse.json({
          success: false,
          needs_reauth: true,
          error: "CAROL password required for first sync.",
        });
      }

      const login = await loginToCarol({
        username: activeUsername,
        password: providedPassword,
      });
      activeToken = login.token;
      activeRiderId = login.riderId;
      collection = await collectCarolRides({ token: activeToken, riderId: activeRiderId });

      await updateUserCarolAuthWithFallback(supabase, memberId, {
        carol_username: activeUsername,
        carol_token: activeToken,
        carol_rider_id: activeRiderId,
      });
    }

    const ridesByType = collection.ridesByType;
    const failedTypes = collection.failedTypes;

    const typesSummary: Record<string, number> = {};
    const rows: Array<Record<string, unknown>> = [];
    for (const type of CAROL_TYPES) {
      const rides = ridesByType[type] ?? [];
      typesSummary[type] = rides.length;
      for (const ride of rides) {
        const externalId = asString(ride.id, "");
        const sessionDate = parseUnixToIso(ride.start);
        if (!externalId || !sessionDate) continue;
        rows.push({
          external_id: externalId,
          member_id: memberId,
          ride_type: asString(ride.type, type) === "INTENSE" ? "REHIT" : asString(ride.type, type),
          session_date: sessionDate,
          duration_seconds: asNumber(ride.duration),
          peak_power_watts: asNumber(ride.peakPower),
          avg_sprint_power: asNumber(ride.averageSprintPower),
          manp: asNumber(ride.manp),
          heart_rate_max: asNumber(ride.heartRateMax),
          heart_rate_avg: asNumber(ride.heartRateAverage),
          hr_percent_age_limit: asNumber(ride.heartRatePercentOfAgeLimit),
          calories_incl_epoc: asNumber(ride.caloriesInclEpoc),
          calories_active: asNumber(ride.calories),
          avg_power_watts: asNumber(ride.averagePower),
          resistance_absolute: asNumber(ride.resistanceAbsolute),
          sequential_number: asNumber(ride.sequential),
          is_valid: asBoolean(ride.valid),
          octane_score: asNumber(ride.octaneScore),
          distance_meters: asNumber(ride.distance),
          rpm_max: asNumber(ride.rpmMax),
          sprint_duration_seconds: asNumber(ride.sprintDuration),
          raw_data: {
            source: "carol_api_sync",
            rider_id: activeRiderId,
            ride,
          },
        });
      }
    }

    const dedupedByExternalId = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const id = asString(row.external_id, "");
      if (!id) continue;
      dedupedByExternalId.set(id, row);
    }
    const dedupedRows = Array.from(dedupedByExternalId.values());

    if (dedupedRows.length > 0) {
      for (let offset = 0; offset < dedupedRows.length; offset += 200) {
        await upsertCarolRowsWithFallback(supabase, dedupedRows.slice(offset, offset + 200));
      }
    }

    return NextResponse.json({
      success: true,
      member_id: memberId,
      imported: dedupedRows.length,
      types: typesSummary,
      failed_types: failedTypes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync CAROL rides.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
