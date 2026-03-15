import { NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ClerkWebhookUser = {
  id: string;
  email_addresses?: Array<{ id?: string; email_address?: string }>;
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  public_metadata?: Record<string, unknown> | null;
  unsafe_metadata?: Record<string, unknown> | null;
};

function valueAsString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function normalizeRole(value: string): "member" | "coach" | "admin" | "staff" {
  const role = value.toLowerCase();
  if (role === "coach" || role === "admin" || role === "staff") {
    return role;
  }
  return "member";
}

function normalizeMembershipTier(value: string): "essential" | "premier" | "concierge" {
  const tier = value.toLowerCase();
  if (tier === "premier" || tier === "concierge") {
    return tier;
  }
  return "essential";
}

function getPrimaryEmail(data: ClerkWebhookUser): string {
  const primaryId = valueAsString(data.primary_email_address_id ?? "", "");
  const addresses = Array.isArray(data.email_addresses) ? data.email_addresses : [];
  const primary =
    addresses.find((address) => valueAsString(address.id, "") === primaryId) ??
    addresses[0];
  return valueAsString(primary?.email_address, "");
}

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        success: false,
        error:
          "SUPABASE_SERVICE_ROLE_KEY is required for Clerk webhook user sync.",
      },
      { status: 500 },
    );
  }

  let event:
    | { type: "user.created" | "user.updated" | "user.deleted" | string; data: unknown }
    | null = null;
  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid Clerk webhook signature." },
      { status: 400 },
    );
  }

  if (!event) {
    return NextResponse.json(
      { success: false, error: "Missing webhook payload." },
      { status: 400 },
    );
  }

  if (event.type === "user.deleted") {
    const deleted = event.data as { id?: string };
    const clerkId = valueAsString(deleted.id, "");
    if (!clerkId) {
      return NextResponse.json({ success: true });
    }

    const updateResult = await supabaseAdmin
      .from("users")
      .update({ is_active: false })
      .eq("clerk_id", clerkId);
    if (updateResult.error) {
      return NextResponse.json(
        { success: false, error: updateResult.error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const user = event.data as ClerkWebhookUser;
    const clerkId = valueAsString(user.id, "");
    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: "Webhook payload missing user id." },
        { status: 400 },
      );
    }

    const metadata = (user.public_metadata ?? user.unsafe_metadata ?? {}) as Record<
      string,
      unknown
    >;
    const email = getPrimaryEmail(user);
    const fullName =
      [valueAsString(user.first_name, ""), valueAsString(user.last_name, "")]
        .filter(Boolean)
        .join(" ")
        .trim() || "Member";

    const upsertPayload = {
      clerk_id: clerkId,
      email,
      full_name: fullName,
      role: normalizeRole(valueAsString(metadata.role, "member")),
      membership_tier: normalizeMembershipTier(
        valueAsString(metadata.membership_tier, "essential"),
      ),
      avatar_url: valueAsString(user.image_url, "") || null,
      is_active: true,
    };

    const upsertResult = await supabaseAdmin
      .from("users")
      .upsert(upsertPayload, { onConflict: "clerk_id" });
    if (upsertResult.error) {
      return NextResponse.json(
        { success: false, error: upsertResult.error.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
