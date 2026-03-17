import { NextResponse } from "next/server";
import { asOptionalNumber, asRequiredString, getActorContext, isCoachRole } from "@/lib/server/actor";
import { sendProtocolReadySmsForMember } from "@/lib/server/sms-notifications";

type ProtocolSessionInput = {
  name?: string;
  description?: string;
  equipment?: string;
  duration_minutes?: number | string;
  order_index?: number | string;
  status?: string;
};

type Body = {
  action?: "assign";
  member_id?: string;
  protocol_id?: string;
  start_date?: string;
  coach_notes?: string;
  // Legacy fields for old-style protocol creation
  name?: string;
  description?: string;
  primary_goal?: string;
  secondary_goal?: string;
  week_current?: number | string;
  week_total?: number | string;
  dustin_notes?: string;
  is_active?: boolean;
  sessions?: ProtocolSessionInput[];
};

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
      .from("protocols")
      .select("id,name,description,target_system,arx_frequency_per_week,carol_frequency_per_week,recovery_target_per_month,carol_ride_types,arx_exercises,notes")
      .order("name");
    if (res.error) throw new Error(res.error.message);
    return NextResponse.json({ success: true, protocols: res.data ?? [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Failed to load protocols." }, { status: 500 });
  }
}

function normalizeEquipment(equipment: string): "arx" | "carol" | "vasper" | "katalyst" | "proteus" | "quickboard" | "recovery" | "other" {
  const normalized = equipment.trim().toLowerCase();
  if (
    [
      "arx",
      "carol",
      "vasper",
      "katalyst",
      "proteus",
      "quickboard",
      "recovery",
      "other",
    ].includes(normalized)
  ) {
    return normalized as "arx" | "carol" | "vasper" | "katalyst" | "proteus" | "quickboard" | "recovery" | "other";
  }
  return "other";
}

function normalizeSessionStatus(status: string): "pending" | "completed" | "modified" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "completed") return "completed";
  if (normalized === "modified") return "modified";
  return "pending";
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachRole(context.role)) {
      return NextResponse.json(
        { success: false, error: "Only coach/staff accounts can create protocols." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;

    // New-style: assign a library protocol to a member
    if (body.action === "assign") {
      const memberId = asRequiredString(body.member_id, "member_id");
      const protocolId = asRequiredString(body.protocol_id, "protocol_id");
      const startDate = typeof body.start_date === "string" && body.start_date ? body.start_date : new Date().toISOString().slice(0, 10);
      const coachNotes = typeof body.coach_notes === "string" ? body.coach_notes.trim() : null;
      const actorId = String(context.dbUser.id ?? "");

      // Deactivate any existing active assignment for this member
      await context.supabase
        .from("member_protocols")
        .update({ status: "completed" })
        .eq("member_id", memberId)
        .eq("status", "active");

      const assignRes = await context.supabase
        .from("member_protocols")
        .insert({ member_id: memberId, protocol_id: protocolId, assigned_by: actorId, start_date: startDate, status: "active", coach_notes: coachNotes })
        .select("id")
        .single();
      if (assignRes.error) throw new Error(assignRes.error.message);
      return NextResponse.json({ success: true, assignment_id: assignRes.data?.id });
    }

    const memberId = asRequiredString(body.member_id, "member_id");
    const name = asRequiredString(body.name, "name");
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const primaryGoal = typeof body.primary_goal === "string" ? body.primary_goal.trim() : null;
    const secondaryGoal = typeof body.secondary_goal === "string" ? body.secondary_goal.trim() : null;
    const weekCurrent = Math.max(1, Math.round(asOptionalNumber(body.week_current) ?? 1));
    const weekTotal = Math.max(1, Math.round(asOptionalNumber(body.week_total) ?? 1));
    const dustinNotes = typeof body.dustin_notes === "string" ? body.dustin_notes.trim() : null;
    const isActive = body.is_active ?? true;

    const protocolInsert = await context.supabase
      .from("protocols")
      .insert({
        member_id: memberId,
        name,
        description,
        primary_goal: primaryGoal,
        secondary_goal: secondaryGoal,
        week_current: weekCurrent,
        week_total: weekTotal,
        dustin_notes: dustinNotes,
        is_active: isActive,
      })
      .select("id")
      .single();

    if (protocolInsert.error || !protocolInsert.data?.id) {
      throw new Error(protocolInsert.error?.message ?? "Failed to create protocol row.");
    }

    const rawSessions = Array.isArray(body.sessions) ? body.sessions : [];
    const sessions = rawSessions
      .map((session, index) => {
        const sessionName = typeof session.name === "string" ? session.name.trim() : "";
        if (!sessionName) return null;
        const duration = asOptionalNumber(session.duration_minutes);
        const orderIndex = asOptionalNumber(session.order_index);
        return {
          protocol_id: protocolInsert.data.id,
          member_id: memberId,
          name: sessionName,
          description: typeof session.description === "string" ? session.description.trim() : null,
          equipment: normalizeEquipment(typeof session.equipment === "string" ? session.equipment : "other"),
          duration_minutes: duration !== null ? Math.max(0, Math.round(duration)) : null,
          order_index: orderIndex !== null ? Math.max(1, Math.round(orderIndex)) : index + 1,
          status: normalizeSessionStatus(typeof session.status === "string" ? session.status : "pending"),
          dustin_notes: dustinNotes,
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    if (sessions.length > 0) {
      const sessionsInsert = await context.supabase.from("protocol_sessions").insert(sessions);
      if (sessionsInsert.error) {
        throw new Error(sessionsInsert.error.message);
      }
    }

    await sendProtocolReadySmsForMember(
      context.supabase,
      memberId,
      primaryGoal ?? "",
    );

    return NextResponse.json({ success: true, protocol_id: protocolInsert.data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create protocol.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
