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

type InboxPeer = {
  id: string;
  full_name: string;
  role: string;
  unread_count: number;
  latest_at: string;
  latest_preview: string;
};

export async function GET(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }

    const actorId = asString(context.dbUser.id, "");
    if (!actorId) {
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
    let peers: InboxPeer[] = [];

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
      peers = [
        {
          id: peerId,
          full_name: peerName,
          role: peerRole,
          unread_count: 0,
          latest_at: "",
          latest_preview: "",
        },
      ];
    } else {
      const members = await loadMembers(context.supabase);
      if (!members.length) throw new Error("No members available for coach inbox.");
      const memberById = new Map<string, AnyRow>();
      members.forEach((member) => {
        const id = asString(member.id, "");
        if (id) memberById.set(id, member);
      });

      let indexRows: AnyRow[] = [];
      let indexSupportsReadAt = true;
      const withReadAtIndex = await context.supabase
        .from("messages")
        .select("sender_id,recipient_id,created_at,body,read_at")
        .or(`sender_id.eq.${actorId},recipient_id.eq.${actorId}`)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (!withReadAtIndex.error && Array.isArray(withReadAtIndex.data)) {
        indexRows = withReadAtIndex.data as AnyRow[];
      } else if (
        withReadAtIndex.error &&
        isMissingReadAtColumnError(withReadAtIndex.error.message)
      ) {
        indexSupportsReadAt = false;
        const fallbackIndex = await context.supabase
          .from("messages")
          .select("sender_id,recipient_id,created_at,body")
          .or(`sender_id.eq.${actorId},recipient_id.eq.${actorId}`)
          .order("created_at", { ascending: false })
          .limit(2000);
        if (fallbackIndex.error) throw new Error(fallbackIndex.error.message);
        indexRows = Array.isArray(fallbackIndex.data) ? (fallbackIndex.data as AnyRow[]) : [];
      } else if (withReadAtIndex.error) {
        throw new Error(withReadAtIndex.error.message);
      }

      const peerStats = new Map<string, InboxPeer>();
      for (const row of indexRows) {
        const senderId = asString(row.sender_id, "");
        const recipientId = asString(row.recipient_id, "");
        if (!senderId || !recipientId) continue;
        if (senderId !== actorId && recipientId !== actorId) continue;
        const otherId = senderId === actorId ? recipientId : senderId;
        if (!memberById.has(otherId)) continue;
        const member = memberById.get(otherId) as AnyRow;
        const createdAt = asString(row.created_at, "");
        const existing = peerStats.get(otherId);
        if (!existing) {
          peerStats.set(otherId, {
            id: otherId,
            full_name: asString(member.full_name, "Member"),
            role: "member",
            unread_count:
              indexSupportsReadAt &&
              senderId === otherId &&
              recipientId === actorId &&
              !asString(row.read_at, "")
                ? 1
                : 0,
            latest_at: createdAt,
            latest_preview: asString(row.body, "").slice(0, 160),
          });
        } else {
          if (
            indexSupportsReadAt &&
            senderId === otherId &&
            recipientId === actorId &&
            !asString(row.read_at, "")
          ) {
            existing.unread_count += 1;
          }
          if (createdAt && (!existing.latest_at || createdAt > existing.latest_at)) {
            existing.latest_at = createdAt;
            existing.latest_preview = asString(row.body, "").slice(0, 160);
          }
        }
      }

      peers = Array.from(peerStats.values());
      if (peers.length === 0) {
        peers = members.slice(0, 50).map((member) => ({
          id: asString(member.id, ""),
          full_name: asString(member.full_name, "Member"),
          role: "member",
          unread_count: 0,
          latest_at: "",
          latest_preview: "",
        }));
      }
      peers = peers.filter((peer) => peer.id.length > 0);
      peers.sort((a, b) => {
        if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
        if (a.latest_at && b.latest_at && a.latest_at !== b.latest_at) {
          return b.latest_at.localeCompare(a.latest_at);
        }
        if (a.latest_at && !b.latest_at) return -1;
        if (!a.latest_at && b.latest_at) return 1;
        return a.full_name.localeCompare(b.full_name);
      });

      const selectedMember = requestedPeerId
        ? peers.find((peer) => peer.id === requestedPeerId)
        : undefined;
      const preferredMember = selectedMember ?? peers[0];
      peerId = asString(preferredMember?.id, "");
      peerName = asString(preferredMember?.full_name, "Member");
      peerRole = asString(preferredMember?.role, "member");
    }
    if (!peerId) throw new Error("Inbox peer profile id is missing.");

    const baseFilter = `or(and(sender_id.eq.${peerId},recipient_id.eq.${actorId}),and(sender_id.eq.${actorId},recipient_id.eq.${peerId}))`;

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
          asString(row.recipient_id, "") === actorId &&
          !asString(row.read_at, ""),
      ).length;

      if (markRead && unreadCount > 0) {
        const unreadIds = messageRows
          .filter(
            (row) =>
              asString(row.sender_id, "") === peerId &&
              asString(row.recipient_id, "") === actorId &&
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
      peers,
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
