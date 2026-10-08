# Account phase 3: reviews (storefront + account) + profile & security

Last of three customer-account phases (AGENTS §4.9, worklog §4.3): 1. shell + overview + orders + tracking + billing ✅ → 2. wishlist + addresses ✅ → **3. Reviews + Profile & security**. It also closes worklog §4.2 "Reviews on the product page".

## Goal

- **Product page reviews**: a "Customer reviews" section with the average, the count, a 5→1 star breakdown, the latest published reviews and a **Write a review** button. "(N reviews)" in the purchase panel links to it.
- **All reviews** `/products/[slug]/reviews`: every published review, 10 per page, `?page=` in the URL, works without JS.
- **Write / edit** `/account/reviews/[slug]`: a star picker, an optional title and the review text. One review per product. An edit goes back to moderation.
- **Your reviews** `/account/reviews`: a "Ready to review" list (delivered products you haven't reviewed yet) and your reviews with their moderation status, plus Edit and Delete.
- **Profile & security** `/account/profile/[[...rest]]`: Clerk `<UserProfile />`, themed by the existing appearance module.
- Nav gains a **Profile** group: Reviews, Profile & security. The overview's Profile card links to Profile & security.

**Client decision (2026-10-06): only verified buyers may review.** A review needs the reviewer's own **delivered** order containing that product, and every new review carries that order item.

## Non-goals

- Review photos, helpful votes, replies from the store, sorting or filtering of reviews, review emails or notifications.
- Guest-order claiming (§9.1). Guest buyers can review once that ships.
- A "Write a review" link on the order detail page. "Ready to review" covers that entry point.
- Changes to admin moderation, apart from the existing action also revalidating `/products/[slug]/reviews`.
- Profile sync on dev. Name and phone edits reach `profiles` through the Clerk webhook, which exists only in production (see Needs attention).
- Existing unverified seed reviews stay. The new rule applies to new and edited reviews.

## What I inspected

- `AGENTS.md` §3.9, §4.2, §4.9, §8, §9.3, §11.4, §16, §22; `worklog.md` §4.2, §4.3; `prompts/goreto-account-2-wishlist-addresses.md`.
- Migrations:
  - `engagement`: the `reviews` table, which has `unique (user_id, product_id)`, a 1–4000 body check, own-read, own-insert-pending, staff-read and staff-moderate policies, and no delete policy.
  - `verified_review_purchases`: the insert policy accepts a cited order item only if it comes from the reviewer's own delivered order for that product, but still allows no order item at all.
  - `harden_grants`: `authenticated` has `select, insert, update` on reviews and no `delete`.
  - `storefront_reads`: `product_rating_summaries`, and `storefront_testimonials` with its "Priya S." byline expression.
  - `clerk_profile_sync`: deletion anonymises the profile and keeps its reviews.
  - `admin_operations`: `admin_attention_counts` counts pending reviews for the bell.
- Code:
  - `src/app/(store)/products/[slug]/page.tsx` (ISR 60s, `generateStaticParams`).
  - `src/features/catalog/{product-detail,queries,mappers,types,slug}.ts`.
  - `src/components/store/product/product-purchase.tsx`, which is shared with quick view.
  - `src/components/ui/rating.tsx`.
  - `src/features/admin/actions/{engagement,helpers}.ts`, which hold `moderateReviewAction` and `revalidateStorefrontCatalog`.
  - `src/app/(admin)/admin/reviews/page.tsx` and `review-moderation.tsx`. The moderation note is labelled "only visible to staff".
  - `src/features/account/{nav,queries}.ts`, `src/components/store/account/{account-nav,account-ui,address-form}.tsx`, `src/app/(account)/account/{layout,page,wishlist/page}.tsx`.
  - `src/features/wishlist/actions.ts` (Server Action pattern), `src/components/store/header-auth.tsx` (modal sign-in pattern), `src/lib/auth/{profile,clerk-appearance}.ts`, `src/components/ui/icons.ts`.
  - `src/lib/pagination/page.ts`.
  - `tests/db/rls.test.ts`, whose verified-review test currently expects an unverified insert to be allowed, and `tests/db/account-addresses-wishlist.test.ts` (harness pattern).
- Docs and packages: Next `03-file-conventions/dynamic-routes.md` (optional catch-all `[[...rest]]`, `params.rest?: string[]`), and `@clerk/nextjs` `UserProfile`, which uses `useEnforceCorrectRoutingProps` and derives path routing from the catch-all route.

## Decisions

1. **One migration** `supabase/migrations/20261006090000_product_reviews.sql`:
   - **Verified buyers only, enforced in the database.** Replace the insert policy `reviews: own create pending` so that `order_item_id` is **required**, with the existing own-delivered-item check. A direct PostgREST insert can then never create an unverified review.
   - `submit_review(p_product_slug text, p_rating smallint, p_title text, p_body text) returns uuid`, `security definer`, `set search_path = ''`. It is the app's single write path:
     - Inputs are trimmed and validated. Rating must be 1–5, the title 0–120 characters (empty becomes null) and the body 10–2000 characters. A violation raises `22023`.
     - A signed-out caller or one with no profile raises `42501`. An unknown or inactive product raises `P0002`.
     - The function picks the caller's latest delivered order item for that product. If none exists it raises `42501` with message `not_a_verified_buyer`.
     - It upserts on `(user_id, product_id)`. A real change (rating, title or body) sets `status = 'pending'`, clears `moderated_by`, `moderated_at` and `moderation_note`, and refreshes `order_item_id`. An unchanged resubmit is a no-op, so it isn't sent back to moderation for nothing.
     - It returns the review id.
   - **Delete own review**: add a `reviews: own delete` policy (`user_id = current_profile_id()`) and `grant delete on public.reviews to authenticated`. No function is needed, because RLS limits it to the caller's own rows.
   - **Public reads** (`security definer`, `stable`, `set search_path = ''`, published reviews of **active** products only, bounded inputs):
     - `product_reviews(p_product_slug text, p_limit integer, p_offset integer)` returns `review_id, rating, title, body, author_name, verified, created_at`, newest first. `p_limit` is clamped to 1–50 and `p_offset` to 0–10000.
     - The byline uses the same "Priya S." expression as testimonials. A deleted or nameless profile reads "Goreto customer". No profile id or order id leaves the function.
     - `product_rating_breakdown(p_product_slug text)` returns `rating, review_count` for the 1–5 bars.
     - Both `revoke … from public` and `grant execute … to anon, authenticated, service_role`, like `product_rating_summaries`.
   - **Account read** `account_reviewable_products()` (`security invoker`, `stable`) lists delivered products the caller hasn't reviewed yet: `product_id, slug, title, image_path, delivered_at`, newest delivery first, active products only, at most 20. It filters on `orders.user_id = current_profile_id()` explicitly, like `account_reads`, so owners and staff see only their own purchases. Grants: `revoke from public, anon`, `grant to authenticated`.
   - Grants follow `harden_grants`. No table or column change.

2. **Storefront stays cached.**
   - The product page reads the breakdown and the latest 4 reviews through the anon public client at render, inside the existing ISR window.
   - `/products/[slug]/reviews` reads `searchParams`, so it renders dynamically with the public client. It has no auth and no user data. It returns 404 for an unknown or inactive product, and canonical metadata points at the product page.
   - The **Write a review** button is a client component. Signed out, it uses `SignInButton mode="modal"` with `forceRedirectUrl` set to `/account/reviews/<slug>`. Signed in, it is a link to that page. The product page never learns on the server who is viewing.
   - `ProductPurchase` gets an optional `reviewsHref`. The product page passes `#reviews`, and quick view leaves it unset, so "(N reviews)" stays plain text in the modal.

3. **Product page section** `ProductReviews` (server component, placed between Product information and You May Also Like, `id="reviews"`):
   - The summary shows the large average, `Rating variant="stars"` and the count.
   - The breakdown shows 5 → 1 rows, each with the star count as text, a `ProgressBar`-style bar and the review count. Each bar also has a text label, so colour is never the only signal (§3.9).
   - The latest 4 reviews appear as `ReviewCard`s with stars, an optional title, the body (`whitespace-pre-line`), the byline, a "Verified purchase" pill and a Kathmandu-formatted date.
   - "See all N reviews" appears when there are more than 4.
   - Empty state: "No reviews yet. Bought this? Share how it went once it's delivered." plus the Write a review button.

4. **Write / edit page** `/account/reviews/[slug]`:
   - The page calls `requireProfile()`, validates the slug and loads the product (active only, 404 otherwise) and the caller's existing review.
   - It checks eligibility with the same rule as the function, a delivered order item from the caller's own orders, so the page can explain itself.
   - **Not eligible**: an empty-state card, "You can review this after your order is delivered", with links to the product and to Orders.
   - **Eligible**: `ReviewForm` (React Hook Form + Zod, the same schema the action parses), with these parts:
     - a **star rating radio group**: a `fieldset` and `legend` "Your rating", five native radios with labels "1 star" … "5 stars", stars filled up to the choice, arrow keys native, and an inline required error;
     - a title (optional, max 120);
     - the review text (10–2000, with a live character count wired via `aria-describedby`);
     - a note: "Reviews are checked before they appear. Editing a review sends it for checking again."
   - When editing, the current status pill and the existing values are prefilled.
   - The Server Action `submitReviewAction` re-validates with Zod, calls `submit_review` through `getUserSupabase()` and maps errors to friendly messages (`42501 not_a_verified_buyer`, `P0002`, `22023`). It then `revalidatePath("/account/reviews")` plus the product page and its `/reviews` page (an edit can pull a published review off them) and redirects to `/account/reviews`.

5. **Your reviews page** `/account/reviews`:
   - **Ready to review**: up to 20 cards with the order-snapshot image, the title, "Delivered {date}" and a **Write a review** link. The section is hidden when the list is empty.
   - **Your reviews**: own rows through RLS `.eq("user_id", profile.id)`, newest first, 10 per page with `AccountPagination`. Each row shows the product title (a link while the product is active), stars, title and body, the date and a status pill:
     - Pending → "Awaiting approval" (warning);
     - Published → "Published" (success);
     - Rejected → "Not published" (error) with the text "It didn't meet our review guidelines."
   - The staff moderation note is **never** shown to the customer. It is labelled staff-only in admin.
   - **Edit** links to `/account/reviews/<slug>` while the product is active. **Delete** opens a confirm dialog, then `deleteReviewAction(id)` (Zod uuid, RLS own delete), which revalidates the account page and the product's review pages.
   - Empty state: "No reviews yet". It points to Ready to review when that list has items, and otherwise to Orders.

6. **Profile & security** `/account/profile/[[...rest]]/page.tsx`:
   - The page calls `requireProfile()` and renders `AccountPageHeader` plus `<UserProfile />`.
   - Theme: the provider's `clerkAppearance` already applies. For width it adds a small `clerkUserProfileAppearance` (rootBox and cardBox at 100% width, no shadow, our border) in `src/lib/auth/clerk-appearance.ts`, so all Clerk styling stays in one module (§9.3).

7. **Nav**: `ACCOUNT_NAV` gains `{ label: "Profile", items: Reviews (star), Profile & security (shield check) }` after Saved. `AccountNavIcon` gains `reviews` and `profile`. The overview's Profile card gets a "Manage profile" text link.

8. **Moderation revalidation**: `moderateReviewAction` already revalidates the product page. It also revalidates `/products/<slug>/reviews`.

9. **Tokens only.** Icons come from `icons.ts`; star, shield-check, pencil, trash and seal-check are all already exported. Dates are formatted in Asia/Kathmandu through the existing order formatters.

## Files expected to change

```text
supabase/migrations/20261006090000_product_reviews.sql        new
src/types/database.ts                                          regenerated (npm run db:types)
src/features/reviews/schema.ts (+ test)                       new: form schema, limits, error mapping (client-safe)
src/features/reviews/queries.ts (+ test)                      new: public product reads + account reads, mappers
src/features/reviews/actions.ts                               new: submitReviewAction, deleteReviewAction
src/components/store/reviews/{product-reviews,review-card,rating-breakdown,write-review-button}.tsx   new
src/components/store/reviews/__tests__/*.test.tsx             new
src/components/store/account/{review-form,account-review-list,reviewable-products}.tsx (+ tests)   new
src/components/store/product/product-purchase.tsx             optional reviewsHref link
src/app/(store)/products/[slug]/page.tsx                      reviews section, reviewsHref
src/app/(store)/products/[slug]/reviews/page.tsx              new: all reviews
src/app/(account)/account/reviews/page.tsx                    new
src/app/(account)/account/reviews/[slug]/page.tsx             new: write / edit
src/app/(account)/account/profile/[[...rest]]/page.tsx        new
src/app/(account)/account/page.tsx                            "Manage profile" link
src/features/account/nav.ts (+ test), src/components/store/account/account-nav.tsx   Profile group
src/lib/auth/clerk-appearance.ts                              UserProfile width theme
src/features/admin/actions/engagement.ts                      also revalidate /products/<slug>/reviews
tests/db/reviews.test.ts                                      new
tests/db/rls.test.ts                                          unverified insert now rejected
worklog.md                                                    mark phase 3 + product reviews done
```

## Database / migration impact

The migration adds one replaced policy, one new policy, one grant and four functions. It changes no table, column or data, and existing reviews are untouched. Verify with `npm run test:db`, then `npm run db:push` (dev) and `npm run db:types`.

**Prod:** apply it with the next release (dry run first), together with the pending Phase 11 migrations.

**Rollback:** drop the four functions, drop `reviews: own delete`, revoke delete, and recreate the `verified_review_purchases` insert policy.

## Auth / RLS

- `/account(.*)` is already session-protected by `src/proxy.ts`. Every new account page also calls `requireProfile()`.
- Writes go through the Clerk-token client only, with no service role.
  - `submit_review` is `security definer` because it must write fields the caller can't set directly. It derives the user and the order item itself and trusts no id from the browser.
  - Delete is plain RLS on own rows.
- Customers still can't publish, moderate or read other people's raw review rows. The public surface stays limited to functions that return no ids beyond the review id.
- Owners and staff are treated as customers here. `account_reviewable_products` and the own-review list filter on the caller's own profile.

## Validation and security

- The slug is checked with `isValidSlug` before any query, and review ids must be UUIDs.
- The Zod schema mirrors the SQL checks: rating integer 1–5, title ≤ 120, body 10–2000 after trimming. The database re-checks everything.
- Review text is rendered as text, never as HTML, with React escaping and `whitespace-pre-line`.
- The browser cannot claim a verified purchase or choose an order item.
- Not-owned or unknown review ids delete nothing and report "not found", so the response doesn't leak whether the review exists.

## Tests

- **DB** (`tests/db/reviews.test.ts`, PGlite, rolled back):
  - `submit_review` succeeds for a delivered buyer, and the row is pending with the order item set;
  - it fails `not_a_verified_buyer` for a customer whose order wasn't delivered and for one who never bought the product;
  - it fails for an inactive or unknown product and for `anon`;
  - an edit of a published review returns it to pending and clears the moderation fields, while an unchanged resubmit keeps it published;
  - limits: rating 0 or 6, a 9-character body and a 121-character title all fail;
  - a direct insert with no order item is now rejected;
  - a customer can delete their own review but not another customer's;
  - `product_reviews` returns only published reviews of active products, with bylines and no ids, and clamps limit and offset;
  - the breakdown counts match `product_rating_summaries`;
  - `account_reviewable_products` lists only the caller's own delivered, unreviewed, active products, including for the owner;
  - `anon` cannot run `account_reviewable_products`.
- **Unit**: the form schema; the error mapping; the review and breakdown mappers (bars sum, empty).
- **Components**:
  - `RatingBreakdown` has text labels;
  - `ReviewCard` shows the verified pill and no HTML injection;
  - `WriteReviewButton` opens the sign-in modal when signed out and is a link when signed in;
  - `ReviewForm`: the star radio group is labelled and keyboard-operable, errors are inline, and the counter works;
  - the account review list: status pills, no moderation note, the delete confirm;
  - `ReviewableProducts`;
  - the nav shows the Profile group.

## Acceptance criteria

1. A product with published reviews shows the average, the breakdown, the latest 4 and "See all N reviews". `/products/<slug>/reviews` paginates with `?page=`.
2. A product without reviews shows the empty state. "(N reviews)" on the product page jumps to the section.
3. Signed out, Write a review opens the sign-in modal and lands on the write page after sign-in.
4. A signed-in customer without a delivered order for the product sees the "after your order is delivered" state and no form.
5. A delivered buyer submits a review. It appears on `/account/reviews` as "Awaiting approval" and not yet on the product page. After an admin publishes it, it appears on the product page (within the revalidation).
6. Editing a published review returns it to "Awaiting approval" and removes it from the storefront. Deleting removes it everywhere.
7. "Ready to review" lists delivered products not yet reviewed, and a product drops off it once reviewed.
8. `/account/profile` shows Clerk's profile and security screens in Goreto styling, and its subpages (`/account/profile/security`) load on refresh.
9. The nav shows Profile → Reviews and Profile & security with `aria-current`. There is no horizontal scroll at 375px, and everything is keyboard-reachable with visible focus.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run db:push && npm run db:types
npm run build      # load .env.local first so prerender targets dev (prod lacks this migration)
npm run dev        # signed-out pass by script; the signed-in pass needs a Clerk test user
```

## Manual test steps

1. `npm run dev`. Open a seeded product with reviews: check the summary, breakdown, 4 cards and "See all"; page through `/products/<slug>/reviews?page=2`.
2. Signed out, click Write a review: the sign-in modal opens; sign in and you land on `/account/reviews/<slug>`.
3. As a customer with no delivered order for it, you see the not-eligible state.
4. As a customer with a delivered order (seed customer or a test order you deliver in admin), open `/account/reviews`: the product is under Ready to review. Write a review and confirm it shows "Awaiting approval".
5. In `/admin/reviews`, publish it; reload the product page and the review is listed.
6. Edit it: it's back to Awaiting approval and gone from the product page. Delete it: it's gone from the account list.
7. Open `/account/profile`, then Security; refresh on the security subpage.
8. Resize to 375px and tab through the reviews pages and the form (arrow keys move the star choice).

## Rollback

Revert the commit and roll back the migration as above. Reviews written meanwhile remain valid rows under the old schema.

## Changes made during execution

- **No `reviewsHref` prop.** `ProductPurchase` already has `variant: "page" | "quick-view"`, so on the page layout the rating links to `#reviews`, and quick view keeps plain text.
- The migration starts with `drop policy if exists "reviews: own delete"`. The old hosted dev database already had a policy of that name, created outside migrations.
  - Its regenerated types also listed `account_submit_review`, `account_update_review`, `account_delete_review` and `account_reviewable_items`, which no file in git defines. A reviews implementation was applied to the old dev DB from code that isn't in this repository.
  - That database was retired the same day (see `goreto-supabase-account-migration.md`).
- The pure mappers live in `src/features/reviews/mappers.ts`, beside `queries.ts`, so they can be unit-tested without `server-only`.
- `formatNepalDate(iso)` was added to `src/features/orders/format.ts` for "18 Mar 2025" dates in Nepal time.
- `ReviewStatusPill` sits in `account-ui.tsx` and shares the tone map with `PaymentStatusPill`, now named `pillTones`.
- The account list shows only "Written {date}". `updated_at` also moves when staff moderate, so it can't stand for "edited".
- The star radios carry `aria-describedby` for the error but not `aria-invalid`, which jsx-a11y rejects on radios.
- The all-reviews page reuses `AccountPagination`, which works for any path.

### Verification

- `npm run typecheck` passes, after `npx next typegen` for the new routes. `npx eslint src tests scripts` is clean.
- `npm run lint` reports 3 errors in `prompts/.apply-vscode-animation.cjs`, an untracked file from another session that this work doesn't touch.
- `npm test`: 91 files, 644 tests. `npm run test:db`: 18 files, 324 tests, including 18 new ones in `tests/db/reviews.test.ts`; `tests/db/rls.test.ts` now expects unverified inserts to be rejected.
- `npm run build` passes, and `/products/[slug]` is still SSG.
- `scripts/seed/seed.test.ts` failed once on this machine because `core.autocrlf=true` checked `seed.ndjson` out with CRLF. `npm run seed:generate` rewrote it byte-identical in content (LF), and the test passes.
- Dev server, signed out:
  - the product page shows the summary, breakdown, 4 reviews, "See all 18 reviews" and `#reviews`;
  - `/products/<slug>/reviews?page=2` shows "Page 2 of 2", and `?page=99` returns 404;
  - the empty state appears for a product without reviews;
  - the account routes redirect to sign-in with the right `redirect_url`;
  - at a true 375px (iframe) nothing scrolls sideways.
- **Signed in** (owner, through a Clerk sign-in token on the dev instance): the screenshots show `/account/reviews` empty, the write page's not-eligible state, Profile & security (`<UserProfile />` in the shell), and, with a delivered seed order lent to the owner and then given back, "Ready to review" and the eligible form.
- **Not run:** submitting and deleting through the browser. Headless screenshots can't click; `submit_review` and delete are covered by the DB tests.
