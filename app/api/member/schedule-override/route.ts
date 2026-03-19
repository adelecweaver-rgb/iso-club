import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asStr(v: unknown, fb = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fb;
}
function asNum(v: unknown): number { return typeof v === "number" && Number.isFinite(v) ? v : 0; }

function currentWeekStart(): string {
  const d = new Date();
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    const memberId = asStr(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    const ws = currentWeekStart();
    const res = await supabase
      .from("member_schedule_overrides")
      .select("id,protocol_day_id,original_day_of_week,override_day_of_week")
      .eq("member_id", memberId)
      .eq("week_start", ws);
    return NextResponse.json({ success: true, overrides: res.data ?? [], week_start: ws });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed.", overrides: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    const memberId = asStr(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    const body = (await request.json()) as { protocol_day_id?: string; original_day_of_week?: number; override_day_of_week?: number };
    const protocolDayId = asStr(body.protocol_day_id);
    const originalDow = asNum(body.original_day_of_week);
    const overrideDow = asNum(body.override_day_of_week);
    if (!protocolDayId || !originalDow || !overrideDow) {
      return NextResponse.json({ success: false, error: "protocol_day_id, original_day_of_week, override_day_of_week required." }, { status: 400 });
    }
    const ws = currentWeekStart();
    const res = await supabase.from("member_schedule_overrides").upsert(
      { member_id: memberId, protocol_day_id: protocolDayId, original_day_of_week: originalDow, override_day_of_week: overrideDow, week_start: ws },
      { onConflict: "member_id,protocol_day_id,week_start" },
    );
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    const memberId = asStr(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    const body = (await request.json()) as { protocol_day_id?: string };
    const protocolDayId = asStr(body.protocol_day_id);
    if (!protocolDayId) return NextResponse.json({ success: false, error: "protocol_day_id required." }, { status: 400 });
    const ws = currentWeekStart();
    await supabase.from("member_schedule_overrides").delete()
      .eq("member_id", memberId).eq("protocol_day_id", protocolDayId).eq("week_start", ws);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
