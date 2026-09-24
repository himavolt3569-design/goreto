import { siteConfig } from "@/config/site";
import { CartButton, Logo, NavItem, SearchInput } from "@/components/ui";
import { HeaderAuth, HeaderWishlist } from "./header-auth";
import { MobileNav } from "./mobile-nav";

export function StoreSearchForm({ className }: { className?: string }) {
  return (
    <form action="/search" method="get" role="search" className={className}>
      <SearchInput
        name="q"
        aria-label="Search products"
        placeholder="Search products..."
        autoComplete="off"
      />
    </form>
  );
}

export function StoreHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-8 lg:gap-8">
        <Logo href="/" showMark={false} className="shrink-0" />

        <nav aria-label="Main" className="hidden flex-1 items-center gap-2 lg:flex">
          {siteConfig.mainNav.map((link) => (
            <NavItem key={link.href} href={link.href}>
              {link.label}
            </NavItem>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <StoreSearchForm className="mr-2 hidden w-56 md:block xl:w-64" />
          <HeaderWishlist className="hidden sm:inline-flex" />
          {/* No cart store yet: show the true (empty) count rather than a fake badge. */}
          <CartButton href="/cart" count={0} />
          <HeaderAuth />
          <MobileNav links={siteConfig.mainNav}>
            <StoreSearchForm />
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
