import { NextResponse } from "next/server";
import { asRequiredString, getActorContext } from "@/lib/server/actor";

type Body = {
  recipient_id?: string;
  body?: string;
  thread_id?: string;
};

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const messageBody = asRequiredString(body.body, "body");

    let recipientId =
      typeof body.recipient_id === "string" && body.recipient_id.trim().length > 0
        ? body.recipient_id.trim()
        : "";

    if (!recipientId) {
      // Allow members to "reply to coach" without picking a recipient manually.
      const staffLookup = await context.supabase
        .from("users")
        .select("id")
        .in("role", ["coach", "admin", "staff"])
        .eq("is_active", true)
        .limit(1);
      if (staffLookup.error || !staffLookup.data?.[0]?.id) {
        throw new Error("No active coach/staff recipient found.");
      }
      recipientId = String(staffLookup.data[0].id);
    }

    const senderId = String(context.dbUser.id ?? "");
    if (!senderId) throw new Error("Sender user id is missing.");

    const threadId =
      typeof body.thread_id === "string" && body.thread_id.trim().length > 0
        ? body.thread_id.trim()
        : null;

    const inserted = await context.supabase.from("messages").insert({
      sender_id: senderId,
      recipient_id: recipientId,
      body: messageBody,
      thread_id: threadId,
    });

    if (inserted.error) throw new Error(inserted.error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to send message.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
