import { redirect } from "next/navigation";
import Link from "next/link";
import { isClerkConfigured } from "@/lib/server/clerk";
import { getCurrentAuthState, isCoachAdminOrStaff, routeForRole } from "@/lib/server/roles";
import { loadPrototypeFromFiles } from "@/lib/server/prototype";

export default async function CoachLogPage() {
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

  const prototype = await loadPrototypeFromFiles(
    ["iso-club-staff-log.html"],
    "Coach Staff Log",
  );

  if (!prototype.source) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Staff log source missing</h1>
          <p className="muted">
            Add
            {" "}
            <code>iso-club-staff-log.html</code>
            {" "}
            to the repository root to render this page design.
          </p>
          <Link className="btn" href="/coach">
            Back to coach dashboard
          </Link>
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
