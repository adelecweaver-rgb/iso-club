import { redirect } from "next/navigation";
import { getCurrentAuthState, routeForRole } from "@/lib/server/roles";
import { isClerkConfigured } from "@/lib/server/clerk";
import { loadDashboardLiveData, loadPrototypeStyles } from "@/app/dashboard/page";
import { MemberProgressClient } from "@/components/member-progress-client";

export default async function MemberProgressPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Authentication not configured</h1>
        </div>
      </main>
    );
  }

  const authState = await getCurrentAuthState();
  if (!authState.isAuthenticated || !authState.userId) redirect("/sign-in");
  if (authState.role !== "member") redirect(routeForRole(authState.role));
  if (!authState.onboardingComplete) redirect("/onboarding");

  const [payload, styles] = await Promise.all([
    loadDashboardLiveData(authState.userId, authState.role),
    loadPrototypeStyles(),
  ]);

  return (
    <>
      <style>{styles}</style>
      <MemberProgressClient payload={payload} />
    </>
  );
}
