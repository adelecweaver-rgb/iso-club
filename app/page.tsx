import { loadPrototypeFromFiles } from "@/lib/server/prototype";

export default async function HomePage() {
  const landing = await loadPrototypeFromFiles(["iso-club-landing.html"], "Iso Club");

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
