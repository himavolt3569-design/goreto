import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountPagination } from "@/components/store/account/account-ui";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { RatingBreakdown } from "@/components/store/reviews/rating-breakdown";
import { ReviewCard } from "@/components/store/reviews/review-card";
import { WriteReviewButton } from "@/components/store/reviews/write-review-button";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { getProductBySlug } from "@/features/catalog/product-detail";
import { fetchReviewPage } from "@/features/reviews/queries";
import { pageNumber } from "@/lib/pagination/page";

export async function generateMetadata({ params }: PageProps<"/products/[slug]/reviews">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: `Reviews of ${product.title}`,
    description: `Customer reviews of ${product.title} from verified buyers.`,
    alternates: { canonical: `/products/${product.slug}` },
  };
}

/** Every published review of a product, 10 per page (`?page=`), without JavaScript. */
export default async function ProductReviewsPage({ params, searchParams }: PageProps<"/products/[slug]/reviews">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const page = pageNumber(query.page);
  const { breakdown, reviews } = await fetchReviewPage(product.slug, page);
  if (page > 1 && page > reviews.pageCount) notFound();
  const productHref = `/products/${product.slug}`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 md:px-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: product.category.title, href: `/categories/${product.category.slug}` },
          { label: product.title, href: productHref },
          { label: "Reviews" },
        ]}
      />
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-neutral-900">Reviews of {product.title}</h1>
        <Link href={productHref} className={buttonClasses({ variant: "text", size: "md", className: "h-8 w-fit px-0" })}>
          <ArrowLeftIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
          Back to product
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-8">
        <Card className="flex flex-col gap-6 p-6 lg:sticky lg:top-24">
          <RatingBreakdown breakdown={breakdown} />
          <WriteReviewButton productSlug={product.slug} />
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          {reviews.rows.length ? (
            <ul aria-label="Reviews" className="flex flex-col gap-4">
              {reviews.rows.map((review) => (
                <li key={review.id}>
                  <ReviewCard review={review} />
                </li>
              ))}
            </ul>
          ) : (
            <Card className="px-6 py-12 text-center text-body text-neutral-500">No reviews yet.</Card>
          )}
          <AccountPagination pathname={`${productHref}/reviews`} page={page} pageCount={reviews.pageCount} />
        </div>
      </div>
    </div>
  );
}
