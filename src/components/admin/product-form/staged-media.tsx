"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { ArrowDownIcon, ArrowUpIcon, CheckCircleIcon, ImageIcon, TrashIcon, UploadSimpleIcon, WarningCircleIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { discardStagedMediaAction } from "@/features/admin/actions/products";
import { MAX_STAGED_PHOTOS } from "@/features/admin/product-form/file-signature";
import { ACCEPTED_IMAGE_TYPES, uploadPhotoFile } from "./upload-photo";

/*
 * Photos on the Add product page. They upload to a staging folder right away
 * (so large files don't hold up saving) and are checked and attached, in this
 * order, when the product is created. Linking a photo to a variant happens in
 * the editor afterwards, once the variants exist.
 */

export type StagedPhoto = {
  key: string;
  path: string;
  name: string;
  /** Local object URL for the preview; never sent to the server. */
  previewUrl: string;
  altText: string;
  warning?: string;
};

type Failure = { key: string; name: string; message: string };

export function StagedMedia({ stagingId, photos, onChange }: { stagingId: string; photos: StagedPhoto[]; onChange: Dispatch<SetStateAction<StagedPhoto[]>> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [uploading, setUploading] = useState<string[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);

  // Free the local previews when the page goes away.
  useEffect(() => () => latest.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), []);

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const room = MAX_STAGED_PHOTOS - photos.length;
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const accepted = files.slice(0, Math.max(0, room));
    const nextFailures: Failure[] = files.slice(accepted.length).map((file) => ({
      key: `${file.name}-${Math.random()}`,
      name: file.name,
      message: `Add at most ${MAX_STAGED_PHOTOS} photos before creating the product.`,
    }));

    // One at a time keeps the gallery in the order the files were chosen.
    for (const file of accepted) {
      setUploading((current) => [...current, file.name]);
      const result = await uploadPhotoFile({ stagingId }, file);
      setUploading((current) => current.filter((name) => name !== file.name));
      if (result.ok) {
        const photo: StagedPhoto = { key: result.path, path: result.path, name: file.name, previewUrl: URL.createObjectURL(file), altText: "", warning: result.warning };
        onChange((current) => [...current, photo]);
      } else {
        nextFailures.push({ key: `${file.name}-${Math.random()}`, name: file.name, message: result.message });
      }
    }
    setFailures(nextFailures);
  }

  function update(key: string, altText: string) {
    onChange((current) => current.map((photo) => (photo.key === key ? { ...photo, altText } : photo)));
  }

  function move(index: number, offset: -1 | 1) {
    onChange((current) => {
      const next = [...current];
      const target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function remove(photo: StagedPhoto) {
    onChange((current) => current.filter((item) => item.key !== photo.key));
    URL.revokeObjectURL(photo.previewUrl);
    void discardStagedMediaAction({ stagingId, path: photo.path });
  }

  const busy = uploading.length > 0;

  return (
    <Card id="media" className="flex scroll-mt-24 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2 text-neutral-900">Media</h2>
          <p className="text-body text-neutral-500">
            JPEG, PNG, WebP or AVIF up to 10 MB. The first photo is the cover. Photos are added when you create the product; you can tie them to variants afterwards.
          </p>
        </div>
        <div>
          <input ref={inputRef} id={inputId} type="file" accept={ACCEPTED_IMAGE_TYPES} multiple className="sr-only" onChange={onFiles} disabled={busy} tabIndex={-1} />
          <Button
            variant="secondary"
            size="md"
            loading={busy}
            disabled={photos.length >= MAX_STAGED_PHOTOS}
            onClick={() => inputRef.current?.click()}
            leadingIcon={<UploadSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
          >
            Upload photos
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-1">
        {uploading.map((name) => (
          <p key={name} className="flex items-center gap-2 text-small text-neutral-700">
            <span aria-hidden="true" className="size-3 shrink-0 animate-pulse rounded-full bg-primary-300 motion-reduce:animate-none" />
            <span>
              <span className="font-medium">{name}</span>: uploading…
            </span>
          </p>
        ))}
        {failures.map((failure) => (
          <p key={failure.key} className="flex items-start gap-2 text-small text-error-700">
            <WarningCircleIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-medium">{failure.name}</span>: {failure.message}
            </span>
          </p>
        ))}
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-neutral-300 px-6 py-12 text-center">
          <ImageIcon aria-hidden="true" size={32} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
          <p className="text-body font-medium text-neutral-900">No photos yet</p>
          <p className="text-body text-neutral-500">Products without photos show a placeholder on the storefront.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-4" aria-label="Photos to add">
          {photos.map((photo, index) => {
            const label = `photo ${index + 1}`;
            return (
              <li key={photo.key} className="grid gap-4 rounded-md border border-neutral-200 p-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
                <div className="flex flex-col gap-2">
                  <span className="relative block aspect-square w-full overflow-hidden rounded-md bg-neutral-100">
                    <Image src={photo.previewUrl} alt="" fill unoptimized sizes="128px" className="object-cover" />
                  </span>
                  <div className="flex items-center justify-between gap-1">
                    {index === 0 ? (
                      <Badge size="sm" tone="new">
                        Cover
                      </Badge>
                    ) : (
                      <span className="text-small text-neutral-500">#{index + 1}</span>
                    )}
                    <div className="flex">
                      <button type="button" aria-label={`Move ${label} earlier`} disabled={index === 0} onClick={() => move(index, -1)} className={iconButtonClasses({ variant: "ghost", size: "sm" })}>
                        <ArrowUpIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${label} later`}
                        disabled={index === photos.length - 1}
                        onClick={() => move(index, 1)}
                        className={iconButtonClasses({ variant: "ghost", size: "sm" })}
                      >
                        <ArrowDownIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-3">
                  <p className="flex items-center gap-2 truncate text-small text-neutral-500">
                    <CheckCircleIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} className="shrink-0 text-success-700" />
                    <span className="truncate">{photo.name}</span>
                  </p>
                  {photo.warning ? <p className="text-small text-warning-700">{photo.warning}</p> : null}
                  <Field label={`Alt text for ${label}`} hint={photo.altText ? undefined : <span className="text-warning-700">Missing alt text</span>}>
                    {(control) => (
                      <Input
                        {...control}
                        value={photo.altText}
                        onChange={(event) => update(photo.key, event.target.value)}
                        maxLength={200}
                        placeholder="e.g. Gold hoop earrings on a model"
                      />
                    )}
                  </Field>
                  <button
                    type="button"
                    onClick={() => remove(photo)}
                    className={buttonClasses({ variant: "tertiary", size: "md", className: "w-fit" })}
                  >
                    <TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                    Remove photo
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
