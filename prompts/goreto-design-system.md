# Implement the Goreto.store Design System

## Goal

Turn `designs/Goreto-designsystem.png` into code: Tailwind v4 design tokens, fonts, an icon convention, and a set of reusable, accessible UI primitives and card/navigation components in `components/ui`. Add a dev-only `/design-system` page that renders every section of the reference so it can be compared visually.

## Non-goals

- Homepage, product, checkout, confirmation, or admin pages. Each gets its own task later.
- Supabase, auth, data fetching, cart state, or any business logic.
- Working category dropdown, search, wishlist, or cart behaviour. The nav and cards are presentational and take link/action slots.
- Dark mode. The reference is light only, so the boilerplate `prefers-color-scheme: dark` block is removed.
- Prettier, Playwright, or E2E setup.

## What I inspected

- `package.json`: Next 16.3.6, React 19.2.8, Tailwind 4.3.3 (`@tailwindcss/postcss`), ESLint 9 with `eslint-config-next`, npm lockfile. There are no test tooling, no icon library, and no UI libs.
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`: untouched create-next-app boilerplate (Geist fonts, zinc colours, dark mode).
- `tsconfig.json`: strict mode, `@/*` → `./*`. There is no `src/` directory yet.
- `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`.
- Design references: `Goreto-designsystem.png` (primary), plus `goreto-home.png` and `goreto-admin.png` for how the tokens are used in context. The admin screenshot confirms the lakh number grouping (`Rs. 1,24,580`) and the order-status pill colours (Pending amber, Processing blue, Shipped/Delivered green, Canceled red).
- Local Next docs read: `01-getting-started/13-fonts.md`, `02-components/font.md` (the Tailwind CSS-variable pattern), `01-getting-started/11-css.md`, `03-file-conventions/src-folder.md`, `05-config/.../optimizePackageImports.md`, `02-guides/testing/vitest.md`.
- Tailwind v4 `theme.css`: the default radius scale conflicts with ours (`rounded-md` is 6px by default), so it must be overridden. `--text-*--font-weight` is supported. `--spacing: 0.25rem` already gives the 4px base.
- Skills: only `supabase` and `supabase-postgres-best-practices` are installed. Neither applies because this task has no database work.

## Decisions

1. **Move to `src/` now.** The repo is still pure boilerplate and AGENTS.md §19 targets `src/`. Move `app/` to `src/app/` and update `tsconfig` paths to `@/*` → `./src/*`. `public/` stays at the root.
2. **Tokens live in `src/app/globals.css` under `@theme`.** Reset the Tailwind defaults with `--color-*: initial`, `--radius-*: initial`, and `--shadow-*: initial`, so off-system classes such as `bg-zinc-50` or `rounded-3xl` generate no CSS.
   - Colours: `primary-100..500` and `neutral-50..900` with the reference hex values, plus `white` and `black`.
   - Colours added beyond the reference, each documented in the CSS:
     - `primary-600 #EA580C`: primary button hover. The reference hover is visibly darker than 500.
     - `primary-700 #C2410C`: small orange text on tinted surfaces such as badges, for readable contrast.
   - Semantic tokens, each with a `-50` tint and a `-600`/`-700` foreground, matching the reference pills:
     - `success`: green, used for In Stock, COD, Delivered, and Active.
     - `warning`: amber, used for Low Stock, Pending, and the rating star.
     - `error`: red, used for Sold Out and Canceled.
     - `info`: blue, used for AR Ready and Processing.
     - `limited`: violet, used for the LIMITED badge.
   - Type: `text-display-1` (48/56 bold), `text-display-2`, `text-h1`, `text-h2`, `text-h3`, `text-body-lg`, `text-body`, and `text-small`, with line-height and weight baked in. Font families are `font-display` (Playfair Display) and `font-sans` (Inter).
   - Radius: `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`. `rounded-full` is built in.
   - Shadows: `sm`, `md`, `lg`, and `xl`, with the exact reference values.
   - Body: `bg-neutral-50 text-neutral-900 font-sans`.
3. **Fonts: load Inter and Playfair Display from `next/font/google`** as CSS variables on `<html>`, replacing Geist.
4. **Icons: Phosphor (`@phosphor-icons/react`).**
   - Server components import from `@phosphor-icons/react/ssr`. Client components import from the package root.
   - Defaults are `size 24`, outline weight `bold` (about 2px at 20–24px, per the spec), and `fill` weight for active states. These live as constants in `src/components/ui/icon.ts`.
   - Add `@phosphor-icons/react` to `experimental.optimizePackageImports`. It is not in Next's default list.
5. **Class utility: add `cn()` in `src/lib/utils/cn.ts`**, built on `clsx` and `tailwind-merge`. This lets a caller's `className` override primitive defaults safely. `tailwind-merge` gets a config extension so it recognises the custom `text-*` size tokens.
6. **Primitives are server-compatible and use no `"use client"`.** Icons and actions are passed as `ReactNode` slots, not component props, so everything works across the RSC boundary. `buttonClasses()` is exported so a `next/link` element can be styled as a button without a Slot dependency.
7. **Money: add `formatNpr(paisa)` in `src/lib/money/format.ts`.** It returns `Rs. 2,499` using `en-IN` lakh grouping and shows paisa only when non-zero. Product cards take a price in paisa.
8. **The `/design-system` page is dev-only.** It calls `notFound()` when `NODE_ENV === "production"` and sets `robots: noindex`. It uses neutral image placeholders because no product photography exists in the repo, and I will not hotlink stock images.
9. **Replace the homepage placeholder.** The boilerplate `page.tsx` becomes a minimal branded placeholder (logo plus a "Storefront coming soon" line) so no zinc or Geist boilerplate is left. The real homepage is a separate task.
10. **Test tooling follows the Next Vitest guide:** `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, and `vite-tsconfig-paths`. Add the scripts `typecheck` (`tsc --noEmit`) and `test` (`vitest run`).

## Known conflict with accessibility

In the reference, white text on `primary-500 #F97316` (the primary button) and `#F97316` text on white (the text button) are about 2.8:1. That is below WCAG AA's 4.5:1 for 14–16px text. I will keep the reference colours, because AGENTS.md forbids recolouring, and flag this for a decision. Badge text uses `primary-700` because the reference badge text already reads darker than the fill.

## Files to change

```text
app/                                 -> moved to src/app/
src/app/layout.tsx                   Inter + Playfair via next/font, metadata, body classes
src/app/globals.css                  @theme tokens (colour/type/radius/shadow/fonts), base styles, focus ring
src/app/page.tsx                     minimal branded placeholder
src/app/design-system/page.tsx       dev-only living style guide (sections 01–14)
src/components/ui/icon.ts            icon size/weight constants
src/components/ui/button.tsx         Button + buttonClasses(); variants primary|secondary|tertiary|text; sizes lg|md; disabled/loading
src/components/ui/icon-button.tsx    square icon-only button with required aria-label; sizes md(44)|sm(40)
src/components/ui/field.tsx          Field wrapper: label, hint, inline error; wires id/aria-describedby/aria-invalid
src/components/ui/input.tsx          Input (44px, 12px radius, #E2E8F0 border, orange focus) with leading/trailing slots
src/components/ui/search-input.tsx   Input preset: magnifier icon, type=search, optional trailing action
src/components/ui/select.tsx         styled native <select> with caret icon
src/components/ui/badge.tsx          NEW | BESTSELLER | LIMITED | COD | AR READY (+ neutral)
src/components/ui/status.tsx         StatusIndicator (in stock, low stock, sold out, now playing, AR live) + OrderStatusPill (pending…canceled); always text + dot/icon
src/components/ui/progress-bar.tsx   role=progressbar with label and "N% complete"
src/components/ui/rating.tsx         filled star + value + (count), accessible label
src/components/ui/card.tsx           base Card surface (white, neutral-200 border, radius lg, shadow-sm)
src/components/ui/product-card.tsx   image, badge, title, rating, price (paisa), link + action slots
src/components/ui/lookbook-card.tsx  image, title, subtitle, arrow link
src/components/ui/video-card.tsx     poster, Now Playing pill, play affordance, title, duration
src/components/ui/resource-card.tsx  thumbnail, file icon, title, description, meta, external link
src/components/ui/logo.tsx           bag icon + "Goreto" / ".store" wordmark
src/components/ui/nav-item.tsx       nav link with icon + active underline (aria-current)
src/components/ui/cart-button.tsx    cart icon link with count badge (accessible count)
src/components/ui/index.ts           barrel export
src/lib/utils/cn.ts                  clsx + tailwind-merge (custom text tokens registered)
src/lib/money/format.ts              formatNpr(paisa)
src/lib/money/format.test.ts
src/components/ui/__tests__/*.test.tsx   Button, Field/Input, Badge/Status, ProgressBar, ProductCard
vitest.config.mts, vitest.setup.ts
tsconfig.json                        paths -> ./src/*
next.config.ts                       optimizePackageImports
package.json / package-lock.json     deps + scripts
```

## Database, auth, and RLS impact

None.

## Security and validation

There is no untrusted input. The design-system page is excluded from production builds. No secrets are involved.

## Acceptance criteria

- Every token in AGENTS.md §3.1–3.5 exists as a Tailwind utility with the exact reference value. Default Tailwind colours, radii, and shadows are unavailable.
- Inter is the body font, and Playfair Display is available as `font-display`. No Geist remains.
- The Button renders all 4 variants in default, hover, focus-visible, and disabled states at 44px high with 12px radius, with 16px padding at `lg` and 12px at `md`, and an 8px icon gap.
- Inputs, search, and select match the field spec: 44px, 12px radius, 1px `#E2E8F0` border, 16px padding, orange focus. Label and error are separate from the placeholder, and the error is linked through `aria-describedby`.
- Badges, statuses, and order pills always include readable text.
- The ProgressBar exposes `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- The cards and navigation visually match sections 12–13 of the reference.
- `/design-system` in dev shows sections 01–14 in reference order, and a side-by-side comparison with the PNG holds up. The page is usable at 375px width with no horizontal scroll.
- Icon-only controls have accessible names, and focus rings are visible on every interactive element.

## Checks to run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run dev   # then open /design-system and compare with designs/Goreto-designsystem.png (desktop + 375px)
```

## Manual test steps

1. Run `npm run dev` and open `http://localhost:3000/design-system`.
2. Compare each numbered section against `designs/Goreto-designsystem.png`: swatches and hex labels, type scale, spacing blocks, radius and shadow tiles, icon grid (outline and filled), buttons (hover and disabled), inputs, badges, statuses, progress bar, the four cards, the nav bar, and principles.
3. Tab through the page. Each button, input, select, and link should show a visible orange focus ring. Disabled buttons should be skipped.
4. Resize to 375px. Sections should stack with no horizontal page scroll.
5. Open `/`. You should see a branded placeholder in Inter/Playfair on the `neutral-50` surface.
6. Run `npm run build && npm start`. `/design-system` should return 404 in production.

## Rollback

Everything is additive except the `src/` move and the boilerplate replacement. Rolling back means reverting the commit. There is no data impact.

## Changes made during execution

- **Icons are imported through `src/components/ui/icons.ts`.** It deep-imports each Phosphor icon (`@phosphor-icons/react/dist/ssr/<Name>`). Importing the `/ssr` barrel loaded all ~1,500 icons, which made the test run take 82s instead of 2s. Next's `optimizePackageImports` matches package names and may not cover the `/ssr` subpath, so I did not add it and `next.config.ts` is unchanged. The logo mark is `HandbagSimpleIcon` (fill).
- **Vitest is pinned to `^4`.** Vitest 5 needs `@types/node` 22 or newer, and the repo pins `^20`. `vite-tsconfig-paths` was dropped in favour of Vite's native `resolve.tsconfigPaths`.
- **Buttons set `[&_svg]:shrink-0`.** Browser verification showed icons shrinking to nothing inside narrow grid cells.
- **The design-system page layout changed for readability.** Icons take 4 columns and Buttons 8. Inputs span two rows beside Badges, Progress, and Status (`grid-flow-dense`). The type specimens moved into section 02.
