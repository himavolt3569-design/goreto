/**
 * Static storefront navigation and brand copy. Non-secret store settings will
 * move to the settings singleton (AGENTS §11.9) once it exists.
 */

export type SiteLink = { label: string; href: string };

export type SocialPlatform = "instagram" | "youtube" | "pinterest";

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
   * Official profile URLs. Icons render only for platforms with a URL, so no
   * handle is ever invented. Fill these in when the accounts exist.
   */
  social: {
    instagram: null,
    youtube: null,
    pinterest: null,
  } satisfies Record<SocialPlatform, string | null>,
};
