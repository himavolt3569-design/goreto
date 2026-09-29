import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";

export default function StoreLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <>
      <StoreHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <StoreFooter />
      {/* Product quick view (intercepted /products/[slug]); null otherwise. */}
      {modal}
    </>
  );
}
