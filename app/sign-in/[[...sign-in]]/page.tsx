import { SignIn } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/server/clerk";

export default function SignInPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="shell">
        <div className="card">
          <h1 className="title">Clerk is not configured</h1>
          <p className="muted">
            Add
            {" "}
            <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
            {" "}
            and
            {" "}
            <code>CLERK_SECRET_KEY</code>
            {" "}
            in your Vercel environment variables.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <SignIn />
    </main>
  );
}
