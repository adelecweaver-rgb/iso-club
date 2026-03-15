import Link from "next/link";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { OnboardingForm } from "@/components/onboarding-form";
import { isClerkConfigured, safeAuth } from "@/lib/server/clerk";

export default async function HomePage() {
  const clerkConfigured = isClerkConfigured();
  const { userId } = await safeAuth();

  return (
    <main className="shell">
      <div className="card">
        <div className="top-strip">
          <p className="muted" style={{ margin: 0 }}>
            Iso Club • Member Portal
          </p>
          {clerkConfigured && userId ? <UserButton /> : null}
        </div>
        <h1 className="title">Your project is fully set up.</h1>
        <p className="muted">
          This is now a real Next.js app with Clerk authentication and Supabase
          integration scaffolding, ready for Vercel deployment.
        </p>
        {!clerkConfigured ? (
          <p className="muted" style={{ color: "#f0b955", marginTop: 8 }}>
            Authentication is not configured. Set
            {" "}
            <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
            {" "}
            and
            {" "}
            <code>CLERK_SECRET_KEY</code>
            {" "}
            in Vercel environment variables.
          </p>
        ) : null}

        <div className="actions">
          {clerkConfigured && !userId ? (
            <>
            <SignInButton mode="modal">
              <button className="btn" type="button">
                Sign in
              </button>
            </SignInButton>
            <Link className="btn secondary" href="/sign-up">
              Create account
            </Link>
            </>
          ) : userId ? (
            <Link className="btn" href="/dashboard">
              Open member dashboard
            </Link>
          ) : (
            <button className="btn" type="button" disabled>
              Configure Clerk to continue
            </button>
          )}
        </div>
        {clerkConfigured && userId ? <OnboardingForm /> : null}
      </div>
    </main>
  );
}
