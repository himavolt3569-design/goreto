"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ArrowCounterClockwiseIcon, CheckCircleIcon, PlusIcon, WarningCircleIcon } from "@/components/ui/icons";
import type { SelectOption } from "@/components/ui/select";
import { discardStagedMediaAction, quickCreateProductAction, type QuickCreateResult } from "@/features/admin/actions/products";
import { issuesByPath } from "@/features/admin/product-form/schema";
import { emptyQuickProduct, MAX_QUICK_PRODUCTS, quickProductSchema, type QuickProductValues } from "@/features/admin/product-form/quick-product";
import { cn } from "@/lib/utils/cn";
import { orderedMedia } from "./media-strip";
import { BulkProductCard, fieldId, type BulkCard } from "./product-card";

/*
 * Bulk add products (prompts/goreto-admin-bulk-add-products.md). A list of
 * short cards with "Add another product" at the end. Create sends the cards
 * one at a time, so each product is saved (and can fail) on its own; created
 * cards collapse to a summary row and failed ones stay editable for a retry.
 */

function newCard(categoryId = ""): BulkCard {
  return {
    key: crypto.randomUUID(),
    stagingId: crypto.randomUUID(),
    values: emptyQuickProduct(categoryId),
    files: [],
    uploading: false,
    status: "editing",
    errors: {},
  };
}

/** A card nobody has touched; ignored on Create when other cards have content. */
function isBlank(card: BulkCard): boolean {
  const { title, price, compareAtPrice, shortDescription } = card.values;
  return !title.trim() && !price.trim() && !compareAtPrice.trim() && !shortDescription.trim() && card.files.length === 0;
}

/** Inline errors for a card, or null when it can be sent. */
function cardErrors(card: BulkCard): { errors: Record<string, string>; message?: string } | null {
  const parsed = quickProductSchema.safeParse(card.values);
  const errors = parsed.success ? {} : issuesByPath(parsed.error);
  if (card.values.publish && !card.files.some((file) => file.kind === "image")) errors.publish = "Add a photo before publishing";
  if (card.uploading) return { errors, message: "Wait for the uploads to finish." };
  return Object.keys(errors).length > 0 ? { errors, message: "Check the highlighted fields." } : null;
}

const FIELD_ORDER: (keyof QuickProductValues)[] = ["title", "categoryId", "stock", "price", "compareAtPrice", "shortDescription", "publish"];

export function BulkProductsForm({ categories }: { categories: SelectOption[] }) {
  const [cards, setCards] = useState<BulkCard[]>(() => [newCard()]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState<{ created: number; failed: number } | null>(null);
  /** A card that was just added; its name field gets focus once it renders. */
  const focusNext = useRef<string | null>(null);
  const latest = useRef(cards);
  useEffect(() => {
    latest.current = cards;
  }, [cards]);

  // Free local previews when the page goes away.
  useEffect(() => () => latest.current.forEach((card) => card.files.forEach((file) => URL.revokeObjectURL(file.previewUrl))), []);

  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(fieldId({ key: focusNext.current }, "title"))?.focus();
    focusNext.current = null;
  }, [cards]);

  const pending = cards.filter((card) => card.status !== "created");
  const unsaved = pending.some((card) => !isBlank(card));
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  function update(key: string, change: (card: BulkCard) => BulkCard) {
    setCards((current) => current.map((card) => (card.key === key ? change(card) : card)));
  }

  function setValues(key: string, patch: Partial<QuickProductValues>) {
    update(key, (card) => {
      const errors = { ...card.errors };
      for (const field of Object.keys(patch)) delete errors[field];
      // A flagged card stays flagged (for Retry) until it's sent again; only the edited field's error clears.
      return { ...card, values: { ...card.values, ...patch }, errors };
    });
  }

  function addCard(from?: BulkCard) {
    const previous = from ?? cards[cards.length - 1];
    const card = newCard(previous?.values.categoryId ?? "");
    if (from) {
      // Same category, prices, stock and description; a new name and no media.
      const { categoryId, price, compareAtPrice, stock, shortDescription } = from.values;
      card.values = { ...card.values, categoryId, price, compareAtPrice, stock, shortDescription };
    }
    setCards((current) => {
      const index = from ? current.findIndex((item) => item.key === from.key) + 1 : current.length;
      return [...current.slice(0, index), card, ...current.slice(index)];
    });
    focusNext.current = card.key;
    setFinished(null);
  }

  function removeCard(card: BulkCard) {
    for (const file of card.files) {
      URL.revokeObjectURL(file.previewUrl);
      void discardStagedMediaAction({ stagingId: card.stagingId, path: file.path });
    }
    setCards((current) => {
      const next = current.filter((item) => item.key !== card.key);
      return next.length > 0 ? next : [newCard()];
    });
  }

  async function createAll() {
    const candidates = pending.filter((card) => !isBlank(card) || pending.length === 1);
    if (candidates.length === 0) return;

    // Flag every invalid card first; the valid ones are created regardless.
    const invalid = new Map(candidates.map((card) => [card.key, cardErrors(card)] as const).filter(([, problem]) => problem !== null));
    const queue = candidates.filter((card) => !invalid.has(card.key));
    setCards((current) =>
      current.map((card) => {
        const problem = invalid.get(card.key);
        if (problem) return { ...card, status: "failed", errors: problem.errors, message: problem.message };
        return queue.some((item) => item.key === card.key) ? { ...card, status: "waiting", errors: {}, message: undefined } : card;
      }),
    );
    const firstInvalid = candidates.find((card) => invalid.has(card.key));
    if (firstInvalid) {
      const field = FIELD_ORDER.find((name) => invalid.get(firstInvalid.key)!.errors[name]);
      // Focus also scrolls the field into view.
      document.getElementById(fieldId(firstInvalid, field ?? "title"))?.focus();
    }
    if (queue.length === 0) return;

    setRunning(true);
    setFinished(null);
    let created = 0;
    for (const card of queue) {
      update(card.key, (item) => ({ ...item, status: "creating" }));
      const media = orderedMedia(card.files).map((file) => ({ path: file.path, altText: "" }));
      const result: QuickCreateResult = await quickCreateProductAction(card.values, { stagingId: card.stagingId, media }).catch(() => ({
        ok: false,
        message: "The connection dropped. Check it and choose Retry.",
      }));
      if (result.ok) created += 1;
      update(card.key, (item) =>
        result.ok
          ? { ...item, status: "created", created: result, errors: {}, message: undefined }
          : { ...item, status: "failed", errors: result.fieldErrors ?? {}, message: result.message },
      );
    }
    setRunning(false);
    setFinished({ created, failed: invalid.size + queue.length - created });
  }

  const toCreate = pending.filter((card) => !isBlank(card)).length || (pending.length === 1 ? 1 : 0);
  const failedCount = cards.filter((card) => card.status === "failed").length;
  const createdCount = cards.filter((card) => card.status === "created").length;
  const uploading = cards.some((card) => card.uploading);
  const photoCount = pending.reduce((sum, card) => sum + card.files.filter((file) => file.kind === "image").length, 0);
  const videoCount = pending.reduce((sum, card) => sum + card.files.filter((file) => file.kind === "video").length, 0);
  const atLimit = cards.length >= MAX_QUICK_PRODUCTS;

  return (
    <div className="flex flex-col gap-6">
      {finished ? (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-md px-4 py-3 text-body",
            finished.failed > 0 ? "bg-warning-100 text-warning-700" : "bg-success-100 text-success-700",
          )}
        >
          {finished.failed > 0 ? (
            <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
          ) : (
            <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
          )}
          <span>
            {finished.created} {finished.created === 1 ? "product" : "products"} created
            {finished.failed > 0
              ? `, ${finished.failed} ${finished.failed === 1 ? "needs" : "need"} attention. Products already created stay created; fix the flagged ones and choose Retry.`
              : "."}
          </span>
        </p>
      ) : null}

      <ol className="flex flex-col gap-4" aria-label="Products to add">
        {cards.map((card, index) => (
          <li key={card.key}>
            <BulkProductCard
              card={card}
              number={index + 1}
              categories={categories}
              canRemove={cards.length > 1 || !isBlank(card)}
              locked={running}
              onValues={(patch) => setValues(card.key, patch)}
              onFiles={(change) => update(card.key, (item) => ({ ...item, files: change(item.files) }))}
              onUploading={(value) => update(card.key, (item) => ({ ...item, uploading: value }))}
              onDuplicate={() => addCard(card)}
              onRemove={() => removeCard(card)}
            />
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => addCard()}
        disabled={running || atLimit}
        className="flex min-h-16 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary-200 bg-white px-6 py-4 text-body-lg font-medium text-primary-500 transition-colors hover:border-primary-500 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300 disabled:hover:bg-white"
      >
        <PlusIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
        {atLimit ? `Up to ${MAX_QUICK_PRODUCTS} products at a time` : "Add another product"}
      </button>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-200 bg-white/95 px-4 py-4 shadow-lg md:-mx-8 md:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-neutral-700" aria-live="polite">
            {running ? (
              "Creating products… keep this page open."
            ) : toCreate > 0 ? (
              <>
                <span className="font-medium text-neutral-900">
                  {toCreate} {toCreate === 1 ? "product" : "products"}
                </span>{" "}
                ready · {photoCount} {photoCount === 1 ? "photo" : "photos"} · {videoCount} {videoCount === 1 ? "video" : "videos"}
              </>
            ) : createdCount > 0 ? (
              `All ${createdCount} products created.`
            ) : (
              "Fill in a product to get started."
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {createdCount > 0 && toCreate === 0 ? (
              <Link href="/admin/products" className={buttonClasses({ variant: "tertiary", size: "md" })}>
                Back to products
              </Link>
            ) : null}
            <Button
              size="lg"
              loading={running}
              disabled={toCreate === 0 || uploading}
              onClick={() => void createAll()}
              leadingIcon={failedCount > 0 ? <ArrowCounterClockwiseIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} /> : undefined}
            >
              {failedCount > 0 && createdCount > 0 ? "Retry" : `Create ${toCreate > 1 ? `${toCreate} products` : "product"}`}
            </Button>
          </div>
        </div>
        {uploading && !running ? <p className="mt-2 text-small text-neutral-500">Waiting for uploads to finish…</p> : null}
      </div>
    </div>
  );
}
