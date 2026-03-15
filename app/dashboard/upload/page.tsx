import { redirect } from "next/navigation";
import { isClerkConfigured, safeCurrentUser } from "@/lib/server/clerk";
import { getCurrentAuthState, routeForRole } from "@/lib/server/roles";
import { MemberUploadDataForm } from "@/components/member-upload-data-form";

export default async function DashboardUploadPage() {
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
  if (authState.role !== "member") {
    redirect(routeForRole(authState.role));
  }
  if (!authState.onboardingComplete) {
    redirect("/onboarding");
  }

  const clerkUser = await safeCurrentUser();
  const memberName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser?.username ||
    "Member";

  return <MemberUploadDataForm memberName={memberName} />;
}
