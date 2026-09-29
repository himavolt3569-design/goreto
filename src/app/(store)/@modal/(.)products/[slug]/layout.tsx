import type { ReactNode } from "react";
import { QuickViewModal } from "@/components/store/quick-view/quick-view-modal";

/**
 * Quick view (AGENTS §4.3): a client navigation to a product from a storefront
 * page lands here instead of the full page. The shell stays mounted while the
 * content streams in, so the dialog opens at once and keeps its focus.
 */
export default async function QuickViewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <QuickViewModal href={`/products/${slug}`}>{children}</QuickViewModal>;
}
