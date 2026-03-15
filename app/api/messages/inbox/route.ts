import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";

type AnyRow = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function isMissingReadAtColumnError(message: string): boolean {
  return /column ["']?read_at["']? .*messages.* does not exist|Could not find the 'read_at' column/i.test(
    message,
  );
}

function isMissingIsActiveColumnError(message: string): boolean {
  return /column ["']?is_active["']? .*users.* does not exist|Could not find the 'is_active' column/i.test(
    message,
  );
}

function isCoachRole(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  return normalized === "coach" || normalized === "admin" || normalized === "staff";
}

async function loadCoaches(
  supabase: NonNullable<Awaited<ReturnType<typeof getActorContext>>["context"]>["supabase"],
): Promise<AnyRow[]> {
  const first = await supabase
    .from("users")
    .select("id,full_name,role")
    .in("role", ["coach", "admin", "staff"])
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(50);
  if (!first.error && Array.isArray(first.data)) {
    return first.data as AnyRow[];
  }
  if (first.error && isMissingIsActiveColumnError(first.error.message)) {
    const fallback = await supabase
      .from("users")
      .select("id,full_name,role")
      .in("role", ["coach", "admin", "staff"])
      .order("full_name", { ascending: true })
      .limit(50);
    if (!fallback.error && Array.isArray(fallback.data)) {
      return fallback.data as AnyRow[];
    }
    throw new Error(fallback.error?.message ?? "No coach/staff account found.");
  }
  throw new Error(first.error?.message ?? "No coach/staff account found.");
}

async function loadMembers(
  supabase: NonNullable<Awaited<ReturnType<typeof getActorContext>>["context"]>["supabase"],
): Promise<AnyRow[]> {
  const first = await supabase
    .from("users")
    .select("id,full_name,role")
    .eq("role", "member")
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(200);
  if (!first.error && Array.isArray(first.data)) {
    return first.data as AnyRow[];
  }
  if (first.error && isMissingIsActiveColumnError(first.error.message)) {
    const fallback = await supabase
      .from("users")
      .select("id,full_name,role")
      .eq("role", "member")
      .order("full_name", { ascending: true })
      .limit(200);
    if (!fallback.error && Array.isArray(fallback.data)) {
      return fallback.data as AnyRow[];
    }
    throw new Error(fallback.error?.message ?? "No member account found.");
  }
  throw new Error(first.error?.message ?? "No member account found.");
}

export async function GET(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }

    const memberId = asString(context.dbUser.id, "");
    if (!memberId) {
      return NextResponse.json(
        { success: false, error: "Current user profile id is missing." },
        { status: 400 },
      );
    }
    const actorRole = asString(context.role, "member").toLowerCase();
    if (!(actorRole === "member" || isCoachRole(actorRole))) {
      return NextResponse.json(
        { success: false, error: "Only member/coach/staff accounts can access inbox." },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const markRead = url.searchParams.get("mark_read") === "1";
    const requestedPeerId = asString(url.searchParams.get("peer_id"), "");
    let peerId = "";
    let peerName = "Coach";
    let peerRole = "coach";

    if (actorRole === "member") {
      const coaches = await loadCoaches(context.supabase);
      if (!coaches.length) throw new Error("No active coach/staff account found for inbox.");
      const selectedCoach = requestedPeerId
        ? coaches.find((row) => asString(row.id, "") === requestedPeerId)
        : undefined;
      const preferredCoach =
        selectedCoach ??
        coaches.find((row) => asString(row.full_name, "").toLowerCase().includes("dustin")) ??
        coaches[0];
      peerId = asString(preferredCoach.id, "");
      peerName = asString(preferredCoach.full_name, "Coach");
      peerRole = asString(preferredCoach.role, "coach");
    } else {
      const members = await loadMembers(context.supabase);
      if (!members.length) throw new Error("No members available for coach inbox.");
      const selectedMember = requestedPeerId
        ? members.find((row) => asString(row.id, "") === requestedPeerId)
        : undefined;
      const preferredMember = selectedMember ?? members[0];
      peerId = asString(preferredMember.id, "");
      peerName = asString(preferredMember.full_name, "Member");
      peerRole = asString(preferredMember.role, "member");
    }
    if (!peerId) throw new Error("Inbox peer profile id is missing.");

    const baseFilter = `or(and(sender_id.eq.${peerId},recipient_id.eq.${memberId}),and(sender_id.eq.${memberId},recipient_id.eq.${peerId}))`;

    let messageRows: AnyRow[] = [];
    let supportsReadAt = true;
    const withReadAt = await context.supabase
      .from("messages")
      .select("id,sender_id,recipient_id,body,thread_id,created_at,read_at")
      .or(baseFilter)
      .order("created_at", { ascending: true })
      .limit(500);
    if (!withReadAt.error && Array.isArray(withReadAt.data)) {
      messageRows = withReadAt.data as AnyRow[];
    } else if (
      withReadAt.error &&
      isMissingReadAtColumnError(withReadAt.error.message)
    ) {
      supportsReadAt = false;
      const fallback = await context.supabase
        .from("messages")
        .select("id,sender_id,recipient_id,body,thread_id,created_at")
        .or(baseFilter)
        .order("created_at", { ascending: true })
        .limit(500);
      if (fallback.error) throw new Error(fallback.error.message);
      messageRows = Array.isArray(fallback.data) ? (fallback.data as AnyRow[]) : [];
    } else if (withReadAt.error) {
      throw new Error(withReadAt.error.message);
    }

    let unreadCount = 0;
    if (supportsReadAt) {
      unreadCount = messageRows.filter(
        (row) =>
          asString(row.sender_id, "") === peerId &&
          asString(row.recipient_id, "") === memberId &&
          !asString(row.read_at, ""),
      ).length;

      if (markRead && unreadCount > 0) {
        const unreadIds = messageRows
          .filter(
            (row) =>
              asString(row.sender_id, "") === peerId &&
              asString(row.recipient_id, "") === memberId &&
              !asString(row.read_at, ""),
          )
          .map((row) => asString(row.id, ""))
          .filter(Boolean);
        if (unreadIds.length > 0) {
          const markReadRes = await context.supabase
            .from("messages")
            .update({ read_at: new Date().toISOString() })
            .in("id", unreadIds);
          if (!markReadRes.error) {
            unreadCount = 0;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      peer: {
        id: peerId,
        full_name: peerName,
        role: peerRole,
      },
      coach: {
        id: peerId,
        full_name: peerName,
      },
      unread_count: unreadCount,
      messages: messageRows.map((row) => ({
        id: asString(row.id, ""),
        sender_id: asString(row.sender_id, ""),
        recipient_id: asString(row.recipient_id, ""),
        body: asString(row.body, ""),
        thread_id: asString(row.thread_id, ""),
        created_at: asString(row.created_at, ""),
        read_at: supportsReadAt ? asString(row.read_at, "") : "",
      })),
      supports_read_tracking: supportsReadAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load inbox.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
