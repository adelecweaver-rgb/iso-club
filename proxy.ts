import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfigured } from "@/lib/server/clerk";

const withoutClerk = () => NextResponse.next();
const clerkConfigured = isClerkConfigured();

const withClerk = clerkConfigured
  ? (() => {
      const isPublicRoute = createRouteMatcher([
        "/",
        "/sign-in(.*)",
        "/sign-up(.*)",
        "/api/webhooks/clerk(.*)",
      ]);

      return clerkMiddleware(async (auth, req) => {
        if (!isPublicRoute(req)) {
          await auth.protect();
        }
      });
    })()
  : withoutClerk;

export default withClerk;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|png|jpg|jpeg|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
