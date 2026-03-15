import { NextResponse } from "next/server";
import { asRequiredString, getActorContext, isCoachRole } from "@/lib/server/actor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Body = {
  member_id?: string;
  phone?: string;
  full_name?: string;
};

export async function POST(request: Request) {
  try {
    const { context, error } = await getActorContext();
    if (!context) {
      return NextResponse.json({ success: false, error: error ?? "Unauthorized." }, { status: 401 });
    }
    if (!isCoachRole(context.role)) {
      return NextResponse.json(
        { success: false, error: "Only coach/admin/staff can update member phones." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Body;
    const memberId = asRequiredString(body.member_id, "member_id");
    const phone = asRequiredString(body.phone, "phone");
    const fullName =
      typeof body.full_name === "string" && body.full_name.trim().length > 0
        ? body.full_name.trim()
        : null;

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "SUPABASE_SERVICE_ROLE_KEY is required." },
        { status: 500 },
      );
    }

    const updatePayload: { phone: string; full_name?: string } = { phone };
    if (fullName) updatePayload.full_name = fullName;

    const updateRes = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("id", memberId)
      .eq("role", "member");
    if (updateRes.error) throw new Error(updateRes.error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update member contact.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
