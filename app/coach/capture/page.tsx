import { redirect } from "next/navigation";
import { isClerkConfigured } from "@/lib/server/clerk";
import { getCurrentAuthState, isCoachAdminOrStaff, routeForRole } from "@/lib/server/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CoachCaptureClient } from "@/components/coach-capture-client";

type MemberOption = {
  id: string;
  name: string;
};

async function loadMemberOptions(): Promise<MemberOption[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const result = await admin
    .from("users")
    .select("id,full_name")
    .eq("role", "member")
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(200);
  if (result.error || !Array.isArray(result.data)) return [];
  return result.data
    .map((row) => ({
      id: typeof row.id === "string" ? row.id : "",
      name: typeof row.full_name === "string" ? row.full_name : "Member",
    }))
    .filter((row) => row.id.length > 0);
}

export default async function CoachCapturePage() {
  if (!isClerkConfigured()) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Authentication not configured</h1>
          <p className="muted">Set Clerk environment variables in Vercel.</p>
        </div>
      </main>
    );
  }

  const authState = await getCurrentAuthState();
  if (!authState.isAuthenticated) {
    redirect("/sign-in");
  }
  if (!isCoachAdminOrStaff(authState.role)) {
    redirect(routeForRole(authState.role));
  }

  const members = await loadMemberOptions();
  return <CoachCaptureClient members={members} />;
}
