"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, useTransition, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { CubeIcon, ImageIcon, UploadSimpleIcon, WarningCircleIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchArProductAction, saveArAssetAction, searchArProductsAction } from "@/features/admin/actions/ar";
import {
  AR_ANCHORS,
  AR_MODE_FORMATS,
  AR_MODE_HINTS,
  AR_MODE_LABELS,
  AR_MODES,
  AR_PLACEMENTS,
  CALIBRATION_LIMITS,
  formatSuitsMode,
  type ArMode,
  type ArPlacement,
} from "@/features/admin/ar-forms";
import { humanize } from "@/features/admin/format";
import type { ArAssetFormValues, ArProduct } from "@/features/admin/queries/ar-editor";
import type { PickerProduct } from "@/features/admin/queries/collection-editor";
import { editorGridClasses } from "./admin-ui";
import { CheckboxField, SaveCard, useEditorForm } from "./editor-parts";
import { FormSection } from "./product-form/fields";
import { ProductPicker } from "./product-picker";
import { acceptFor, formatList, uploadArFile } from "./upload-ar-asset";

/*
 * Add/Edit AR asset (prompts/goreto-admin-media-ar.md). Choose the product,
 * the try-on mode and where it's worn, then upload the overlay or model; the
 * accepted file types follow the mode. Calibration is optional and starts
 * collapsed (AGENTS §4.7: progressive disclosure). No 3D viewer is loaded
 * here (AGENTS §14.3).
 */

type AssetFile = { path: string; format: string; previewUrl: string | null; local: boolean; name: string | null };

const isImage = (format: string) => format === "png" || format === "webp";

function toPicker(product: ArProduct): PickerProduct {
  return { id: product.id, title: product.title, status: product.status, thumbnail: product.thumbnail };
}

export function ArAssetForm({
  assetId,
  initialProduct,
  values,
  format,
  fileUrl,
  updatedLabel,
}: {
  assetId: string | null;
  initialProduct: ArProduct | null;
  values: ArAssetFormValues;
  /** Stored format of the current file ("" on create). */
  format: string;
  fileUrl: string | null;
  updatedLabel: string | null;
}) {
  const { state, errors, pending, onSubmit } = useEditorForm(saveArAssetAction);
  const [product, setProduct] = useState<ArProduct | null>(initialProduct);
  const [productError, setProductError] = useState<string | null>(null);
  const [loadingProduct, startLoadingProduct] = useTransition();
  const [variantId, setVariantId] = useState(values.variantId);
  const [mode, setMode] = useState<ArMode>(values.mode);
  const [placement, setPlacement] = useState<ArPlacement>(values.placement);
  const [anchor, setAnchor] = useState(values.calibration.anchor);
  const [file, setFile] = useState<AssetFile | null>(
    values.assetPath ? { path: values.assetPath, format, previewUrl: fileUrl && isImage(format) ? fileUrl : null, local: false, name: null } : null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileLabelId = useId();

  // Free a local preview when it's replaced or the page goes away.
  useEffect(() => () => {
    if (file?.local && file.previewUrl) URL.revokeObjectURL(file.previewUrl);
  }, [file]);

  function chooseProduct(picked: PickerProduct | null) {
    setProductError(null);
    // A file lives in its product's folder, so changing product needs a new upload.
    setFile(null);
    setVariantId("");
    if (!picked) {
      setProduct(null);
      return;
    }
    startLoadingProduct(async () => {
      const response = await fetchArProductAction(picked.id);
      if (response.ok) setProduct(response.product);
      else setProductError(response.message);
    });
  }

  function changePlacement(next: string) {
    const value = next as ArPlacement;
    setPlacement(value);
    if (!AR_ANCHORS[value].includes(anchor)) setAnchor(AR_ANCHORS[value][0]!);
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen || !product) return;
    setUploading(true);
    setUploadError(null);
    const result = await uploadArFile(product.id, chosen, AR_MODE_FORMATS[mode]);
    setUploading(false);
    if (!result.ok) {
      setUploadError(`${chosen.name}: ${result.message}`);
      return;
    }
    setFile({ path: result.path, format: result.format, previewUrl: isImage(result.format) ? URL.createObjectURL(chosen) : null, local: true, name: chosen.name });
  }

  const allowed = AR_MODE_FORMATS[mode];
  const mismatch = file !== null && !formatSuitsMode(mode, file.format);
  const fileError = uploadError ?? errors.assetPath;
  const variantOptions = [{ value: "", label: "All variants" }, ...(product?.variants ?? []).map((variant) => ({ value: variant.id, label: variant.label }))];

  return (
    <form onSubmit={onSubmit} noValidate className={editorGridClasses}>
      {assetId ? <input type="hidden" name="assetId" value={assetId} /> : null}
      <input type="hidden" name="productId" value={product?.id ?? ""} />
      <input type="hidden" name="assetPath" value={file?.path ?? ""} />

      <div className="flex min-w-0 flex-col gap-6">
        <FormSection id="product" title="Product" description="The product shoppers try on. Pick a variant when only one colour or finish has this artwork.">
          {assetId && product ? (
            <p className="text-body text-neutral-700">
              <span className="font-medium text-neutral-900">{product.title}</span>. To use this artwork on another product, add a new asset there.
            </p>
          ) : assetId ? (
            <p className="text-body text-neutral-500">You can&apos;t see this asset&apos;s product.</p>
          ) : (
            <ProductPicker
              search={searchArProductsAction}
              selected={product ? toPicker(product) : null}
              onSelect={chooseProduct}
              hint="Type at least 2 letters. Staff without catalog access see live products only."
              error={productError ?? errors.productId}
            />
          )}
          {loadingProduct ? <p className="text-small text-neutral-700">Loading variants…</p> : null}
          <Field label="Variant" error={errors.variantId} hint="“All variants” uses this file for every option.">
            {(control) => <Select {...control} name="variantId" options={variantOptions} value={variantId} onValueChange={setVariantId} disabled={!product} />}
          </Field>
        </FormSection>

        <FormSection id="try-on" title="Try-on" description="How the product is shown on the shopper and where it sits.">
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Mode" error={errors.mode} hint={AR_MODE_HINTS[mode]}>
              {(control) => (
                <Select
                  {...control}
                  name="mode"
                  value={mode}
                  onValueChange={(value) => setMode(value as ArMode)}
                  options={AR_MODES.map((value) => ({ value, label: AR_MODE_LABELS[value] }))}
                />
              )}
            </Field>
            <Field label="Worn on" error={errors.placement}>
              {(control) => (
                <Select
                  {...control}
                  name="placement"
                  value={placement}
                  onValueChange={changePlacement}
                  options={AR_PLACEMENTS.map((value) => ({ value, label: humanize(value) }))}
                />
              )}
            </Field>
          </div>

          <div role="group" aria-labelledby={fileLabelId} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span id={fileLabelId} className="text-body font-medium text-neutral-900">
                File
              </span>
              <span className="text-small text-neutral-500">
                {formatList(allowed)} up to 25 MB. {mode === "live_3d" ? "No preview is shown for models." : "Use a transparent background."}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                {file?.previewUrl ? (
                  <Image src={file.previewUrl} alt="" fill unoptimized sizes="128px" className="object-contain p-2" />
                ) : file ? (
                  <CubeIcon aria-hidden="true" size={32} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
                ) : (
                  <ImageIcon aria-hidden="true" size={32} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <p className="truncate text-body text-neutral-700">
                  {file ? `${file.name ?? "Current file"} · ${file.format.toUpperCase()}` : "No file yet"}
                </p>
                {file && !file.local && !fileUrl ? (
                  <p className="text-small text-warning-700">This asset points at a file that was never uploaded here. Upload one.</p>
                ) : null}
                <input
                  ref={inputRef}
                  type="file"
                  accept={acceptFor(allowed)}
                  className="sr-only"
                  onChange={onFile}
                  disabled={uploading || !product}
                  tabIndex={-1}
                />
                <Button
                  variant="secondary"
                  size="md"
                  className="w-fit"
                  loading={uploading}
                  disabled={!product}
                  onClick={() => inputRef.current?.click()}
                  leadingIcon={<UploadSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
                >
                  {file ? "Replace file" : "Upload file"}
                </Button>
              </div>
            </div>

            <div aria-live="polite">
              {!product ? <p className="text-small text-neutral-500">Choose a product first.</p> : null}
              {uploading ? <p className="text-small text-neutral-700">Uploading…</p> : null}
              {mismatch && !fileError ? (
                <p className="text-small text-warning-700">
                  {AR_MODE_LABELS[mode]} needs a {formatList(allowed)} file. Upload one, or switch the mode back.
                </p>
              ) : null}
              {fileError ? (
                <p role="alert" className="flex items-start gap-1 text-small text-error-700">
                  <WarningCircleIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
                  {fileError}
                </p>
              ) : null}
            </div>
          </div>
        </FormSection>

        <details className="rounded-lg border border-neutral-200 bg-white" open={Boolean(errors.anchor || errors.scale || errors.offsetX || errors.offsetY || errors.rotationDeg)}>
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg px-6 py-4 text-h3 text-neutral-900">
            Advanced calibration
            <span className="text-small font-normal text-neutral-500">Optional. The defaults suit most artwork.</span>
          </summary>
          <div className="flex flex-col gap-6 border-t border-neutral-200 p-6">
            <Field label="Anchor" error={errors.anchor} hint="The body point the file is pinned to.">
              {(control) => (
                <Select {...control} name="anchor" value={anchor} onValueChange={setAnchor} options={AR_ANCHORS[placement].map((value) => ({ value, label: humanize(value) }))} />
              )}
            </Field>
            <div className="grid gap-6 md:grid-cols-2">
              <NumberField name="scale" label="Scale" hint="1 = the size the file was drawn at." defaultValue={values.calibration.scale} step="0.01" limits={CALIBRATION_LIMITS.scale} error={errors.scale} />
              <NumberField name="rotationDeg" label="Rotation (degrees)" hint="Clockwise is positive." defaultValue={values.calibration.rotation_deg} step="1" limits={CALIBRATION_LIMITS.rotation} error={errors.rotationDeg} />
              <NumberField name="offsetX" label="Horizontal offset" hint="Share of the anchor's width; right is positive." defaultValue={values.calibration.offset_x} step="0.01" limits={CALIBRATION_LIMITS.offset} error={errors.offsetX} />
              <NumberField name="offsetY" label="Vertical offset" hint="Share of the anchor's height; down is positive." defaultValue={values.calibration.offset_y} step="0.01" limits={CALIBRATION_LIMITS.offset} error={errors.offsetY} />
            </div>
          </div>
        </details>
      </div>

      <SaveCard title="Status" submitLabel={assetId ? "Save changes" : "Add AR asset"} pending={pending || uploading} state={state} updatedLabel={updatedLabel}>
        <CheckboxField
          name="isActive"
          defaultChecked={values.isActive}
          label="Active"
          description="Live products with an active asset show AR READY in the store."
        />
      </SaveCard>
    </form>
  );
}

function NumberField({
  name,
  label,
  hint,
  defaultValue,
  step,
  limits,
  error,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: number;
  step: string;
  limits: { min: number; max: number };
  error?: string;
}) {
  return (
    <Field label={label} hint={`${hint} ${limits.min} to ${limits.max}.`} error={error}>
      {(control) => (
        <Input {...control} name={name} type="number" inputMode="decimal" defaultValue={defaultValue} step={step} min={limits.min} max={limits.max} className="tabular-nums" />
      )}
    </Field>
  );
}
