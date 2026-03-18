import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asStr(v: unknown, fb = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fb;
}

type ProtocolItem = { type: "arx" | "carol" | "recovery"; subtype: string };

type Body = {
  to_add?: ProtocolItem[];
  to_remove?: ProtocolItem[];
  bonus?: string[];
};

async function logProtocolItem(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  memberId: string,
  item: ProtocolItem,
  todayIso: string,
) {
  const sessionDate = new Date().toISOString();
  const externalId = `checkin-${memberId}-${item.type}-${item.subtype}-${Date.now()}`;

  if (item.type === "arx") {
    const exists = await supabase.from("arx_sessions").select("id").eq("member_id", memberId).eq("exercise", "ARX Session").gte("session_date", `${todayIso}T00:00:00`).limit(1);
    if (!exists.data?.length) {
      await supabase.from("arx_sessions").insert({ member_id: memberId, session_date: sessionDate, exercise: "ARX Session", external_id: externalId });
    }
  } else if (item.type === "carol") {
    const exists = await supabase.from("carol_sessions").select("id").eq("member_id", memberId).eq("ride_type", item.subtype).like("external_id", "checkin-%").gte("session_date", `${todayIso}T00:00:00`).limit(1);
    if (!exists.data?.length) {
      await supabase.from("carol_sessions").insert({ member_id: memberId, session_date: sessionDate, ride_type: item.subtype, external_id: externalId });
    }
  } else if (item.type === "recovery") {
    const exists = await supabase.from("recovery_sessions").select("id").eq("member_id", memberId).eq("modality", item.subtype).eq("session_date", todayIso).limit(1);
    if (!exists.data?.length) {
      await supabase.from("recovery_sessions").insert({ member_id: memberId, session_date: todayIso, modality: item.subtype });
    }
  }
}

async function removeProtocolItem(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  memberId: string,
  item: ProtocolItem,
  todayIso: string,
) {
  if (item.type === "arx") {
    const r = await supabase.from("arx_sessions").select("id").eq("member_id", memberId).eq("exercise", "ARX Session").gte("session_date", `${todayIso}T00:00:00`).order("session_date", { ascending: false }).limit(1);
    if (r.data?.[0]) await supabase.from("arx_sessions").delete().eq("id", (r.data[0] as Record<string, unknown>).id);
  } else if (item.type === "carol") {
    const r = await supabase.from("carol_sessions").select("id").eq("member_id", memberId).eq("ride_type", item.subtype).like("external_id", "checkin-%").gte("session_date", `${todayIso}T00:00:00`).limit(1);
    if (r.data?.[0]) await supabase.from("carol_sessions").delete().eq("id", (r.data[0] as Record<string, unknown>).id);
  } else if (item.type === "recovery") {
    const r = await supabase.from("recovery_sessions").select("id").eq("member_id", memberId).eq("modality", item.subtype).eq("session_date", todayIso).limit(1);
    if (r.data?.[0]) await supabase.from("recovery_sessions").delete().eq("id", (r.data[0] as Record<string, unknown>).id);
  }
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    const memberId = asStr(context.dbUser.id);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });

    const body = (await request.json()) as Body;
    const todayIso = new Date().toISOString().slice(0, 10);

    // Log new protocol activities
    for (const item of body.to_add ?? []) {
      await logProtocolItem(supabase, memberId, item, todayIso);
    }

    // Remove unchecked protocol activities
    for (const item of body.to_remove ?? []) {
      await removeProtocolItem(supabase, memberId, item, todayIso);
    }

    // Log bonus activities → manual_workout_sessions
    for (const key of body.bonus ?? []) {
      const exists = await supabase.from("manual_workout_sessions").select("id").eq("member_id", memberId).eq("equipment", key).eq("session_date", todayIso).eq("is_bonus", true).limit(1);
      if (!exists.data?.length) {
        await supabase.from("manual_workout_sessions").insert({ member_id: memberId, equipment: key, session_date: todayIso, is_bonus: true });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed to save activity." }, { status: 500 });
  }
}
