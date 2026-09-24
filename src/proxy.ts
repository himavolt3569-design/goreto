import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Public-first (AGENTS §7): the storefront, guest checkout, tracking, and
 * try-on stay public. This only requires a session; owner/staff authorization
 * is enforced again in server code and RLS.
 */
const isSignedInRoute = createRouteMatcher(["/account(.*)", "/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isSignedInRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    // Clerk's auto-proxy path.
    "/__clerk/:path*",
  ],
};
