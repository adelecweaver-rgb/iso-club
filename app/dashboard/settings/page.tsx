import { redirect } from "next/navigation";
import { isClerkConfigured, safeCurrentUser } from "@/lib/server/clerk";
import { getCurrentAuthState, routeForRole } from "@/lib/server/roles";
import { getActorContext } from "@/lib/server/actor";
import { MemberSettingsClient } from "@/components/member-settings-client";

export default async function DashboardSettingsPage() {
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
  if (!authState.isAuthenticated) redirect("/sign-in");
  if (authState.role !== "member") redirect(routeForRole(authState.role));
  if (!authState.onboardingComplete) redirect("/onboarding");

  const { context } = await getActorContext();
  if (!context) redirect("/sign-in");

  const clerkUser = await safeCurrentUser();
  const displayName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser?.username ||
    "Member";

  const arxUsername = typeof context.dbUser.arx_username === "string" ? context.dbUser.arx_username : "";
  const carolConnected = typeof context.dbUser.carol_token === "string" && context.dbUser.carol_token.trim().length > 0;
  const onboardingUpdatedAt =
    typeof context.dbUser.onboarding_updated_at === "string" &&
    context.dbUser.onboarding_updated_at.trim().length > 0
      ? context.dbUser.onboarding_updated_at
      : null;

  return (
    <MemberSettingsClient
      displayName={displayName}
      arxConnected={arxUsername.length > 0}
      carolConnected={carolConnected}
      onboardingUpdatedAt={onboardingUpdatedAt}
    />
  );
}
