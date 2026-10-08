"use client";

import Link from "next/link";
import { ClerkLoading, Show, SignInButton } from "@clerk/nextjs";
import { buttonClasses, type ButtonVariant } from "@/components/ui/button";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { PencilSimpleIcon } from "@/components/ui/icons";

export function writeReviewHref(productSlug: string): string {
  return `/account/reviews/${productSlug}`;
}

/**
 * "Write a review" on the cached product page. Signed in, it links to the
 * write page, which checks the verified-buyer rule on the server. Signed out,
 * it opens Clerk's sign-in modal and continues there afterwards.
 */
export function WriteReviewButton({ productSlug, variant = "secondary" }: { productSlug: string; variant?: ButtonVariant }) {
  const href = writeReviewHref(productSlug);
  const classes = buttonClasses({ variant, size: "md", className: "w-fit" });
  const label = (
    <>
      <PencilSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
      Write a review
    </>
  );
  const link = (
    <Link href={href} className={classes}>
      {label}
    </Link>
  );

  return (
    <>
      <ClerkLoading>{link}</ClerkLoading>
      <Show when="signed-in">{link}</Show>
      <Show when="signed-out">
        <SignInButton mode="modal" forceRedirectUrl={href} signUpForceRedirectUrl={href}>
          <button type="button" className={classes}>
            {label}
          </button>
        </SignInButton>
      </Show>
    </>
  );
}
