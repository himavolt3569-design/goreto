"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { FormProvider, useForm, useFormContext, useWatch, type FieldErrors, type FieldPath } from "react-hook-form";
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
import {
  AdvancedFields,
  advancedSummary,
  DescriptionSpecsFields,
  detailsSummary,
  EssentialsSection,
  MerchandisingFields,
  merchandisingSummary,
  type SlugMode,
} from "./detail-sections";
import { CollapsibleSection, useFieldError } from "./fields";
import { fillEmptySkus, OptionsVariantsFields, variantsSummary } from "./options-variants-section";
import { StagedMedia, type StagedPhoto } from "./staged-media";

/*
 * Add/Edit product (AGENTS §4.7): one form for both. An always-open
 * Essentials card holds what every product needs; everything else sits in
 * folded sections with one-line summaries, and any section with an error
 * opens on submit. The schema validates in the browser for inline errors; the
 * Server Action validates the same input again and the database function
 * once more.
 */

type FoldedSection = "details" | "variants" | "merchandising" | "advanced";
const FOLDED_SECTIONS: { id: FoldedSection; title: string }[] = [
  { id: "details", title: "Description & specifications" },
  { id: "variants", title: "Options & variants" },
  { id: "merchandising", title: "Badges, tags & collections" },
  { id: "advanced", title: "Advanced" },
];

/** Every field path with an error message (array-level errors sit on `<array>.root`). */
export function errorPaths(errors: unknown, prefix = ""): string[] {
  if (!errors || typeof errors !== "object") return [];
  const record = errors as Record<string, unknown>;
  const paths = typeof record.message === "string" && record.message ? [prefix] : [];
  for (const [key, value] of Object.entries(record)) {
    if (key === "message" || key === "type" || key === "types" || key === "ref") continue;
    paths.push(...errorPaths(value, key === "root" ? prefix : prefix ? `${prefix}.${key}` : key));
  }
  return [...new Set(paths)];
}

/** The folded section showing the field at `path`; null for Essentials and the status panel (always visible). */
export function sectionForPath(path: string, single: boolean): FoldedSection | null {
  const [root, , field] = path.split(".");
  switch (root) {
    case "description":
    case "specs":
    case "careInstructions":
      return "details";
    case "options":
      return "variants";
    case "variants":
      if (!single || field === undefined) return "variants";
      return field === "initialStock" ? null : "advanced";
    case "tags":
    case "collectionIds":
    case "isFeatured":
    case "isBestseller":
    case "isLimitedEdition":
    case "isSponsored":
      return "merchandising";
    case "slug":
    case "lowStockThreshold":
      return "advanced";
    default:
      return null;
  }
}

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
  /** Stored slug and status when editing; `version` (updated_at) changes on every product save. */
  saved: { slug: string; status: ProductFormStatus; version: string; updatedLabel: string } | null;
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
  const [open, setOpen] = useState<Set<FoldedSection>>(() => new Set());

  // Read, not watched: this re-renders when the errors change, not on every keystroke.
  const isSingle = () => {
    const { options, variants } = form.getValues();
    return options.length === 0 && variants.length === 1;
  };
  const errorCounts = new Map<FoldedSection, number>();
  for (const path of errorPaths(form.formState.errors)) {
    const section = sectionForPath(path, isSingle());
    if (section) errorCounts.set(section, (errorCounts.get(section) ?? 0) + 1);
  }

  function toggle(section: FoldedSection) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  /** Opens the sections holding these fields, then focuses the first once it is visible. */
  function revealErrors(paths: string[]) {
    const single = isSingle();
    const sections = paths.map((path) => sectionForPath(path, single)).filter((section): section is FoldedSection => section !== null);
    if (sections.length > 0) setOpen((current) => new Set([...current, ...sections]));
    const first = paths[0];
    if (first) setTimeout(() => form.setFocus(first as FieldPath<ProductFormValues>), 0);
  }

  function jumpTo(section: FoldedSection) {
    setOpen((current) => new Set([...current, section]));
    setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  // After a save, the page re-renders with the stored values (new variant ids, stock).
  // Keyed on the saved version so refreshes from photo actions keep unsaved edits.
  const savedVersion = saved?.version ?? null;
  const resetToSaved = useEffectEvent(() => form.reset(defaultValues));
  useEffect(() => {
    resetToSaved();
  }, [savedVersion]);

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
        const staged = stagingId ? { stagingId, media: photos.map((photo) => ({ path: photo.path, altText: photo.altText })) } : undefined;
        const response = await saveProductAction(productId, input, staged);
        if (!response) return; // Created: the action redirected to the editor.
        setResult(response);
        if (!response.ok) {
          const fieldErrors = Object.entries(response.fieldErrors ?? {});
          for (const [path, message] of fieldErrors) {
            form.setError(path as FieldPath<ProductFormValues>, { type: "server", message });
          }
          revealErrors(fieldErrors.map(([path]) => path));
        }
      });
    },
    (errors: FieldErrors<ProductFormValues>) => {
      setResult({ ok: false, message: "Check the highlighted fields." });
      revealErrors(errorPaths(errors));
    },
  );

  function fillSkus() {
    const filled = fillEmptySkus(form.getValues());
    if (filled) form.setValue("variants", filled, { shouldDirty: true });
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <EssentialsSection
            categories={categories}
            slugMode={slugMode}
            onTitleBlur={fillSkus}
            variantInfo={variantInfo}
            media={stagingId ? <StagedMedia stagingId={stagingId} photos={photos} onChange={setPhotos} /> : undefined}
          />
          <CollapsibleSection
            id="details"
            title="Description & specifications"
            summary={<SectionSummary of="details" />}
            open={open.has("details")}
            onToggle={() => toggle("details")}
            errorCount={errorCounts.get("details")}
          >
            <DescriptionSpecsFields />
          </CollapsibleSection>
          <CollapsibleSection
            id="variants"
            title="Options & variants"
            summary={<SectionSummary of="variants" />}
            open={open.has("variants")}
            onToggle={() => toggle("variants")}
            errorCount={errorCounts.get("variants")}
          >
            <OptionsVariantsFields variantInfo={variantInfo} />
          </CollapsibleSection>
          <CollapsibleSection
            id="merchandising"
            title="Badges, tags & collections"
            summary={<SectionSummary of="merchandising" />}
            open={open.has("merchandising")}
            onToggle={() => toggle("merchandising")}
            errorCount={errorCounts.get("merchandising")}
          >
            <MerchandisingFields collections={collections} linkedCollections={linkedCollections} />
          </CollapsibleSection>
          <CollapsibleSection
            id="advanced"
            title="Advanced"
            summary={<SectionSummary of="advanced" />}
            open={open.has("advanced")}
            onToggle={() => toggle("advanced")}
            errorCount={errorCounts.get("advanced")}
          >
            <AdvancedFields savedSlug={saved?.slug ?? null} slugMode={slugMode} onSlugModeChange={setSlugMode} />
          </CollapsibleSection>
        </div>

        {/* Below xl the panel sticks to the bottom of the screen, so Save stays in reach. */}
        <aside className="sticky bottom-0 z-20 flex flex-col gap-4 xl:top-24 xl:bottom-auto">
          <StatusPanel pending={pending} result={result} saved={saved} isNew={productId === null} canStagePhotos={Boolean(stagingId)} isDirty={isDirty} />
          <nav aria-label="Form sections" className="hidden xl:block">
            <Card className="flex flex-col p-2">
              {FOLDED_SECTIONS.map((section) => {
                const errors = errorCounts.get(section.id) ?? 0;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jumpTo(section.id)}
                    aria-label={`Go to ${section.title}${errors > 0 ? `, ${errors} to fix` : ""}`}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-md px-4 text-left text-body text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    {section.title}
                    {errors > 0 ? <span className="rounded-full bg-error-100 px-2 text-small font-medium text-error-700">{errors} to fix</span> : null}
                  </button>
                );
              })}
            </Card>
          </nav>
        </aside>
      </form>
    </FormProvider>
  );
}

/** A folded section's one-line summary; watches only that section's fields. */
function SectionSummary({ of }: { of: FoldedSection }) {
  const values = useWatch<ProductFormValues>() as ProductFormValues;
  switch (of) {
    case "details":
      return detailsSummary(values);
    case "variants":
      return variantsSummary(values);
    case "merchandising":
      return merchandisingSummary(values);
    case "advanced":
      return advancedSummary(values);
  }
}

function StatusPanel({
  pending,
  result,
  saved,
  isNew,
  canStagePhotos,
  isDirty,
}: {
  pending: boolean;
  result: ActionResult | null;
  saved: ProductFormProps["saved"];
  isNew: boolean;
  canStagePhotos: boolean;
  isDirty: boolean;
}) {
  const status = useWatch<ProductFormValues, "status">({ name: "status" });
  const statusError = useFieldError("status");
  const { register } = useFormContext<ProductFormValues>();

  return (
    <Card className="flex flex-col gap-4 p-4 shadow-lg xl:gap-6 xl:p-6 xl:shadow-sm">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body font-medium text-neutral-900 xl:text-h3">Status</legend>
        <div className="grid grid-cols-3 gap-1 rounded-md bg-neutral-100 p-1">
          {PRODUCT_STATUSES.map((value) => (
            <label
              key={value}
              className="flex min-h-10 cursor-pointer items-center justify-center rounded-sm px-2 text-body font-medium text-neutral-700 has-[:checked]:bg-white has-[:checked]:text-primary-700 has-[:checked]:shadow-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-500"
            >
              <input type="radio" value={value} {...register("status")} className="sr-only" />
              {STATUS_COPY[value].label}
            </label>
          ))}
        </div>
        <p className="hidden text-small text-neutral-500 xl:block">{STATUS_COPY[status]?.description}</p>
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
        {isNew && !canStagePhotos ? <p className="text-small text-neutral-500">You can add photos after creating the product.</p> : null}
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
