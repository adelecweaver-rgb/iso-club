import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";

export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachRole(context.role)) {
      return NextResponse.json({ success: false, error: "Coach access required." }, { status: 403 });
    }

    const res = await context.supabase
      .from("users")
      .select("id,full_name,membership_tier,member_status,onboarding_updated_at")
      .eq("role", "member")
      .eq("is_active", true)
      .order("full_name");

    if (res.error) throw new Error(res.error.message);

    return NextResponse.json({
      success: true,
      members: (res.data ?? []).map((m: Record<string, unknown>) => ({
        id: String(m.id ?? ""),
        name: String(m.full_name ?? "Member"),
        tier: String(m.membership_tier ?? ""),
        member_status: String(m.member_status ?? "active"),
        review_requested_at: (m.onboarding_updated_at as string) ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed to load members." }, { status: 500 });
  }
}
