import Link from "next/link";
import type { ReactNode } from "react";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { MagnifyingGlassIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { AdminMobileNav } from "./mobile-nav";
import { HeaderSearch } from "./header-search";
import { NotificationsMenu, ProfileMenu, QuickActionsMenu, type AttentionItem, type ProfileSummary, type QuickAction } from "./header-menus";
import { SidebarNav } from "./sidebar-nav";

export type AdminShellProps = {
  allowedHrefs: readonly string[];
  attention: AttentionItem[] | null;
  quickActions: QuickAction[];
  profile: ProfileSummary;
  children: ReactNode;
};

/**
 * Admin chrome from designs/goreto-admin.png: fixed topic-grouped sidebar
 * from `lg` up (a drawer below), header with search, notifications, quick
 * actions and profile, and the page footer.
 */
export function AdminShell({ allowedHrefs, attention, quickActions, profile, children }: AdminShellProps) {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-1">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-body font-medium text-primary-600 shadow-md focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 overflow-y-auto border-r border-neutral-200 bg-white px-4 py-6 lg:flex">
        <Logo href="/admin" className="px-2" />
        <SidebarNav allowedHrefs={allowedHrefs} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-neutral-200 bg-neutral-50">
          <div className="flex h-16 items-center gap-2 px-4 md:gap-4 md:px-8">
            <AdminMobileNav allowedHrefs={allowedHrefs} />
            <Logo href="/admin" showMark={false} className="hidden sm:inline-flex lg:hidden" />
            <HeaderSearch className="ml-auto hidden w-full max-w-md md:flex" />
            <div className="ml-auto flex items-center gap-2 md:ml-0">
              <Link href="/admin/search" aria-label="Search" className={iconButtonClasses({ variant: "ghost", className: "md:hidden" })}>
                <MagnifyingGlassIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
              </Link>
              <NotificationsMenu items={attention} />
              {quickActions.length > 0 ? <QuickActionsMenu actions={quickActions} /> : null}
              <ProfileMenu profile={profile} />
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex flex-1 flex-col gap-6 px-4 py-6 outline-none md:px-8 md:py-8">
          {children}
        </main>

        <footer className="flex flex-col gap-2 border-t border-neutral-200 px-4 py-4 text-small text-neutral-500 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p>© {year} Goreto.store. All rights reserved.</p>
          <nav aria-label="Admin footer">
            <Link href="/admin/support" className="rounded-xs hover:text-primary-600">
              Help
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
