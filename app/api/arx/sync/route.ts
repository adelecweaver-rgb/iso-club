import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ARX_BASE = "https://my.arxfit.com";

// ARX exercise ID → display name.
// IDs are consistent across the platform; names follow the standard ARX catalog.
const EXERCISE_NAMES: Record<number, string> = {
  1: "Leg Press",
  2: "Chest Press",
  3: "Row",
  4: "Leg Curl",
  5: "Overhead Press",
  6: "Bicep Curl",
  7: "Tricep Extension",
  8: "Calf Raise",
  9: "Hip Abduction",
  10: "Hip Adduction",
  11: "Leg Extension",
  12: "Pulldown",
  13: "Deadlift",
  14: "Squat",
  15: "Shrug",
  16: "Ab Crunch",
  17: "Back Extension",
  18: "Chest Fly",
  19: "Reverse Fly",
  20: "Lateral Raise",
  25: "Hip Thrust",
};

function resolveExerciseName(id: number, machineType: number): string {
  return EXERCISE_NAMES[id] ?? `Exercise ${id} (Machine ${machineType})`;
}

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

// ─── ARX auth ────────────────────────────────────────────────────────────────

function extractPhpSessId(setCookieHeader: string): string {
  return setCookieHeader.match(/PHPSESSID=([^;]+)/)?.[1] ?? "";
}

async function loginToArx(username: string, password: string): Promise<string> {
  // Step 1: GET login page — capture initial PHPSESSID so Symfony can validate
  // the CSRF token against the session (required for Symfony security component).
  const loginPageRes = await fetch(`${ARX_BASE}/login`, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; IsoClub/1.0)" },
  });
  const loginHtml = await loginPageRes.text();
  const initialSessId = extractPhpSessId(loginPageRes.headers.get("set-cookie") ?? "");

  // Extract CSRF token — try both attribute orderings
  const csrfMatch =
    loginHtml.match(/name="_csrf_token"[^>]*value="([^"]+)"/) ??
    loginHtml.match(/value="([^"]+)"[^>]*name="_csrf_token"/) ??
    loginHtml.match(/name="[^"]*_token[^"]*"[^>]*value="([^"]+)"/) ??
    loginHtml.match(/value="([^"]+)"[^>]*name="[^"]*_token[^"]*"/);
  if (!csrfMatch) {
    throw new Error("Could not extract CSRF token from ARX login page. The site structure may have changed.");
  }
  const csrfToken = csrfMatch[1];

  // Step 2: POST login_check — pass initial PHPSESSID so Symfony can look up
  // the CSRF token from the session and validate it.
  const loginCheckRes = await fetch(`${ARX_BASE}/login_check`, {
    method: "POST",
    redirect: "manual",
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; IsoClub/1.0)",
      Origin: ARX_BASE,
      Referer: `${ARX_BASE}/login`,
      ...(initialSessId ? { Cookie: `PHPSESSID=${initialSessId}` } : {}),
    },
    body: new URLSearchParams({
      _username: username,
      _password: password,
      _csrf_token: csrfToken,
    }).toString(),
  });

  if (loginCheckRes.status !== 302 && loginCheckRes.status !== 301 && loginCheckRes.status !== 200) {
    throw new Error(`ARX login returned unexpected status ${loginCheckRes.status}.`);
  }

  // Successful Symfony login sets a new PHPSESSID via Set-Cookie
  const newSessId = extractPhpSessId(loginCheckRes.headers.get("set-cookie") ?? "");
  if (!newSessId) {
    // Login may have failed silently — redirected back to /login
    const redirectTo = loginCheckRes.headers.get("location") ?? "";
    if (redirectTo.includes("login")) {
      throw new Error("ARX login failed. Please check your username and password.");
    }
    // Some server configurations reuse the existing session
    if (initialSessId) return initialSessId;
    throw new Error("ARX login failed — no session cookie returned.");
  }
  return newSessId;
}

// ─── HTML data extraction ─────────────────────────────────────────────────────

function extractJsonVar(html: string, varName: string): unknown {
  const marker = `let ${varName} = `;
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const valueStart = start + marker.length;
  const firstChar = html[valueStart];
  const closeChar = firstChar === "[" ? "]" : "}";
  let depth = 0;
  for (let i = valueStart; i < html.length; i++) {
    if (html[i] === firstChar) depth++;
    else if (html[i] === closeChar) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(valueStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractTotalPages(html: string): number {
  const matches = [...html.matchAll(/exercise_sets\?page=(\d+)/g)];
  if (!matches.length) return 1;
  return Math.max(...matches.map((m) => parseInt(m[1], 10)));
}

async function fetchFirstPage(sessId: string): Promise<{ html: string; userId: string }> {
  const res = await fetch(`${ARX_BASE}/user/me/exercise_sets`, {
    cache: "no-store",
    headers: {
      Cookie: `PHPSESSID=${sessId}`,
      "User-Agent": "Mozilla/5.0 (compatible; IsoClub/1.0)",
    },
  });

  const finalUrl = res.url ?? "";
  const html = await res.text();

  if (finalUrl.includes("/login")) {
    throw new Error("ARX login failed — session not established. Please check your username and password.");
  }

  // UUID may appear in the redirect URL when Symfony rewrites /user/me/ → /user/{UUID}/
  const uuidFromUrl = finalUrl.match(
    /\/user\/([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\//i,
  )?.[1] ?? null;

  // Symfony also embeds the UUID as a plain JS string: let userId = "UUID-HERE";
  // extractJsonVar only handles arrays/objects — use a direct regex for string values.
  const uuidFromHtml = html.match(/let userId\s*=\s*"([^"]+)"/)?.[1] ?? null;

  const userId = uuidFromUrl ?? uuidFromHtml ?? null;
  if (!userId) {
    const pageTitle = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "unknown";
    throw new Error(
      `Could not determine ARX user ID. Page: "${pageTitle}". URL: ${finalUrl}. Login may have failed.`,
    );
  }
  return { html, userId };
}

async function fetchPage(sessId: string, userId: string, page: number): Promise<string> {
  const url = `${ARX_BASE}/user/${userId}/exercise_sets?page=${page}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Cookie: `PHPSESSID=${sessId}`,
      "User-Agent": "Mozilla/5.0 (compatible; IsoClub/1.0)",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ARX page ${page} (status ${res.status}).`);
  return res.text();
}

// ─── DB upsert (same fallback logic as coach import) ──────────────────────────

function extractMissingColumn(msg: string): string | null {
  return (
    msg.match(/column ["']?([^"']+)["']? of relation .* does not exist/i)?.[1] ??
    msg.match(/Could not find the ['"]?([^'"]+)['"]? column/i)?.[1] ??
    null
  );
}

async function upsertSets(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  const CHUNK = 200;
  const stripped = new Set<string>();
  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    const chunk = rows.slice(offset, offset + CHUNK);
    let working = chunk.map((r) => {
      const copy = { ...r };
      for (const col of stripped) delete copy[col];
      return copy;
    });
    let attempts = 0;
    while (attempts < 10) {
      const res = await supabase.from("arx_sessions").upsert(working, { onConflict: "external_id" });
      if (!res.error) break;
      const missing = extractMissingColumn(res.error.message);
      if (missing && !stripped.has(missing)) {
        stripped.add(missing);
        working = working.map((r) => { const c = { ...r }; delete c[missing]; return c; });
        attempts++;
        continue;
      }
      if (/no unique or exclusion constraint/i.test(res.error.message)) {
        const ids = working.map((r) => String(r.external_id)).filter(Boolean);
        const existing = await supabase.from("arx_sessions").select("external_id").in("external_id", ids);
        const existingSet = new Set((existing.data ?? []).map((r: Record<string, unknown>) => String(r.external_id)));
        const toInsert = working.filter((r) => !existingSet.has(String(r.external_id)));
        const toUpdate = working.filter((r) => existingSet.has(String(r.external_id)));
        if (toInsert.length) await supabase.from("arx_sessions").insert(toInsert);
        for (const row of toUpdate) {
          const id = String(row.external_id);
          const payload = { ...row };
          delete payload.external_id;
          await supabase.from("arx_sessions").update(payload).eq("external_id", id);
        }
        break;
      }
      throw new Error(res.error.message);
    }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

type Body = { arxUsername?: string; arxPassword?: string; userId?: string };

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const arxUsername = asString(body.arxUsername);
    const arxPassword = asString(body.arxPassword);
    const requestedUserId = asString(body.userId);
    const actorUserId = asString(context.dbUser.id);
    const actorRole = asString(context.role, "member").toLowerCase();
    const isCoachOrAdmin = actorRole === "coach" || actorRole === "admin";

    const targetUserId = (isCoachOrAdmin && requestedUserId) ? requestedUserId : actorUserId;
    if (!targetUserId) {
      return NextResponse.json({ success: false, error: "Could not resolve member ID." }, { status: 400 });
    }
    if (!isCoachOrAdmin && targetUserId !== actorUserId) {
      return NextResponse.json({ success: false, error: "Members can only sync their own ARX account." }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase admin client unavailable." }, { status: 500 });
    }

    // Load saved ARX username for this member
    const userRes = await supabase.from("users").select("arx_username").eq("id", targetUserId).limit(1);
    const savedUsername = asString((userRes.data?.[0] as Record<string, unknown> | undefined)?.arx_username);
    const activeUsername = arxUsername || savedUsername;

    if (!activeUsername || !arxPassword) {
      return NextResponse.json(
        { success: false, error: "ARX username and password are required." },
        { status: 400 },
      );
    }

    // Login and get session cookie
    const sessId = await loginToArx(activeUsername, arxPassword);

    // Fetch page 1 — also discovers ARX user UUID from the redirect URL
    const { html: page1Html, userId: arxUserId } = await fetchFirstPage(sessId);

    const totalPages = extractTotalPages(page1Html);
    const allSets: Array<Record<string, unknown>> = [];

    // Extract page 1 sets
    const page1Sets = extractJsonVar(page1Html, "allSets");
    if (Array.isArray(page1Sets)) allSets.push(...(page1Sets as Array<Record<string, unknown>>));

    // Fetch remaining pages
    for (let page = 2; page <= Math.min(totalPages, 200); page++) {
      const html = await fetchPage(sessId, arxUserId, page);
      const sets = extractJsonVar(html, "allSets");
      if (Array.isArray(sets)) allSets.push(...(sets as Array<Record<string, unknown>>));
      // Small delay to avoid hammering their server
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    if (allSets.length === 0) {
      return NextResponse.json({ success: false, error: "No exercise sets found in your ARX account." }, { status: 404 });
    }

    // Map to arx_sessions rows
    const rows = allSets
      .filter((s) => asString(s.uuid) && asString(s.exerciseDate))
      .map((s) => {
        const exerciseId = typeof s.exercise === "number" ? s.exercise : 0;
        const machineTypeId = typeof s.machineType === "number" ? s.machineType : 0;
        return {
          external_id: asString(s.uuid),
          member_id: targetUserId,
          session_date: asString(s.exerciseDate),
          exercise: resolveExerciseName(exerciseId, machineTypeId),
          machine_type: `ARX Machine ${machineTypeId}`,
          concentric_max: asNum(s.concentricMax),
          eccentric_max: asNum(s.eccentricMax),
          intensity: asNum(s.intensity),
          output: asNum(s.intensity),
          duration: s.elapsedSeconds != null ? `${Math.round(Number(s.elapsedSeconds))}s` : null,
          staff_notes: asString(s.notes) || null,
          raw_data: {
            source: "arx_credential_sync",
            arx_user_id: arxUserId,
            exercise_id: exerciseId,
            machine_type_id: machineTypeId,
            max_load: asNum(s.maxLoad),
            protocol: s.protocol,
            speed: asNum(s.speed),
            hide_from_stats: s.hideFromStats,
            location_id: s.locationId,
          },
        };
      });

    await upsertSets(supabase, rows);

    // Save ARX username for future syncs
    await supabase.from("users").update({ arx_username: activeUsername }).eq("id", targetUserId);

    const exercises = [...new Set(rows.map((r) => r.exercise))];
    return NextResponse.json({
      success: true,
      imported: rows.length,
      pages: totalPages,
      exercises,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ARX sync failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
