import { NextResponse } from "next/server";
import { getActorContext, isCoachRole } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

type Body = {
  member_id: string;
  notification_id: string;
  protocol_changed: boolean;
  // If the coach changed the protocol, they may pass updated assignment fields:
  new_protocol_id?: string;
  new_days_per_week?: number;
  coach_notes: string; // required regardless of protocol_changed
};

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

    const body = (await request.json()) as Body;
    const memberId = asString(body.member_id);
    const notificationId = asString(body.notification_id);
    const coachNotes = asString(body.coach_notes);
    const protocolChanged = body.protocol_changed === true;

    if (!memberId) {
      return NextResponse.json({ success: false, error: "member_id required." }, { status: 400 });
    }
    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: "notification_id required." },
        { status: 400 },
      );
    }
    if (!coachNotes) {
      return NextResponse.json(
        { success: false, error: "Coach note is required before confirming." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    // 1. Return member to 'active' status
    const statusUpdate = await supabase
      .from("users")
      .update({ member_status: "active" })
      .eq("id", memberId);
    if (statusUpdate.error) throw new Error(statusUpdate.error.message);

    // 2. Mark the coach notification as read
    await supabase
      .from("coach_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    // 3. If protocol changed, update the member's active protocol record
    if (protocolChanged && body.new_protocol_id) {
      const newProtocolId = asString(body.new_protocol_id);
      // End current active protocol
      await supabase
        .from("member_protocols")
        .update({ status: "inactive", end_date: now })
        .eq("member_id", memberId)
        .eq("status", "active");

      // Assign new protocol
      const coachId = asString(context.dbUser.id);
      await supabase.from("member_protocols").insert({
        member_id: memberId,
        protocol_id: newProtocolId,
        assigned_by: coachId,
        assigned_at: now,
        start_date: now,
        status: "active",
        coach_notes: coachNotes,
        days_per_week: body.new_days_per_week ?? null,
      });
    } else if (!protocolChanged) {
      // Even if no protocol change, record the coach note on the current assignment
      await supabase
        .from("member_protocols")
        .update({ coach_notes: coachNotes })
        .eq("member_id", memberId)
        .eq("status", "active");
    }

    // 4. Send member in-app notification
    const memberRes = await supabase
      .from("users")
      .select("full_name")
      .eq("id", memberId)
      .limit(1);
    const memberName =
      Array.isArray(memberRes.data) && memberRes.data.length > 0
        ? asString((memberRes.data[0] as Record<string, unknown>).full_name, "Member")
        : "Member";

    const notifMessage = protocolChanged
      ? "Coach Dustin has reviewed your profile update and adjusted your protocol. Check the Protocol tab to see what changed."
      : "Coach Dustin reviewed your profile update. Your protocol stays the same.";

    const notifType = protocolChanged ? "protocol_updated" : "protocol_reviewed";

    await supabase.from("member_notifications").insert({
      member_id: memberId,
      type: notifType,
      message: notifMessage,
      is_read: false,
      created_at: now,
    });

    return NextResponse.json({ success: true, member_name: memberName });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to confirm review.",
      },
      { status: 500 },
    );
  }
}
