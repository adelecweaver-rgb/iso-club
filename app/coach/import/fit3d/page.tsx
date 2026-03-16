import { redirect } from "next/navigation";
import { CoachFit3dImportTool } from "@/components/coach-fit3d-import-tool";
import { getCurrentAuthState, routeForRole } from "@/lib/server/roles";
import { isClerkConfigured } from "@/lib/server/clerk";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MemberOption = {
  id: string;
  full_name: string;
};

async function loadMembers(): Promise<MemberOption[]> {
  const admin = createSupabaseAdminClient();
  const server = admin ?? (await createSupabaseServerClient());
  if (!server) return [];

  const result = await server
    .from("users")
    .select("id,full_name,role")
    .eq("role", "member")
    .order("full_name", { ascending: true });
  if (result.error || !Array.isArray(result.data)) return [];

  return result.data.map((row) => ({
    id: String(row.id || ""),
    full_name: String(row.full_name || "Member"),
  }));
}

export default async function CoachFit3dImportPage() {
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
  if (authState.role === "member" || authState.role === "unknown") {
    redirect(routeForRole(authState.role));
  }

  const members = await loadMembers();
  return <CoachFit3dImportTool initialMembers={members} />;
}
