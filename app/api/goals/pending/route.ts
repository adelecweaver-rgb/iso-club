import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

// GET — coach fetches all pending goal suggestions
export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context || !isCoachRole(context.role)) {
      return NextResponse.json({ success: false, error: error ?? "Coach access required." }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }

    const res = await supabase
      .from("goal_suggestions")
      .select("id,member_id,suggestions,protocol_suggestion,protocol_reasoning,created_at,status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (res.error) throw new Error(res.error.message);

    const rows = Array.isArray(res.data) ? res.data : [];

    // Enrich with member names
    const memberIds = [...new Set(rows.map((r: Record<string, unknown>) => asStr(r.member_id)))].filter(Boolean);
    const memberMap: Record<string, string> = {};
    if (memberIds.length > 0) {
      const mRes = await supabase.from("users").select("id,full_name").in("id", memberIds);
      for (const m of (Array.isArray(mRes.data) ? mRes.data : []) as Array<Record<string, unknown>>) {
        memberMap[asStr(m.id)] = asStr(m.full_name, "Member");
      }
    }

    const suggestions = rows.map((r: Record<string, unknown>) => ({
      id: asStr(r.id),
      member_id: asStr(r.member_id),
      member_name: memberMap[asStr(r.member_id)] ?? "Member",
      suggestions: Array.isArray(r.suggestions) ? r.suggestions : [],
      protocol_suggestion: asStr(r.protocol_suggestion as unknown),
      protocol_reasoning: asStr(r.protocol_reasoning as unknown),
      created_at: asStr(r.created_at as unknown),
      status: asStr(r.status as unknown),
    }));

    return NextResponse.json({ success: true, suggestions });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load pending suggestions." },
      { status: 500 },
    );
  }
}
