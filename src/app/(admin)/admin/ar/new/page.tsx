import type { Metadata } from "next";
import { BackLink, PageHeader } from "@/components/admin/admin-ui";
import { ArAssetForm } from "@/components/admin/ar-asset-form";
import { defaultCalibration } from "@/features/admin/ar-forms";
import { requireAdminAccess } from "@/features/admin/auth";
import { fetchArProduct } from "@/features/admin/queries/ar-editor";
import { isUuid, param } from "@/features/admin/url";

export const metadata: Metadata = { title: "Add AR asset" };

/** `?product=<id>` starts with that product chosen (from the product editor). */
export default async function NewArAssetPage({ searchParams }: PageProps<"/admin/ar/new">) {
  await requireAdminAccess("ar.manage");
  const productId = param(await searchParams, "product");
  const product = productId && isUuid(productId) ? await fetchArProduct(productId) : null;

  return (
    <>
      <BackLink href={product ? `/admin/products/${product.id}` : "/admin/ar"}>{product ? product.title : "AR Try-On"}</BackLink>
      <PageHeader
        title="Add AR asset"
        description="A product shows AR READY once it's live and has an active asset. Photo try-on also needs a provider configured on the server."
      />
      <ArAssetForm
        assetId={null}
        initialProduct={product}
        values={{ productId: product?.id ?? "", variantId: "", mode: "live_2d", placement: "ear", assetPath: "", calibration: defaultCalibration("ear"), isActive: true }}
        format=""
        fileUrl={null}
        updatedLabel={null}
      />
    </>
  );
}
