/*
 * Stand-in for the storefront heart in tests of the surfaces that show it.
 * The real button needs Clerk and Server Actions; it has its own test.
 */
export function WishlistButton({ productTitle }: { slug: string; productTitle: string; className?: string }) {
  return <button type="button" aria-label={`Save ${productTitle} to wishlist`} aria-pressed={false} />;
}
