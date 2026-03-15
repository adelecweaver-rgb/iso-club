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
  const absolutePath = path.join(process.cwd(), "iso-club-landing.html");
  const html = await fs.readFile(absolutePath, "utf8");
  return parseLanding(html);
}

export default async function HomePage() {
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
