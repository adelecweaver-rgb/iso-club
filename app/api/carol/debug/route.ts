import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { context, error } = await getActorContext();
  if (!context) {
    return NextResponse.json({ error: error ?? "Not authenticated." }, { status: 401 });
  }

  const memberId = String(context.dbUser.id ?? "");
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client unavailable." }, { status: 500 });
  }

  const res = await supabase
    .from("carol_sessions")
    .select("session_date,ride_type,peak_power_watts,manp,avg_sprint_power,calories_incl_epoc,heart_rate_max,sequential_number,fitness_score,octane_score,calories,max_hr,ride_number,energy_joules,average_power")
    .eq("member_id", memberId)
    .order("session_date", { ascending: false })
    .limit(5);

  return NextResponse.json({
    member_id: memberId,
    error: res.error?.message ?? null,
    row_count: res.data?.length ?? 0,
    rows: res.data ?? [],
  });
}
