import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function loadDashboardMarkup() {
  try {
    return await fs.readFile(path.join(process.cwd(), "index.html"), "utf8");
  } catch {
    return `
      <!doctype html>
      <html>
      <body style="font-family:Arial;background:#1e2b1b;color:#f2e8dd;padding:24px;">
        <h2>Dashboard template missing</h2>
        <p>Could not find /index.html at project root.</p>
      </body>
      </html>
    `;
  }
}

async function getSupabaseStatus() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      ok: false,
      message:
        "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables.",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message:
        "Supabase variables are set but server client could not be created.",
    };
  }

  const { error } = await supabase.auth.getSession();
  if (error) {
    return {
      ok: false,
      message: `Supabase client reached, but returned an auth error: ${error.message}`,
    };
  }

  return {
    ok: true,
    message: "Supabase client is connected and ready to use.",
  };
}

export default async function DashboardPage() {
  const { userId } = await auth();
  const html = await loadDashboardMarkup();
  const supabase = await getSupabaseStatus();

  if (!userId) {
    return null;
  }

  return (
    <main className="shell" style={{ display: "block", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: "100%" }}>
        <div className="top-strip">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/" className="btn secondary">
              Back
            </Link>
            <p className="muted" style={{ margin: 0 }}>
              Protected dashboard
            </p>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>

        <div
          className="status-box"
          style={{
            borderColor: supabase.ok
              ? "rgba(116, 142, 107, 0.4)"
              : "rgba(196, 122, 106, 0.4)",
            background: supabase.ok
              ? "rgba(116, 142, 107, 0.12)"
              : "rgba(196, 122, 106, 0.12)",
          }}
        >
          <strong>
            Supabase status: {supabase.ok ? "Connected" : "Needs setup"}
          </strong>
          <span>{supabase.message}</span>
        </div>

        <div style={{ marginTop: 14 }}>
          <iframe
            title="Iso Club member dashboard"
            srcDoc={html}
            className="dashboard-frame"
          />
        </div>
      </div>
    </main>
  );
}
