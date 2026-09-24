# Implement the Goreto.store homepage

## Goal

Build the storefront homepage from `designs/goreto-home.png`. Every section in the reference is built in order, at desktop fidelity, with a sensible stacked layout on tablet and mobile. The page also gets a shared storefront header and footer.

The data comes from a typed, clearly marked **development seed catalog** exposed through `getHomepageData()`. A later Supabase catalog task replaces this function's body without changing the page.

Imagery comes from **Lorem Picsum**, served by its fixed image IDs through `next/image`. Picsum has no topic search, so I reviewed all ~990 images in its catalog and hand-picked the IDs that fit fashion and accessories. Because the seed is ours, its categories and products are named after what those photos actually show.

## Non-goals

- Supabase schema, migrations, RLS, or generated types. These belong to the catalog task.
- Cart store, add-to-cart, wishlist persistence, auth, and search results. The same goes for the pages behind the links: product, category, collection, try-on, account, and cart.
- Real AR. The hero's phone mockup is a decorative marketing illustration. Its "Try in AR" control is a link to `/try-on`.
- Newsletter persistence. There is no `newsletter_subscribers` table yet, so see decision 9.
- Playwright E2E setup.

## What I inspected

- `AGENTS.md` §3 (tokens), §4.1 (homepage contract), §7 (route groups), §8 (URL vs local state), §22 (a11y), §26 (fake data and trust traps).
- `prompts/goreto-design-system.md`: tokens, the icon convention (deep imports via `src/components/ui/icons.ts`), and `cn()`.
- `src/components/ui/*`: `Button` / `buttonClasses`, `IconButton` / `iconButtonClasses`, `Logo`, `NavItem`, `SearchInput`, `CartButton`, `ProductCard` (with wishlist and cart slots), `MediaFrame`, `Card`, `Badge`, `Field`, `Input`.
- `src/app/layout.tsx`: root layout with fonts. `src/app/page.tsx`: placeholder. `src/app/globals.css`: `@theme` tokens.
- `package.json`: Next 16.3.6, React 19.2.8, Tailwind 4, Vitest 4, and npm. `zod@4` is present only as a transitive dependency.
- There is no `src/lib/supabase` and no `public/images`.
- Local Next docs:
  - `01-getting-started/12-images.md` and `03-api-reference/02-components/image.md`. `remotePatterns` is required. Redirects are followed up to `maximumRedirects: 3` without re-checking patterns, which matters because Picsum redirects to `fastly.picsum.photos`. `qualities` defaults to `[75]` in Next 16.
  - `03-file-conventions/route-groups.md`.
  - `02-guides/forms.md`: Server Action with `useActionState`.
- Skills: only the `supabase` skills are installed. They don't apply because there is no DB work.

## Decisions

1. **Route group.** Move the homepage to `src/app/(store)/page.tsx`. Add `src/app/(store)/layout.tsx`, which renders `StoreHeader`, `{children}`, and `StoreFooter`. The root layout is unchanged. `/design-system` stays outside the group.

2. **Dev seed catalog.** It lives in `src/features/catalog/dev-seed.ts`, with a header comment saying it is dev-only seed data.
   - `getHomepageData()` in `src/features/catalog/homepage.ts` returns view models: categories, featured products, collections, and testimonials.
   - It returns the seed only when `NODE_ENV !== "production"`. In production it returns empty lists, and each section renders its empty state or is omitted.
   - This keeps fake products and, most importantly, fake "Verified Customer" testimonials out of production (AGENTS §26).
   - Prices are integer paisa and are formatted with `formatNpr`.

3. **Picsum images.**
   - Add `picsumImage(id, w, h)` in `src/lib/media/picsum.ts`. It returns `https://picsum.photos/id/{id}/{w}/{h}`.
   - `next.config.ts` gets `images.remotePatterns: [{ protocol: "https", hostname: "picsum.photos", pathname: "/id/**" }]`.
   - Chosen IDs:

     | Where | Picsum ID |
     | --- | --- |
     | Hero portrait | 1027 |
     | AR phone mockup | 64 (woman in aviators). Thumbnails: 26, 628, 823 |
     | Dresses | 325 |
     | Jewelry | 628 |
     | Bags | 7 |
     | Shoes | 21 |
     | Sunglasses | 26 |
     | Tops | 836 |
     | Outerwear | 669 |
     | Hats | 823 |
     | Scarves | 758 |
     | Boots | 604 |
     | Collections carousel | 758, 669, 1005 |
     | How-it-works | 832, with 628 as the inset |
     | Testimonial avatars | 832, 836, 996 |

4. **Seed content adapted to the photos.** Where Picsum has no match, the reference's categories and products are renamed instead of faked:
   - Beauty and Activewear become Hats, Scarves, and Boots.
   - Featured products:

     | Product | Category | Price |
     | --- | --- | --- |
     | Beaded Wrist Stack | jewelry | Rs. 1,799 |
     | Leather Weekender Bag | bags | Rs. 3,999 |
     | White Lace Sundress | dresses | Rs. 2,899 |
     | Aviator Sunglasses | accessories | Rs. 2,499 |
     | White Pointed Heels | shoes | Rs. 3,499 |

   - The tab labels match the reference exactly: All, Dresses, Jewelry, Bags, and Accessories.

5. **Featured tabs.** `FeaturedProducts` is a client component using the ARIA tabs pattern: arrow, Home, and End keys, with roving `tabIndex`.
   - The filter is local UI state. It is not in the URL, because this is a homepage merchandising widget rather than a search page (AGENTS §8).
   - An empty tab shows an empty state with a link to the category.

6. **Product card actions.** I reuse `ProductCard` as-is.
   - **Cart slot:** the orange bag button is a `Link` to `/products/[slug]` with the label "Choose options for {title}". Quick add without a variant choice would be wrong, and no cart exists yet.
   - **Wishlist slot:** the heart keeps its look, but it is an `aria-disabled` button titled "Wishlist coming soon". I chose this over a control that silently does nothing.

7. **Header.** Built from existing primitives.
   - The logo is the wordmark only (`showMark={false}`), as in the reference.
   - Nav items: Categories, AR Try-On, New Arrivals, Collections, and Offers.
   - Search is a GET `<form action="/search">` using `SearchInput name="q"`.
   - Wishlist and account are icon links. `CartButton` shows count `0`: there is no cart store yet, so I show no fake "1" badge.
   - Below `lg`, the nav collapses into a hamburger disclosure (`MobileNav`, a client component) with a close control, Escape to close, and focus returned to the toggle. Search moves into that panel.

8. **Collections carousel.** `CollectionCarousel` is a client component.
   - It has three slides with previous/next buttons and dot buttons that show `aria-current`.
   - It uses `aria-roledescription="carousel"`, and each slide is a labelled group.
   - There is no autoplay, so there is no motion to disable.

9. **Newsletter.**
   - `NewsletterForm` is a client component using `useActionState`. It calls a Server Action, `subscribeToNewsletter`, in `src/features/newsletter/actions.ts`.
   - The action validates the email with Zod, and `zod` is added as a direct dependency. It then returns an honest message: "Thanks! Newsletter signups open soon — we haven't stored your email yet."
   - It stores nothing. Invalid input shows an inline error through `Field`. Persistence is a later task.

10. **Testimonials.** They come only from the dev seed (decision 2). If there are none, the section is omitted.

11. **Footer.**
    - It has the wordmark, the tagline "Style it. See it. Love it.", the nav links, and legal links (Privacy, Terms, Cookies). The copyright year is computed at render.
    - Social icons (Instagram, YouTube, Pinterest) render only for URLs set in `src/config/site.ts`. They start empty, because I will not invent handles. **Until you add URLs, the reference's social icons won't appear.**

12. **Links to routes that don't exist yet.** These 404 until their tasks ship, which is expected for incremental delivery:
    - `/categories`, `/categories/[slug]`, `/products/[slug]`
    - `/collections/[slug]`, `/try-on`, `/search`
    - `/account`, `/account/wishlist`, `/cart`
    - `/offers`, `/help`, `/about`, `/privacy`, `/terms`, `/cookies`

13. **Hero.**
    - The background is a warm `primary-100` field. The portrait covers the right side, with a gradient fade into the background, and the phone mockup is overlaid.
    - The CTAs are `Shop Now` (primary, links to `#featured`) and `Try in AR` (secondary with a cube icon, links to `/try-on`).
    - The trust row has three icon + label + caption items.
    - On mobile, text comes first and the portrait follows at a fixed aspect ratio. The phone mockup is hidden below `md`.

14. **Section headings.** Add a shared `SectionHeading`: an orange uppercase eyebrow, a Playfair `text-display-2` title, and a `text-body-lg` neutral-500 subtitle, with an optional trailing action. It is used by six sections.

15. **New icons** added to `icons.ts`: CaretLeft, CaretRight, List, X, InstagramLogo, YoutubeLogo, PinterestLogo, CornersOut, Quotes, EnvelopeSimple, and DotsThree.

16. **GSAP motion** (added at approval time at your request). Add `gsap@^3.15` and `@gsap/react@^2`. GSAP is free for commercial use since 3.13, including ScrollTrigger.
    - Animations live only in homepage client components. Nothing is added to the global bundle or the root layout except a 1-line inline script.
    - **No-flash strategy**, following the local "preventing flash before hydration" guide:
      - An inline `<head>` script adds `js` to `<html>`. The `<html>` element gets `suppressHydrationWarning`.
      - CSS hides `.js [data-animate]` with `visibility: hidden` until GSAP reveals it by animating `autoAlpha`.
      - Without JavaScript, or with `prefers-reduced-motion: reduce`, the content is visible immediately.
      - A 3-second CSS fail-safe un-hides the content if GSAP never loads.
    - **`HomeMotion`** is a client wrapper around the page sections. It uses `useGSAP` with `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`.
      - Hero entrance: the copy fades up in a staggered sequence (eyebrow, title, text, CTAs, trust items). The portrait eases in from a slight scale, and the phone mockup rises in, then floats gently on a loop.
      - Scroll reveals: `ScrollTrigger.batch` fades each section and its cards up once, as they enter the viewport. This covers category circles, product cards, steps, testimonials, and the newsletter band.
    - **Featured tabs:** the cards stagger in when the tab changes.
    - **Carousel:** a GSAP crossfade plays when the slide changes, with the text sliding in and a slight settle on the image scale.
    - Under reduced motion there are no tweens and no looping float, and slide changes are instant.

## Files to change

```text
next.config.ts                                   images.remotePatterns (picsum.photos /id/**)
package.json / package-lock.json                 + zod (direct dep)
src/app/page.tsx                                 -> moved to src/app/(store)/page.tsx (homepage composition)
src/app/(store)/layout.tsx                       StoreHeader + main + StoreFooter
src/config/site.ts                               nav links, footer links, social URLs (empty), tagline
src/lib/media/picsum.ts (+ .test.ts)             picsumImage()
src/features/catalog/types.ts                    HomeCategory, HomeProduct, HomeCollection, Testimonial, HomepageData
src/features/catalog/dev-seed.ts                 DEV-ONLY seed data
src/features/catalog/homepage.ts (+ .test.ts)    getHomepageData(), FEATURED_TABS
src/features/newsletter/schema.ts (+ .test.ts)   zod email schema + state type
src/features/newsletter/actions.ts               "use server" subscribeToNewsletter
src/components/ui/icons.ts                       + icons listed above
src/components/ui/section-heading.tsx            SectionHeading (+ export in index.ts)
src/components/store/store-header.tsx            header (server)
src/components/store/mobile-nav.tsx              "use client" disclosure menu
src/components/store/store-footer.tsx            footer (server)
src/components/store/home/hero.tsx               hero + AR phone mockup + trust row
src/components/store/home/category-rail.tsx      category circles
src/components/store/home/featured-products.tsx  "use client" tabs + ProductCard grid
src/components/store/home/collection-carousel.tsx "use client" banner carousel
src/components/store/home/how-it-works.tsx       3 steps + image
src/components/store/home/testimonials.tsx       3 quote cards
src/components/store/home/newsletter.tsx         band + NewsletterForm ("use client" form part)
src/components/store/home/__tests__/*.test.tsx   featured tabs, carousel, newsletter form
```

## Database, auth, and RLS impact

None. There is no data persistence, and the Server Action stores nothing.

## Security and validation

- The newsletter email is validated server-side with Zod: it is trimmed, capped at 254 characters, and must be a valid email. Only a status message is returned.
- `remotePatterns` is limited to `picsum.photos` and the `/id/**` path.
- The search form is a plain GET, and nothing is interpolated into SQL.
- There are no secrets.

## UI reference and constraints

- The reference is `designs/goreto-home.png`, built in section order per AGENTS §4.1.
- Only design-system tokens are used: colours, `text-*` scale, 4px spacing, radii, and shadows.
- The container is `max-w-7xl` with `px-4 md:px-8`.
- Buttons and inputs are 44px. The card radius is `lg`, and the band and banner radius is `xl`.

## Acceptance criteria

- At about 1280px, the desktop page shows these sections in reference order, with composition closely matching the PNG:
  1. header
  2. hero
  3. trust row
  4. categories
  5. featured + tabs
  6. collection carousel
  7. how it works
  8. testimonials
  9. newsletter
  10. footer
- At 375px, sections stack with no horizontal page scroll. Only the category rail scrolls horizontally, and it snaps. The mobile nav opens and closes, and Escape works.
- Tabs filter the product grid and are operable with the keyboard. The carousel's previous, next, and dot controls change the slide and expose their current state.
- An invalid newsletter email shows an inline error. A valid one shows the honest "not stored yet" message.
- Every image has meaningful alt text, or empty alt text where it is decorative. Icon-only controls have names. Focus is visible everywhere.
- A production build renders the page without seed products or testimonials, and shows empty states instead.

## Checks to run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run dev   # screenshot / and compare with designs/goreto-home.png at 1280px and 375px (headless Chromium via npx playwright, not added to the project)
```

## Manual test steps

1. Run `npm run dev` and open `http://localhost:3000/`. Compare each section with `designs/goreto-home.png`.
2. Click the tabs All, Dresses, Jewelry, Bags, and Accessories. The grid should filter. Use the arrow keys on the tab list.
3. Use the carousel's previous, next, and dot controls. The slide and the active dot should change.
4. Submit the newsletter form with `abc` and check that an inline error appears. Submit `you@example.com` and check that the "signups open soon" message appears.
5. Resize to 375px, open the menu, press Escape, and check that focus returns to the menu button. There should be no horizontal page scroll.
6. Tab through the page and check that the focus ring is visible on every control.

## Changes made during execution

### Code organisation

- `FEATURED_TABS` and `filterByTab` moved to `src/features/catalog/featured-tabs.ts`. `FeaturedProducts` is a client component, and importing them from `homepage.ts` would have pulled the seed module into the client bundle.
- `FeaturedProducts` takes a `heading` prop, so the server-rendered `SectionHeading` sits beside the tabs, as in the reference.
- The newsletter form is a separate `newsletter-form.tsx` client component. Its test is `src/features/newsletter/actions.test.ts`, not `schema.test.ts`.
- `CheckCircle` was added to `icons.ts` for the newsletter success message.

### Hero and GSAP

- The hero portrait is `lg:w-[46%]`, rather than 60%, and uses a squarer Picsum crop (1000×1100). Picsum #1027 is a tall portrait, so a wide crop showed only the face.
- The phone mockup shows from `lg` up, rather than from `md`.
- The GSAP code lives in `src/components/motion/`:
  - `gsap.ts` registers the plugins and provides `prefersReducedMotion()`.
  - `home-motion.tsx` drives the hero timeline and the `ScrollTrigger.batch` reveals.
- The CSS fail-safe applies only until `HomeMotion` adds `.motion-ready` to `<html>`. That way it can't un-hide scroll-reveal targets before they animate.

### Fixes and test setup

- The category rail is `relative` and has `scroll-px-*` padding.
  - `relative` fixes a page-level horizontal overflow at 375px. The absolutely positioned `sr-only` text on "More" escaped the scroll container.
  - The padding stops the first circle from snapping flush to the screen edge.
- `vitest.setup.ts` gains a `matchMedia` stub, because jsdom has none and ScrollTrigger needs it at registration. The stub reports no match, so tests take the reduced-motion path.

### Verification

Browser checks used a scratchpad `playwright-core` script with the locally cached Chromium. Nothing was added to the project. All 19 checks pass:
- hero entrance
- tabs and their keyboard handling
- carousel previous/next and dots
- newsletter error and success
- visible focus ring
- hash-load reveal
- reduced motion
- no-JS visibility
- mobile menu and Escape
- no overflow at 375px

## Rollback

The work is additive, apart from moving `page.tsx` into `(store)`. To roll back, revert the commit. There is no data impact.
