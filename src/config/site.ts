/**
 * Static storefront navigation and brand copy. Non-secret store settings will
 * move to the settings singleton (AGENTS §11.9) once it exists.
 */

export type SiteLink = { label: string; href: string };

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
    { label: "AR Try-On", href: "/try-on" },
    { label: "New Arrivals", href: "/search?sort=newest" },
    { label: "Collections", href: "/collections" },
    { label: "Offers", href: "/offers" },
  ] satisfies SiteLink[],

  footerNav: [
    { label: "Shop", href: "/search" },
    { label: "Categories", href: "/categories" },
    { label: "AR Try-On", href: "/try-on" },
    { label: "Help", href: "/help" },
    { label: "About", href: "/about" },
  ] satisfies SiteLink[],

  legalNav: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Cookies", href: "/cookies" },
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
