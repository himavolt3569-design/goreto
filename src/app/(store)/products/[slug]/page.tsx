import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ui/product-card";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { accordionIcons, ProductAccordions } from "@/components/store/product/product-accordions";
import { ProductPurchase } from "@/components/store/product/product-purchase";
import { ProductRail } from "@/components/store/product/product-rail";
import { ProductSpecs } from "@/components/store/product/product-specs";
import { TryOnCard } from "@/components/store/product/try-on-card";
import { ChooseOptionsLink, WishlistSoonButton } from "@/components/store/product-card-actions";
import { siteConfig } from "@/config/site";
import {
  getProductBySlug,
  getProductSlugs,
  getRelatedProducts,
} from "@/features/catalog/product-detail";

/** Catalog data is cached and refreshed at most once a minute (ISR). */
export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return { title: product.title, description: product.shortDescription };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-6 md:px-8 lg:gap-12">
      <div className="flex flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: product.category.title, href: `/categories/${product.category.slug}` },
            { label: product.title },
          ]}
        />

        <ProductPurchase
          product={{
            slug: product.slug,
            title: product.title,
            badge: product.badge,
            rating: product.rating,
            shortDescription: product.shortDescription,
            basePricePaisa: product.basePricePaisa,
            lowStockThreshold: product.lowStockThreshold,
            options: product.options,
            variants: product.variants,
            media: product.media,
          }}
        />
      </div>

      {product.tryOn ? (
        <section aria-labelledby="try-on-title">
          <TryOnCard productSlug={product.slug} tryOn={product.tryOn} />
        </section>
      ) : null}

      <section aria-label="Product information" className="grid items-start gap-6 lg:grid-cols-2">
        <ProductSpecs specs={product.specs} />
        <ProductAccordions
          sections={[
            {
              id: "description",
              title: "Description",
              icon: accordionIcons.description,
              content: <p>{product.description}</p>,
              defaultOpen: true,
            },
            {
              id: "shipping",
              title: "Shipping & Delivery",
              icon: accordionIcons.shipping,
              content: <p>{siteConfig.policies.shipping}</p>,
            },
            {
              id: "returns",
              title: "Returns & Refunds",
              icon: accordionIcons.returns,
              content: <p>{siteConfig.policies.returns}</p>,
            },
            {
              id: "care",
              title: "Care Instructions",
              icon: accordionIcons.care,
              content: <p>{product.careInstructions}</p>,
            },
          ]}
        />
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related-title">
          <ProductRail title="You May Also Like" titleId="related-title">
            {related.map((item) => (
              <li key={item.slug} className="flex snap-start">
                <ProductCard
                  title={item.title}
                  href={`/products/${item.slug}`}
                  pricePaisa={item.pricePaisa}
                  image={item.image}
                  rating={item.rating ?? undefined}
                  className="w-full"
                  wishlistAction={<WishlistSoonButton productTitle={item.title} />}
                  cartAction={<ChooseOptionsLink slug={item.slug} title={item.title} />}
                />
              </li>
            ))}
          </ProductRail>
        </section>
      ) : null}
    </div>
  );
}
