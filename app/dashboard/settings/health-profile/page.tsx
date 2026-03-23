import { redirect } from "next/navigation";
import { isClerkConfigured, safeCurrentUser } from "@/lib/server/clerk";
import { getCurrentAuthState, routeForRole } from "@/lib/server/roles";
import { HealthProfilePageClient } from "@/components/health-profile-page-client";

export default async function HealthProfilePage() {
  if (!isClerkConfigured()) {
    return (
      <main>
        <div>
          <h1>Authentication not configured</h1>
          <p>Set Clerk environment variables in Vercel.</p>
        </div>
      </main>
    );
  }

  const authState = await getCurrentAuthState();
  if (!authState.isAuthenticated) redirect("/sign-in");
  if (authState.role !== "member") redirect(routeForRole(authState.role));
  if (!authState.onboardingComplete) redirect("/onboarding");

  const clerkUser = await safeCurrentUser();
  const displayName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser?.username ||
    "Member";

  return <HealthProfilePageClient displayName={displayName} />;
}
