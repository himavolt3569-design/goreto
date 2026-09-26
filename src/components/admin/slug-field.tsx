"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { sanitizeSlugInput, SLUG_MAX_LENGTH, SLUG_MAX_WORDS, slugFromTitle, slugProblem, slugWordCount } from "@/features/admin/product-form/keys";
import { cn } from "@/lib/utils/cn";

/*
 * URL slugs in the admin editors: the same rules everywhere (3–80
 * characters, at most 8 words). A slug follows the name ("auto") until it is
 * typed ("custom"); "Generate from name" switches back.
 */

export type SlugMode = "auto" | "custom";

/**
 * Live hint under a slug field: the URL, word and character counts, and the
 * mode. Without `basePath` the slug is an internal key (no storefront page).
 */
export function SlugHint({ basePath, slug, mode, savedSlug }: { basePath?: string; slug: string; mode: SlugMode; savedSlug: string | null }) {
  const words = slugWordCount(slug);
  return (
    <span className="flex flex-col gap-1">
      {basePath ? (
        <span className="break-all">
          goreto.store{basePath}/{slug || "…"}
        </span>
      ) : null}
      <span>
        <span className={cn(words > SLUG_MAX_WORDS && "font-medium text-error-700")}>
          {words}/{SLUG_MAX_WORDS} words
        </span>
        {" · "}
        <span className={cn(slug.length > SLUG_MAX_LENGTH && "font-medium text-error-700")}>
          {slug.length}/{SLUG_MAX_LENGTH} characters
        </span>
        {" · "}
        {mode === "auto" ? "Auto from name" : "Custom"}
      </span>
      {basePath && savedSlug && slug !== savedSlug ? (
        <span className="text-warning-700">
          Changing the slug breaks links people already shared to {basePath}/{savedSlug}.
        </span>
      ) : null}
    </span>
  );
}

/**
 * Name + URL slug for FormData forms (inputs named `title` and `slug`).
 * The server validates both again.
 */
export function NameSlugFields({
  nameLabel,
  namePlaceholder,
  nameMaxLength,
  basePath,
  defaultTitle,
  defaultSlug,
  savedSlug,
  errors,
}: {
  nameLabel: string;
  namePlaceholder: string;
  nameMaxLength: number;
  /** e.g. "/categories"; omitted for internal keys without a storefront page. */
  basePath?: string;
  defaultTitle: string;
  defaultSlug: string;
  /** The stored slug when editing (starts in custom mode, warns on change). */
  savedSlug: string | null;
  errors: Record<string, string>;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState(defaultSlug);
  const [mode, setMode] = useState<SlugMode>(savedSlug ? "custom" : "auto");
  const [touched, setTouched] = useState(false);
  // Client check once the slug was left; the server error wins until the next edit.
  const clientError = touched ? slugProblem(slug) : null;
  const [serverErrors, setServerErrors] = useState(errors);
  const [previousErrors, setPreviousErrors] = useState(errors);
  if (errors !== previousErrors) {
    setPreviousErrors(errors);
    setServerErrors(errors);
  }

  return (
    <>
      <Field label={nameLabel} required error={serverErrors.title}>
        {(control) => (
          <Input
            {...control}
            name="title"
            value={title}
            maxLength={nameMaxLength}
            placeholder={namePlaceholder}
            required
            onChange={(event) => {
              setTitle(event.target.value);
              setServerErrors((current) => withoutKey(current, "title"));
              if (mode === "auto") setSlug(slugFromTitle(event.target.value));
            }}
          />
        )}
      </Field>
      <Field
        label="URL slug"
        required
        error={serverErrors.slug ?? clientError ?? undefined}
        hint={<SlugHint basePath={basePath} slug={slug} mode={mode} savedSlug={savedSlug} />}
      >
        {(control) => (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              {...control}
              name="slug"
              value={slug}
              maxLength={SLUG_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
              required
              onChange={(event) => {
                setSlug(sanitizeSlugInput(event.target.value));
                setMode("custom");
                setServerErrors((current) => withoutKey(current, "slug"));
              }}
              onBlur={() => {
                // Tidy a trailing dash left while typing.
                setSlug((value) => value.replace(/-+$/, ""));
                setTouched(true);
              }}
            />
            <Button
              type="button"
              variant="tertiary"
              size="md"
              disabled={mode === "auto"}
              onClick={() => {
                setSlug(slugFromTitle(title));
                setMode("auto");
              }}
            >
              Generate from name
            </Button>
          </div>
        )}
      </Field>
    </>
  );
}

function withoutKey(errors: Record<string, string>, key: string): Record<string, string> {
  if (!(key in errors)) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}
