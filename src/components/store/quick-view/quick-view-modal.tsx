"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { QUICK_VIEW_TITLE_ID } from "./ids";

/**
 * Product quick view: the intercepted `/products/[slug]` route shown over the
 * current page. Every way of closing it goes back in history, so Back closes
 * it, Forward reopens it, and the URL is the canonical product page.
 *
 * Parallel slots keep their last state on client navigation, so once the URL
 * is no longer this product (View cart, Buy Now) the modal renders nothing.
 */
export function QuickViewModal({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  if (pathname !== href) return null;
  return <QuickViewDialog>{children}</QuickViewDialog>;
}

function QuickViewDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // The card link that opened the quick view is still on the page below.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Native modal: the browser traps focus and turns Escape into `cancel`.
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  function close() {
    if (closingRef.current) return;
    closingRef.current = true;
    router.back();
  }

  return (
    <dialog
      ref={dialogRef}
      data-scroll-lock=""
      aria-labelledby={QUICK_VIEW_TITLE_ID}
      onCancel={(event) => {
        // Leave closing to the router so history stays in step.
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === event.currentTarget) close();
      }}
      className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-5xl overflow-y-auto rounded-xl bg-white text-neutral-900 shadow-xl backdrop:bg-neutral-900/60"
    >
      {/* Sticky, so Close stays in reach while the content scrolls. */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-white px-4 py-2 sm:px-6 lg:px-8">
        <p className="text-small font-medium text-neutral-500">Quick view</p>
        <button
          type="button"
          aria-label="Close quick view"
          onClick={close}
          className={iconButtonClasses({ variant: "ghost", size: "md", className: "-mr-3" })}
        >
          <XIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
        </button>
      </div>
      <div className="px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">{children}</div>
    </dialog>
  );
}
