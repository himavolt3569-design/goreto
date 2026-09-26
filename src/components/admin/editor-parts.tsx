"use client";

import { startTransition, useActionState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ActionResult } from "@/features/admin/auth";
import { ActionMessage, type AdminAction } from "./action-forms";

/*
 * Pieces shared by the coupon and delivery editors (admin phase 3): the
 * hand-submitted FormData form, the on/off checkbox, and the sticky save card.
 */

const NO_ERRORS: Record<string, string> = {};

/**
 * `useActionState` plus a submit handler that keeps typed values when the
 * server returns errors (React resets `<form action>` forms after a submit).
 */
export function useEditorForm(action: AdminAction) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = (state && !state.ok && state.fieldErrors) || NO_ERRORS;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Portalled dialogs still bubble React events to the form they opened from.
    event.stopPropagation();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return { state, errors, pending, onSubmit };
}

export function CheckboxField({ name, defaultChecked, label, description }: { name: string; defaultChecked: boolean; label: string; description?: ReactNode }) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500"
      />
      <span className="flex flex-col">
        <span className="text-body font-medium text-neutral-900">{label}</span>
        {description ? <span className="text-small text-neutral-500">{description}</span> : null}
      </span>
    </label>
  );
}

/** Sticky side card: settings, Save, the result, and when it was last saved. */
export function SaveCard({
  title,
  children,
  submitLabel,
  pending,
  state,
  updatedLabel,
}: {
  title: string;
  children?: ReactNode;
  submitLabel: string;
  pending: boolean;
  state: ActionResult | null;
  updatedLabel?: string | null;
}) {
  return (
    <aside className="flex flex-col gap-6 xl:sticky xl:top-24">
      <Card className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-h3 text-neutral-900">{title}</h2>
          {children}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" fullWidth loading={pending}>
            {submitLabel}
          </Button>
          <ActionMessage state={state} />
        </div>
        {updatedLabel ? <p className="border-t border-neutral-200 pt-4 text-small text-neutral-500">Last updated {updatedLabel}</p> : null}
      </Card>
    </aside>
  );
}
