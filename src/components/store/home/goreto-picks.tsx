import { ChooseOptionsLink } from "@/components/store/product-card-actions";
import { WishlistButton } from "@/components/store/wishlist-button";
import { PICK_LABEL, PickBadge } from "@/components/ui/pick-badge";
import { ProductCard } from "@/components/ui/product-card";
import { SectionHeading } from "@/components/ui/section-heading";
import type { HomeProduct } from "@/features/catalog/types";

/**
 * Homepage section listing the products staff flagged as sponsored
 * (`products.is_sponsored`), under the neutral "Goreto Picks" name the client
 * chose. Renders nothing when there are none.
 */
export function GoretoPicks({ products }: { products: readonly HomeProduct[] }) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="picks-title" className="mx-auto w-full max-w-7xl px-4 pt-12 md:px-8 md:pt-16">
      <SectionHeading
        id="picks-title"
        eyebrow="Hand-selected"
        title={`${PICK_LABEL}s`}
        description={
          <>
            Standout pieces from our edit, marked with <PickBadge size={16} /> across the store.
          </>
        }
      />
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {products.map((product) => (
          <li key={product.slug} data-animate="reveal" className="flex">
            <ProductCard
              title={product.title}
              href={`/products/${product.slug}`}
              pricePaisa={product.pricePaisa}
              image={product.image}
              pick
              className="w-full"
              wishlistAction={<WishlistButton slug={product.slug} productTitle={product.title} />}
              cartAction={<ChooseOptionsLink slug={product.slug} title={product.title} />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
