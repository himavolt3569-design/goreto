import type { Metadata } from "next";
import { AccountNav } from "@/components/store/account/account-nav";

export const metadata: Metadata = {
  title: { default: "Your account", template: "%s · Account | Goreto.store" },
  robots: { index: false, follow: false },
};

/**
 * Account shell (AGENTS §4.9): grouped navigation beside the page. It doesn't
 * authorize: layouts don't re-render on client navigation, so every account
 * page calls requireProfile() itself.
 */
export default function AccountSectionLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-16 pt-6 md:px-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
      <aside className="min-w-0 lg:pt-12">
        <AccountNav />
      </aside>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}
