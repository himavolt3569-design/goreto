"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useEffectEvent, useId, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ICON_SIZE, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { ArrowSquareOutIcon, XIcon } from "@/components/ui/icons";
import { Input, fieldControlClasses } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { createCategoryInlineAction, saveCategoryAction, type CreatedCategory } from "@/features/admin/actions/categories";
import type { CategoryFormValues, CategoryOption } from "@/features/admin/queries/catalog";
import { categoryOptions } from "@/features/catalog/category-options";
import { cn } from "@/lib/utils/cn";
import { ActionMessage } from "./action-forms";
import { ImageField } from "./image-field";
import { FormSection } from "./product-form/fields";
import { NameSlugFields } from "./slug-field";

/*
 * Add/Edit category (admin phase 2), plus "+ Create new category" in any
 * category dropdown: the same form opens in a pop-up over the current page,
 * so nothing typed there is lost, and the new category is selected when it's
 * created. The server validates again and the database keeps the tree two
 * levels deep.
 */

const NO_ERRORS: Record<string, string> = {};

const EMPTY_VALUES: CategoryFormValues = { title: "", slug: "", parentId: "", description: "", imagePath: "", isActive: true, sortOrder: 0 };

/* ---------- Full page ---------- */

export type CategoryFormProps = {
  categoryId: string | null;
  values: CategoryFormValues;
  imageUrl: string | null;
  /** Top-level categories this one may sit under (never itself). */
  parents: CategoryOption[];
  /** A category with subcategories must stay top-level. */
  hasChildren: boolean;
  /** Stored slug and last update when editing. */
  saved: { slug: string; isActive: boolean; updatedLabel: string } | null;
  /** Create only: folder id for an image uploaded before the category exists. */
  stagingId?: string;
};

export function CategoryForm({ categoryId, values, imageUrl, parents, hasChildren, saved, stagingId }: CategoryFormProps) {
  const [state, formAction, pending] = useActionState(saveCategoryAction, null);
  const errors = (state && !state.ok && state.fieldErrors) || NO_ERRORS;

  // Submitted by hand so React doesn't reset the fields when validation fails.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}
      {stagingId ? <input type="hidden" name="stagingId" value={stagingId} /> : null}

      <div className="flex min-w-0 flex-col gap-6">
        <FormSection id="basic" title="Basic information" description="The category's name and address on the storefront.">
          <DetailFields values={values} errors={errors} savedSlug={saved?.slug ?? null} parents={parents} hasChildren={hasChildren} topLevelOnly={false} />
        </FormSection>

        <FormSection id="image" title="Image" description="Used on the category tiles of the homepage and /categories.">
          <ImageField
            kind="category"
            target={categoryId ? { ownerId: categoryId } : { stagingId: stagingId! }}
            name="imagePath"
            label="Category image"
            description="A square photo works best, at least 800 × 800 px."
            defaultPath={values.imagePath}
            defaultUrl={imageUrl}
            aspect="square"
            error={errors.imagePath}
          />
        </FormSection>
      </div>

      <aside className="flex flex-col gap-6 xl:sticky xl:top-24">
        <Card className="flex flex-col gap-6 p-6">
          <VisibilityFields values={values} errors={errors} />

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" fullWidth loading={pending}>
              {categoryId ? "Save changes" : "Create category"}
            </Button>
            <ActionMessage state={state} />
          </div>

          {saved ? (
            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4 text-small text-neutral-500">
              <p>Last updated {saved.updatedLabel}</p>
              {saved.isActive ? (
                <Link href={`/categories/${saved.slug}`} className={buttonClasses({ variant: "text", size: "md", className: "w-fit" })}>
                  View on store
                  <ArrowSquareOutIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
                </Link>
              ) : null}
            </div>
          ) : null}
        </Card>
      </aside>
    </form>
  );
}

/* ---------- Shared fields ---------- */

function DetailFields({
  values,
  errors,
  savedSlug,
  parents,
  hasChildren,
  topLevelOnly,
}: {
  values: CategoryFormValues;
  errors: Record<string, string>;
  savedSlug: string | null;
  parents: CategoryOption[];
  hasChildren: boolean;
  /** Creating a parent from the Parent field: no parent of its own. */
  topLevelOnly: boolean;
}) {
  const [parentId, setParentId] = useState(values.parentId);
  return (
    <>
      <NameSlugFields
        nameLabel="Category name"
        namePlaceholder="e.g. Festive Wear"
        nameMaxLength={80}
        basePath="/categories"
        defaultTitle={values.title}
        defaultSlug={values.slug}
        savedSlug={savedSlug}
        errors={errors}
      />
      {topLevelOnly ? null : (
        <Field
          label="Parent category"
          error={errors.parentId}
          hint={hasChildren ? "This category has subcategories, so it stays top-level." : "Subcategories show inside their parent's page. Only two levels are used."}
        >
          {(control) => (
            <CategorySelect
              {...control}
              mode="parent"
              name="parentId"
              categories={parents}
              value={parentId}
              onValueChange={setParentId}
              disabled={hasChildren}
            />
          )}
        </Field>
      )}
      <Field label="Description" error={errors.description} hint="Shown at the top of the category page. Up to 500 characters.">
        {(control) => (
          <textarea {...control} name="description" defaultValue={values.description} rows={4} maxLength={500} className={cn(fieldControlClasses, "h-auto py-3")} />
        )}
      </Field>
    </>
  );
}

function VisibilityFields({ values, errors }: { values: CategoryFormValues; errors: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-h3 text-neutral-900">Visibility</h2>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={values.isActive}
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500"
        />
        <span className="flex flex-col">
          <span className="text-body font-medium text-neutral-900">Show on the storefront</span>
          <span className="text-small text-neutral-500">Hidden categories and their products don&apos;t appear on category pages.</span>
        </span>
      </label>
      <Field label="Sort order" error={errors.sortOrder} hint="Lower numbers come first.">
        {(control) => <Input {...control} name="sortOrder" type="number" min={0} max={9999} step={1} defaultValue={values.sortOrder} required />}
      </Field>
    </div>
  );
}

/* ---------- Dropdown with "+ Create new category" ---------- */

/** Never a real category id (the server only accepts UUIDs). */
export const CREATE_CATEGORY_VALUE = "__create_category__";

export type CategorySelectProps = {
  /** "category": any category (product editor). "parent": top-level ones plus "None". */
  mode: "category" | "parent";
  categories: CategoryOption[];
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function CategorySelect({ mode, categories, value, onValueChange, ...select }: CategorySelectProps) {
  const [created, setCreated] = useState<CategoryOption[]>([]);
  const [open, setOpen] = useState(false);

  // New categories show at once; the page refresh brings the same rows from the server.
  const known = new Set(categories.map((category) => category.id));
  const all = [...categories, ...created.filter((category, index) => !known.has(category.id) && created.findIndex((item) => item.id === category.id) === index)];
  const topLevel = all.filter((category) => category.parentId === null);

  const options: SelectOption[] =
    mode === "parent"
      ? [{ value: "", label: "None — top-level category" }, ...topLevel.map((category) => ({ value: category.id, label: category.title }))]
      : categoryOptions(all);
  options.push({ value: CREATE_CATEGORY_VALUE, label: mode === "parent" ? "+ Create new parent category" : "+ Create new category" });

  function onCreated(category: CreatedCategory) {
    const parent = category.parent ? [{ id: category.parent.id, title: category.parent.title, parentId: null }] : [];
    setCreated((current) => [...current, ...parent, { id: category.id, title: category.title, parentId: category.parentId }]);
    setOpen(false);
    onValueChange(category.id);
  }

  return (
    <>
      <Select
        {...select}
        options={options}
        value={value}
        onValueChange={(next) => (next === CREATE_CATEGORY_VALUE ? setOpen(true) : onValueChange(next))}
      />
      {open ? (
        <CreateCategoryDialog
          title={mode === "parent" ? "New parent category" : "New category"}
          topLevelOnly={mode === "parent"}
          parents={topLevel}
          onCreated={onCreated}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/* ---------- Pop-up ---------- */

function CreateCategoryDialog({
  title,
  topLevelOnly,
  parents,
  onCreated,
  onClose,
}: {
  title: string;
  topLevelOnly: boolean;
  parents: CategoryOption[];
  onCreated: (category: CreatedCategory) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // One upload folder per pop-up; the image is attached when the category is created.
  const [stagingId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      opener?.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-neutral-900/50"
    >
      <DialogCategoryForm titleId={titleId} title={title} topLevelOnly={topLevelOnly} parents={parents} stagingId={stagingId} onCreated={onCreated} onClose={onClose} />
    </dialog>,
    document.body,
  );
}

function DialogCategoryForm({
  titleId,
  title,
  topLevelOnly,
  parents,
  stagingId,
  onCreated,
  onClose,
}: {
  titleId: string;
  title: string;
  topLevelOnly: boolean;
  parents: CategoryOption[];
  stagingId: string;
  onCreated: (category: CreatedCategory) => void;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createCategoryInlineAction, null);
  const errors = (state && !state.ok && state.fieldErrors) || NO_ERRORS;

  // Only a new result reports a new category.
  const reportCreated = useEffectEvent((category: CreatedCategory) => onCreated(category));
  useEffect(() => {
    if (state?.ok) reportCreated(state.category);
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The pop-up is portalled, but React still bubbles its events to the form
    // it was opened from (e.g. the product form): stop them here.
    event.stopPropagation();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 p-6">
      <input type="hidden" name="stagingId" value={stagingId} />
      <DialogHeader titleId={titleId} title={title} onClose={onClose}>
        {topLevelOnly ? "A top-level category. It's selected as the parent when you create it." : "It's selected in the dropdown when you create it."}
      </DialogHeader>
      <DetailFields values={EMPTY_VALUES} errors={errors} savedSlug={null} parents={parents} hasChildren={false} topLevelOnly={topLevelOnly} />
      <ImageField
        kind="category"
        target={{ stagingId }}
        name="imagePath"
        label="Category image"
        description="Optional. A square photo works best, at least 800 × 800 px."
        defaultPath=""
        defaultUrl={null}
        aspect="square"
        error={errors.imagePath}
      />
      <VisibilityFields values={EMPTY_VALUES} errors={errors} />
      {state && !state.ok ? <ActionMessage state={state} /> : null}
      <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
        <button type="button" onClick={onClose} className={buttonClasses({ variant: "tertiary", size: "md" })}>
          Cancel
        </button>
        <Button type="submit" size="md" loading={pending}>
          Create category
        </Button>
      </div>
    </form>
  );
}

function DialogHeader({ titleId, title, onClose, children }: { titleId: string; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-h2 text-neutral-900">
          {title}
        </h2>
        <p className="text-body text-neutral-500">{children}</p>
      </div>
      <button type="button" aria-label="Close" onClick={onClose} className={iconButtonClasses({ variant: "ghost", className: "-mr-2 -mt-2" })}>
        <XIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
      </button>
    </div>
  );
}
