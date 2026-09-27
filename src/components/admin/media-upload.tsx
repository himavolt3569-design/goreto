"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { CheckCircleIcon, UploadSimpleIcon, WarningCircleIcon, XIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { searchMediaProductsAction } from "@/features/admin/actions/media";
import { attachProductMediaAction } from "@/features/admin/actions/products";
import type { PickerProduct } from "@/features/admin/queries/collection-editor";
import { Panel } from "./admin-ui";
import { ProductPicker } from "./product-picker";
import { ACCEPTED_IMAGE_TYPES, uploadPhotoFile } from "./product-form/upload-photo";

/*
 * Upload photos to a product from the media library. Uses the product
 * editor's upload and attach actions, so the same permission, path and byte
 * checks apply; photos join the end of the product's gallery.
 */

const MAX_FILES = 20;

type Row = {
  key: string;
  file: File;
  altText: string;
  status: "ready" | "uploading" | "done" | "error";
  message?: string;
};

export function MediaUpload() {
  const [product, setProduct] = useState<PickerProduct | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, change: Partial<Row>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    const waiting = rows.filter((row) => row.status !== "done");
    const room = Math.max(0, MAX_FILES - waiting.length);
    setNotice(files.length > room ? `Add at most ${MAX_FILES} photos at a time.` : null);
    setRows([...waiting, ...files.slice(0, room).map((file) => ({ key: crypto.randomUUID(), file, altText: "", status: "ready" as const }))]);
  }

  async function upload() {
    if (!product) return;
    setBusy(true);
    setNotice(null);
    let added = 0;
    for (const row of rows.filter((item) => item.status === "ready" || item.status === "error")) {
      update(row.key, { status: "uploading", message: undefined });
      const uploaded = await uploadPhotoFile({ productId: product.id }, row.file);
      if (!uploaded.ok) {
        update(row.key, { status: "error", message: uploaded.message });
        continue;
      }
      const attached = await attachProductMediaAction({ productId: product.id, path: uploaded.path, altText: row.altText, variantId: null });
      if (!attached.ok) {
        update(row.key, { status: "error", message: attached.message });
        continue;
      }
      added += 1;
      update(row.key, { status: "done", message: uploaded.warning });
    }
    setBusy(false);
    if (added > 0) setNotice(`${added} ${added === 1 ? "photo" : "photos"} added to ${product.title}.`);
  }

  const pending = rows.filter((row) => row.status === "ready" || row.status === "error").length;

  return (
    <Panel title="Upload photos" description="Add photos to a product's gallery. They go after its existing photos; reorder them in the product editor." bodyClassName="flex flex-col gap-6 px-6 pb-6">
      <ProductPicker
        search={searchMediaProductsAction}
        selected={product}
        onSelect={(next) => {
          setProduct(next);
          setNotice(null);
        }}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" multiple accept={ACCEPTED_IMAGE_TYPES} className="sr-only" onChange={onFiles} disabled={busy} tabIndex={-1} />
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            leadingIcon={<UploadSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
          >
            Choose photos
          </Button>
          <Button size="md" loading={busy} disabled={!product || pending === 0} onClick={upload}>
            {pending > 0 ? `Upload ${pending} ${pending === 1 ? "photo" : "photos"}` : "Upload"}
          </Button>
          <span className="text-small text-neutral-500">JPEG, PNG, WebP or AVIF up to 10 MB each.</span>
        </div>

        {rows.length > 0 ? (
          <ul aria-label="Photos to upload" className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {rows.map((row) => (
              <li key={row.key} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4">
                <span className="min-w-0 truncate text-body font-medium text-neutral-900 md:w-56 md:shrink-0">{row.file.name}</span>
                <Input
                  aria-label={`Alt text for ${row.file.name}`}
                  placeholder="Alt text (describe the photo)"
                  value={row.altText}
                  maxLength={200}
                  disabled={row.status === "uploading" || row.status === "done"}
                  onChange={(event) => update(row.key, { altText: event.target.value })}
                  className="md:flex-1"
                />
                <RowStatus row={row} />
                {row.status === "done" || row.status === "uploading" ? null : (
                  <button
                    type="button"
                    aria-label={`Remove ${row.file.name}`}
                    disabled={busy}
                    onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                    className={iconButtonClasses({ variant: "ghost", size: "sm" })}
                  >
                    <XIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        <p aria-live="polite" className="text-small text-neutral-700">
          {!product && rows.length > 0 ? "Choose a product to upload to." : notice}
        </p>
      </div>
    </Panel>
  );
}

function RowStatus({ row }: { row: Row }) {
  if (row.status === "uploading") return <span className="text-small text-neutral-700 md:w-40">Uploading…</span>;
  if (row.status === "done") {
    return (
      <span className="flex items-start gap-1 text-small text-success-700 md:w-40">
        <CheckCircleIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
        {row.message ? <span className="text-warning-700">Added. {row.message}</span> : "Added"}
      </span>
    );
  }
  if (row.status === "error") {
    return (
      <span role="alert" className="flex items-start gap-1 text-small text-error-700 md:w-40">
        <WarningCircleIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
        {row.message}
      </span>
    );
  }
  return <span className="text-small text-neutral-500 md:w-40">Ready</span>;
}
