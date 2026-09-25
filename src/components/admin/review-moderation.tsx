"use client";

import { fieldControlClasses } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { moderateReviewAction } from "@/features/admin/actions/engagement";
import type { ReviewStatus } from "@/features/admin/queries/engagement";
import { cn } from "@/lib/utils/cn";
import { ActionForm, FormDialog, SubmitButton } from "./action-forms";

/** Publish (one click) or reject (with a note the team can see later). */
export function ReviewModeration({ reviewId, status, productTitle }: { reviewId: string; status: ReviewStatus; productTitle: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {status !== "published" ? (
        <ActionForm action={moderateReviewAction} hidden={{ reviewId, decision: "published", note: "" }} className="flex flex-col gap-1">
          <SubmitButton variant="primary">Publish</SubmitButton>
        </ActionForm>
      ) : null}
      {status !== "rejected" ? (
        <FormDialog
          action={moderateReviewAction}
          hidden={{ reviewId, decision: "rejected" }}
          title="Reject this review?"
          description={`It won't appear on ${productTitle}. The note is only visible to staff.`}
          triggerLabel="Reject"
          submitLabel="Reject review"
        >
          {(state) => (
            <Field label="Reason" required error={state && !state.ok ? state.fieldErrors?.note : undefined}>
              {(control) => (
                <textarea
                  {...control}
                  name="note"
                  required
                  maxLength={500}
                  rows={3}
                  className={cn(fieldControlClasses, "h-auto py-3")}
                  placeholder="e.g. Spam link, off-topic, or personal details."
                />
              )}
            </Field>
          )}
        </FormDialog>
      ) : null}
    </div>
  );
}
