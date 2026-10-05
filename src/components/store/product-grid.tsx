import { ChooseOptionsLink } from "@/components/store/product-card-actions";
import { WishlistButton } from "@/components/store/wishlist-button";
import { ProductCard } from "@/components/ui/product-card";
import type { ProductSummary } from "@/features/catalog/types";

/** The storefront listing grid (category, search): 2 / 3 / 5 columns of rated product cards. */
export function ProductGrid({ products }: { products: readonly ProductSummary[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {products.map((product) => (
        <li key={product.slug} className="flex">
          <ProductCard
            title={product.title}
            href={`/products/${product.slug}`}
            pricePaisa={product.pricePaisa}
            image={product.image}
            pick={product.isPick}
            rating={product.rating ?? undefined}
            className="w-full"
            wishlistAction={<WishlistButton slug={product.slug} productTitle={product.title} />}
            cartAction={<ChooseOptionsLink slug={product.slug} title={product.title} />}
          />
        </li>
      ))}
    </ul>
  );
}
