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

  // Count rows by member_id
  const countByMemberId = await supabase
    .from("carol_sessions")
    .select("*", { count: "exact", head: true })
    .eq("member_id", memberId);

  // Count rows by user_id
  const countByUserId = await supabase
    .from("carol_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", memberId);

  // Fetch one sample row with all columns (no filter) to reveal schema
  const sampleRow = await supabase
    .from("carol_sessions")
    .select("*")
    .limit(1);

  // Fetch one row for this member ignoring raw_data
  const memberRow = await supabase
    .from("carol_sessions")
    .select("*")
    .eq("member_id", memberId)
    .limit(1);

  return NextResponse.json({
    resolved_member_id: memberId,
    clerk_id: context.clerkUserId,
    role: context.role,
    carol_sessions: {
      count_by_member_id: countByMemberId.count,
      count_by_member_id_error: countByMemberId.error?.message ?? null,
      count_by_user_id: countByUserId.count,
      count_by_user_id_error: countByUserId.error?.message ?? null,
      sample_row_columns: sampleRow.data?.length
        ? Object.keys(sampleRow.data[0] as object).filter((k) => k !== "raw_data")
        : null,
      sample_row_error: sampleRow.error?.message ?? null,
      member_row_error: memberRow.error?.message ?? null,
      member_row_sample: memberRow.data?.length
        ? (() => {
            const row = { ...(memberRow.data[0] as Record<string, unknown>) };
            delete row.raw_data;
            return row;
          })()
        : null,
    },
  });
}
