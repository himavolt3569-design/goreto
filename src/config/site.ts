/**
 * Static storefront navigation and brand copy. Non-secret store settings will
 * move to the settings singleton (AGENTS §11.9) once it exists.
 */

import { features, type FeatureName } from "./features";

/** `feature` hides the link while that feature is unfinished (src/config/features.ts). */
export type SiteLink = { label: string; href: string; feature?: FeatureName };

/** The links whose feature is ready (or that need none). */
export function visibleLinks(links: readonly SiteLink[], enabled: Record<FeatureName, boolean> = features): SiteLink[] {
  return links.filter((link) => !link.feature || enabled[link.feature]);
}

export type SocialPlatform = "instagram" | "youtube" | "pinterest";

export type ProductAssurance = {
  icon: "delivery" | "returns" | "cod";
  title: string;
  caption: string;
};

export const siteConfig = {
  name: "Goreto.store",
  tagline: "Style it. See it. Love it.",

  mainNav: [
    { label: "Categories", href: "/categories" },
    { label: "AR Try-On", href: "/try-on", feature: "arTryOn" },
    { label: "New Arrivals", href: "/search?sort=newest" },
    { label: "Collections", href: "/collections" },
    { label: "Offers", href: "/offers", feature: "offers" },
  ] satisfies SiteLink[],

  footerNav: [
    { label: "Shop", href: "/search" },
    { label: "Categories", href: "/categories" },
    { label: "AR Try-On", href: "/try-on", feature: "arTryOn" },
    { label: "Help", href: "/help", feature: "infoPages" },
    { label: "About", href: "/about", feature: "infoPages" },
  ] satisfies SiteLink[],

  legalNav: [
    { label: "Privacy", href: "/privacy", feature: "infoPages" },
    { label: "Terms", href: "/terms", feature: "infoPages" },
    { label: "Cookies", href: "/cookies", feature: "infoPages" },
  ] satisfies SiteLink[],

  /**
   * Reassurance row under the product page's buy buttons. The reference's
   * "Free Delivery" and "Secure Payment" claims are replaced with true ones:
   * delivery fees depend on the address and payment is Cash on Delivery only.
   */
  productAssurances: [
    { icon: "delivery", title: "Delivery across Nepal", caption: "Fees shown at checkout" },
    { icon: "returns", title: "Easy Returns", caption: "7-day returns" },
    { icon: "cod", title: "Cash on Delivery", caption: "Pay when it arrives" },
  ] satisfies ProductAssurance[],

  /**
   * Store-wide policy copy for the product page accordions.
   * TODO(owner): confirm the 7-day returns policy wording.
   */
  policies: {
    shipping:
      "We deliver across Nepal with our courier partners. The delivery services available for your address, and their fees, are shown at checkout. Your order confirmation includes an estimated delivery range and tracking updates.",
    returns:
      "Changed your mind? Unworn items in their original packaging can be returned within 7 days of delivery. Contact support with your order number to arrange a return. Orders are paid by Cash on Delivery, so refunds are arranged with you directly.",
  },

  /**
   * Official profile URLs. Icons render only for platforms with a URL, so no
   * handle is ever invented. Fill these in when the accounts exist.
   */
  social: {
    instagram: null,
    youtube: null,
    pinterest: null,
  } satisfies Record<SocialPlatform, string | null>,
};
