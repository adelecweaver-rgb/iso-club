import { redirect } from "next/navigation";
import { isClerkConfigured } from "@/lib/server/clerk";
import { getCurrentAuthState, routeForRole } from "@/lib/server/roles";
import { loadPrototypeFromFiles } from "@/lib/server/prototype";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const clerkConfigured = isClerkConfigured();
  if (!clerkConfigured) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Authentication not configured</h1>
          <p className="muted">
            Set
            {" "}
            <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
            {" "}
            and
            {" "}
            <code>CLERK_SECRET_KEY</code>
            {" "}
            in Vercel.
          </p>
        </div>
      </main>
    );
  }

  const authState = await getCurrentAuthState();
  if (!authState.isAuthenticated) {
    redirect("/sign-in");
  }

  if (authState.role === "coach" || authState.role === "admin" || authState.role === "staff") {
    redirect(routeForRole(authState.role));
  }

  if (authState.onboardingComplete) {
    redirect("/dashboard");
  }

  const prototype = await loadPrototypeFromFiles(
    ["iso-club-onboarding.html"],
    "Iso Club Onboarding",
  );

  if (!prototype.source) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Complete onboarding</h1>
          <p className="muted">
            Finish your intake details to continue to the dashboard.
          </p>
          <OnboardingForm />
        </div>
      </main>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: prototype.styles }} />
      <div dangerouslySetInnerHTML={{ __html: prototype.body }} />
      {prototype.script ? (
        <script dangerouslySetInnerHTML={{ __html: prototype.script }} />
      ) : null}
    </>
  );
}
