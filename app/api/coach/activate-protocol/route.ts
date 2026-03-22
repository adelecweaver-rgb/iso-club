import { NextResponse } from "next/server";
import { asRequiredString, getActorContext, isCoachRole } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendProtocolReadySmsForMember } from "@/lib/server/sms-notifications";

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

type ActivateBody = {
  member_id?: string;
  protocol_id?: string;
  start_date?: string;
  coach_note?: string;
  frequency?: number;
  selected_days?: string[];
};

type UpdateBody = {
  member_id?: string;
  protocol_id?: string;
  coach_note?: string;
  frequency?: number;
  selected_days?: string[];
};

async function createMemberNotification(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  memberId: string,
  message: string,
) {
  const res = await supabase.from("member_notifications").insert({
    member_id: memberId,
    message,
    is_read: false,
  });
  return res;
}

// POST — confirm a new protocol for an awaiting_protocol member
// Sets member status → 'active', assigns protocol, sends in-app notification
export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context || !isCoachRole(context.role)) {
      return NextResponse.json(
        { success: false, error: error ?? "Coach access required." },
        { status: 403 },
      );
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }

    const body = (await request.json()) as ActivateBody;
    const memberId = asRequiredString(body.member_id, "member_id");
    const protocolId = asRequiredString(body.protocol_id, "protocol_id");
    const coachNote = asStr(body.coach_note).trim();
    if (!coachNote) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Add a note to your member before confirming. It makes a big difference.",
        },
        { status: 400 },
      );
    }
    const startDate =
      typeof body.start_date === "string" && body.start_date
        ? body.start_date
        : new Date().toISOString().slice(0, 10);
    const actorId = asStr(context.dbUser.id);

    // Deactivate any existing active assignment
    await supabase
      .from("member_protocols")
      .update({ status: "completed" })
      .eq("member_id", memberId)
      .eq("status", "active");

    // Assign the new protocol
    const assignRes = await supabase
      .from("member_protocols")
      .insert({
        member_id: memberId,
        protocol_id: protocolId,
        assigned_by: actorId,
        start_date: startDate,
        status: "active",
        coach_notes: coachNote,
      })
      .select("id")
      .single();
    if (assignRes.error) throw new Error(assignRes.error.message);

    // Move member from awaiting_protocol → active
    const updateRes = await supabase
      .from("users")
      .update({ status: "active" })
      .eq("id", memberId);
    if (updateRes.error) throw new Error(updateRes.error.message);

    // In-app notification to member
    await createMemberNotification(
      supabase,
      memberId,
      "Your coach has set up your protocol. Open the Protocol tab to see your plan.",
    );

    // Best-effort SMS — ignore errors (table may not exist in all envs)
    try {
      await sendProtocolReadySmsForMember(context.supabase, memberId, "");
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, assignment_id: assignRes.data?.id });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to activate protocol." },
      { status: 500 },
    );
  }
}

// PATCH — update an active member's protocol and notify them
export async function PATCH(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context || !isCoachRole(context.role)) {
      return NextResponse.json(
        { success: false, error: error ?? "Coach access required." },
        { status: 403 },
      );
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable." }, { status: 500 });
    }

    const body = (await request.json()) as UpdateBody;
    const memberId = asRequiredString(body.member_id, "member_id");
    const coachNote = asStr(body.coach_note).trim();
    const actorId = asStr(context.dbUser.id);

    // Update the active member_protocols row coach_notes if a note or new protocol is provided
    const updateFields: Record<string, unknown> = {};
    if (coachNote) updateFields.coach_notes = coachNote;
    if (typeof body.protocol_id === "string" && body.protocol_id) {
      updateFields.protocol_id = body.protocol_id;
      updateFields.assigned_by = actorId;
      updateFields.start_date = new Date().toISOString().slice(0, 10);
    }

    if (Object.keys(updateFields).length > 0) {
      const updateRes = await supabase
        .from("member_protocols")
        .update(updateFields)
        .eq("member_id", memberId)
        .eq("status", "active");
      if (updateRes.error) throw new Error(updateRes.error.message);
    }

    // In-app notification — keep it generic per spec
    await createMemberNotification(
      supabase,
      memberId,
      "Your coach has updated your protocol. Open the Protocol tab to see what changed.",
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update protocol." },
      { status: 500 },
    );
  }
}
