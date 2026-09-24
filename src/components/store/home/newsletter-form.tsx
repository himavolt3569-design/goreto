"use client";

import { useActionState } from "react";
import { subscribeToNewsletter } from "@/features/newsletter/actions";
import { initialNewsletterState } from "@/features/newsletter/schema";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CheckCircleIcon, EnvelopeSimpleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";

export function NewsletterForm() {
  const [state, formAction, pending] = useActionState(
    subscribeToNewsletter,
    initialNewsletterState,
  );

  return (
    // noValidate: errors are shown inline from the server, never as browser bubbles.
    <form action={formAction} noValidate className="flex w-full flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Field
          label="Email address"
          hideLabel
          error={state.status === "error" ? state.message : undefined}
          className="flex-1"
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="Enter your email address"
              defaultValue={state.status === "error" ? state.email : ""}
              leadingIcon={<EnvelopeSimpleIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
            />
          )}
        </Field>
        <Button type="submit" loading={pending}>
          Subscribe
        </Button>
      </div>
      <div aria-live="polite">
        {state.status === "success" ? (
          <p className="flex items-center gap-2 text-body text-success-700">
            <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            {state.message}
          </p>
        ) : (
          <p className="text-small text-neutral-500">No spam. Unsubscribe anytime.</p>
        )}
      </div>
    </form>
  );
}
