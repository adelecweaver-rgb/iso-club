import { NextResponse } from "next/server";
import { asRequiredString, getActorContext } from "@/lib/server/actor";

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

function isCoachRole(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  return normalized === "coach" || normalized === "admin" || normalized === "staff";
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

    const body = (await request.json()) as Body;
    const messageBody = asRequiredString(body.body, "body");

    const actorRole = asString(context.role, "member").toLowerCase();
    let recipientId =
      typeof body.recipient_id === "string" && body.recipient_id.trim().length > 0
        ? body.recipient_id.trim()
        : "";

    if (!recipientId) {
      if (isCoachRole(actorRole)) {
        throw new Error("recipient_id is required when sending as coach/staff.");
      }
      // Allow members to "reply to coach" without picking a recipient manually.
      const staffLookup = await context.supabase
        .from("users")
        .select("id,full_name,role")
        .in("role", ["coach", "admin", "staff"])
        .eq("is_active", true)
        .order("full_name", { ascending: true })
        .limit(50);
      let staffRows: AnyRow[] = [];
      if (!staffLookup.error && Array.isArray(staffLookup.data)) {
        staffRows = staffLookup.data as AnyRow[];
      } else if (
        staffLookup.error &&
        isMissingIsActiveColumnError(staffLookup.error.message)
      ) {
        const fallback = await context.supabase
          .from("users")
          .select("id,full_name,role")
          .in("role", ["coach", "admin", "staff"])
          .order("full_name", { ascending: true })
          .limit(50);
        if (!fallback.error && Array.isArray(fallback.data)) {
          staffRows = fallback.data as AnyRow[];
        } else {
          throw new Error(fallback.error?.message ?? "No active coach/staff recipient found.");
        }
      } else if (staffLookup.error) {
        throw new Error(staffLookup.error.message);
      }
      if (staffRows.length === 0) {
        throw new Error("No active coach/staff recipient found.");
      }
      const preferredCoach =
        staffRows.find((row) => asString(row.full_name, "").toLowerCase().includes("dustin")) ??
        staffRows[0];
      recipientId = asString(preferredCoach.id, "");
      if (!recipientId) throw new Error("Coach recipient is missing id.");
    }

    const senderId = String(context.dbUser.id ?? "");
    if (!senderId) throw new Error("Sender user id is missing.");
    if (recipientId === senderId) {
      throw new Error("Cannot send a message to yourself.");
    }

    const recipientLookupWithActive = await context.supabase
      .from("users")
      .select("id,role,full_name")
      .eq("id", recipientId)
      .eq("is_active", true)
      .limit(1);
    let recipientRow: AnyRow | null = null;
    if (!recipientLookupWithActive.error && Array.isArray(recipientLookupWithActive.data)) {
      recipientRow = recipientLookupWithActive.data[0] as AnyRow | null;
    } else if (
      recipientLookupWithActive.error &&
      isMissingIsActiveColumnError(recipientLookupWithActive.error.message)
    ) {
      const fallbackRecipientLookup = await context.supabase
        .from("users")
        .select("id,role,full_name")
        .eq("id", recipientId)
        .limit(1);
      if (!fallbackRecipientLookup.error && Array.isArray(fallbackRecipientLookup.data)) {
        recipientRow = fallbackRecipientLookup.data[0] as AnyRow | null;
      } else {
        throw new Error(fallbackRecipientLookup.error?.message ?? "Recipient user not found.");
      }
    } else if (recipientLookupWithActive.error) {
      throw new Error(recipientLookupWithActive.error.message);
    }
    if (!recipientRow) {
      throw new Error("Recipient user not found.");
    }

    const recipientRole = asString(recipientRow.role, "").toLowerCase();
    if (actorRole === "member" && !isCoachRole(recipientRole)) {
      throw new Error("Members can only message coach/staff accounts.");
    }
    if (isCoachRole(actorRole) && recipientRole !== "member") {
      throw new Error("Coach/staff can only message member accounts.");
    }

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
    const inserted = await context.supabase
      .from("messages")
      .insert(insertPayload)
      .select("id,sender_id,recipient_id,body,thread_id,created_at")
      .single();

    if (!inserted.error && inserted.data) {
      insertedMessage = inserted.data as AnyRow;
    } else if (inserted.error) {
      const fallbackInsert = await context.supabase.from("messages").insert(insertPayload);
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
