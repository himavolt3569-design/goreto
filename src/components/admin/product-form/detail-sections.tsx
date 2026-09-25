"use client";

import { useState, type KeyboardEvent } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { PlusIcon, TrashIcon, XIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { sanitizeSlugInput, SLUG_MAX_LENGTH, SLUG_MAX_WORDS, slugFromTitle, slugWordCount, toKey } from "@/features/admin/product-form/keys";
import { cn } from "@/lib/utils/cn";
import type { ProductFormValues } from "@/features/admin/product-form/schema";
import type { CollectionOption } from "@/features/admin/queries/product-editor";
import type { CategoryOption } from "@/features/admin/queries/catalog";
import { CheckboxField, FormSection, TextAreaField, TextField, useFieldError } from "./fields";

/* Basic information, pricing, specifications, inventory and merchandising (AGENTS §4.7). */

export type SlugMode = "auto" | "custom";

export function BasicSection({
  categories,
  savedSlug,
  slugMode,
  onSlugModeChange,
  onTitleBlur,
}: {
  categories: CategoryOption[];
  /** The stored slug when editing; changing it breaks shared links. */
  savedSlug: string | null;
  slugMode: SlugMode;
  onSlugModeChange: (mode: SlugMode) => void;
  onTitleBlur: () => void;
}) {
  const { register, setValue } = useFormContext<ProductFormValues>();
  const categoryError = useFieldError("categoryId");
  const titleField = register("title");
  const parents = new Map(categories.map((category) => [category.id, category.title]));

  return (
    <FormSection id="basic" title="Basic information" description="What shoppers see first on the product page and in search.">
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
      <SlugField savedSlug={savedSlug} mode={slugMode} onModeChange={onSlugModeChange} />
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Category" required error={categoryError}>
          {(control) => (
            <Select {...control} {...register("categoryId")}>
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.parentId ? `${parents.get(category.parentId) ?? ""} › ${category.title}` : category.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <TextAreaField name="shortDescription" label="Short description" hint="One or two sentences under the price. Up to 200 characters." rows={2} maxLength={200} />
      <TextAreaField name="description" label="Description" hint="The full story: materials, fit and details." rows={6} maxLength={5000} />
    </FormSection>
  );
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
  const words = slugWordCount(slug);
  const tooManyWords = words > SLUG_MAX_WORDS;

  function generate() {
    setValue("slug", slugFromTitle(getValues("title")), { shouldDirty: true, shouldValidate: true });
    onModeChange("auto");
  }

  return (
    <Field
      label="URL slug"
      required
      error={error}
      hint={
        <span className="flex flex-col gap-1">
          <span className="break-all">goreto.store/products/{slug || "…"}</span>
          <span>
            <span className={cn(tooManyWords && "font-medium text-error-700")}>
              {words}/{SLUG_MAX_WORDS} words
            </span>
            {" · "}
            <span className={cn(slug.length > SLUG_MAX_LENGTH && "font-medium text-error-700")}>
              {slug.length}/{SLUG_MAX_LENGTH} characters
            </span>
            {" · "}
            {mode === "auto" ? "Auto from name" : "Custom"}
          </span>
          {savedSlug && slug !== savedSlug ? (
            <span className="text-warning-700">Changing the slug breaks links people already shared to /products/{savedSlug}.</span>
          ) : null}
        </span>
      }
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

export function PricingSection() {
  return (
    <FormSection id="pricing" title="Pricing" description="Prices are in Nepali rupees. A variant can override the price in the variants table.">
      <div className="grid gap-6 md:grid-cols-2">
        <TextField name="basePrice" label="Price (Rs.)" required inputMode="decimal" placeholder="e.g. 2,499" autoComplete="off" />
        <TextField
          name="compareAtPrice"
          label="Compare-at price (Rs.)"
          hint="Optional. Shown struck through when higher than the price."
          inputMode="decimal"
          autoComplete="off"
        />
      </div>
    </FormSection>
  );
}

export function SpecsSection() {
  const { control } = useFormContext<ProductFormValues>();
  const specs = useFieldArray({ control, name: "specs", keyName: "fieldKey" });
  return (
    <FormSection id="specs" title="Specifications & care" description="Shown in the product page's specification table and Care section.">
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
      <TextAreaField name="careInstructions" label="Care instructions" rows={3} maxLength={2000} />
    </FormSection>
  );
}

export function InventorySection() {
  return (
    <FormSection id="inventory" title="Inventory" description="Stock is set per variant. Existing stock changes only through adjustments, so edits never overwrite a sale.">
      <TextField
        name="lowStockThreshold"
        label="Low-stock alert at"
        required
        inputMode="numeric"
        className="md:w-64"
        hint="Variants at or below this count show “Only N left” and appear in low-stock alerts."
      />
    </FormSection>
  );
}

export function MerchandisingSection({
  collections,
  linkedCollections,
}: {
  /** null when this user can't change collection links (content.manage). */
  collections: CollectionOption[] | null;
  linkedCollections: { id: string; title: string }[];
}) {
  return (
    <FormSection id="merchandising" title="Merchandising & links" description="Badges, homepage placement, search tags and collections.">
      <div className="grid gap-4 md:grid-cols-3">
        <CheckboxField name="isFeatured" label="Featured" description="Eligible for the homepage product grid." />
        <CheckboxField name="isBestseller" label="Bestseller" description="Shows the BESTSELLER badge." />
        <CheckboxField name="isLimitedEdition" label="Limited edition" description="Shows the LIMITED badge." />
      </div>
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
    </FormSection>
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
