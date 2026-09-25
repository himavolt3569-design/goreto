"use client";

import { startTransition, useActionState, useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircleIcon, WarningCircleIcon, XIcon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Button, buttonClasses, type ButtonVariant } from "@/components/ui/button";
import { iconButtonClasses } from "@/components/ui/icon-button";
import type { ActionResult } from "@/features/admin/auth";
import { cn } from "@/lib/utils/cn";

/*
 * Client wrappers around admin Server Actions: pending states, inline
 * success/error messages (announced to screen readers), switches and dialogs.
 * Every action re-checks permission and validates on the server.
 */

export type AdminAction = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function ActionMessage({ state, className }: { state: ActionResult | null; className?: string }) {
  if (!state) return null;
  if (state.ok && !state.message) return null;
  const MessageIcon = state.ok ? CheckCircleIcon : WarningCircleIcon;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cn("flex items-start gap-1 text-small", state.ok ? "text-success-700" : "text-error-700", className)}
    >
      <MessageIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
      {state.message}
    </p>
  );
}

export function SubmitButton({ children, variant = "primary", size = "md", className }: { children: ReactNode; variant?: ButtonVariant; size?: "md" | "lg"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} loading={pending} className={className}>
      {children}
    </Button>
  );
}

/** Hidden inputs for fixed action arguments (ids, target states). */
export function HiddenFields({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/** A form bound to an admin action, with its result shown underneath. */
export function ActionForm({
  action,
  hidden,
  children,
  className,
  messageClassName,
}: {
  action: AdminAction;
  hidden?: Record<string, string>;
  children: ReactNode | ((state: ActionResult | null) => ReactNode);
  className?: string;
  messageClassName?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {hidden ? <HiddenFields values={hidden} /> : null}
      {typeof children === "function" ? children(state) : children}
      <ActionMessage state={state} className={messageClassName} />
    </form>
  );
}

/**
 * On/off switch that submits the *target* state. Disabled while saving;
 * the page re-renders with the stored value after the action refreshes.
 */
export function ToggleForm({
  action,
  id,
  checked,
  label,
  disabled = false,
  extra,
}: {
  action: AdminAction;
  id: string;
  checked: boolean;
  /** Accessible name, e.g. "Active: Pathao". */
  label: string;
  disabled?: boolean;
  extra?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <HiddenFields values={{ id, value: String(!checked), ...extra }} />
      <button
        type="submit"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-busy={pending || undefined}
        disabled={disabled || pending}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-primary-500" : "bg-neutral-300",
        )}
      >
        <span
          aria-hidden="true"
          className={cn("inline-block size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0.5")}
        />
      </button>
      {state && !state.ok ? <ActionMessage state={state} /> : null}
    </form>
  );
}

/**
 * A button that opens a native modal <dialog> holding an action form. The
 * dialog closes after a successful submit; errors stay inline.
 */
export function FormDialog({
  action,
  hidden,
  title,
  description,
  triggerLabel,
  triggerVariant = "tertiary",
  triggerIcon,
  submitLabel,
  submitVariant = "primary",
  children,
}: {
  action: AdminAction;
  hidden?: Record<string, string>;
  title: string;
  description?: ReactNode;
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  triggerIcon?: ReactNode;
  submitLabel: string;
  submitVariant?: ButtonVariant;
  children: ReactNode | ((state: ActionResult | null) => ReactNode);
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) dialogRef.current?.close();
  }, [state]);

  // Submitted by hand so typed text survives a validation error (React resets
  // <form action> forms after every submission).
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <>
      <button type="button" className={buttonClasses({ variant: triggerVariant, size: "md" })} onClick={() => dialogRef.current?.showModal()}>
        {triggerIcon}
        {triggerLabel}
      </button>
      {state?.ok ? <ActionMessage state={state} /> : null}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-neutral-900/50"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id={titleId} className="text-h2 text-neutral-900">
                {title}
              </h2>
              {description ? <p className="text-body text-neutral-500">{description}</p> : null}
            </div>
            <button type="button" aria-label="Close" onClick={() => dialogRef.current?.close()} className={iconButtonClasses({ variant: "ghost", className: "-mr-2 -mt-2" })}>
              <XIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
            </button>
          </div>
          {hidden ? <HiddenFields values={hidden} /> : null}
          <div className="flex flex-col gap-4">{typeof children === "function" ? children(state) : children}</div>
          {state && !state.ok ? <ActionMessage state={state} /> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClasses({ variant: "tertiary", size: "md" })}>
              Cancel
            </button>
            <Button type="submit" variant={submitVariant} size="md" loading={pending}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
