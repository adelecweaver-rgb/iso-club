import { redirect } from "next/navigation";
import { MemberConnectArxForm } from "@/components/member-connect-arx-form";
import { getCurrentAuthState } from "@/lib/server/roles";
import { isClerkConfigured, safeCurrentUser } from "@/lib/server/clerk";
import { getActorContext } from "@/lib/server/actor";

export default async function MemberConnectArxPage() {
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

  const { context } = await getActorContext();
  if (!context) redirect("/sign-in");

  const clerkUser = await safeCurrentUser();
  const memberName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser?.username ||
    "Member";

  const savedArxUsername =
    typeof context.dbUser.arx_username === "string" ? context.dbUser.arx_username : "";

  return (
    <MemberConnectArxForm
      memberName={memberName}
      savedArxUsername={savedArxUsername}
      hasStoredUsername={savedArxUsername.length > 0}
    />
  );
}
