"use client";

import type { ReactNode, TextareaHTMLAttributes } from "react";
import { get, useFormContext, useFormState, type FieldPath } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { CaretDownIcon } from "@/components/ui/icons";
import { Input, fieldControlClasses, type InputProps } from "@/components/ui/input";
import type { ProductFormValues } from "@/features/admin/product-form/schema";
import { cn } from "@/lib/utils/cn";

/* React Hook Form wiring for the product editor's fields (labels, hints, inline errors). */

export type ProductPath = FieldPath<ProductFormValues>;

/** The error message for `name`, from the client schema or the server. */
export function useFieldError(name: string): string | undefined {
  const { errors } = useFormState<ProductFormValues>();
  // Array-level errors land on `<array>.root` when the resolver sees a field array.
  const error = get(errors, name) as { message?: string; root?: { message?: string } } | undefined;
  return error?.message ?? error?.root?.message;
}

export function FormSection({
  id,
  title,
  description,
  children,
  action,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card id={id} className="flex scroll-mt-24 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2 text-neutral-900">{title}</h2>
          {description ? <p className="text-body text-neutral-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/**
 * A folded form section (AGENTS §4.7 progressive disclosure). The header is
 * an accordion button with a one-line summary, so folded content is never
 * hidden silently. Folded fields stay mounted (the `hidden` attribute), so
 * the form keeps registering and validating them.
 */
export function CollapsibleSection({
  id,
  title,
  summary,
  open,
  onToggle,
  errorCount = 0,
  children,
}: {
  id: string;
  title: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  errorCount?: number;
  children: ReactNode;
}) {
  const panelId = `${id}-panel`;
  return (
    <Card id={id} className="scroll-mt-24 overflow-hidden">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-16 w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:-outline-offset-2"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-h3 text-neutral-900">{title}</span>
            <span className="truncate text-small text-neutral-500">{summary}</span>
          </span>
          {errorCount > 0 ? (
            <span className="shrink-0 rounded-full bg-error-100 px-2 py-1 text-small font-medium text-error-700">
              {errorCount} to fix
            </span>
          ) : null}
          <CaretDownIcon
            aria-hidden="true"
            size={ICON_SIZE_SM}
            weight={ICON_WEIGHT_OUTLINE}
            className={cn("shrink-0 text-neutral-700 transition-transform motion-reduce:transition-none", open && "rotate-180")}
          />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="flex flex-col gap-6 border-t border-neutral-200 px-6 py-6">
        {children}
      </div>
    </Card>
  );
}

export function TextField({
  name,
  label,
  hint,
  required,
  hideLabel,
  className,
  ...input
}: {
  name: ProductPath;
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  hideLabel?: boolean;
  className?: string;
} & Omit<InputProps, "name" | "id">) {
  const { register } = useFormContext<ProductFormValues>();
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error} required={required} hideLabel={hideLabel} className={className}>
      {(control) => <Input {...control} {...input} {...register(name)} />}
    </Field>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  rows = 4,
  ...textarea
}: {
  name: ProductPath;
  label: ReactNode;
  hint?: ReactNode;
  rows?: number;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id">) {
  const { register } = useFormContext<ProductFormValues>();
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => <textarea {...control} {...textarea} rows={rows} className={cn(fieldControlClasses, "h-auto py-3")} {...register(name)} />}
    </Field>
  );
}

/** A checkbox styled as a toggle chip, for compact rows of flags. The description becomes its tooltip. */
export function CheckboxChip({ name, label, description }: { name: ProductPath; label: string; description: string }) {
  const { register } = useFormContext<ProductFormValues>();
  return (
    <label
      title={description}
      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-body font-medium text-neutral-700 transition-colors hover:border-primary-300 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-100 has-[:checked]:text-primary-700 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-500"
    >
      <input type="checkbox" {...register(name)} className="size-4 shrink-0 cursor-pointer accent-primary-500" />
      {label}
    </label>
  );
}

export function CheckboxField({ name, label, description }: { name: ProductPath; label: ReactNode; description?: ReactNode }) {
  const { register } = useFormContext<ProductFormValues>();
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" {...register(name)} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500" />
      <span className="flex flex-col">
        <span className="text-body font-medium text-neutral-900">{label}</span>
        {description ? <span className="text-small text-neutral-500">{description}</span> : null}
      </span>
    </label>
  );
}

/** Inline error for a whole group (e.g. "variants"), announced when it appears. */
export function GroupError({ name, className }: { name: string; className?: string }) {
  const error = useFieldError(name);
  if (!error) return null;
  return (
    <p role="alert" className={cn("rounded-md bg-error-100 px-4 py-3 text-body text-error-700", className)}>
      {error}
    </p>
  );
}
