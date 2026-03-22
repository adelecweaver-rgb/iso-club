import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";

function asStr(v: unknown, fb = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fb;
}
function asNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
}

export async function GET(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachRole(context.role)) {
      return NextResponse.json({ success: false, error: "Coach access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const protocolId = searchParams.get("protocol_id");
    if (!protocolId) {
      return NextResponse.json({ success: false, error: "protocol_id is required." }, { status: 400 });
    }

    const daysRes = await context.supabase
      .from("protocol_days")
      .select("id,day_of_week,day_name,day_theme,day_description")
      .eq("protocol_id", protocolId)
      .order("day_of_week");
    if (daysRes.error) throw new Error(daysRes.error.message);

    const days = daysRes.data ?? [];
    if (!days.length) {
      return NextResponse.json({ success: true, days: [] });
    }

    const dayIds = days.map((d) => (d as Record<string, unknown>).id as string);
    const actRes = await context.supabase
      .from("protocol_day_activities")
      .select("id,protocol_day_id,activity_order,activity_type,activity_name,duration_minutes,is_optional,cold_plunge")
      .in("protocol_day_id", dayIds)
      .order("activity_order");
    if (actRes.error) throw new Error(actRes.error.message);

    const activities = (actRes.data ?? []) as Array<Record<string, unknown>>;

    const result = days.map((d) => {
      const dr = d as Record<string, unknown>;
      const dayActs = activities
        .filter((a) => a.protocol_day_id === dr.id)
        .map((a) => ({
          id: asStr(a.id),
          order: asNum(a.activity_order),
          type: asStr(a.activity_type),
          name: asStr(a.activity_name),
          durationMinutes: asNum(a.duration_minutes),
          isOptional: a.is_optional === true,
          coldPlunge: typeof a.cold_plunge === "string" ? a.cold_plunge : null,
        }));
      return {
        id: asStr(dr.id),
        dayOfWeek: asNum(dr.day_of_week),
        dayName: asStr(dr.day_name),
        dayTheme: asStr(dr.day_theme),
        dayDescription: asStr(dr.day_description),
        activities: dayActs,
      };
    });

    return NextResponse.json({ success: true, days: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed.", days: [] },
      { status: 500 },
    );
  }
}
