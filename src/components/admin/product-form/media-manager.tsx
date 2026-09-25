"use client";

import { startTransition, useActionState, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { ArrowDownIcon, ArrowUpIcon, CheckCircleIcon, ImageIcon, TrashIcon, UploadSimpleIcon, WarningCircleIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  attachProductMediaAction,
  deleteProductMediaAction,
  reorderProductMediaAction,
  updateProductMediaAction,
} from "@/features/admin/actions/products";
import type { ActionResult } from "@/features/admin/auth";
import type { EditorMedia } from "@/features/admin/queries/product-editor";
import { cn } from "@/lib/utils/cn";
import { ActionMessage, FormDialog, HiddenFields } from "../action-forms";
import { Thumb } from "../admin-ui";
import { ACCEPTED_IMAGE_TYPES, uploadPhotoFile } from "./upload-photo";

/*
 * Product photos (AGENTS §18.3–18.4). Files go straight from the browser to
 * Storage on a signed URL the server issues for a path it chooses; the server
 * then checks the stored bytes before the photo joins the gallery. The first
 * photo is the cover. Photos can belong to one variant or all of them.
 */

type UploadStatus = { id: string; name: string; state: "uploading" | "done" | "error"; message?: string };

async function uploadPhoto(productId: string, file: File): Promise<{ ok: boolean; message?: string }> {
  const uploaded = await uploadPhotoFile({ productId }, file);
  if (!uploaded.ok) return uploaded;
  const attached = await attachProductMediaAction({ productId, path: uploaded.path, altText: "", variantId: null });
  if (!attached.ok) return { ok: false, message: attached.message };
  return { ok: true, message: uploaded.warning ? `Uploaded. ${uploaded.warning}` : undefined };
}

export function MediaManager({
  productId,
  media,
  variants,
}: {
  productId: string;
  media: EditorMedia[];
  variants: { id: string; label: string }[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [reorderState, reorder, reordering] = useActionState(reorderProductMediaAction, null);

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    const batch = files.map((file) => ({ id: `${file.name}-${file.lastModified}-${Math.random()}`, name: file.name, state: "uploading" as const }));
    setUploads(batch);
    // One at a time keeps the gallery order the same as the chosen order.
    for (const [index, file] of files.entries()) {
      const outcome = await uploadPhoto(productId, file);
      setUploads((current) =>
        current.map((item) => (item.id === batch[index]!.id ? { ...item, state: outcome.ok ? "done" : "error", message: outcome.message } : item)),
      );
    }
    setBusy(false);
  }

  function move(index: number, offset: -1 | 1) {
    const ids = media.map((item) => item.id);
    const target = index + offset;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("mediaIds", ids.join(","));
    startTransition(() => reorder(formData));
  }

  return (
    <Card id="media" className="flex scroll-mt-24 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2 text-neutral-900">Media</h2>
          <p className="text-body text-neutral-500">
            JPEG, PNG, WebP or AVIF up to 10 MB. The first photo is the cover. Alt text describes the photo for screen readers.
          </p>
        </div>
        <div>
          <input ref={inputRef} id={inputId} type="file" accept={ACCEPTED_IMAGE_TYPES} multiple className="sr-only" onChange={onFiles} disabled={busy} />
          <Button
            variant="secondary"
            size="md"
            loading={busy}
            onClick={() => inputRef.current?.click()}
            leadingIcon={<UploadSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
          >
            Upload photos
          </Button>
        </div>
      </div>

      {uploads.length > 0 ? (
        <ul aria-live="polite" className="flex flex-col gap-1 rounded-md bg-neutral-50 p-4">
          {uploads.map((item) => (
            <li key={item.id} className={cn("flex items-start gap-2 text-small", item.state === "error" ? "text-error-700" : "text-neutral-700")}>
              {item.state === "error" ? (
                <WarningCircleIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
              ) : item.state === "done" ? (
                <CheckCircleIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-success-700" />
              ) : (
                <span aria-hidden="true" className="mt-1 size-3 shrink-0 animate-pulse rounded-full bg-primary-300 motion-reduce:animate-none" />
              )}
              <span>
                <span className="font-medium">{item.name}</span>: {item.state === "uploading" ? "uploading…" : item.message ?? "uploaded."}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <ActionMessage state={reorderState && !reorderState.ok ? reorderState : null} />

      {media.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-neutral-300 px-6 py-12 text-center">
          <ImageIcon aria-hidden="true" size={32} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
          <p className="text-body font-medium text-neutral-900">No photos yet</p>
          <p className="text-body text-neutral-500">Products without photos show a placeholder on the storefront.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-4">
          {media.map((item, index) => (
            <MediaItem
              key={`${item.id}-${item.altText}-${item.variantId ?? ""}`}
              item={item}
              position={index}
              count={media.length}
              variants={variants}
              reordering={reordering}
              onMove={(offset) => move(index, offset)}
            />
          ))}
        </ol>
      )}
    </Card>
  );
}

function MediaItem({
  item,
  position,
  count,
  variants,
  reordering,
  onMove,
}: {
  item: EditorMedia;
  position: number;
  count: number;
  variants: { id: string; label: string }[];
  reordering: boolean;
  onMove: (offset: -1 | 1) => void;
}) {
  const [state, save, saving] = useActionState<ActionResult | null, FormData>(updateProductMediaAction, null);
  const label = `photo ${position + 1}`;

  // Submitted by hand so typed alt text survives a validation error.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => save(formData));
  }

  return (
    <li className="grid gap-4 rounded-md border border-neutral-200 p-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <Thumb src={item.url} sizes="128px" className="aspect-square size-auto w-full rounded-md" />
        <div className="flex items-center justify-between gap-1">
          {position === 0 ? (
            <Badge size="sm" tone="new">
              Cover
            </Badge>
          ) : (
            <span className="text-small text-neutral-500">#{position + 1}</span>
          )}
          <div className="flex">
            <button
              type="button"
              aria-label={`Move ${label} earlier`}
              disabled={position === 0 || reordering}
              onClick={() => onMove(-1)}
              className={iconButtonClasses({ variant: "ghost", size: "sm" })}
            >
              <ArrowUpIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            </button>
            <button
              type="button"
              aria-label={`Move ${label} later`}
              disabled={position === count - 1 || reordering}
              onClick={() => onMove(1)}
              className={iconButtonClasses({ variant: "ghost", size: "sm" })}
            >
              <ArrowDownIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <HiddenFields values={{ mediaId: item.id }} />
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field
              label={`Alt text for ${label}`}
              error={state && !state.ok ? state.fieldErrors?.altText : undefined}
              hint={item.altText ? undefined : <span className="text-warning-700">Missing alt text</span>}
            >
              {(control) => <Input {...control} name="altText" defaultValue={item.altText} maxLength={200} placeholder="e.g. Gold hoop earrings on a model" />}
            </Field>
            <Field label="Shown for" error={state && !state.ok ? state.fieldErrors?.variantId : undefined}>
              {(control) => (
                <Select {...control} name="variantId" defaultValue={item.variantId ?? ""}>
                  <option value="">All variants</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="tertiary" size="md" loading={saving}>
              Save photo details
            </Button>
            <ActionMessage state={state} />
          </div>
        </form>
        <div className="flex">
          <FormDialog
            action={deleteProductMediaAction}
            hidden={{ mediaId: item.id }}
            title="Delete this photo?"
            description="It's removed from the gallery and from storage. This can't be undone."
            triggerLabel="Delete photo"
            triggerIcon={<TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
            submitLabel="Delete photo"
          >
            <Thumb src={item.url} sizes="96px" className="size-24 rounded-md" />
          </FormDialog>
        </div>
      </div>
    </li>
  );
}
