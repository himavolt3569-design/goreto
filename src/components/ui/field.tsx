import { useId, type ReactNode } from "react";
import { WarningCircleIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "./icon";

export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export type FieldProps = {
  label: ReactNode;
  /** Visually hide the label while keeping it for assistive technology. */
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  id?: string;
  className?: string;
  /** Receives the id/aria wiring that must be spread onto the control. */
  children: (control: FieldControlProps) => ReactNode;
};

/**
 * Label + hint + inline error wrapper. Placeholder text is never the only label.
 */
export function Field({
  label,
  hideLabel = false,
  hint,
  error,
  required,
  id,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={controlId}
        className={cn(
          "text-body font-medium text-neutral-900",
          hideLabel && "sr-only",
        )}
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="text-error-700">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children({
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-small text-neutral-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="flex items-center gap-1 text-small text-error-700"
        >
          <WarningCircleIcon
            aria-hidden="true"
            size={ICON_SIZE_XS}
            weight={ICON_WEIGHT_OUTLINE}
          />
          {error}
        </p>
      ) : null}
    </div>
  );
}
