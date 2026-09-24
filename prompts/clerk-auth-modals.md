# Open sign-in and sign-up as modals

## Goal

Sign in and Sign up open as Clerk modals over the current page instead of navigating to `/sign-in` or `/sign-up`. The shopper stays where they were, and after authenticating they land back on the same page.

## Non-goals

- Custom auth forms built with `useSignIn` / `useSignUp`. The modals use Clerk's prebuilt components with the existing Goreto theme.
- Account pages or admin work.
- Changing which routes are protected.

## What I inspected

- `src/components/store/header-auth.tsx`: `SignInButton` / `SignUpButton` use the default `mode="redirect"`. The account icon and the mobile-menu auth links are plain `Link`s to `/sign-in` and `/sign-up`.
- `src/components/store/store-header.tsx`: the wishlist heart links to `/account/wishlist`, which the proxy protects.
- `src/components/store/mobile-nav.tsx`: auth links are rendered inside the disclosure panel.
- `src/lib/auth/clerk-appearance.ts`: the token theme. No modal backdrop is set, and in Core 3 `colorModalBackdrop` renders at full opacity.
- `src/proxy.ts`: `auth.protect()` redirects signed-out visitors to `NEXT_PUBLIC_CLERK_SIGN_IN_URL`.
- Clerk docs for `SignInButton` (`mode: 'redirect' | 'modal'`, `forceRedirectUrl`, `fallbackRedirectUrl`) and `SignIn` (`withSignUp`). The docs don't say whether the "Sign up" link inside the sign-in modal switches modals in place. I'll check that in the browser.

## Decisions

1. **Every in-page trigger opens a modal.** This covers the header Sign in / Sign up buttons, the account icon shown below `xl`, and the mobile-menu "Sign in" / "Create account" items. They all use `mode="modal"`. The mobile items become `<button>`s styled like the menu links. The menu closes before the modal opens, so focus doesn't return into a hidden panel.
2. **Signed-out wishlist heart opens the sign-in modal.** After sign-in it goes to `/account/wishlist`, using `forceRedirectUrl` and `signUpForceRedirectUrl`. Signed in, it stays a normal link.
3. **Keep `/sign-in` and `/sign-up` as fallback pages.** They still handle:
   - redirects from protected routes (`/account`, `/admin`);
   - direct and shared links;
   - Clerk's email-link and OAuth return steps.

   They are no longer the normal path.
4. **Modal backdrop.** Set `colorModalBackdrop: "rgba(15, 23, 42, 0.5)"` (neutral-900 at 50%). This is a soft dim with no blur or glass effect, per §3.5. The modal card keeps the existing token theme.
5. **Switching between sign-in and sign-up.** If Clerk's in-modal "Sign up" / "Sign in" link navigates to the full page instead of switching in place, I set the sign-in modal to the combined sign-in-or-up flow (`withSignUp`). That way a new user can finish sign-up inside the modal. I'll decide from browser behaviour, not memory.
6. **Accessibility.** Clerk's modal provides the dialog role, focus trap, Esc to close, and focus return. I'll verify these by keyboard. Triggers stay real `<button>`s at 44px with visible focus.

## Files expected to change

- `src/components/store/header-auth.tsx`
- `src/components/store/mobile-nav.tsx` (passes a close callback before the modal opens)
- `src/components/store/store-header.tsx` (wishlist heart becomes an auth-aware control)
- `src/lib/auth/clerk-appearance.ts` (`colorModalBackdrop`)
- `AGENTS.md` §9.3: one line saying in-page auth uses Clerk modals and the pages are fallbacks.

## Database / auth impact

None. Proxy protection is unchanged.

## Acceptance criteria

1. From `/`, clicking Sign in or Sign up opens a modal. The URL doesn't change.
2. Account icon, mobile menu items, and the signed-out wishlist heart also open the modal.
3. Sign-up can be completed without leaving the modal. Afterwards the header shows the user button on the same page.
4. Esc and the close button dismiss the modal, and focus returns to the trigger.
5. A signed-out visit to `/account` still redirects to the `/sign-in` page.
6. The backdrop is a soft dark dim, and the modal uses the orange primary, Inter, and 12px radius.

## Checks

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and a manual browser pass on the running dev server, including DOM/URL checks in headless Chromium.

## Manual test steps

1. On `/`, click **Sign in**. The modal opens and the URL stays `/`. Press Esc: it closes and focus returns to the button.
2. Click **Sign up** and create an account inside the modal. The avatar appears and you are still on `/`.
3. Sign out. Narrow the window, open the menu, and tap **Sign in**. The menu closes and the modal opens.
4. While signed out, click the heart. The sign-in modal opens. Sign in, and you are taken to `/account/wishlist`.
5. While signed out, visit `/account` directly. You are redirected to the `/sign-in` page.

## Rollback

Revert the listed files. The fallback pages are untouched.

## Implementation notes (post-approval)

- Decision 5 was resolved in the browser. Clerk's in-modal "Sign up" / "Sign in" footer links switch between the modals in place, and the URL stays `/`. `withSignUp` was not needed.
- The mobile-menu Wishlist item moved into `MobileNavAuthLinks`, so it is auth-aware like the header heart.
- Before Clerk loads, every trigger renders a plain link to the fallback page, so clicks never do nothing.
