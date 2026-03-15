import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

export async function GET(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (context.role !== "member") {
      return NextResponse.json(
        { success: false, error: "Only members can access this inbox endpoint." },
        { status: 403 },
      );
    }
    const db = createSupabaseAdminClient() ?? context.supabase;

    const memberId = asString(context.dbUser.id, "");
    if (!memberId) {
      return NextResponse.json(
        { success: false, error: "Current user profile id is missing." },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const markRead = url.searchParams.get("mark_read") === "1";

    const coachLookup = await db
      .from("users")
      .select("id,full_name,role")
      .in("role", ["coach", "admin", "staff"])
      .eq("is_active", true)
      .order("full_name", { ascending: true })
      .limit(50);
    if (coachLookup.error || !Array.isArray(coachLookup.data) || coachLookup.data.length === 0) {
      throw new Error("No active coach/staff account found for inbox.");
    }
    const coaches = coachLookup.data as AnyRow[];
    const preferredCoach =
      coaches.find((row) => asString(row.full_name, "").toLowerCase().includes("dustin")) ??
      coaches[0];
    const coachId = asString(preferredCoach.id, "");
    const coachName = asString(preferredCoach.full_name, "Coach");
    if (!coachId) throw new Error("Coach profile id is missing.");

    const baseFilter = `or(and(sender_id.eq.${coachId},recipient_id.eq.${memberId}),and(sender_id.eq.${memberId},recipient_id.eq.${coachId}))`;

    let messageRows: AnyRow[] = [];
    let supportsReadAt = true;
    const withReadAt = await db
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
      const fallback = await db
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
          asString(row.sender_id, "") === coachId &&
          asString(row.recipient_id, "") === memberId &&
          !asString(row.read_at, ""),
      ).length;

      if (markRead && unreadCount > 0) {
        const unreadIds = messageRows
          .filter(
            (row) =>
              asString(row.sender_id, "") === coachId &&
              asString(row.recipient_id, "") === memberId &&
              !asString(row.read_at, ""),
          )
          .map((row) => asString(row.id, ""))
          .filter(Boolean);
        if (unreadIds.length > 0) {
          const markReadRes = await db
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
      coach: {
        id: coachId,
        full_name: coachName,
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
