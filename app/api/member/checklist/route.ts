import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Body = {
  type: "arx" | "carol" | "recovery";
  subtype: string;
};

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
      return NextResponse.json({ success: false, error: "Supabase admin client unavailable." }, { status: 500 });
    }

    const body = (await request.json()) as Body;
    const type = asString(body.type);
    const subtype = asString(body.subtype);

    if (!type || !subtype) {
      return NextResponse.json({ success: false, error: "type and subtype are required." }, { status: 400 });
    }

    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const sessionDate = now.toISOString();
    const externalId = `checkin-${memberId}-${type}-${subtype}-${Date.now()}`;

    if (type === "arx") {
      // Check one-per-day: no ARX checkin already today
      const existing = await supabase
        .from("arx_sessions")
        .select("id")
        .eq("member_id", memberId)
        .eq("exercise", "ARX Session")
        .gte("session_date", `${todayIso}T00:00:00`)
        .limit(1);
      if (existing.data?.length) {
        return NextResponse.json({ success: false, already_logged: true, error: "ARX session already logged today." }, { status: 409 });
      }
      const res = await supabase.from("arx_sessions").insert({
        member_id: memberId,
        session_date: sessionDate,
        exercise: "ARX Session",
        external_id: externalId,
      });
      if (res.error) throw new Error(res.error.message);
    } else if (type === "carol") {
      // Check one-per-day per ride type
      const existing = await supabase
        .from("carol_sessions")
        .select("id")
        .eq("member_id", memberId)
        .eq("ride_type", subtype)
        .gte("session_date", `${todayIso}T00:00:00`)
        .limit(1);
      if (existing.data?.length) {
        return NextResponse.json({ success: false, already_logged: true, error: `${subtype} already logged today.` }, { status: 409 });
      }
      const res = await supabase.from("carol_sessions").insert({
        member_id: memberId,
        session_date: sessionDate,
        ride_type: subtype,
        external_id: externalId,
      });
      if (res.error) throw new Error(res.error.message);
    } else if (type === "recovery") {
      // Check one-per-day per modality
      const existing = await supabase
        .from("recovery_sessions")
        .select("id")
        .eq("member_id", memberId)
        .eq("modality", subtype)
        .gte("session_date", todayIso)
        .lte("session_date", todayIso)
        .limit(1);
      if (existing.data?.length) {
        return NextResponse.json({ success: false, already_logged: true, error: `${subtype} already logged today.` }, { status: 409 });
      }
      const res = await supabase.from("recovery_sessions").insert({
        member_id: memberId,
        session_date: todayIso,
        modality: subtype,
      });
      if (res.error) throw new Error(res.error.message);
    } else {
      return NextResponse.json({ success: false, error: "Unknown checklist item type." }, { status: 400 });
    }

    return NextResponse.json({ success: true, logged_at: sessionDate });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to log checklist item." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    const memberId = asString(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });

    const body = (await request.json()) as Body;
    const type = asString(body.type);
    const subtype = asString(body.subtype);
    const todayIso = new Date().toISOString().slice(0, 10);

    if (type === "arx") {
      const existing = await supabase
        .from("arx_sessions").select("id")
        .eq("member_id", memberId).eq("exercise", "ARX Session")
        .gte("session_date", `${todayIso}T00:00:00`)
        .order("session_date", { ascending: false }).limit(1);
      if (existing.data?.[0]) {
        await supabase.from("arx_sessions").delete().eq("id", (existing.data[0] as Record<string, unknown>).id);
      }
    } else if (type === "carol") {
      const existing = await supabase
        .from("carol_sessions").select("id")
        .eq("member_id", memberId).eq("ride_type", subtype)
        .like("external_id", "checkin-%")
        .gte("session_date", `${todayIso}T00:00:00`)
        .order("session_date", { ascending: false }).limit(1);
      if (existing.data?.[0]) {
        await supabase.from("carol_sessions").delete().eq("id", (existing.data[0] as Record<string, unknown>).id);
      }
    } else if (type === "recovery") {
      const existing = await supabase
        .from("recovery_sessions").select("id")
        .eq("member_id", memberId).eq("modality", subtype)
        .eq("session_date", todayIso)
        .limit(1);
      if (existing.data?.[0]) {
        await supabase.from("recovery_sessions").delete().eq("id", (existing.data[0] as Record<string, unknown>).id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to remove checklist item." },
      { status: 500 },
    );
  }
}
