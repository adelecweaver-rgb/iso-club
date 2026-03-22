import { loadPrototypeFromFiles } from "@/lib/server/prototype";

export const metadata = {
  title: "Iso Club — Platform",
  description:
    "Your health. Guided daily. Measured always. The Iso Club member platform tracks every workout, surfaces your real progress, and gives your coach everything they need to guide you.",
};

export default async function PlatformPage() {
  const page = await loadPrototypeFromFiles(
    ["iso-club-platform.html"],
    "Iso Club Platform",
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: page.styles }} />
      <div dangerouslySetInnerHTML={{ __html: page.body }} />
      {page.script ? (
        <script dangerouslySetInnerHTML={{ __html: page.script }} />
      ) : null}
    </>
  );
}
