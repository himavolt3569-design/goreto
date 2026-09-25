"use client";

import { useRef } from "react";
import { ListIcon, XIcon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "./sidebar-nav";

/**
 * Admin navigation below `lg`: a modal drawer on the native <dialog>, which
 * traps focus, closes on Escape and returns focus to the menu button.
 */
export function AdminMobileNav({ allowedHrefs }: { allowedHrefs: readonly string[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open admin menu"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className={iconButtonClasses({ variant: "ghost" })}
      >
        <ListIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Admin menu"
        className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] overflow-y-auto border-r border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-neutral-900/50"
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="flex flex-col gap-6 p-4">
          <div className="flex items-center justify-between">
            <Logo href="/admin" />
            <button type="button" aria-label="Close admin menu" onClick={close} className={iconButtonClasses({ variant: "ghost" })}>
              <XIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
            </button>
          </div>
          <SidebarNav allowedHrefs={allowedHrefs} onNavigate={close} />
        </div>
      </dialog>
    </div>
  );
}
