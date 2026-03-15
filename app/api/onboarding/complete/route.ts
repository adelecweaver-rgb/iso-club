import { NextResponse } from "next/server";
import { asOptionalNumber, getActorContext } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Body = {
  full_name?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  height_inches?: number | string;
  emergency_contact?: string;
  membership_tier?: string;
  notes?: string;
  whoop_connected?: boolean;
  oura_connected?: boolean;
  whoop_user_id?: string;
  oura_user_id?: string;
};

function normalizeMembershipTier(value: string | undefined): "essential" | "premier" | "concierge" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "premier" || normalized === "concierge") {
    return normalized;
  }
  return "essential";
}

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SUPABASE_SERVICE_ROLE_KEY is required to write onboarding data.",
        },
        { status: 500 },
      );
    }

    const fullName =
      (typeof body.full_name === "string" && body.full_name.trim().length > 0
        ? body.full_name.trim()
        : context.fullName) || "Member";
    const membershipTier = normalizeMembershipTier(body.membership_tier);
    const heightInches = asOptionalNumber(body.height_inches);
    const role =
      ["coach", "admin", "staff"].includes(context.role) ? context.role : "member";

    const payload = {
      clerk_id: context.clerkUserId,
      email: context.email,
      full_name: fullName,
      role,
      membership_tier: membershipTier,
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      date_of_birth:
        typeof body.date_of_birth === "string" ? body.date_of_birth.trim() || null : null,
      gender: typeof body.gender === "string" ? body.gender.trim() || null : null,
      height_inches: heightInches,
      emergency_contact:
        typeof body.emergency_contact === "string"
          ? body.emergency_contact.trim() || null
          : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      whoop_connected: body.whoop_connected ?? false,
      oura_connected: body.oura_connected ?? false,
      whoop_user_id:
        typeof body.whoop_user_id === "string" ? body.whoop_user_id.trim() || null : null,
      oura_user_id:
        typeof body.oura_user_id === "string" ? body.oura_user_id.trim() || null : null,
      is_active: true,
      avatar_url: String(context.dbUser.avatar_url ?? "") || null,
    };

    const upserted = await supabaseAdmin
      .from("users")
      .upsert(payload, { onConflict: "clerk_id" })
      .select("id")
      .single();

    if (upserted.error) throw new Error(upserted.error.message);

    return NextResponse.json({ success: true, user_id: upserted.data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to complete onboarding.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
