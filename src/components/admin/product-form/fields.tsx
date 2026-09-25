"use client";

import type { ReactNode, TextareaHTMLAttributes } from "react";
import { get, useFormContext, useFormState, type FieldPath } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
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
