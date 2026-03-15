import Link from "next/link";
import { redirect } from "next/navigation";
import { isClerkConfigured } from "@/lib/server/clerk";
import { getCurrentAuthState, routeForRole } from "@/lib/server/roles";
import { MemberSettingsForm } from "@/components/member-settings-form";

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
  if (!authState.isAuthenticated) {
    redirect("/sign-in");
  }
  if (authState.role !== "member") {
    redirect(routeForRole(authState.role));
  }
  if (!authState.onboardingComplete) {
    redirect("/onboarding");
  }

  return (
    <main className="shell">
      <div className="card">
        <div className="top-strip">
          <h1 className="title" style={{ marginBottom: 0 }}>
            Profile settings
          </h1>
          <Link className="btn secondary" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Keep your phone current so SMS alerts can reach you.
        </p>
        <MemberSettingsForm />
      </div>
    </main>
  );
}
