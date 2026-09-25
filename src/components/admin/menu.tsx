"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

/*
 * Accessible menu button (WAI-ARIA menu pattern): the trigger toggles a
 * popover of links or buttons. Arrow keys, Home and End move focus; Escape
 * closes and returns focus to the trigger; Tab or a click outside closes.
 */

type MenuContextValue = { close: (restoreFocus?: boolean) => void };
const MenuContext = createContext<MenuContextValue | null>(null);

export type MenuProps = {
  /** Renders the trigger contents. */
  trigger: ReactNode;
  /** Accessible name when the trigger has no visible text. */
  triggerLabel?: string;
  triggerClassName?: string;
  /** Popover alignment under the trigger. */
  align?: "start" | "end";
  panelClassName?: string;
  /** Optional heading/description above the items (not focusable). */
  header?: ReactNode;
  children: ReactNode;
};

export function Menu({ trigger, triggerLabel, triggerClassName, align = "end", panelClassName, header, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        list[(index + 1) % list.length]?.focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        list[(index - 1 + list.length) % list.length]?.focus();
        break;
      case "Home":
        event.preventDefault();
        list[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        list[list.length - 1]?.focus();
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={panelRef}
          className={cn(
            "absolute top-full z-50 mt-2 min-w-56 rounded-md border border-neutral-200 bg-white p-2 shadow-lg",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
          onKeyDown={onPanelKeyDown}
        >
          {header}
          <div id={menuId} role="menu" aria-label={triggerLabel} className="flex flex-col">
            <MenuContext.Provider value={{ close }}>{children}</MenuContext.Provider>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const itemClasses =
  "flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-body text-neutral-900 outline-none transition-colors hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none aria-disabled:pointer-events-none aria-disabled:text-neutral-300";

export function MenuLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const context = useContext(MenuContext);
  return (
    <Link href={href} role="menuitem" tabIndex={-1} className={cn(itemClasses, className)} onClick={() => context?.close(false)}>
      {children}
    </Link>
  );
}

export type MenuButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role"> & {
  /** Keep the menu open after activation (e.g. while a form submits). */
  keepOpen?: boolean;
};

export function MenuButton({ children, className, keepOpen = false, onClick, type = "button", ...props }: MenuButtonProps) {
  const context = useContext(MenuContext);
  return (
    <button
      type={type}
      role="menuitem"
      tabIndex={-1}
      className={cn(itemClasses, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!keepOpen) context?.close();
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-neutral-200" />;
}
