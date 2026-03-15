import { loadPrototypeFromFiles } from "@/lib/server/prototype";

export default async function HomePage() {
  const prototype = await loadPrototypeFromFiles(
    ["iso-club-landing.html"],
    "Iso Club Landing",
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: prototype.styles }} />
      <div dangerouslySetInnerHTML={{ __html: prototype.body }} />
      {prototype.script ? (
        <script dangerouslySetInnerHTML={{ __html: prototype.script }} />
      ) : null}
    </>
  );
}
