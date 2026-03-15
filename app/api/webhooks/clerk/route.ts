import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ClerkEmailAddress = {
  id?: string;
  email_address?: string;
};

type ClerkUserData = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmailAddress[] | null;
};

function firstNonEmpty(values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function fullNameFromUser(user: ClerkUserData): string {
  const first = typeof user.first_name === "string" ? user.first_name.trim() : "";
  const last = typeof user.last_name === "string" ? user.last_name.trim() : "";
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return firstNonEmpty([combined, user.username, "Member"]);
}

function primaryEmailFromUser(user: ClerkUserData): string {
  const addresses = Array.isArray(user.email_addresses) ? user.email_addresses : [];
  const primaryId =
    typeof user.primary_email_address_id === "string" ? user.primary_email_address_id : "";
  const primaryMatch = addresses.find((item) => item?.id === primaryId);
  if (primaryMatch?.email_address) return primaryMatch.email_address.trim();
  const firstAddress = addresses.find((item) => typeof item?.email_address === "string");
  return typeof firstAddress?.email_address === "string"
    ? firstAddress.email_address.trim()
    : "";
}

async function upsertUser(userData: ClerkUserData) {
  const clerkId = firstNonEmpty([userData.id]);
  if (!clerkId) {
    throw new Error("Webhook user payload is missing id.");
  }

  const email = primaryEmailFromUser(userData);
  const fullName = fullNameFromUser(userData);
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin client is not configured.");
  }

  const payload = {
    clerk_id: clerkId,
    email,
    full_name: fullName,
    role: "member",
    is_active: true,
    avatar_url:
      typeof userData.image_url === "string" && userData.image_url.trim().length > 0
        ? userData.image_url.trim()
        : null,
  };

  const { error } = await admin.from("users").upsert(payload, { onConflict: "clerk_id" });
  if (error) {
    throw new Error(error.message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const event = await verifyWebhook(request);
    const eventType = event.type;

    if (eventType === "user.created" || eventType === "user.updated") {
      await upsertUser(event.data as ClerkUserData);
    }

    if (eventType === "user.deleted") {
      const userData = event.data as ClerkUserData | null;
      const clerkId = firstNonEmpty([userData?.id]);
      if (clerkId) {
        const admin = createSupabaseAdminClient();
        if (admin) {
          await admin.from("users").update({ is_active: false }).eq("clerk_id", clerkId);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
