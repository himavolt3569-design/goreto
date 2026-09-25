"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, fieldControlClasses } from "@/components/ui/input";
import { saveCollectionAction } from "@/features/admin/actions/collections";
import type { CollectionFormValues, CollectionProduct } from "@/features/admin/queries/collection-editor";
import type { CollectionState } from "@/features/admin/states";
import { cn } from "@/lib/utils/cn";
import { ActionMessage } from "./action-forms";
import { CollectionProducts } from "./collection-products";
import { ImageField } from "./image-field";
import { FormSection } from "./product-form/fields";
import { NameSlugFields } from "./slug-field";
import { CollectionStatePill } from "./status-pills";

/*
 * Add/Edit collection (admin phase 2): a campaign shown in the homepage
 * carousel while it is on and inside its schedule. Times are entered in
 * Nepal time (Asia/Kathmandu) and stored in UTC.
 */

const NO_ERRORS: Record<string, string> = {};

export type CollectionFormProps = {
  collectionId: string | null;
  values: CollectionFormValues;
  heroImageUrl: string | null;
  products: CollectionProduct[];
  saved: { slug: string; state: CollectionState; updatedLabel: string } | null;
  /** Create only: folder id for a hero image uploaded before the collection exists. */
  stagingId?: string;
};

export function CollectionForm({ collectionId, values, heroImageUrl, products, saved, stagingId }: CollectionFormProps) {
  const [state, formAction, pending] = useActionState(saveCollectionAction, null);
  const errors = (state && !state.ok && state.fieldErrors) || NO_ERRORS;
  const [hasImage, setHasImage] = useState(values.heroImagePath !== "");

  // Submitted by hand so React doesn't reset the fields when validation fails.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const target = collectionId ? { ownerId: collectionId } : { stagingId: stagingId! };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      {collectionId ? <input type="hidden" name="collectionId" value={collectionId} /> : null}
      {stagingId ? <input type="hidden" name="stagingId" value={stagingId} /> : null}

      <div className="flex min-w-0 flex-col gap-6">
        <FormSection id="basic" title="Basic information" description="What shoppers read on the homepage carousel.">
          <NameSlugFields
            nameLabel="Title"
            namePlaceholder="e.g. Dashain Edit"
            nameMaxLength={120}
            basePath="/collections"
            defaultTitle={values.title}
            defaultSlug={values.slug}
            savedSlug={saved?.slug ?? null}
            errors={errors}
          />
          <Field label="Eyebrow" error={errors.eyebrow} hint={`The small line above the title, e.g. "New collection". Up to 40 characters.`}>
            {(control) => <Input {...control} name="eyebrow" defaultValue={values.eyebrow} maxLength={40} />}
          </Field>
          <Field label="Description" error={errors.description} hint="One or two sentences. Up to 300 characters.">
            {(control) => (
              <textarea {...control} name="description" defaultValue={values.description} rows={3} maxLength={300} className={cn(fieldControlClasses, "h-auto py-3")} />
            )}
          </Field>
        </FormSection>

        <FormSection id="image" title="Hero image" description="The large photo behind the collection on the homepage.">
          <ImageField
            kind="collection"
            target={target}
            name="heroImagePath"
            label="Hero image"
            description="A wide photo works best, at least 1600 × 900 px."
            defaultPath={values.heroImagePath}
            defaultUrl={heroImageUrl}
            aspect="wide"
            error={errors.heroImagePath}
            onPathChange={(path) => setHasImage(path !== "")}
          />
          <Field
            label="Alt text"
            required={hasImage}
            error={errors.heroImageAlt}
            hint="Describe the photo for people using screen readers, e.g. “Model in a red Dhaka sari”."
          >
            {(control) => <Input {...control} name="heroImageAlt" defaultValue={values.heroImageAlt} maxLength={200} disabled={!hasImage} />}
          </Field>
        </FormSection>

        <FormSection id="products" title="Products" description="Shown in this order. Draft and archived products stay hidden from shoppers.">
          <CollectionProducts initial={products} error={errors.products ?? errors.productIds} />
        </FormSection>
      </div>

      <aside className="flex flex-col gap-6 xl:sticky xl:top-24">
        <Card className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-h3 text-neutral-900">Schedule</h2>
              {saved ? <CollectionStatePill state={saved.state} /> : null}
            </div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={values.isActive}
                className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500"
              />
              <span className="flex flex-col">
                <span className="text-body font-medium text-neutral-900">Collection is on</span>
                <span className="text-small text-neutral-500">It shows while on and inside the dates below.</span>
              </span>
            </label>
            <Field label="Starts" error={errors.startsAt} hint="Nepal time. Empty = straight away.">
              {(control) => <Input {...control} name="startsAt" type="datetime-local" defaultValue={values.startsAt} />}
            </Field>
            <Field label="Ends" error={errors.endsAt} hint="Nepal time. Empty = no end.">
              {(control) => <Input {...control} name="endsAt" type="datetime-local" defaultValue={values.endsAt} />}
            </Field>
            <Field label="Sort order" error={errors.sortOrder} hint="Lower numbers come first in the carousel.">
              {(control) => <Input {...control} name="sortOrder" type="number" min={0} max={9999} step={1} defaultValue={values.sortOrder} required />}
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" fullWidth loading={pending}>
              {collectionId ? "Save changes" : "Create collection"}
            </Button>
            <ActionMessage state={state} />
          </div>

          {saved ? <p className="border-t border-neutral-200 pt-4 text-small text-neutral-500">Last updated {saved.updatedLabel}</p> : null}
        </Card>
      </aside>
    </form>
  );
}
