import { redirect } from "next/navigation";
import { MemberConnectCarolForm } from "@/components/member-connect-carol-form";
import { getCurrentAuthState } from "@/lib/server/roles";
import { isClerkConfigured, safeCurrentUser } from "@/lib/server/clerk";
import { getActorContext } from "@/lib/server/actor";

export default async function MemberConnectCarolPage() {
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
  // Allow any authenticated user (member or coach) to connect their own account

  const { context } = await getActorContext();
  if (!context) {
    redirect("/sign-in");
  }
  const memberId = String(context.dbUser.id || "").trim();
  if (!memberId) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Unable to load member profile</h1>
          <p className="muted">Could not resolve your user ID for CAROL sync.</p>
        </div>
      </main>
    );
  }

  const clerkUser = await safeCurrentUser();
  const clerkName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser?.username ||
    "Member";
  const memberName =
    (typeof context.dbUser.full_name === "string" && context.dbUser.full_name.trim()
      ? context.dbUser.full_name.trim()
      : clerkName);
  const savedCarolUsername =
    typeof context.dbUser.carol_username === "string"
      ? context.dbUser.carol_username
      : "";
  const hasStoredCarolToken =
    typeof context.dbUser.carol_token === "string" &&
    context.dbUser.carol_token.trim().length > 0;

  return (
    <MemberConnectCarolForm
      userId={memberId}
      memberName={memberName}
      savedCarolUsername={savedCarolUsername}
      hasStoredCarolToken={hasStoredCarolToken}
    />
  );
}
