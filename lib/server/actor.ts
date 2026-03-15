import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AnyRow = Record<string, unknown>;

export type ActorContext = {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  clerkUserId: string;
  email: string;
  fullName: string;
  dbUser: AnyRow;
  role: string;
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function normalizeTier(value: string): "essential" | "premier" | "concierge" {
  const v = value.toLowerCase();
  if (v === "premier" || v === "concierge") return v;
  return "essential";
}

export async function getActorContext(): Promise<{
  context: ActorContext | null;
  error: string | null;
}> {
  const { userId } = await auth();
  if (!userId) {
    return { context: null, error: "Not authenticated." };
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return { context: null, error: "Unable to resolve Clerk user." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { context: null, error: "Supabase is not configured." };
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser.username ||
    "Member";

  const metadataRole = asString(
    (clerkUser.publicMetadata as Record<string, unknown> | undefined)?.role ??
      (clerkUser.unsafeMetadata as Record<string, unknown> | undefined)?.role,
    "",
  ).toLowerCase();
  const inferredRole =
    metadataRole ||
    (email.toLowerCase().includes("dustin") ? "coach" : "member");

  let dbUser: AnyRow | null = null;

  const byClerk = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", userId)
    .limit(1);
  if (!byClerk.error && Array.isArray(byClerk.data) && byClerk.data.length > 0) {
    dbUser = byClerk.data[0] as AnyRow;
  } else if (email) {
    const byEmail = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .limit(1);
    if (!byEmail.error && Array.isArray(byEmail.data) && byEmail.data.length > 0) {
      dbUser = byEmail.data[0] as AnyRow;
    }
  }

  if (!dbUser) {
    const createPayload = {
      clerk_id: userId,
      email,
      full_name: fullName,
      role: inferredRole === "coach" || inferredRole === "admin" || inferredRole === "staff"
        ? inferredRole
        : "member",
      membership_tier: "essential",
      is_active: true,
      avatar_url: clerkUser.imageUrl ?? null,
    };
    const created = await supabase
      .from("users")
      .upsert(createPayload, { onConflict: "clerk_id" })
      .select("*")
      .limit(1);
    if (!created.error && Array.isArray(created.data) && created.data.length > 0) {
      dbUser = created.data[0] as AnyRow;
    } else {
      return {
        context: null,
        error:
          created.error?.message ??
          "Unable to create user record in Supabase.",
      };
    }
  }

  const role = asString(dbUser.role, inferredRole || "member").toLowerCase();
  const membershipTier = normalizeTier(asString(dbUser.membership_tier, "essential"));
  dbUser.membership_tier = membershipTier;

  return {
    context: {
      supabase,
      clerkUserId: userId,
      email,
      fullName,
      dbUser,
      role,
    },
    error: null,
  };
}

export function isCoachRole(role: string): boolean {
  return ["coach", "admin", "staff"].includes(role.toLowerCase());
}

export function asRequiredString(value: unknown, fieldName: string): string {
  const text = asString(value, "");
  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }
  return text;
}

export function asOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
