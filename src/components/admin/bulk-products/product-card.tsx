"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ArrowSquareOutIcon, CheckCircleIcon, CopyIcon, ImageIcon, PencilSimpleIcon, TrashIcon, WarningCircleIcon } from "@/components/ui/icons";
import { fieldControlClasses, Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import type { QuickCreateResult } from "@/features/admin/actions/products";
import type { QuickProductValues } from "@/features/admin/product-form/quick-product";
import { cn } from "@/lib/utils/cn";
import { MediaStrip, type StagedFile } from "./media-strip";

/*
 * One product on the Bulk add page: the few fields a product needs to exist,
 * plus its photos and videos. Everything else (variants, specs, SEO-ish copy)
 * lives in the full editor, linked once the product is created.
 */

export type CardStatus = "editing" | "waiting" | "creating" | "created" | "failed";

export type BulkCard = {
  key: string;
  stagingId: string;
  values: QuickProductValues;
  files: StagedFile[];
  uploading: boolean;
  status: CardStatus;
  errors: Record<string, string>;
  message?: string;
  created?: Extract<QuickCreateResult, { ok: true }>;
};

const DESCRIPTION_MAX = 200;

export function fieldId(card: Pick<BulkCard, "key">, field: keyof QuickProductValues): string {
  return `bulk-${card.key}-${field}`;
}

export function BulkProductCard({
  card,
  number,
  categories,
  canRemove,
  locked,
  onValues,
  onFiles,
  onUploading,
  onDuplicate,
  onRemove,
}: {
  card: BulkCard;
  number: number;
  categories: SelectOption[];
  canRemove: boolean;
  /** True while the batch is being created. */
  locked: boolean;
  onValues: (patch: Partial<QuickProductValues>) => void;
  onFiles: (update: (current: StagedFile[]) => StagedFile[]) => void;
  onUploading: (uploading: boolean) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  if (card.status === "created" && card.created) return <CreatedCard card={card} number={number} />;

  const { values, errors } = card;
  const busy = locked || card.status === "creating";
  const hasPhoto = card.files.some((file) => file.kind === "image");
  const heading = values.title.trim() || `Product ${number}`;
  const headingId = `bulk-${card.key}-heading`;

  return (
    <Card
      aria-labelledby={headingId}
      aria-busy={card.status === "creating" || undefined}
      role="group"
      className={cn("flex flex-col gap-6 p-6", card.status === "failed" && "border-error-500", card.status === "creating" && "border-primary-300")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-small font-medium uppercase tracking-wide text-neutral-500">Product {number}</p>
          <h2 id={headingId} className="truncate text-h3 text-neutral-900">
            {heading}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CardStatusLabel status={card.status} />
          <IconButton
            label={`Duplicate ${heading}`}
            icon={<CopyIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
            onClick={onDuplicate}
            disabled={busy}
          />
          {canRemove ? (
            <IconButton
              label={`Remove ${heading}`}
              icon={<TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
              onClick={onRemove}
              disabled={busy}
            />
          ) : null}
        </div>
      </div>

      {card.message ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-error-100 px-4 py-3 text-body text-error-700">
          <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
          {card.message}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Field id={fieldId(card, "title")} label="Product name" required error={errors.title}>
            {(control) => (
              <Input
                {...control}
                value={values.title}
                onChange={(event) => onValues({ title: event.target.value })}
                maxLength={120}
                placeholder="e.g. Silver jhumka earrings"
                autoComplete="off"
                disabled={busy}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field id={fieldId(card, "categoryId")} label="Category" required error={errors.categoryId}>
              {(control) => (
                <Select
                  {...control}
                  value={values.categoryId}
                  onValueChange={(categoryId) => onValues({ categoryId })}
                  options={categories}
                  placeholder="Choose a category"
                  disabled={busy}
                />
              )}
            </Field>
            <Field id={fieldId(card, "stock")} label="In stock" error={errors.stock}>
              {(control) => (
                <Input
                  {...control}
                  value={values.stock}
                  onChange={(event) => onValues({ stock: event.target.value.replace(/[^\d]/g, "") })}
                  inputMode="numeric"
                  maxLength={6}
                  disabled={busy}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={fieldId(card, "price")} label="Price" required error={errors.price}>
              {(control) => (
                <Input
                  {...control}
                  value={values.price}
                  onChange={(event) => onValues({ price: event.target.value })}
                  leadingIcon={<span className="text-body font-medium">Rs.</span>}
                  inputMode="decimal"
                  placeholder="2,499"
                  autoComplete="off"
                  disabled={busy}
                />
              )}
            </Field>
            <Field id={fieldId(card, "compareAtPrice")} label="Was price" hint="Optional. Shows the item as on sale." error={errors.compareAtPrice}>
              {(control) => (
                <Input
                  {...control}
                  value={values.compareAtPrice}
                  onChange={(event) => onValues({ compareAtPrice: event.target.value })}
                  leadingIcon={<span className="text-body font-medium">Rs.</span>}
                  inputMode="decimal"
                  placeholder="2,999"
                  autoComplete="off"
                  disabled={busy}
                />
              )}
            </Field>
          </div>

          <Field
            id={fieldId(card, "shortDescription")}
            label="Short description"
            hint={`Optional · ${values.shortDescription.length}/${DESCRIPTION_MAX}`}
            error={errors.shortDescription}
          >
            {(control) => (
              <textarea
                {...control}
                value={values.shortDescription}
                onChange={(event) => onValues({ shortDescription: event.target.value })}
                rows={2}
                maxLength={DESCRIPTION_MAX}
                placeholder="One or two lines shoppers see under the name."
                disabled={busy}
                className={cn(fieldControlClasses, "h-auto resize-y py-3")}
              />
            )}
          </Field>
        </div>

        <MediaStrip
          stagingId={card.stagingId}
          files={card.files}
          onChange={onFiles}
          onUploadingChange={onUploading}
          productName={values.title}
          disabled={busy}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={fieldId(card, "publish")} className={cn("flex items-center gap-3", (busy || !hasPhoto) && "cursor-not-allowed")}>
          <button
            id={fieldId(card, "publish")}
            type="button"
            role="switch"
            aria-checked={values.publish}
            aria-describedby={`${fieldId(card, "publish")}-hint`}
            disabled={busy || (!hasPhoto && !values.publish)}
            onClick={() => onValues({ publish: !values.publish })}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
              values.publish ? "bg-primary-500" : "bg-neutral-300",
            )}
          >
            <span
              aria-hidden="true"
              className={cn("inline-block size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none", values.publish ? "translate-x-5" : "translate-x-0.5")}
            />
          </button>
          <span className="flex flex-col">
            <span className="text-body font-medium text-neutral-900">Publish now</span>
            <span id={`${fieldId(card, "publish")}-hint`} className={cn("text-small", errors.publish ? "text-error-700" : "text-neutral-500")}>
              {errors.publish ?? (hasPhoto ? "Off saves it as a draft you can finish later." : "Add a photo to publish. Without one it's saved as a draft.")}
            </span>
          </span>
        </label>
        {card.uploading ? <p className="text-small text-neutral-500">Uploading files…</p> : null}
      </div>
    </Card>
  );
}

function CardStatusLabel({ status }: { status: CardStatus }) {
  if (status === "waiting") return <Badge tone="neutral">Waiting</Badge>;
  if (status === "creating") return <Badge tone="new">Creating…</Badge>;
  if (status === "failed")
    return (
      <span className="flex items-center gap-1 text-small font-medium text-error-700">
        <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
        Needs attention
      </span>
    );
  return null;
}

function CreatedCard({ card, number }: { card: BulkCard; number: number }) {
  const created = card.created!;
  const cover = card.files.find((file) => file.kind === "image");
  const photos = card.files.filter((file) => file.kind === "image").length;
  const videos = card.files.length - photos;
  return (
    <Card role="group" aria-label={`Product ${number}: ${card.values.title}, created`} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-100 text-neutral-500">
        {cover ? <Image src={cover.previewUrl} alt="" fill unoptimized sizes="64px" className="object-cover" /> : <ImageIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-body font-medium text-neutral-900">{card.values.title}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-neutral-500">
          <span className="flex items-center gap-1 font-medium text-success-700">
            <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
            {created.published ? "Created and live" : "Created as draft"}
          </span>
          <span>
            {photos} {photos === 1 ? "photo" : "photos"}
            {videos > 0 ? `, ${videos} ${videos === 1 ? "video" : "videos"}` : ""}
          </span>
          {created.mediaRejected > 0 ? (
            <span className="text-error-700">
              {created.mediaRejected} {created.mediaRejected === 1 ? "file was" : "files were"} rejected
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link href={`/admin/products/${created.id}/edit`} className={buttonClasses({ variant: "tertiary", size: "md" })}>
          <PencilSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          Open in editor
        </Link>
        {created.published ? (
          <Link href={`/products/${created.slug}`} className={buttonClasses({ variant: "text", size: "md" })}>
            View on store
            <ArrowSquareOutIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
