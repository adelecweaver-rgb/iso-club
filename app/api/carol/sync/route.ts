import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Body = {
  carolUsername?: string;
  carolPassword?: string;
  userId?: string;
};

type CarolRide = Record<string, unknown>;

const CAROL_TYPES = [
  "REHIT",
  "FAT_BURN_30",
  "FAT_BURN_45",
  "FAT_BURN_60",
  "ENERGISER",
] as const;

type CarolType = (typeof CAROL_TYPES)[number];

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
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return null;
}

function parseUnixToIso(value: unknown): string | null {
  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function mapRideType(value: unknown): string {
  const raw = asString(value, "REHIT").toUpperCase();
  if (raw === "INTENSE") return "REHIT";
  return raw;
}

function extractMissingColumnName(message: string): string | null {
  const relationMatch = message.match(/column ["']?([^"']+)["']? of relation .* does not exist/i);
  if (relationMatch?.[1]) return relationMatch[1];
  const genericMatch = message.match(/Could not find the ['"]?([^'"]+)['"]? column/i);
  if (genericMatch?.[1]) return genericMatch[1];
  return null;
}

function extractToken(payload: Record<string, unknown>): string | null {
  return (
    asString(payload.token, "") ||
    asString(payload.accessToken, "") ||
    asString(payload.access_token, "") ||
    asString(payload.jwt, "") ||
    asString((payload.data as Record<string, unknown> | undefined)?.token, "") ||
    asString((payload.data as Record<string, unknown> | undefined)?.accessToken, "") ||
    asString((payload.data as Record<string, unknown> | undefined)?.access_token, "") ||
    null
  );
}

function extractRiderId(payload: Record<string, unknown>): string | null {
  const data = payload.data as Record<string, unknown> | undefined;
  return (
    asString(payload.riderId, "") ||
    asString((payload.rider as Record<string, unknown> | undefined)?.id, "") ||
    asString((payload.user as Record<string, unknown> | undefined)?.riderId, "") ||
    asString(data?.riderId, "") ||
    asString((data?.rider as Record<string, unknown> | undefined)?.id, "") ||
    asString((data?.user as Record<string, unknown> | undefined)?.riderId, "") ||
    null
  );
}

function extractPageData(payload: Record<string, unknown>): {
  rides: CarolRide[];
  last: boolean;
  totalPages: number | null;
} {
  const maybeData = payload.data as Record<string, unknown> | undefined;
  const rides =
    (Array.isArray(payload.content) ? payload.content : null) ||
    (Array.isArray(payload.rides) ? payload.rides : null) ||
    (Array.isArray(maybeData?.content) ? maybeData.content : null) ||
    (Array.isArray(maybeData?.rides) ? maybeData.rides : null) ||
    [];
  const totalPages =
    asNumber(payload.totalPages) ??
    asNumber(payload.total_pages) ??
    asNumber(maybeData?.totalPages) ??
    asNumber(maybeData?.total_pages);
  const pageNumber =
    asNumber(payload.number) ??
    asNumber(payload.page) ??
    asNumber(maybeData?.number) ??
    asNumber(maybeData?.page) ??
    0;
  const hasLast =
    typeof payload.last === "boolean" ||
    typeof maybeData?.last === "boolean";
  const explicitLast =
    asBoolean(payload.last) ??
    asBoolean(maybeData?.last) ??
    false;
  const computedLast = totalPages !== null ? pageNumber >= totalPages - 1 : false;

  return {
    rides: rides as CarolRide[],
    last: hasLast ? explicitLast : computedLast,
    totalPages: totalPages !== null ? Math.max(0, Math.round(totalPages)) : null,
  };
}

async function fetchCarolRidesForType(params: {
  token: string;
  riderId: string;
  type: CarolType;
}): Promise<CarolRide[]> {
  const { token, riderId, type } = params;
  const allRides: CarolRide[] = [];
  let page = 0;
  let totalPages: number | null = null;

  while (true) {
    const response = await fetch(
      `https://i.carolbike.com/rider-api/rider/${encodeURIComponent(riderId)}/ride/type/${encodeURIComponent(type)}?page=${page}&size=100`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new CarolApiError(
        response.status,
        asString(payload.message, "") ||
          asString(payload.error, "") ||
          `CAROL ride fetch failed for ${type} (page ${page}).`,
      );
    }

    const parsed = extractPageData(payload);
    allRides.push(...parsed.rides);
    if (parsed.totalPages !== null) {
      totalPages = parsed.totalPages;
    }
    if (parsed.last) break;
    page += 1;
    if (totalPages !== null && page >= totalPages) break;
    if (page > 500) break;
  }

  return allRides;
}

async function upsertCarolRowsWithFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  rows: Array<Record<string, unknown>>,
) {
  let workingRows = rows.map((row) => ({ ...row }));
  const removedColumns = new Set<string>();
  let coercedIntegers = false;

  while (true) {
    const result = await supabase
      .from("carol_sessions")
      .upsert(workingRows, { onConflict: "external_id" });
    if (!result.error) return;

    if (
      /invalid input syntax for type integer|out of range for type integer/i.test(result.error.message) &&
      !coercedIntegers
    ) {
      workingRows = workingRows.map((row) => {
        const next = { ...row };
        const numericFields = [
          "duration_seconds",
          "peak_power_watts",
          "avg_sprint_power",
          "manp",
          "heart_rate_max",
          "heart_rate_avg",
          "hr_percent_age_limit",
          "calories_incl_epoc",
          "calories_active",
          "avg_power_watts",
          "resistance_absolute",
          "sequential_number",
          "octane_score",
          "distance_meters",
          "rpm_max",
          "sprint_duration_seconds",
        ] as const;
        for (const field of numericFields) {
          const value = next[field];
          if (typeof value === "number" && Number.isFinite(value)) {
            next[field] = Math.round(value);
          }
        }
        return next;
      });
      coercedIntegers = true;
      continue;
    }

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

    if (/there is no unique or exclusion constraint matching the ON CONFLICT specification/i.test(result.error.message)) {
      // Fallback when external_id column exists but unique constraint is absent.
      const externalIds = Array.from(
        new Set(
          workingRows
            .map((row) => asString(row.external_id, ""))
            .filter(Boolean),
        ),
      );
      const existingSet = new Set<string>();
      for (let offset = 0; offset < externalIds.length; offset += 200) {
        const chunk = externalIds.slice(offset, offset + 200);
        const existing = await supabase
          .from("carol_sessions")
          .select("external_id")
          .in("external_id", chunk);
        if (existing.error) throw new Error(existing.error.message);
        for (const row of Array.isArray(existing.data) ? existing.data : []) {
          const id = asString((row as Record<string, unknown>).external_id, "");
          if (id) existingSet.add(id);
        }
      }

      const toInsert = workingRows.filter((row) => !existingSet.has(asString(row.external_id, "")));
      const toUpdate = workingRows.filter((row) => existingSet.has(asString(row.external_id, "")));

      for (let offset = 0; offset < toInsert.length; offset += 250) {
        const chunk = toInsert.slice(offset, offset + 250);
        const insertResult = await supabase.from("carol_sessions").insert(chunk);
        if (insertResult.error) throw new Error(insertResult.error.message);
      }
      for (const row of toUpdate) {
        const externalId = asString(row.external_id, "");
        if (!externalId) continue;
        const updatePayload = { ...row };
        delete updatePayload.external_id;
        const updateResult = await supabase
          .from("carol_sessions")
          .update(updatePayload)
          .eq("external_id", externalId);
        if (updateResult.error) throw new Error(updateResult.error.message);
      }
      return;
    }

    throw new Error(result.error.message);
  }
}

async function loginToCarol(params: {
  carolUsername: string;
  carolPassword: string;
}): Promise<{ token: string; riderId: string }> {
  const { carolUsername, carolPassword } = params;
  const loginResponse = await fetch("https://i.carolbike.com/rider-api/auth/login?v=3.4.27", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      username: carolUsername,
      password: carolPassword,
    }),
    cache: "no-store",
  });
  const loginPayload = (await loginResponse.json().catch(() => ({}))) as Record<string, unknown>;
  if (!loginResponse.ok) {
    throw new CarolApiError(
      401,
      asString(loginPayload.message, "") ||
        asString(loginPayload.error, "") ||
        "CAROL authentication failed.",
    );
  }

  const token = extractToken(loginPayload);
  const riderId = extractRiderId(loginPayload);
  if (!token || !riderId) {
    throw new CarolApiError(502, "CAROL login response missing token or rider ID.");
  }

  return { token, riderId };
}

async function collectCarolRides(params: {
  token: string;
  riderId: string;
}) {
  const { token, riderId } = params;
  const ridesByType: Record<string, CarolRide[]> = {};
  const failedTypes: Record<string, string> = {};
  let unauthorizedFailures = 0;
  let successfulTypes = 0;

  for (const type of CAROL_TYPES) {
    try {
      ridesByType[type] = await fetchCarolRidesForType({ token, riderId, type });
      successfulTypes += 1;
    } catch (typeError) {
      ridesByType[type] = [];
      if (
        typeError instanceof CarolApiError &&
        (typeError.status === 401 || typeError.status === 403)
      ) {
        unauthorizedFailures += 1;
      }
      failedTypes[type] =
        typeError instanceof Error ? typeError.message : `Failed to fetch rides for ${type}.`;
    }
  }

  return {
    ridesByType,
    failedTypes,
    unauthorizedFailures,
    successfulTypes,
  };
}

async function updateUserCarolAuthWithFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
  payload: {
    carol_token?: string;
    carol_rider_id?: string;
    carol_username?: string;
  },
) {
  const updatePayload: Record<string, unknown> = {};
  if (payload.carol_token) updatePayload.carol_token = payload.carol_token;
  if (payload.carol_rider_id) updatePayload.carol_rider_id = payload.carol_rider_id;
  if (payload.carol_username) updatePayload.carol_username = payload.carol_username;
  if (!Object.keys(updatePayload).length) return;

  const removedColumns = new Set<string>();
  while (true) {
    const updateResult = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", userId);
    if (!updateResult.error) return;

    const missingColumn = extractMissingColumnName(updateResult.error.message);
    if (!missingColumn || removedColumns.has(missingColumn)) {
      throw new Error(updateResult.error.message);
    }
    removedColumns.add(missingColumn);
    delete updatePayload[missingColumn];
    if (!Object.keys(updatePayload).length) return;
  }
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const providedCarolUsername = asString(body.carolUsername, "");
    const providedCarolPassword = asString(body.carolPassword, "");
    const requestedUserId = asString(body.userId, "");
    const actorUserId = asString(context.dbUser.id, "");
    if (!actorUserId) {
      return NextResponse.json(
        { success: false, error: "Authenticated user record is missing id." },
        { status: 400 },
      );
    }

    const targetUserId = requestedUserId || actorUserId;
    const actorRole = asString(context.role, "member").toLowerCase();
    const isCoachOrAdmin = actorRole === "coach" || actorRole === "admin";
    if (!isCoachOrAdmin && targetUserId !== actorUserId) {
      return NextResponse.json(
        { success: false, error: "Members can only sync their own CAROL account." },
        { status: 403 },
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "SUPABASE_SERVICE_ROLE_KEY is required for CAROL sync." },
        { status: 500 },
      );
    }

    const targetUserRes = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", targetUserId)
      .limit(1);
    if (targetUserRes.error) throw new Error(targetUserRes.error.message);
    if (!Array.isArray(targetUserRes.data) || targetUserRes.data.length === 0) {
      return NextResponse.json({ success: false, error: "Target user not found." }, { status: 404 });
    }
    const targetRole = asString((targetUserRes.data[0] as Record<string, unknown>).role, "member").toLowerCase();
    if (targetRole !== "member") {
      return NextResponse.json(
        { success: false, error: "CAROL sync target must be a member." },
        { status: 400 },
      );
    }
    const targetUser = targetUserRes.data[0] as Record<string, unknown>;
    const storedCarolToken = asString(targetUser.carol_token, "");
    const storedCarolRiderId = asString(targetUser.carol_rider_id, "");
    const storedCarolUsername = asString(targetUser.carol_username, "");

    let activeToken = storedCarolToken;
    let activeRiderId = storedCarolRiderId;
    let activeCarolUsername = providedCarolUsername || storedCarolUsername;
    let collection:
      | Awaited<ReturnType<typeof collectCarolRides>>
      | null = null;

    if (activeToken && activeRiderId) {
      collection = await collectCarolRides({
        token: activeToken,
        riderId: activeRiderId,
      });
      const tokenLikelyExpired =
        collection.successfulTypes === 0 && collection.unauthorizedFailures > 0;
      if (tokenLikelyExpired) {
        if (!providedCarolPassword) {
          return NextResponse.json(
            {
              success: false,
              needs_reauth: true,
              error: "Stored CAROL token expired. Please re-enter your CAROL password.",
            },
            { status: 401 },
          );
        }
        if (!activeCarolUsername) {
          return NextResponse.json(
            { success: false, error: "CAROL username is required to refresh your connection." },
            { status: 400 },
          );
        }
        const login = await loginToCarol({
          carolUsername: activeCarolUsername,
          carolPassword: providedCarolPassword,
        });
        activeToken = login.token;
        activeRiderId = login.riderId;
        await updateUserCarolAuthWithFallback(supabaseAdmin, targetUserId, {
          carol_token: activeToken,
          carol_rider_id: activeRiderId,
          carol_username: activeCarolUsername,
        });
        collection = await collectCarolRides({
          token: activeToken,
          riderId: activeRiderId,
        });
      } else if (providedCarolUsername && providedCarolUsername !== storedCarolUsername) {
        await updateUserCarolAuthWithFallback(supabaseAdmin, targetUserId, {
          carol_username: providedCarolUsername,
        });
      }
    } else {
      if (!activeCarolUsername || !providedCarolPassword) {
        return NextResponse.json(
          {
            success: false,
            error:
              "CAROL username and password are required for first-time connection.",
          },
          { status: 400 },
        );
      }
      const login = await loginToCarol({
        carolUsername: activeCarolUsername,
        carolPassword: providedCarolPassword,
      });
      activeToken = login.token;
      activeRiderId = login.riderId;
      await updateUserCarolAuthWithFallback(supabaseAdmin, targetUserId, {
        carol_token: activeToken,
        carol_rider_id: activeRiderId,
        carol_username: activeCarolUsername,
      });
      collection = await collectCarolRides({
        token: activeToken,
        riderId: activeRiderId,
      });
    }

    if (!collection) {
      throw new Error("Unable to collect CAROL rides.");
    }
    const ridesByType = collection.ridesByType;
    const failedTypes = collection.failedTypes;

    const allRows: Array<Record<string, unknown>> = [];
    const typesSummary: Record<string, number> = {};
    for (const type of CAROL_TYPES) {
      const rides = ridesByType[type] ?? [];
      typesSummary[type] = rides.length;
      for (const ride of rides) {
        const externalId = asString(ride.id, "");
        if (!externalId) continue;
        const sessionDateIso = parseUnixToIso(ride.start);
        if (!sessionDateIso) continue;
        const mappedRide: Record<string, unknown> = {
          external_id: asString(ride.id, ""),
          user_id: targetUserId,
          ride_type: mapRideType(ride.type),
          session_date: sessionDateIso,
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
        };
        allRows.push({
          member_id: targetUserId,
          ...mappedRide,
          raw_data: {
            source: "carol_api_sync",
            rider_id: activeRiderId,
            username: activeCarolUsername || null,
            ride,
          },
        });
      }
    }

    const dedupedMap = new Map<string, Record<string, unknown>>();
    for (const row of allRows) {
      const id = asString(row.external_id, "");
      if (!id) continue;
      dedupedMap.set(id, row);
    }
    const dedupedRows = Array.from(dedupedMap.values());

    if (dedupedRows.length > 0) {
      for (let offset = 0; offset < dedupedRows.length; offset += 200) {
        const chunk = dedupedRows.slice(offset, offset + 200);
        await upsertCarolRowsWithFallback(supabaseAdmin, chunk);
      }
    }

    return NextResponse.json({
      success: true,
      imported: dedupedRows.length,
      types: typesSummary,
      failed_types: failedTypes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to sync CAROL rides.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
