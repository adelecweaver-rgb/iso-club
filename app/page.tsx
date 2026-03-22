import { redirect } from "next/navigation";
import { isClerkConfigured } from "@/lib/server/clerk";
import { getCurrentAuthState, routeForRole } from "@/lib/server/roles";
import { loadPrototypeFromFiles } from "@/lib/server/prototype";

export default async function HomePage() {
  if (isClerkConfigured()) {
    const authState = await getCurrentAuthState();
    if (authState.isAuthenticated) {
      redirect(routeForRole(authState.role));
    }
  }

  const landing = await loadPrototypeFromFiles(["iso-club-platform.html"], "Iso Club");

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
