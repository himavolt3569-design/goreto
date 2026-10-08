"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_FILLED, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { StarIcon, WarningCircleIcon } from "@/components/ui/icons";
import { fieldControlClasses, Input } from "@/components/ui/input";
import { submitReviewAction } from "@/features/reviews/actions";
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_TITLE_MAX,
  reviewFormSchema,
  type ReviewFormData,
  type ReviewFormValues,
} from "@/features/reviews/schema";
import { cn } from "@/lib/utils/cn";

const STARS = [1, 2, 3, 4, 5] as const;
const STAR_WORDS: Record<(typeof STARS)[number], string> = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very good", 5: "Excellent" };

/**
 * Write or edit a review (AGENTS §4.9, §11.4). The server re-validates and
 * derives the verified purchase; on success it returns to the review list.
 */
export function ReviewForm({ productSlug, defaults, isEdit }: { productSlug: string; defaults: ReviewFormValues; isEdit: boolean }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const ratingErrorId = useId();
  const form = useForm<ReviewFormValues, unknown, ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;
  const [rating, body] = useWatch({ control: form.control, name: ["rating", "body"] });
  const chosen = Number(rating) || 0;
  const bodyLength = body.trim().length;

  async function submit() {
    setSubmitError(null);
    // On success the action redirects, so only failures return.
    const result = await submitReviewAction(productSlug, form.getValues()).catch(() => ({
      ok: false as const,
      message: "Your review couldn't be saved. Check your connection and try again.",
      fieldErrors: undefined,
    }));
    if (result.ok) return;
    setSubmitError(result.message);
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      form.setError(field as keyof ReviewFormValues, { message });
    }
  }

  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
      <Card className="flex flex-col gap-6 p-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-body font-medium text-neutral-900">
            Your rating
            <span aria-hidden="true" className="text-error-700">
              {" "}
              *
            </span>
          </legend>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {STARS.map((stars) => (
                <label key={stars} className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500">
                  <input
                    type="radio"
                    value={String(stars)}
                    {...register("rating")}
                    aria-describedby={errors.rating ? ratingErrorId : undefined}
                    className="sr-only"
                  />
                  <span className="sr-only">
                    {stars} {stars === 1 ? "star" : "stars"}, {STAR_WORDS[stars]}
                  </span>
                  <StarIcon
                    aria-hidden="true"
                    size={ICON_SIZE}
                    weight={stars <= chosen ? ICON_WEIGHT_FILLED : ICON_WEIGHT_OUTLINE}
                    className={stars <= chosen ? "text-warning-500" : "text-neutral-300"}
                  />
                </label>
              ))}
            </div>
            <p aria-hidden="true" className="text-body text-neutral-700">
              {chosen ? STAR_WORDS[chosen as (typeof STARS)[number]] : "Tap a star"}
            </p>
          </div>
          {errors.rating ? (
            <p id={ratingErrorId} className="flex items-center gap-2 text-small text-error-700">
              <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
              {errors.rating.message}
            </p>
          ) : null}
        </fieldset>

        <Field label="Title" hint="Optional. Sum it up in a few words." error={errors.title?.message}>
          {(control) => <Input {...control} {...register("title")} maxLength={REVIEW_TITLE_MAX} placeholder="e.g. Comfortable and well made" />}
        </Field>

        <Field
          label="Your review"
          required
          hint={`${REVIEW_BODY_MIN}–${REVIEW_BODY_MAX} characters · ${bodyLength} / ${REVIEW_BODY_MAX}`}
          error={errors.body?.message}
        >
          {(control) => (
            <textarea
              {...control}
              {...register("body")}
              rows={6}
              maxLength={REVIEW_BODY_MAX}
              placeholder="How was the quality, fit and delivery?"
              className={cn(fieldControlClasses, "h-auto py-3")}
            />
          )}
        </Field>

        <p className="text-small text-neutral-500">
          Reviews are checked before they appear on the product page.
          {isEdit ? " Editing a review sends it for checking again." : null} Please don&apos;t include phone numbers or addresses.
        </p>
      </Card>

      {submitError ? (
        <p ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-3 rounded-md bg-error-100 p-4 text-body text-neutral-900">
          <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-error-700" />
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/account/reviews" className={buttonClasses({ variant: "tertiary", size: "lg" })}>
          Cancel
        </Link>
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
          {isEdit ? "Save changes" : "Submit review"}
        </Button>
      </div>
    </form>
  );
}
