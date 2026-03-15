import Link from "next/link";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/server/clerk";
import { getCurrentAuthState, routeForRole } from "@/lib/server/roles";
import { loadPrototypeFromFiles } from "@/lib/server/prototype";

export default async function HomePage() {
  const prototype = await loadPrototypeFromFiles(
    ["iso-club-landing.html"],
    "Iso Club Landing",
  );
  const clerkConfigured = isClerkConfigured();
  const authState = clerkConfigured
    ? await getCurrentAuthState()
    : { isAuthenticated: false, role: "unknown" as const, onboardingComplete: false };
  const nextHref = authState.isAuthenticated ? routeForRole(authState.role) : "/sign-in";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: prototype.styles }} />
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(11,12,9,0.9)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 999,
          padding: "6px 10px",
          backdropFilter: "blur(2px)",
        }}
      >
        {clerkConfigured ? (
          authState.isAuthenticated ? (
            <>
              <Link
                href={nextHref}
                style={{ color: "#edeae0", textDecoration: "none", fontSize: 12 }}
              >
                Enter app
              </Link>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.2)" }} />
              <UserButton />
            </>
          ) : (
            <SignInButton mode="modal">
              <button
                type="button"
                style={{
                  border: 0,
                  borderRadius: 999,
                  padding: "6px 12px",
                  cursor: "pointer",
                  background: "#c9f055",
                  color: "#0b0c09",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Sign in
              </button>
            </SignInButton>
          )
        ) : (
          <span style={{ color: "#f0b955", fontSize: 12 }}>Configure Clerk keys</span>
        )}
      </div>
      <div dangerouslySetInnerHTML={{ __html: prototype.body }} />
      {prototype.script ? (
        <script dangerouslySetInnerHTML={{ __html: prototype.script }} />
      ) : null}
    </>
  );
}
