"use client";

import Image from "next/image";
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { ICON_SIZE, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { CaretLeftIcon, CaretRightIcon, ImageIcon, PlayCircleIcon, UploadSimpleIcon, VideoCameraIcon, WarningCircleIcon, XIcon } from "@/components/ui/icons";
import { discardStagedMediaAction } from "@/features/admin/actions/products";
import { MAX_PHOTOS, MAX_VIDEOS, type MediaKind } from "@/features/admin/product-form/file-signature";
import { cn } from "@/lib/utils/cn";
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES, uploadMediaFile } from "../product-form/upload-photo";

/*
 * Photos and videos for one Bulk add card. Files upload to the card's staging
 * folder as soon as they're chosen, so creating the product only has to check
 * and attach them. Photos come first (the first is the cover), then videos.
 */

export type StagedFile = {
  key: string;
  path: string;
  kind: MediaKind;
  name: string;
  /** Local object URL for the preview; never sent to the server. */
  previewUrl: string;
  warning?: string;
};

type Failure = { key: string; name: string; message: string };

const LIMITS: Record<MediaKind, number> = { image: MAX_PHOTOS, video: MAX_VIDEOS };

const tileButton =
  "flex size-8 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40";

/** Photos first, then videos, each kind keeping its own order. */
export function orderedMedia(files: StagedFile[]): StagedFile[] {
  return [...files.filter((file) => file.kind === "image"), ...files.filter((file) => file.kind === "video")];
}

export function MediaStrip({
  stagingId,
  files,
  onChange,
  onUploadingChange,
  productName,
  disabled = false,
}: {
  stagingId: string;
  files: StagedFile[];
  onChange: (update: (current: StagedFile[]) => StagedFile[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  productName: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();
  const [uploading, setUploading] = useState<{ key: string; name: string }[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [dragging, setDragging] = useState(false);

  const photos = files.filter((file) => file.kind === "image");
  const videos = files.filter((file) => file.kind === "video");
  const full = photos.length >= MAX_PHOTOS && videos.length >= MAX_VIDEOS;
  const busy = uploading.length > 0;

  async function addFiles(chosen: File[]) {
    if (chosen.length === 0 || disabled) return;
    const nextFailures: Failure[] = [];
    // Uploads already in the card plus the ones accepted in this batch.
    const used = { image: photos.length, video: videos.length };
    const queue = chosen.map((file) => ({ file, key: `${file.name}-${file.lastModified}-${Math.random()}` }));
    setUploading((current) => [...current, ...queue.map(({ key, file }) => ({ key, name: file.name }))]);
    onUploadingChange(true);

    // One at a time keeps the gallery in the order the files were chosen.
    for (const { file, key } of queue) {
      const kindGuess: MediaKind = file.type.startsWith("video/") ? "video" : "image";
      if (used[kindGuess] >= LIMITS[kindGuess]) {
        nextFailures.push({ key, name: file.name, message: kindGuess === "video" ? `Up to ${MAX_VIDEOS} videos per product.` : `Up to ${MAX_PHOTOS} photos per product.` });
      } else {
        const result = await uploadMediaFile({ stagingId }, file);
        if (!result.ok) {
          nextFailures.push({ key, name: file.name, message: result.message });
        } else if (used[result.kind] >= LIMITS[result.kind]) {
          // The browser's type guess was wrong and this kind is already full.
          void discardStagedMediaAction({ stagingId, path: result.path });
          nextFailures.push({ key, name: file.name, message: result.kind === "video" ? `Up to ${MAX_VIDEOS} videos per product.` : `Up to ${MAX_PHOTOS} photos per product.` });
        } else {
          used[result.kind] += 1;
          const staged: StagedFile = { key: result.path, path: result.path, kind: result.kind, name: file.name, previewUrl: URL.createObjectURL(file), warning: result.warning };
          onChange((current) => [...current, staged]);
        }
      }
      setUploading((current) => current.filter((item) => item.key !== key));
    }
    onUploadingChange(false);
    setFailures(nextFailures);
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    void addFiles(chosen);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  function move(file: StagedFile, offset: -1 | 1) {
    onChange((current) => {
      const sameKind = current.filter((item) => item.kind === file.kind);
      const index = sameKind.findIndex((item) => item.key === file.key);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= sameKind.length) return current;
      [sameKind[index], sameKind[target]] = [sameKind[target]!, sameKind[index]!];
      const other = current.filter((item) => item.kind !== file.kind);
      return orderedMedia(file.kind === "image" ? [...sameKind, ...other] : [...other, ...sameKind]);
    });
  }

  function remove(file: StagedFile) {
    onChange((current) => current.filter((item) => item.key !== file.key));
    URL.revokeObjectURL(file.previewUrl);
    void discardStagedMediaAction({ stagingId, path: file.path });
  }

  const name = productName.trim() || "this product";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body font-medium text-neutral-900">Photos & videos</p>
        <p id={hintId} className="flex items-center gap-3 text-small text-neutral-500">
          <span className={cn("flex items-center gap-1", photos.length >= MAX_PHOTOS && "text-neutral-900")}>
            <ImageIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
            {photos.length}/{MAX_PHOTOS} photos
          </span>
          <span className={cn("flex items-center gap-1", videos.length >= MAX_VIDEOS && "text-neutral-900")}>
            <VideoCameraIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
            {videos.length}/{MAX_VIDEOS} videos
          </span>
        </p>
      </div>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={`Photos and videos for ${name}`}>
        {orderedMedia(files).map((file) => {
          const sameKind = file.kind === "image" ? photos : videos;
          const position = sameKind.findIndex((item) => item.key === file.key);
          const label = `${file.kind === "image" ? "photo" : "video"} ${position + 1}`;
          return (
            <li key={file.key} className="group relative aspect-square overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
              {file.kind === "image" ? (
                <Image src={file.previewUrl} alt="" fill unoptimized sizes="120px" className="object-cover" />
              ) : (
                <>
                  <video src={file.previewUrl} muted playsInline preload="metadata" aria-hidden="true" className="size-full object-cover" />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-900/20 text-white">
                    <PlayCircleIcon aria-hidden="true" size={ICON_SIZE} weight="fill" />
                  </span>
                </>
              )}
              <span className="absolute left-2 top-2">
                {file.kind === "video" ? (
                  <Badge size="sm" tone="neutral">
                    Video
                  </Badge>
                ) : position === 0 ? (
                  <Badge size="sm" tone="new">
                    Cover
                  </Badge>
                ) : null}
              </span>
              <button type="button" aria-label={`Remove ${label} (${file.name})`} disabled={disabled} onClick={() => remove(file)} className={cn(tileButton, "absolute right-1 top-1")}>
                <XIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
              </button>
              {sameKind.length > 1 ? (
                <span className="absolute inset-x-1 bottom-1 flex justify-between">
                  <button type="button" aria-label={`Move ${label} earlier`} disabled={disabled || position === 0} onClick={() => move(file, -1)} className={tileButton}>
                    <CaretLeftIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${label} later`}
                    disabled={disabled || position === sameKind.length - 1}
                    onClick={() => move(file, 1)}
                    className={tileButton}
                  >
                    <CaretRightIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
                  </button>
                </span>
              ) : null}
              {file.warning ? <span className="sr-only">{file.warning}</span> : null}
            </li>
          );
        })}

        {uploading.map((item) => (
          <li key={item.key} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed border-primary-300 bg-primary-100 p-2 text-center">
            <span aria-hidden="true" className="size-3 animate-pulse rounded-full bg-primary-500 motion-reduce:animate-none" />
            <span className="w-full truncate text-small text-neutral-700">Uploading…</span>
            <span className="sr-only">{item.name}</span>
          </li>
        ))}

        {!full ? (
          <li className="aspect-square">
            <label
              htmlFor={inputId}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex size-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-2 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500",
                dragging ? "border-primary-500 bg-primary-100" : "border-neutral-300 bg-white hover:border-primary-300 hover:bg-primary-100",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <UploadSimpleIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
              <span className="text-small font-medium text-neutral-900">Add</span>
              <span className="sr-only">photos or videos for {name}</span>
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                multiple
                accept={`${ACCEPTED_IMAGE_TYPES},${ACCEPTED_VIDEO_TYPES}`}
                aria-describedby={hintId}
                className="sr-only"
                disabled={disabled}
                onChange={onInput}
              />
            </label>
          </li>
        ) : null}
      </ul>

      <p className="text-small text-neutral-500">
        Photos: JPEG, PNG, WebP or AVIF up to 10 MB. Videos: MP4 or WebM up to 50 MB. Drag files here or choose Add.
        {busy ? " Uploading…" : ""}
      </p>

      {failures.length > 0 || files.some((file) => file.warning) ? (
        <ul aria-live="polite" className="flex flex-col gap-1">
          {failures.map((failure) => (
            <li key={failure.key} className="flex items-start gap-2 text-small text-error-700">
              <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">{failure.name}</span>: {failure.message}
              </span>
            </li>
          ))}
          {files
            .filter((file) => file.warning)
            .map((file) => (
              <li key={`${file.key}-warning`} className="flex items-start gap-2 text-small text-warning-700">
                <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">{file.name}</span>: {file.warning}
                </span>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
