import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asStr(v: unknown, fb = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fb;
}
function asNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
}

export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    const memberId = asStr(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });

    // Get member's active protocol
    const mpRes = await supabase
      .from("member_protocols")
      .select("protocol_id,customization_notes,protocols(id,name)")
      .eq("member_id", memberId)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1);
    if (mpRes.error || !mpRes.data?.length) {
      return NextResponse.json({ success: true, days: [], protocolName: "", customizationNotes: null });
    }
    const mp = mpRes.data[0] as Record<string, unknown>;
    const proto = mp.protocols as Record<string, unknown> | null;
    const protocolId = asStr(proto?.id ?? "");
    const protocolName = asStr(proto?.name ?? "");
    const customizationNotes = asStr(mp.customization_notes ?? "") || null;
    if (!protocolId) return NextResponse.json({ success: true, days: [], protocolName: "", customizationNotes: null });
    // Current week overrides
    const nowD = new Date(); const dowd = nowD.getDay(); const diffW = dowd === 0 ? -6 : 1 - dowd;
    nowD.setDate(nowD.getDate() + diffW); nowD.setHours(0,0,0,0);
    const weekStartStr = nowD.toISOString().slice(0, 10);
    const overrideRes = await supabase.from("member_schedule_overrides").select("protocol_day_id,original_day_of_week,override_day_of_week").eq("member_id", memberId).eq("week_start", weekStartStr);
    const overrides = (overrideRes.data ?? []) as Array<Record<string, unknown>>;

    // Fetch all 7 days
    const daysRes = await supabase
      .from("protocol_days")
      .select("id,day_of_week,day_name,day_theme,day_description")
      .eq("protocol_id", protocolId)
      .order("day_of_week");
    if (daysRes.error) return NextResponse.json({ success: true, days: [], protocolName });

    const days = daysRes.data ?? [];
    if (!days.length) return NextResponse.json({ success: true, days: [], protocolName });

    // Fetch all activities for these days
    const dayIds = days.map((d) => (d as Record<string, unknown>).id as string);
    const actRes = await supabase
      .from("protocol_day_activities")
      .select("*")
      .in("protocol_day_id", dayIds)
      .order("activity_order");
    const activities = actRes.data ?? [];

    const result = days.map((d) => {
      const dr = d as Record<string, unknown>;
      const dayActs = (activities as Array<Record<string, unknown>>)
        .filter((a) => a.protocol_day_id === dr.id)
        .map((a) => ({
          id: asStr(a.id),
          order: asNum(a.activity_order),
          type: asStr(a.activity_type),
          name: asStr(a.activity_name),
          durationMinutes: asNum(a.duration_minutes),
          description: asStr(a.description),
          whyItMatters: asStr(a.why_it_matters),
          steps: Array.isArray(a.steps) ? (a.steps as string[]) : [],
          isBookable: a.is_bookable === true,
          bookingUrl: a.booking_url ? asStr(a.booking_url) : null,
          isOptional: a.is_optional === true,
          alternativeActivity: a.alternative_activity ? asStr(a.alternative_activity) : null,
          coldPlunge: a.cold_plunge ? asStr(a.cold_plunge) : null,
        }));
      return {
        id: asStr(dr.id),
        dayOfWeek: asNum(dr.day_of_week),
        dayName: asStr(dr.day_name),
        dayTheme: asStr(dr.day_theme),
        dayDescription: asStr(dr.day_description),
        activities: dayActs,
        totalMinutes: dayActs.reduce((s, a) => s + a.durationMinutes, 0),
      };
    });

    return NextResponse.json({ success: true, days: result, protocolName, customizationNotes, overrides: overrides.map(o => ({ protocolDayId: asStr(o.protocol_day_id), originalDow: asNum(o.original_day_of_week), overrideDow: asNum(o.override_day_of_week) })) });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed.", days: [], protocolName: "" }, { status: 500 });
  }
}
