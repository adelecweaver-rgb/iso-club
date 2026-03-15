import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";

type LandingParts = {
  styles: string;
  body: string;
  script: string;
};

function parseLanding(html: string): LandingParts {
  const styleMatches = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi));
  const scriptMatches = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi));
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  return {
    styles: styleMatches.map((match) => match[1]).join("\n"),
    body: bodyMatch?.[1] ?? html,
    script: scriptMatches.map((match) => match[1]).join("\n"),
  };
}

async function loadLanding(): Promise<LandingParts> {
  try {
    const html = await fs.readFile(path.join(process.cwd(), "iso-club-landing.html"), "utf8");
    return parseLanding(html);
  } catch {
    return {
      styles: "",
      body: `
        <main style="min-height:100vh;padding:24px;background:#0b0c09;color:#edeae0;font-family:Arial,Helvetica,sans-serif;">
          <h2 style="margin:0 0 8px 0;">Landing page not found</h2>
          <p style="margin:0;">Could not load <code>/iso-club-landing.html</code>.</p>
        </main>
      `,
      script: "",
    };
  }
}

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  const landing = await loadLanding();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: landing.styles }} />
      <div dangerouslySetInnerHTML={{ __html: landing.body }} />
      {landing.script ? (
        <script dangerouslySetInnerHTML={{ __html: landing.script }} />
      ) : null}
    </>
  );
}
