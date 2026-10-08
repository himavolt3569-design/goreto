"use client";

import Link from "next/link";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { PlusIcon, TrashIcon, XIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { normalizeSku, sanitizeSlugInput, SLUG_MAX_LENGTH, slugFromTitle, toKey } from "@/features/admin/product-form/keys";
import type { ProductFormValues } from "@/features/admin/product-form/schema";
import type { CollectionOption, EditorVariantInfo } from "@/features/admin/queries/product-editor";
import type { CategoryOption } from "@/features/admin/queries/catalog";
import { CategorySelect } from "../category-form";
import { SlugHint, type SlugMode } from "../slug-field";
import { cn } from "@/lib/utils/cn";
import { CheckboxChip, CheckboxField, TextAreaField, TextField, useFieldError } from "./fields";
import { useSingleVariant } from "./options-variants-section";

/*
 * The product form's sections (AGENTS §4.7): an always-open Essentials card,
 * and the fields of the folded sections (description & specifications,
 * badges/tags/collections, advanced) with their one-line summaries.
 */

export type { SlugMode };

/**
 * The always-open card: what every product needs (name, category, price,
 * stock for a single product, short description) plus, on Add product, the
 * photos passed in as `media`.
 */
export function EssentialsSection({
  categories,
  slugMode,
  onTitleBlur,
  variantInfo,
  media,
}: {
  categories: CategoryOption[];
  slugMode: SlugMode;
  onTitleBlur: () => void;
  variantInfo: Record<string, EditorVariantInfo>;
  media?: ReactNode;
}) {
  const { control: formControl, register, setValue } = useFormContext<ProductFormValues>();
  const categoryError = useFieldError("categoryId");
  const titleField = register("title");
  const single = useSingleVariant();

  return (
    <Card id="essentials" className="flex scroll-mt-24 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-neutral-900">Essentials</h2>
        <p className="text-body text-neutral-500">Everything a shopper needs. The rest is optional and folded below.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Product name" required error={useFieldError("title")}>
          {(control) => (
            <Input
              {...control}
              {...titleField}
              maxLength={120}
              placeholder="e.g. Pearl Drop Earrings"
              onChange={(event) => {
                void titleField.onChange(event);
                if (slugMode === "auto") setValue("slug", slugFromTitle(event.target.value), { shouldDirty: true, shouldValidate: true });
              }}
              onBlur={(event) => {
                void titleField.onBlur(event);
                onTitleBlur();
              }}
            />
          )}
        </Field>
        <Field label="Category" required error={categoryError}>
          {(control) => (
            <Controller
              control={formControl}
              name="categoryId"
              render={({ field }) => (
                <CategorySelect
                  {...control}
                  mode="category"
                  categories={categories}
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  onBlur={field.onBlur}
                  placeholder="Choose a category"
                />
              )}
            />
          )}
        </Field>
      </div>

      <div className={cn("grid gap-4 sm:grid-cols-2", single && "lg:grid-cols-3")}>
        <TextField name="basePrice" label="Price (Rs.)" required inputMode="decimal" placeholder="e.g. 2,499" autoComplete="off" />
        <TextField name="compareAtPrice" label="Compare-at price (Rs.)" hint="Optional, shown struck through." inputMode="decimal" autoComplete="off" />
        {single ? <SingleStockField variantInfo={variantInfo} /> : null}
      </div>

      <TextAreaField name="shortDescription" label="Short description" hint="One or two sentences under the price." rows={2} maxLength={200} />

      {media}
    </Card>
  );
}

/** Stock of a single product: a starting count when new, read-only (adjusted in Inventory) once saved. */
function SingleStockField({ variantInfo }: { variantInfo: Record<string, EditorVariantInfo> }) {
  const variant = useWatch<ProductFormValues, "variants.0">({ name: "variants.0" });
  const info = variant?.id ? variantInfo[variant.id] : undefined;
  if (!info) return <TextField name="variants.0.initialStock" label="Stock" required inputMode="numeric" autoComplete="off" />;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body font-medium text-neutral-900">Stock</p>
      <p className="flex h-11 items-center gap-3">
        <span className="font-medium tabular-nums text-neutral-900">{info.stock} in stock</span>
        <Link href={`/admin/inventory?q=${encodeURIComponent(variant.sku)}`} className="text-body text-primary-600 hover:underline">
          Adjust
        </Link>
      </p>
    </div>
  );
}

/* ---------- Folded sections: summaries and fields ---------- */

/** One-line summaries for the folded section headers. */
export function detailsSummary(values: Pick<ProductFormValues, "description" | "specs" | "careInstructions">): string {
  const parts = [
    values.description.trim() ? "Description added" : "No description yet",
    values.specs.length > 0 ? `${values.specs.length} ${values.specs.length === 1 ? "specification" : "specifications"}` : null,
    values.careInstructions.trim() ? "care added" : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function merchandisingSummary(values: Pick<ProductFormValues, "isFeatured" | "isBestseller" | "isLimitedEdition" | "isSponsored" | "tags" | "collectionIds">): string {
  const parts = [
    values.isFeatured ? "Featured" : null,
    values.isBestseller ? "Bestseller" : null,
    values.isLimitedEdition ? "Limited" : null,
    values.isSponsored ? "Sponsored" : null,
    values.tags.length > 0 ? `${values.tags.length} ${values.tags.length === 1 ? "tag" : "tags"}` : null,
    values.collectionIds && values.collectionIds.length > 0 ? `${values.collectionIds.length} ${values.collectionIds.length === 1 ? "collection" : "collections"}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No badges, tags or collections";
}

export function advancedSummary(values: Pick<ProductFormValues, "slug" | "lowStockThreshold">): string {
  return `/products/${values.slug || "…"} · low-stock alert at ${values.lowStockThreshold || "?"}`;
}

export function DescriptionSpecsFields() {
  const { control } = useFormContext<ProductFormValues>();
  const specs = useFieldArray({ control, name: "specs", keyName: "fieldKey" });
  return (
    <>
      <TextAreaField name="description" label="Description" hint="The full story: materials, fit and details." rows={4} maxLength={5000} />
      <div className="flex flex-col gap-2">
        <p className="text-body font-medium text-neutral-900">Specifications</p>
        {specs.fields.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {specs.fields.map((spec, index) => (
              <li key={spec.fieldKey} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-start gap-2">
                <TextField name={`specs.${index}.label`} label={`Specification ${index + 1} label`} hideLabel placeholder="e.g. Material" maxLength={40} />
                <TextField name={`specs.${index}.value`} label={`Specification ${index + 1} value`} hideLabel placeholder="e.g. 925 sterling silver" maxLength={200} />
                <button type="button" onClick={() => specs.remove(index)} aria-label={`Remove specification ${index + 1}`} className={iconButtonClasses({ variant: "ghost" })}>
                  <TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {specs.fields.length < 30 ? (
          <Button
            variant="text"
            size="md"
            className="w-fit"
            leadingIcon={<PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
            onClick={() => specs.append({ label: "", value: "" }, { focusName: `specs.${specs.fields.length}.label` })}
          >
            Add specification
          </Button>
        ) : null}
      </div>
      <TextAreaField name="careInstructions" label="Care instructions" rows={2} maxLength={2000} />
    </>
  );
}

export function MerchandisingFields({
  collections,
  linkedCollections,
}: {
  /** null when this user can't change collection links (content.manage). */
  collections: CollectionOption[] | null;
  linkedCollections: { id: string; title: string }[];
}) {
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body font-medium text-neutral-900">Badges and placement</legend>
        <div className="flex flex-wrap gap-2">
          <CheckboxChip name="isFeatured" label="Featured" description="Eligible for the homepage product grid." />
          <CheckboxChip name="isBestseller" label="Bestseller" description="Shows the BESTSELLER badge." />
          <CheckboxChip name="isLimitedEdition" label="Limited edition" description="Shows the LIMITED badge." />
          <CheckboxChip name="isSponsored" label="Sponsored" description="Shoppers see a blue “Goreto Pick” tick and it joins the homepage Goreto Picks." />
        </div>
        <p className="text-small text-neutral-500">Featured: homepage grid. Sponsored: blue “Goreto Pick” tick and the homepage Goreto Picks.</p>
      </fieldset>
      <TagsField />
      {collections ? (
        <CollectionsField collections={collections} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-body font-medium text-neutral-900">Collections</p>
          <p className="text-body text-neutral-500">
            {linkedCollections.length > 0 ? linkedCollections.map((collection) => collection.title).join(", ") : "Not in any collection."} Changing collections needs the Content permission.
          </p>
        </div>
      )}
    </>
  );
}

/** URL slug, low-stock alert, and a single product's SKU, weight and active state: fields with good defaults. */
export function AdvancedFields({ savedSlug, slugMode, onSlugModeChange }: { savedSlug: string | null; slugMode: SlugMode; onSlugModeChange: (mode: SlugMode) => void }) {
  const single = useSingleVariant();
  return (
    <>
      <SlugField savedSlug={savedSlug} mode={slugMode} onModeChange={onSlugModeChange} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="lowStockThreshold"
          label="Low-stock alert at"
          required
          inputMode="numeric"
          hint="At or below this, shoppers see “Only N left”."
        />
        {single ? <SingleSkuField /> : null}
        {single ? <TextField name="variants.0.weightGrams" label="Weight (g)" hint="Optional, for delivery rates." inputMode="numeric" autoComplete="off" /> : null}
        {single ? <SinglePriceOverride /> : null}
      </div>
      {single ? <CheckboxField name="variants.0.isActive" label="Available to buy" description="Untick to keep the product visible but not purchasable." /> : null}
    </>
  );
}

function SingleSkuField() {
  const { register, setValue } = useFormContext<ProductFormValues>();
  const skuField = register("variants.0.sku");
  return (
    <Field label="SKU" required error={useFieldError("variants.0.sku")} hint="Filled from the name; change it if you use your own codes.">
      {(control) => (
        <Input
          {...control}
          {...skuField}
          maxLength={64}
          autoComplete="off"
          className="uppercase"
          onBlur={(event) => {
            setValue("variants.0.sku", normalizeSku(event.target.value));
            void skuField.onBlur(event);
          }}
        />
      )}
    </Field>
  );
}

/** Shown only when the single variant already has its own price, so it can be seen and cleared. */
function SinglePriceOverride() {
  const { getValues } = useFormContext<ProductFormValues>();
  const [hasOverride] = useState(() => getValues("variants.0.price").trim() !== "");
  if (!hasOverride) return null;
  return <TextField name="variants.0.price" label="Variant price (Rs.)" hint="Overrides the price above. Clear it to use that price." inputMode="decimal" autoComplete="off" />;
}

/**
 * The product's URL. "Auto" follows the product name (first 8 words);
 * typing here switches to a custom slug, cleaned as you type.
 */
function SlugField({ savedSlug, mode, onModeChange }: { savedSlug: string | null; mode: SlugMode; onModeChange: (mode: SlugMode) => void }) {
  const { register, setValue, getValues } = useFormContext<ProductFormValues>();
  const slug = useWatch<ProductFormValues, "slug">({ name: "slug" }) ?? "";
  const error = useFieldError("slug");
  const slugField = register("slug");

  function generate() {
    setValue("slug", slugFromTitle(getValues("title")), { shouldDirty: true, shouldValidate: true });
    onModeChange("auto");
  }

  return (
    <Field
      label="URL slug"
      required
      error={error}
      hint={<SlugHint basePath="/products" slug={slug} mode={mode} savedSlug={savedSlug} />}
    >
      {(control) => (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            {...control}
            {...slugField}
            maxLength={SLUG_MAX_LENGTH}
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. pearl-drop-earrings"
            onChange={(event) => {
              event.target.value = sanitizeSlugInput(event.target.value);
              void slugField.onChange(event);
              onModeChange("custom");
            }}
            onBlur={(event) => {
              // Tidy a trailing dash left while typing.
              const tidy = event.target.value.replace(/-+$/, "");
              if (tidy !== event.target.value) setValue("slug", tidy, { shouldDirty: true });
              void slugField.onBlur(event);
            }}
          />
          <Button type="button" variant="tertiary" size="md" onClick={generate} disabled={mode === "auto"}>
            Generate from name
          </Button>
        </div>
      )}
    </Field>
  );
}

function TagsField() {
  const { setValue } = useFormContext<ProductFormValues>();
  const tags = useWatch<ProductFormValues, "tags">({ name: "tags" }) ?? [];
  const error = useFieldError("tags");
  const [draft, setDraft] = useState("");

  function commit() {
    const additions = draft.split(",").map((tag) => toKey(tag, 40)).filter(Boolean);
    if (additions.length > 0) setValue("tags", [...new Set([...tags, ...additions])].slice(0, 20), { shouldDirty: true, shouldValidate: true });
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      setValue("tags", tags.slice(0, -1), { shouldDirty: true });
    }
  }

  return (
    <Field label="Tags" error={error} hint="Help search find this product. Press Enter or comma to add. Up to 20.">
      {(control) => (
        <div className="flex flex-col gap-2">
          <Input {...control} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={commit} placeholder="e.g. silver, gift" autoComplete="off" />
          {tags.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Tags">
              {tags.map((tag) => (
                <li key={tag}>
                  <Badge tone="neutral" className="gap-1 pr-1">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => setValue("tags", tags.filter((item) => item !== tag), { shouldDirty: true })}
                      className="flex size-6 items-center justify-center rounded-full hover:bg-neutral-200"
                    >
                      <XIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </Field>
  );
}

function CollectionsField({ collections }: { collections: CollectionOption[] }) {
  const { setValue } = useFormContext<ProductFormValues>();
  const selected = useWatch<ProductFormValues, "collectionIds">({ name: "collectionIds" }) ?? [];

  function toggle(id: string, checked: boolean) {
    setValue("collectionIds", checked ? [...selected, id] : selected.filter((item) => item !== id), { shouldDirty: true });
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-body font-medium text-neutral-900">Collections</legend>
      <p className="text-small text-neutral-500">New links are added at the end of each collection.</p>
      {collections.length === 0 ? (
        <p className="text-body text-neutral-500">There are no collections yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {collections.map((collection) => (
            <li key={collection.id}>
              <label className="flex min-h-11 items-center gap-3 rounded-md border border-neutral-200 px-4">
                <input
                  type="checkbox"
                  checked={selected.includes(collection.id)}
                  onChange={(event) => toggle(collection.id, event.target.checked)}
                  className="size-5 shrink-0 cursor-pointer accent-primary-500"
                />
                <span className="flex-1 text-body text-neutral-900">{collection.title}</span>
                {!collection.isLive ? (
                  <Badge size="sm" tone="neutral">
                    {collection.isActive ? "Scheduled" : "Hidden"}
                  </Badge>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
