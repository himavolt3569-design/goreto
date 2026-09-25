"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ImageIcon, TrashIcon, UploadSimpleIcon, WarningCircleIcon } from "@/components/ui/icons";
import { createCatalogImageUploadAction } from "@/features/admin/actions/catalog-images";
import type { CatalogImageKind } from "@/features/admin/catalog-forms";
import { cn } from "@/lib/utils/cn";
import { ACCEPTED_IMAGE_TYPES, uploadImageFile } from "./product-form/upload-photo";

/*
 * One image for a category or collection. The file uploads straight to
 * Storage on a server-chosen path; the form then submits only the object key
 * (hidden input `name`), and the save action verifies the stored bytes.
 */

type Preview = { url: string; local: boolean } | null;

export function ImageField({
  kind,
  target,
  name,
  label,
  description,
  defaultPath,
  defaultUrl,
  aspect,
  error,
  onPathChange,
}: {
  kind: CatalogImageKind;
  /** The record being edited, or the create form's staging id. */
  target: { ownerId: string } | { stagingId: string };
  name: string;
  label: string;
  description: string;
  defaultPath: string;
  defaultUrl: string | null;
  aspect: "square" | "wide";
  error?: string;
  onPathChange?: (path: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const labelId = useId();
  const [path, setPath] = useState(defaultPath);
  const [preview, setPreview] = useState<Preview>(defaultUrl ? { url: defaultUrl, local: false } : null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "warning"; text: string } | null>(null);

  // Free a local preview when it's replaced or the page goes away.
  useEffect(() => () => {
    if (preview?.local) URL.revokeObjectURL(preview.url);
  }, [preview]);

  function change(nextPath: string, nextPreview: Preview) {
    setPath(nextPath);
    setPreview(nextPreview);
    onPathChange?.(nextPath);
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const result = await uploadImageFile(file, (request) => createCatalogImageUploadAction({ kind, ...target, ...request }));
    setUploading(false);
    if (!result.ok) {
      setMessage({ tone: "error", text: `${file.name}: ${result.message}` });
      return;
    }
    change(result.path, { url: URL.createObjectURL(file), local: true });
    if (result.warning) setMessage({ tone: "warning", text: result.warning });
  }

  const shownError = message?.tone === "error" ? message.text : error;

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-4">
      <input type="hidden" name={name} value={path} />
      <div className="flex flex-col gap-1">
        <span id={labelId} className="text-body font-medium text-neutral-900">
          {label}
        </span>
        <span className="text-small text-neutral-500">{description}</span>
      </div>

      <div className={cn("relative w-full overflow-hidden rounded-md bg-neutral-100", aspect === "square" ? "aspect-square max-w-60" : "aspect-video max-w-xl")}>
        {preview ? (
          <Image src={preview.url} alt="" fill unoptimized={preview.local} sizes={aspect === "square" ? "240px" : "576px"} className="object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 border border-dashed border-neutral-300 px-6 text-center rounded-md">
            <ImageIcon aria-hidden="true" size={32} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
            <p className="text-body text-neutral-500">No image</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input ref={inputRef} id={inputId} type="file" accept={ACCEPTED_IMAGE_TYPES} className="sr-only" onChange={onFile} disabled={uploading} tabIndex={-1} />
        <Button
          variant="secondary"
          size="md"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
          leadingIcon={<UploadSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
        >
          {preview ? "Replace image" : "Upload image"}
        </Button>
        {preview ? (
          <Button
            variant="tertiary"
            size="md"
            disabled={uploading}
            onClick={() => {
              change("", null);
              setMessage(null);
            }}
            leadingIcon={<TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
          >
            Remove image
          </Button>
        ) : null}
      </div>

      <div aria-live="polite">
        {uploading ? <p className="text-small text-neutral-700">Uploading…</p> : null}
        {message?.tone === "warning" ? <p className="text-small text-warning-700">{message.text}</p> : null}
        {shownError ? (
          <p role="alert" className="flex items-start gap-1 text-small text-error-700">
            <WarningCircleIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
            {shownError}
          </p>
        ) : null}
      </div>
      <p className="text-small text-neutral-500">JPEG, PNG, WebP or AVIF up to 10 MB. The change is saved with the form.</p>
    </div>
  );
}
