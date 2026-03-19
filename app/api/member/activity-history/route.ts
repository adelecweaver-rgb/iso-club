import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asStr(v: unknown, fb = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fb;
}
function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}
function dateOf(v: unknown): string {
  const s = asStr(v);
  return s.slice(0, 10); // YYYY-MM-DD
}

export async function GET(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    const memberId = asStr(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const months = Math.min(12, Math.max(1, parseInt(searchParams.get("months") ?? "3", 10)));
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceIso = since.toISOString().slice(0, 10);

    const [arxRes, carolRes, recoveryRes, manualRes] = await Promise.all([
      supabase.from("arx_sessions").select("session_date,exercise,concentric_max,eccentric_max,output").eq("member_id", memberId).gte("session_date", sinceIso).order("session_date", { ascending: false }).limit(2000),
      supabase.from("carol_sessions").select("session_date,ride_type,manp,peak_power_watts").eq("member_id", memberId).gte("session_date", sinceIso).order("session_date", { ascending: false }).limit(1000),
      supabase.from("recovery_sessions").select("session_date,modality").eq("member_id", memberId).gte("session_date", sinceIso).order("session_date", { ascending: false }).limit(1000),
      supabase.from("manual_workout_sessions").select("session_date,equipment").eq("member_id", memberId).gte("session_date", sinceIso).order("session_date", { ascending: false }).limit(500),
    ]);

    // Group everything by date
    type DayData = {
      arx: Array<{ exercise: string; concentricMax: number | null; eccentricMax: number | null }>;
      carol: Array<{ rideType: string; manp: number | null; peakPower: number | null }>;
      recovery: Array<{ modality: string }>;
      manual: Array<{ equipment: string }>;
    };
    const days = new Map<string, DayData>();
    const getDay = (d: string): DayData => {
      if (!days.has(d)) days.set(d, { arx: [], carol: [], recovery: [], manual: [] });
      return days.get(d)!;
    };

    for (const r of (arxRes.data ?? []) as Array<Record<string, unknown>>) {
      const d = dateOf(r.session_date); const ex = asStr(r.exercise);
      if (d && ex) getDay(d).arx.push({ exercise: ex, concentricMax: asNum(r.concentric_max), eccentricMax: asNum(r.eccentric_max) });
    }
    for (const r of (carolRes.data ?? []) as Array<Record<string, unknown>>) {
      const d = dateOf(r.session_date); const rt = asStr(r.ride_type);
      if (d && rt) getDay(d).carol.push({ rideType: rt, manp: asNum(r.manp), peakPower: asNum(r.peak_power_watts) });
    }
    for (const r of (recoveryRes.data ?? []) as Array<Record<string, unknown>>) {
      const d = dateOf(r.session_date); const m = asStr(r.modality);
      if (d) getDay(d).recovery.push({ modality: m || "recovery" });
    }
    for (const r of (manualRes.data ?? []) as Array<Record<string, unknown>>) {
      const d = dateOf(r.session_date); const eq = asStr(r.equipment);
      if (d && eq) getDay(d).manual.push({ equipment: eq });
    }

    const result = Array.from(days.entries()).map(([date, data]) => ({ date, ...data }));
    result.sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json({ success: true, days: result });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed.", days: [] }, { status: 500 });
  }
}
