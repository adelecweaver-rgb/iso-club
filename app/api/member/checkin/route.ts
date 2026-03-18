import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

export async function GET() {
  try {
    const { context, error } = await getActorContext();
    if (!context) return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    const memberId = asString(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    const today = new Date().toISOString().slice(0, 10);
    const res = await supabase.from("daily_checkins").select("feeling").eq("member_id", memberId).eq("checkin_date", today).limit(1);
    const feeling = res.data?.length ? asString(res.data[0].feeling) : null;
    return NextResponse.json({ success: true, feeling: feeling || null });
  } catch (err) {
    return NextResponse.json({ success: false, feeling: null, error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    const memberId = asString(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });

    const body = (await request.json()) as { feeling?: string };
    const feeling = asString(body.feeling);
    if (!["low", "normal", "strong", "hurt"].includes(feeling)) {
      return NextResponse.json({ success: false, error: "feeling must be low, normal, strong, or hurt." }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const res = await supabase.from("daily_checkins").upsert(
      { member_id: memberId, checkin_date: today, feeling },
      { onConflict: "member_id,checkin_date" },
    );
    if (res.error) throw new Error(res.error.message);

    // Send coach notification for low energy or pain
    if (feeling === "low" || feeling === "hurt") {
      const memberName = asString(
        (context.dbUser as Record<string, unknown>).full_name ?? context.fullName,
        "A member",
      );
      const notifType = feeling === "hurt" ? "pain_reported" : "recovery_day";
      const message = feeling === "hurt"
        ? `⚠️ ${memberName} reported pain today — follow up recommended`
        : `${memberName} opted for a recovery day today`;
      // Fire and forget — don't block the response if this fails
      void supabase.from("coach_notifications").insert({ member_id: memberId, type: notifType, message, is_read: false });
    }

    return NextResponse.json({ success: true, feeling });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
