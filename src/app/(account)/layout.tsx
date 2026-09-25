import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";

/** Signed-in customer area (AGENTS §4.9). Same storefront chrome as (store). */
export default function AccountLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <StoreHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <StoreFooter />
    </>
  );
}
