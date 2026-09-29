import { getCurrentProfile } from "@/lib/auth/profile";
import { fetchWishlistSlugs } from "@/features/wishlist/queries";

/*
 * Saved product slugs for the storefront hearts (AGENTS §4.9). Storefront
 * pages are cached for everyone, so each signed-in browser asks once for its
 * own list. The response is private to this user and never cached.
 */

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "signed_out" }, { status: 401, headers: PRIVATE });

  try {
    const slugs = await fetchWishlistSlugs(profile.id);
    return Response.json({ slugs }, { headers: PRIVATE });
  } catch (error) {
    console.error("wishlist slugs failed", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: PRIVATE });
  }
}
