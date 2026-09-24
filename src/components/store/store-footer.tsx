import Link from "next/link";
import type { Icon } from "@/components/ui/icons";
import { siteConfig, type SocialPlatform } from "@/config/site";
import {
  ICON_SIZE,
  ICON_WEIGHT_OUTLINE,
  iconButtonClasses,
  InstagramLogoIcon,
  Logo,
  PinterestLogoIcon,
  YoutubeLogoIcon,
} from "@/components/ui";

const socialMeta: Record<SocialPlatform, { label: string; icon: Icon }> = {
  instagram: { label: "Instagram", icon: InstagramLogoIcon },
  youtube: { label: "YouTube", icon: YoutubeLogoIcon },
  pinterest: { label: "Pinterest", icon: PinterestLogoIcon },
};

const linkClasses =
  "rounded-xs text-body text-neutral-700 transition-colors hover:text-primary-500";

export function StoreFooter() {
  const year = new Date().getFullYear();
  const socials = (Object.keys(socialMeta) as SocialPlatform[]).flatMap((platform) => {
    const href = siteConfig.social[platform];
    return href ? [{ platform, href, ...socialMeta[platform] }] : [];
  });

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 md:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <Logo href="/" showMark={false} />
            <p className="text-body text-neutral-500">{siteConfig.tagline}</p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-8 gap-y-3">
              {siteConfig.footerNav.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClasses}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {socials.length > 0 ? (
            <ul className="flex items-center gap-1" aria-label="Social media">
              {socials.map(({ platform, href, label, icon: SocialIcon }) => (
                <li key={platform}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (opens in a new tab)`}
                    className={iconButtonClasses({ variant: "ghost" })}
                  >
                    <SocialIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-neutral-500">
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <nav aria-label="Legal">
            <ul className="flex gap-6">
              {siteConfig.legalNav.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded-xs text-small text-neutral-500 transition-colors hover:text-primary-500"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
