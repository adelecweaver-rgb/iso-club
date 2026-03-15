import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";

type PrototypeParts = {
  styles: string;
  body: string;
  script: string;
};

async function loadPrototypeParts(): Promise<PrototypeParts> {
  try {
    const html = await fs.readFile(path.join(process.cwd(), "index.html"), "utf8");

    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
    const bodyMatch = html.match(/<body>([\s\S]*?)<script>/i);
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);

    if (!styleMatch || !bodyMatch || !scriptMatch) {
      throw new Error("Could not parse prototype index.html.");
    }

    return {
      styles: styleMatch[1],
      body: bodyMatch[1],
      script: scriptMatch[1],
    };
  } catch {
    return {
      styles: "",
      body: `
        <main style="min-height:100vh;padding:24px;background:#1e2b1b;color:#f2e8dd;font-family:Arial,Helvetica,sans-serif;">
          <h2 style="margin:0 0 8px 0;">Dashboard template missing</h2>
          <p style="margin:0;">Could not load <code>/index.html</code>.</p>
        </main>
      `,
      script: "",
    };
  }
}

export default async function DashboardPage() {
  const { userId } = await auth();
  const prototype = await loadPrototypeParts();

  if (!userId) {
    return null;
  }

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
          background: "rgba(30,43,27,0.9)",
          border: "1px solid rgba(175,189,165,0.22)",
          borderRadius: 999,
          padding: "6px 10px",
          backdropFilter: "blur(2px)",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#afbda5",
            textDecoration: "none",
            fontSize: 12,
            letterSpacing: "0.04em",
          }}
        >
          Back
        </Link>
        <div style={{ width: 1, height: 14, background: "rgba(175,189,165,0.25)" }} />
        <UserButton />
      </div>

      <div dangerouslySetInnerHTML={{ __html: prototype.body }} />
      {prototype.script ? (
        <script
          // This script powers prototype view switching and date rendering.
          dangerouslySetInnerHTML={{ __html: prototype.script }}
        />
      ) : null}
    </>
  );
}
