"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { ArrowsClockwiseIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { tableClasses, tdClasses, thClasses, theadRowClasses } from "@/components/admin/admin-ui";
import { normalizeSku, skuStem, suggestSku, uniqueKey } from "@/features/admin/product-form/keys";
import { emptyVariant, type ProductFormValues, type VariantFormValues } from "@/features/admin/product-form/schema";
import {
  combinationCount,
  combinationKey,
  combinations,
  MAX_OPTION_VALUES,
  MAX_OPTIONS,
  MAX_VARIANTS,
  mergeVariants,
  renameOptionKey,
  variantsMatchOptions,
} from "@/features/admin/product-form/variant-matrix";
import type { EditorVariantInfo } from "@/features/admin/queries/product-editor";
import { cn } from "@/lib/utils/cn";
import { FormSection, GroupError, useFieldError } from "./fields";

/*
 * Options (Colour, Size, ...) and the variants they produce. Staff edit the
 * options, then choose "Update variants": existing variants keep their SKU,
 * price and stock, new combinations are added, and variants whose
 * combination is gone are listed as "removed on save".
 */

const trimmedOptions = (options: ProductFormValues["options"]) =>
  options.map((option) => ({ name: option.name.trim(), values: option.values }));

/** Unique SKU suggestion given SKUs already in use on the form. */
function freshSku(stem: string, names: string[], optionValues: Record<string, string>, taken: Set<string>): string {
  const base = suggestSku(stem, names, optionValues);
  let sku = base;
  for (let suffix = 2; taken.has(sku); suffix += 1) sku = `${base}-${suffix}`;
  taken.add(sku);
  return sku;
}

/** Fills empty SKUs from the title and options (used on title blur and after updating variants). */
export function fillEmptySkus(values: ProductFormValues): VariantFormValues[] | null {
  if (!values.variants.some((variant) => variant.sku.trim() === "")) return null;
  const stem = skuStem(values.title);
  const names = trimmedOptions(values.options).map((option) => option.name);
  const taken = new Set(values.variants.map((variant) => variant.sku.trim()).filter(Boolean));
  return values.variants.map((variant) => (variant.sku.trim() === "" ? { ...variant, sku: freshSku(stem, names, variant.optionValues, taken) } : variant));
}

export function OptionsVariantsSection({ variantInfo }: { variantInfo: Record<string, EditorVariantInfo> }) {
  const { control, getValues, setValue, setError, clearErrors } = useFormContext<ProductFormValues>();
  const options = useFieldArray({ control, name: "options", keyName: "fieldKey" });
  const variants = useFieldArray({ control, name: "variants", keyName: "fieldKey" });
  const watchedOptions = useWatch({ control, name: "options" });
  const watchedVariants = useWatch({ control, name: "variants" });
  const basePrice = useWatch({ control, name: "basePrice" });
  const [removed, setRemoved] = useState<VariantFormValues[]>([]);

  const optionsNow = trimmedOptions(watchedOptions ?? []);
  const liveKeys = new Set((watchedVariants ?? []).map((variant) => combinationKey(variant.optionValues)));
  const removedKeys = new Set(removed.map((row) => combinationKey(row.optionValues)));
  // In sync: every row fits the options, and every combination has a row or was removed on purpose.
  const inSync =
    variantsMatchOptions(optionsNow, watchedVariants ?? []) &&
    combinations(optionsNow).every((optionValues) => liveKeys.has(combinationKey(optionValues)) || removedKeys.has(combinationKey(optionValues)));
  const pendingRemoval = removed.filter((row) => row.id !== null && !liveKeys.has(combinationKey(row.optionValues)));

  function updateVariants() {
    const current = getValues();
    const opts = trimmedOptions(current.options);
    if (opts.some((option) => option.name === "" || option.values.length === 0)) {
      setError("variants", { type: "manual", message: "Give each option a name and at least one value first." });
      return;
    }
    const count = combinationCount(opts);
    if (count > MAX_VARIANTS) {
      setError("variants", { type: "manual", message: `These options make ${count} variants. The limit is ${MAX_VARIANTS}.` });
      return;
    }
    const stem = skuStem(current.title);
    const names = opts.map((option) => option.name);
    const taken = new Set(current.variants.map((variant) => variant.sku.trim()).filter(Boolean));
    const merged = mergeVariants(opts, current.variants, (optionValues) => emptyVariant(freshSku(stem, names, optionValues, taken), optionValues));
    variants.replace(merged.rows);
    // Regenerating restores every combination, so only rows whose combination is gone stay removed.
    const restored = new Set(merged.rows.map((row) => combinationKey(row.optionValues)));
    setRemoved((previous) => [...previous.filter((row) => !restored.has(combinationKey(row.optionValues))), ...merged.removed]);
    clearErrors("variants");
  }

  function removeVariant(index: number) {
    const row = getValues(`variants.${index}`);
    variants.remove(index);
    setRemoved((previous) => [...previous, row]);
  }

  /** Option label for a variant's value, e.g. "Tan / M". */
  function variantLabel(row: VariantFormValues): string {
    const labels = optionsNow.map((option) => option.values.find((value) => value.value === row.optionValues[option.name])?.label ?? "?");
    return labels.length > 0 ? labels.join(" / ") : "Default";
  }

  function renameOption(index: number, next: string) {
    const previous = getValues(`options.${index}.name`).trim();
    if (previous !== next.trim()) setValue("variants", renameOptionKey(getValues("variants"), previous, next.trim()));
  }

  return (
    <FormSection
      id="variants"
      title="Options & variants"
      description="Options are what shoppers choose, like Colour or Size. Each combination is a variant with its own SKU, price and stock."
    >
      <div className="flex flex-col gap-4">
        {options.fields.map((option, index) => (
          <OptionEditor
            key={option.fieldKey}
            index={index}
            onRemove={() => options.remove(index)}
            onRename={(next) => renameOption(index, next)}
          />
        ))}
        {options.fields.length < MAX_OPTIONS ? (
          <Button
            variant="secondary"
            size="md"
            className="w-fit"
            leadingIcon={<PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
            onClick={() => options.append({ name: "", values: [{ value: "value", label: "", swatchHex: "" }] }, { focusName: `options.${options.fields.length}.name` })}
          >
            {options.fields.length === 0 ? "Add options, like Colour or Size" : "Add another option"}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 border-t border-neutral-200 pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-h3 text-neutral-900">
            Variants <span className="text-neutral-500">({watchedVariants?.length ?? 0})</span>
          </h3>
          <Button
            variant={inSync ? "tertiary" : "primary"}
            size="md"
            leadingIcon={<ArrowsClockwiseIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
            onClick={updateVariants}
          >
            Update variants
          </Button>
        </div>

        {!inSync ? (
          <p role="status" className="rounded-md bg-warning-100 px-4 py-3 text-body text-warning-700">
            The options changed. Choose <strong>Update variants</strong> to match them before saving.
          </p>
        ) : null}
        <GroupError name="variants" />

        <div className="overflow-x-auto rounded-md border border-neutral-200" role="region" aria-label="Variants" tabIndex={0}>
          <table className={cn(tableClasses, "min-w-[880px]")}>
            <thead>
              <tr className={theadRowClasses}>
                <th scope="col" className={thClasses}>Variant</th>
                <th scope="col" className={thClasses}>SKU</th>
                <th scope="col" className={thClasses}>Price (Rs.)</th>
                <th scope="col" className={thClasses}>Weight (g)</th>
                <th scope="col" className={thClasses}>Stock</th>
                <th scope="col" className={thClasses}>Active</th>
                <th scope="col" className={thClasses}>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {variants.fields.map((field, index) => {
                const row = watchedVariants?.[index] ?? field;
                return (
                  <VariantRow
                    key={field.fieldKey}
                    index={index}
                    label={variantLabel(row)}
                    info={row.id ? variantInfo[row.id] : undefined}
                    sku={row.sku}
                    basePrice={basePrice}
                    canRemove={variants.fields.length > 1}
                    onRemove={() => removeVariant(index)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {pendingRemoval.length > 0 ? (
          <div role="status" className="flex flex-col gap-1 rounded-md bg-neutral-100 px-4 py-3 text-body text-neutral-700">
            <p className="font-medium text-neutral-900">Removed when you save:</p>
            <ul className="list-disc pl-6">
              {pendingRemoval.map((row) => (
                <li key={row.id}>
                  {row.sku}
                  {row.id && variantInfo[row.id]?.ordered ? " (has orders, so it's set inactive instead of deleted)" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </FormSection>
  );
}

function OptionEditor({ index, onRemove, onRename }: { index: number; onRemove: () => void; onRename: (next: string) => void }) {
  const { control, register, getValues, setValue } = useFormContext<ProductFormValues>();
  const values = useFieldArray({ control, name: `options.${index}.values`, keyName: "fieldKey" });
  const watchedValues = useWatch({ control, name: `options.${index}.values` });
  const nameField = register(`options.${index}.name`);
  const nameError = useFieldError(`options.${index}.name`);
  const valuesError = useFieldError(`options.${index}.values`);

  /** New values take their key from the label; saved keys never change. */
  function relabel(valueIndex: number, label: string) {
    const current = getValues(`options.${index}.values.${valueIndex}`);
    if (current.locked) return;
    const others = new Set(getValues(`options.${index}.values`).filter((_, other) => other !== valueIndex).map((value) => value.value));
    const key = uniqueKey(label, others);
    if (key === current.value) return;
    setValue(`options.${index}.values.${valueIndex}.value`, key);
    const optionName = getValues(`options.${index}.name`).trim();
    setValue(
      "variants",
      getValues("variants").map((variant) =>
        variant.optionValues[optionName] === current.value ? { ...variant, optionValues: { ...variant.optionValues, [optionName]: key } } : variant,
      ),
    );
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
      <legend className="sr-only">Option {index + 1}</legend>
      <div className="flex items-end gap-2">
        <Field label={`Option ${index + 1} name`} error={nameError} className="flex-1">
          {(controlProps) => (
            <Input
              {...controlProps}
              {...nameField}
              placeholder="e.g. Colour"
              maxLength={30}
              onChange={(event) => {
                onRename(event.target.value);
                void nameField.onChange(event);
              }}
            />
          )}
        </Field>
        <button type="button" onClick={onRemove} aria-label={`Remove option ${index + 1}`} className={iconButtonClasses({ variant: "ghost" })}>
          <TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-body font-medium text-neutral-900">Values</p>
        <ul className="flex flex-col gap-2">
          {values.fields.map((value, valueIndex) => (
            <OptionValueRow
              key={value.fieldKey}
              optionIndex={index}
              valueIndex={valueIndex}
              swatch={watchedValues?.[valueIndex]?.swatchHex ?? ""}
              canRemove={values.fields.length > 1}
              onRemove={() => values.remove(valueIndex)}
              onRelabel={(label) => relabel(valueIndex, label)}
            />
          ))}
        </ul>
        {valuesError ? <p className="text-small text-error-700">{valuesError}</p> : null}
        {values.fields.length < MAX_OPTION_VALUES ? (
          <Button
            variant="text"
            size="md"
            className="w-fit"
            leadingIcon={<PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
            onClick={() => {
              const taken = new Set(getValues(`options.${index}.values`).map((item) => item.value));
              values.append({ value: uniqueKey("value", taken), label: "", swatchHex: "" }, { focusName: `options.${index}.values.${values.fields.length}.label` });
            }}
          >
            Add value
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
}

function OptionValueRow({
  optionIndex,
  valueIndex,
  swatch,
  canRemove,
  onRemove,
  onRelabel,
}: {
  optionIndex: number;
  valueIndex: number;
  swatch: string;
  canRemove: boolean;
  onRemove: () => void;
  onRelabel: (label: string) => void;
}) {
  const { register } = useFormContext<ProductFormValues>();
  const base = `options.${optionIndex}.values.${valueIndex}` as const;
  const labelField = register(`${base}.label`);
  const labelOnlyError = useFieldError(`${base}.label`);
  const keyError = useFieldError(`${base}.value`);
  const labelError = labelOnlyError ?? keyError;
  const swatchError = useFieldError(`${base}.swatchHex`);
  const validSwatch = /^#[0-9a-fA-F]{6}$/.test(swatch);

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_minmax(0,10rem)_auto] items-start gap-2">
      <Field label={`Value ${valueIndex + 1}`} hideLabel error={labelError}>
        {(controlProps) => (
          <Input
            {...controlProps}
            {...labelField}
            placeholder="e.g. Tan"
            maxLength={40}
            onChange={(event) => {
              onRelabel(event.target.value);
              void labelField.onChange(event);
            }}
          />
        )}
      </Field>
      <Field label={`Swatch colour for value ${valueIndex + 1}`} hideLabel error={swatchError}>
        {(controlProps) => (
          <Input
            {...controlProps}
            {...register(`${base}.swatchHex`)}
            placeholder="#C19A6B"
            maxLength={7}
            autoComplete="off"
            leadingIcon={
              <span
                className={cn("block size-4 rounded-full border", validSwatch ? "border-neutral-300" : "border-dashed border-neutral-300")}
                style={validSwatch ? { backgroundColor: swatch } : undefined}
              />
            }
          />
        )}
      </Field>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove value ${valueIndex + 1}`}
        className={iconButtonClasses({ variant: "ghost", className: "disabled:opacity-40" })}
      >
        <TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
      </button>
    </li>
  );
}

function VariantRow({
  index,
  label,
  info,
  sku,
  basePrice,
  canRemove,
  onRemove,
}: {
  index: number;
  label: string;
  info: EditorVariantInfo | undefined;
  sku: string;
  basePrice: string;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { register, setValue } = useFormContext<ProductFormValues>();
  const base = `variants.${index}` as const;
  const skuField = register(`${base}.sku`);
  const errors = {
    sku: useFieldError(`${base}.sku`),
    price: useFieldError(`${base}.price`),
    weight: useFieldError(`${base}.weightGrams`),
    stock: useFieldError(`${base}.initialStock`),
  };
  const cell = (name: string, error: string | undefined, children: ReactNode) => (
    <div className="flex flex-col gap-1">
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-small text-error-700">
          {error}
        </p>
      ) : null}
    </div>
  );
  const described = (name: string, error: string | undefined) => (error ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {});

  return (
    <tr className="align-top">
      <td className={cn(tdClasses, "font-medium")}>
        <div className="flex flex-col gap-1">
          {label}
          {info?.ordered ? (
            <Badge size="sm" tone="neutral" className="w-fit">
              Has orders
            </Badge>
          ) : null}
        </div>
      </td>
      <td className={cn(tdClasses, "min-w-56")}>
        {cell(
          `${base}.sku`,
          errors.sku,
          <Input
            {...skuField}
            {...described(`${base}.sku`, errors.sku)}
            aria-label={`SKU for ${label}`}
            maxLength={64}
            autoComplete="off"
            className="uppercase"
            onBlur={(event) => {
              setValue(`${base}.sku`, normalizeSku(event.target.value));
              void skuField.onBlur(event);
            }}
          />,
        )}
      </td>
      <td className={cn(tdClasses, "w-36")}>
        {cell(
          `${base}.price`,
          errors.price,
          <Input
            {...register(`${base}.price`)}
            {...described(`${base}.price`, errors.price)}
            aria-label={`Price for ${label}, leave empty to use the product price`}
            inputMode="decimal"
            placeholder={basePrice || "Same"}
          />,
        )}
      </td>
      <td className={cn(tdClasses, "w-28")}>
        {cell(
          `${base}.weightGrams`,
          errors.weight,
          <Input {...register(`${base}.weightGrams`)} {...described(`${base}.weightGrams`, errors.weight)} aria-label={`Weight in grams for ${label}`} inputMode="numeric" />,
        )}
      </td>
      <td className={cn(tdClasses, "w-32")}>
        {info ? (
          <div className="flex h-11 flex-col justify-center">
            <span className="font-medium tabular-nums">{info.stock}</span>
            <Link href={`/admin/inventory?q=${encodeURIComponent(sku)}`} className="text-small text-primary-600 hover:underline">
              Adjust
            </Link>
          </div>
        ) : (
          cell(
            `${base}.initialStock`,
            errors.stock,
            <Input
              {...register(`${base}.initialStock`)}
              {...described(`${base}.initialStock`, errors.stock)}
              aria-label={`Starting stock for ${label}`}
              inputMode="numeric"
            />,
          )
        )}
      </td>
      <td className={tdClasses}>
        <label className="flex h-11 items-center">
          <input type="checkbox" {...register(`${base}.isActive`)} className="size-5 cursor-pointer accent-primary-500" />
          <span className="sr-only">{label} is active</span>
        </label>
      </td>
      <td className={cn(tdClasses, "text-right")}>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove variant ${label}`}
          className={iconButtonClasses({ variant: "ghost", className: "disabled:opacity-40" })}
        >
          <TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
        </button>
      </td>
    </tr>
  );
}
