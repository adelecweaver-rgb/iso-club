import { NextResponse } from "next/server";
import { asRequiredString, getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Body = {
  recipient_id?: string;
  body?: string;
  thread_id?: string;
};

type AnyRow = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function isMissingIsActiveColumnError(message: string): boolean {
  return /column ["']?is_active["']? .*users.* does not exist|Could not find the 'is_active' column/i.test(
    message,
  );
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    const db = createSupabaseAdminClient() ?? context.supabase;

    const body = (await request.json()) as Body;
    const messageBody = asRequiredString(body.body, "body");

    let recipientId =
      typeof body.recipient_id === "string" && body.recipient_id.trim().length > 0
        ? body.recipient_id.trim()
        : "";

    // Members always reply to coach/staff.
    if (context.role === "member") {
      recipientId = "";
    }

    if (!recipientId) {
      // Allow members to "reply to coach" without picking a recipient manually.
      let staffLookup = await db
        .from("users")
        .select("id,full_name,role")
        .in("role", ["coach", "admin", "staff"])
        .eq("is_active", true)
        .order("full_name", { ascending: true })
        .limit(50);
      if (
        staffLookup.error &&
        isMissingIsActiveColumnError(staffLookup.error.message)
      ) {
        staffLookup = await db
          .from("users")
          .select("id,full_name,role")
          .in("role", ["coach", "admin", "staff"])
          .order("full_name", { ascending: true })
          .limit(50);
      }
      if (!staffLookup.error && Array.isArray(staffLookup.data) && staffLookup.data.length === 0) {
        const fallbackLookup = await db
          .from("users")
          .select("id,full_name,role")
          .in("role", ["coach", "admin", "staff"])
          .order("full_name", { ascending: true })
          .limit(50);
        if (!fallbackLookup.error && Array.isArray(fallbackLookup.data) && fallbackLookup.data.length > 0) {
          staffLookup = fallbackLookup;
        }
      }
      if (staffLookup.error || !Array.isArray(staffLookup.data) || staffLookup.data.length === 0) {
        throw new Error("No active coach/staff recipient found.");
      }
      const staffRows = staffLookup.data as AnyRow[];
      const preferredCoach =
        staffRows.find((row) => asString(row.full_name, "").toLowerCase().includes("dustin")) ??
        staffRows[0];
      recipientId = asString(preferredCoach.id, "");
      if (!recipientId) throw new Error("Coach recipient is missing id.");
    }

    const senderId = String(context.dbUser.id ?? "");
    if (!senderId) throw new Error("Sender user id is missing.");

    const threadId =
      typeof body.thread_id === "string" && body.thread_id.trim().length > 0
        ? body.thread_id.trim()
        : null;

    const insertPayload = {
      sender_id: senderId,
      recipient_id: recipientId,
      body: messageBody,
      thread_id: threadId,
    };

    let insertedMessage: AnyRow | null = null;
    const inserted = await db
      .from("messages")
      .insert(insertPayload)
      .select("id,sender_id,recipient_id,body,thread_id,created_at")
      .single();

    if (!inserted.error && inserted.data) {
      insertedMessage = inserted.data as AnyRow;
    } else if (inserted.error) {
      const fallbackInsert = await db.from("messages").insert(insertPayload);
      if (fallbackInsert.error) throw new Error(fallbackInsert.error.message);
      insertedMessage = {
        id: "",
        sender_id: senderId,
        recipient_id: recipientId,
        body: messageBody,
        thread_id: threadId ?? "",
        created_at: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      message: {
        id: asString(insertedMessage?.id, ""),
        sender_id: asString(insertedMessage?.sender_id, senderId),
        recipient_id: asString(insertedMessage?.recipient_id, recipientId),
        body: asString(insertedMessage?.body, messageBody),
        thread_id: asString(insertedMessage?.thread_id, ""),
        created_at: asString(insertedMessage?.created_at, new Date().toISOString()),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to send message.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
