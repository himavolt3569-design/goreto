"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { FormProvider, useForm, useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { ArrowSquareOutIcon } from "@/components/ui/icons";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { saveProductAction } from "@/features/admin/actions/products";
import type { ActionResult } from "@/features/admin/auth";
import { PRODUCT_STATUSES, productFormSchema, type ProductFormOutput, type ProductFormStatus, type ProductFormValues } from "@/features/admin/product-form/schema";
import type { CategoryOption } from "@/features/admin/queries/catalog";
import type { CollectionOption, EditorVariantInfo } from "@/features/admin/queries/product-editor";
import { ActionMessage } from "../action-forms";
import { BasicSection, InventorySection, MerchandisingSection, PricingSection, SpecsSection, type SlugMode } from "./detail-sections";
import { useFieldError } from "./fields";
import { fillEmptySkus, OptionsVariantsSection } from "./options-variants-section";
import { StagedMedia, type StagedPhoto } from "./staged-media";

/*
 * Add/Edit product (AGENTS §4.7): one sectioned form for both. The schema
 * validates in the browser for inline errors; the Server Action validates the
 * same input again and the database function once more.
 */

const STATUS_COPY: Record<ProductFormStatus, { label: string; description: string }> = {
  draft: { label: "Draft", description: "Hidden from the storefront." },
  active: { label: "Active", description: "Live on the storefront." },
  archived: { label: "Archived", description: "Hidden and kept for order history." },
};

export type ProductFormProps = {
  productId: string | null;
  defaultValues: ProductFormValues;
  categories: CategoryOption[];
  collections: CollectionOption[] | null;
  linkedCollections: { id: string; title: string }[];
  variantInfo: Record<string, EditorVariantInfo>;
  /** Stored slug and status when editing. */
  saved: { slug: string; status: ProductFormStatus; updatedLabel: string } | null;
  /** Add product only: folder id for photos uploaded before the product exists. */
  stagingId?: string;
};

export function ProductForm({ productId, defaultValues, categories, collections, linkedCollections, variantInfo, saved, stagingId }: ProductFormProps) {
  const form = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const { isDirty } = form.formState;
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  // New products follow the name until the slug is typed; saved products keep theirs.
  const [slugMode, setSlugMode] = useState<SlugMode>(productId === null ? "auto" : "custom");
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);

  // After a save, the page re-renders with the stored values (new variant ids, stock).
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const onSubmit = form.handleSubmit(
    () => {
      // The raw input goes to the server, which parses it with the same schema.
      const input = form.getValues();
      setResult(null);
      startTransition(async () => {
        const staged = stagingId ? { stagingId, photos: photos.map((photo) => ({ path: photo.path, altText: photo.altText })) } : undefined;
        const response = await saveProductAction(productId, input, staged);
        if (!response) return; // Created: the action redirected to the editor.
        setResult(response);
        if (!response.ok) {
          for (const [path, message] of Object.entries(response.fieldErrors ?? {})) {
            form.setError(path as FieldPath<ProductFormValues>, { type: "server", message }, { shouldFocus: true });
          }
        }
      });
    },
    () => setResult({ ok: false, message: "Check the highlighted fields." }),
  );

  function fillSkus() {
    const filled = fillEmptySkus(form.getValues());
    if (filled) form.setValue("variants", filled, { shouldDirty: true });
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <BasicSection
            categories={categories}
            savedSlug={saved?.slug ?? null}
            slugMode={slugMode}
            onSlugModeChange={setSlugMode}
            onTitleBlur={fillSkus}
          />
          {stagingId ? <StagedMedia stagingId={stagingId} photos={photos} onChange={setPhotos} /> : null}
          <PricingSection />
          <OptionsVariantsSection variantInfo={variantInfo} />
          <SpecsSection />
          <InventorySection />
          <MerchandisingSection collections={collections} linkedCollections={linkedCollections} />
        </div>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-24">
          <StatusPanel pending={pending} result={result} saved={saved} isNew={productId === null} isDirty={isDirty} />
        </aside>
      </form>
    </FormProvider>
  );
}

function StatusPanel({
  pending,
  result,
  saved,
  isNew,
  isDirty,
}: {
  pending: boolean;
  result: ActionResult | null;
  saved: ProductFormProps["saved"];
  isNew: boolean;
  isDirty: boolean;
}) {
  const status = useWatch<ProductFormValues, "status">({ name: "status" });
  const statusError = useFieldError("status");
  const { register } = useFormContext<ProductFormValues>();

  return (
    <Card className="flex flex-col gap-6 p-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-h3 text-neutral-900">Status</legend>
        {PRODUCT_STATUSES.map((value) => (
          <label
            key={value}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-neutral-200 px-4 py-3 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-100"
          >
            <input type="radio" value={value} {...register("status")} className="mt-0.5 size-5 shrink-0 accent-primary-500" />
            <span className="flex flex-col">
              <span className="text-body font-medium text-neutral-900">{STATUS_COPY[value].label}</span>
              <span className="text-small text-neutral-500">{STATUS_COPY[value].description}</span>
            </span>
          </label>
        ))}
        {statusError ? (
          <p role="alert" className="text-small text-error-700">
            {statusError}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" fullWidth loading={pending}>
          {isNew ? (status === "active" ? "Create and publish" : "Create product") : "Save changes"}
        </Button>
        {isNew ? <p className="text-small text-neutral-500">You can add photos after creating the product.</p> : null}
        {!isNew && isDirty ? <p className="text-small text-warning-700">You have unsaved changes.</p> : null}
        <ActionMessage state={result} />
      </div>

      {saved ? (
        <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4 text-small text-neutral-500">
          <p>Last updated {saved.updatedLabel}</p>
          {saved.status === "active" ? (
            <Link href={`/products/${saved.slug}`} className={buttonClasses({ variant: "text", size: "md", className: "w-fit" })}>
              View on store
              <ArrowSquareOutIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
            </Link>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
