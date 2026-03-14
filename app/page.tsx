import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <main className="shell">
      <div className="card">
        <div className="top-strip">
          <p className="muted" style={{ margin: 0 }}>
            Iso Club • Member Portal
          </p>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
        <h1 className="title">Your project is fully set up.</h1>
        <p className="muted">
          This is now a real Next.js app with Clerk authentication and Supabase
          integration scaffolding, ready for Vercel deployment.
        </p>

        <div className="actions">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn" type="button">
                Sign in
              </button>
            </SignInButton>
            <Link className="btn secondary" href="/sign-up">
              Create account
            </Link>
          </SignedOut>
          <SignedIn>
            <Link className="btn" href="/dashboard">
              Open member dashboard
            </Link>
          </SignedIn>
        </div>
      </div>
    </main>
  );
}
