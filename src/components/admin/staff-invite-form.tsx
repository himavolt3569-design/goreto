"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { EnvelopeSimpleIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { inviteStaffAction } from "@/features/admin/actions/staff";
import { PERMISSION_GROUPS } from "@/features/admin/staff-permissions";
import { ActionMessage } from "./action-forms";
import { useEditorForm } from "./editor-parts";

/*
 * Invite staff by email with starting permissions (admin phase 4). Nothing is
 * ticked by default: staff get only what the owner grants. The form clears
 * after a successful send; errors keep what was typed.
 */

export function StaffInviteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const permissionsHintId = useId();
  const { state, errors, pending, onSubmit } = useEditorForm(inviteStaffAction);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-6 px-6 pb-6">
      <Field label="Email address" required error={errors.email} hint="They get an email from Clerk with a link to create their account." className="max-w-md">
        {(control) => <Input {...control} type="email" name="email" autoComplete="off" maxLength={254} required />}
      </Field>

      <fieldset aria-describedby={permissionsHintId}>
        {/* A legend isn't a flex item, so this fieldset spaces its children with margins. */}
        <legend className="text-body font-medium text-neutral-900">Starting permissions</legend>
        <p id={permissionsHintId} className="mt-1 text-small text-neutral-500">
          You can change these at any time in the table below.
        </p>
        <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {PERMISSION_GROUPS.map((group) => (
            <fieldset key={group.label} className="flex flex-col gap-2">
              <legend className="mb-2 text-small font-medium uppercase tracking-wide text-neutral-500">{group.label}</legend>
              {group.permissions.map((permission) => (
                <label key={permission.key} className="flex min-h-6 items-center gap-3">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={permission.key}
                    className="size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500"
                  />
                  <span className="text-body text-neutral-900">{permission.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        {errors.permissions ? <p className="mt-2 text-small text-error-700">{errors.permissions}</p> : null}
      </fieldset>

      <div className="flex flex-col items-start gap-2">
        <Button type="submit" size="lg" loading={pending}>
          <EnvelopeSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          Send invitation
        </Button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
