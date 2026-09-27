"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/ui/icons";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

/**
 * Copies `value` to the clipboard. `value` may be a path; it is copied as an
 * absolute URL when `asUrl` is set.
 */
export function CopyButton({ value, label, asUrl = false, className }: { value: string; label: string; asUrl?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = asUrl ? new URL(value, window.location.origin).toString() : value;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-body font-medium text-neutral-700 transition-colors hover:bg-neutral-100",
        className,
      )}
    >
      {copied ? (
        <CheckIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} className="text-success-700" />
      ) : (
        <CopyIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
      )}
      <span className={copied ? undefined : "sr-only"}>{copied ? "Copied" : label}</span>
      <span role="status" className="sr-only">
        {copied ? `${label}: copied` : ""}
      </span>
    </button>
  );
}
