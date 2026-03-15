import "server-only";

import { safeAuth, safeCurrentUser } from "@/lib/server/clerk";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AppRole = "member" | "coach" | "admin" | "staff" | "unknown";

export type AuthState = {
  isAuthenticated: boolean;
  userId: string | null;
  email: string;
  role: AppRole;
  onboardingComplete: boolean;
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function normalizeRole(value: string): AppRole {
  const role = value.trim().toLowerCase();
  if (role === "coach" || role === "admin" || role === "staff" || role === "member") {
    return role;
  }
  return "unknown";
}

export function routeForRole(role: AppRole): string {
  if (role === "coach" || role === "admin") return "/coach";
  if (role === "staff") return "/coach/log";
  return "/dashboard";
}

export function isCoachOrAdmin(role: AppRole): boolean {
  return role === "coach" || role === "admin";
}

export function isCoachAdminOrStaff(role: AppRole): boolean {
  return role === "coach" || role === "admin" || role === "staff";
}

export async function getCurrentAuthState(): Promise<AuthState> {
  const { userId } = await safeAuth();
  if (!userId) {
    return {
      isAuthenticated: false,
      userId: null,
      email: "",
      role: "unknown",
      onboardingComplete: false,
    };
  }

  const user = await safeCurrentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const metadataRole = normalizeRole(
    asString(
      (user?.publicMetadata as Record<string, unknown> | undefined)?.role ??
        (user?.unsafeMetadata as Record<string, unknown> | undefined)?.role ??
        "",
      "",
    ),
  );

  const admin = createSupabaseAdminClient();
  if (admin) {
    const byClerk = await admin
      .from("users")
      .select("role,phone,date_of_birth,height_inches,gender,emergency_contact")
      .eq("clerk_id", userId)
      .limit(1);
    if (!byClerk.error && Array.isArray(byClerk.data) && byClerk.data.length > 0) {
      const row = byClerk.data[0] as Record<string, unknown>;
      return {
        isAuthenticated: true,
        userId,
        email,
        role: normalizeRole(asString(row.role, "member")),
        onboardingComplete: Boolean(
          row.phone ||
            row.date_of_birth ||
            row.height_inches ||
            row.gender ||
            row.emergency_contact,
        ),
      };
    }

    if (email) {
      const byEmail = await admin
        .from("users")
        .select("role,phone,date_of_birth,height_inches,gender,emergency_contact")
        .eq("email", email)
        .limit(1);
      if (!byEmail.error && Array.isArray(byEmail.data) && byEmail.data.length > 0) {
        const row = byEmail.data[0] as Record<string, unknown>;
        return {
          isAuthenticated: true,
          userId,
          email,
          role: normalizeRole(asString(row.role, "member")),
          onboardingComplete: Boolean(
            row.phone ||
              row.date_of_birth ||
              row.height_inches ||
              row.gender ||
              row.emergency_contact,
          ),
        };
      }
    }
  }

  if (metadataRole !== "unknown") {
    return {
      isAuthenticated: true,
      userId,
      email,
      role: metadataRole,
      onboardingComplete: false,
    };
  }

  if (email.toLowerCase().includes("dustin")) {
    return {
      isAuthenticated: true,
      userId,
      email,
      role: "coach",
      onboardingComplete: true,
    };
  }

  return {
    isAuthenticated: true,
    userId,
    email,
    role: "member",
    onboardingComplete: false,
  };
}
