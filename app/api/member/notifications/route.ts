import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    const memberId = asString(context.dbUser.id);
    if (!memberId) {
      return NextResponse.json({ success: false, error: "Could not resolve member ID." }, { status: 400 });
    }
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }
    const body = (await request.json()) as { type?: string; message?: string };
    const type = asString(body.type, "general");
    const message = asString(body.message);
    if (!message) {
      return NextResponse.json({ success: false, error: "Message is required." }, { status: 400 });
    }
    const res = await supabase.from("coach_notifications").insert({
      member_id: memberId,
      type,
      message,
      is_read: false,
    });
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to send notification." },
      { status: 500 },
    );
  }
}
