import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountEmptyState, AccountPageHeader, ReviewStatusPill } from "@/components/store/account/account-ui";
import { ReviewForm } from "@/components/store/account/review-form";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PackageIcon } from "@/components/ui/icons";
import { MediaFrame } from "@/components/ui/media-frame";
import { REVIEW_STATUS_DISPLAY } from "@/features/reviews/schema";
import { fetchReviewTarget } from "@/features/reviews/queries";
import { requireProfile } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "Write a review" };

/**
 * Write or edit your review of one product. Only verified buyers (a delivered
 * order containing it) get the form; submit_review enforces the same rule.
 */
export default async function WriteReviewPage({ params }: PageProps<"/account/reviews/[slug]">) {
  const profile = await requireProfile();
  const { slug } = await params;
  const target = await fetchReviewTarget(profile.id, slug);
  if (!target) notFound();

  const { product, existing, isVerifiedBuyer } = target;
  const productHref = `/products/${product.slug}`;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Account", href: "/account" },
          { label: "Reviews", href: "/account/reviews" },
          { label: existing ? "Edit review" : "Write a review" },
        ]}
      />
      <AccountPageHeader
        title={existing ? "Edit your review" : "Write a review"}
        description={
          <>
            For{" "}
            <Link href={productHref} className="rounded-xs font-medium text-neutral-900 hover:text-primary-600">
              {product.title}
            </Link>
          </>
        }
      />

      <Card className="flex items-center gap-4 p-4">
        <MediaFrame image={product.image} sizes="64px" className="size-16 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-body font-medium text-neutral-900">{product.title}</p>
          {existing ? (
            <div className="flex flex-wrap items-center gap-2">
              <ReviewStatusPill status={existing.status} />
              <span className="text-small text-neutral-500">{REVIEW_STATUS_DISPLAY[existing.status].hint}</span>
            </div>
          ) : null}
        </div>
      </Card>

      {isVerifiedBuyer ? (
        <ReviewForm
          productSlug={product.slug}
          isEdit={existing !== null}
          defaults={{
            rating: existing ? String(existing.rating) : "",
            title: existing?.title ?? "",
            body: existing?.body ?? "",
          }}
        />
      ) : (
        <AccountEmptyState
          icon={PackageIcon}
          title="You can review this after your order is delivered"
          description="Reviews on Goreto come from customers who received the product, so shoppers can trust them."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href={productHref} className={buttonClasses({ variant: "tertiary", size: "md" })}>
                Back to product
              </Link>
              <Link href="/account/orders" className={buttonClasses({ variant: "primary", size: "md" })}>
                View orders
              </Link>
            </div>
          }
        />
      )}
    </>
  );
}
