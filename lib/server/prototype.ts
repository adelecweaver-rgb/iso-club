import "server-only";

import { promises as fs } from "fs";
import path from "path";

export type PrototypeParts = {
  styles: string;
  body: string;
  script: string;
  source: string | null;
};

function parsePrototype(html: string): PrototypeParts {
  const styleMatches = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi));
  const scriptMatches = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi));
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  return {
    styles: styleMatches.map((match) => match[1]).join("\n"),
    body: bodyMatch?.[1] ?? html,
    script: scriptMatches.map((match) => match[1]).join("\n"),
    source: null,
  };
}

export async function loadPrototypeFromFiles(
  candidateFiles: string[],
  fallbackTitle: string,
): Promise<PrototypeParts> {
  for (const candidate of candidateFiles) {
    try {
      const absolutePath = path.join(process.cwd(), candidate);
      const html = await fs.readFile(absolutePath, "utf8");
      const parsed = parsePrototype(html);
      return { ...parsed, source: candidate };
    } catch {
      // Try next candidate.
    }
  }

  return {
    styles: "",
    body: `
      <main style="min-height:100vh;padding:24px;background:#0b0c09;color:#edeae0;font-family:Arial,Helvetica,sans-serif;">
        <h2 style="margin:0 0 8px 0;">${fallbackTitle}</h2>
        <p style="margin:0;">Source HTML file not found in repository.</p>
      </main>
    `,
    script: "",
    source: null,
  };
}
