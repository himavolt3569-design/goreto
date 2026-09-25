"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CalendarBlankIcon, CaretDownIcon, CheckIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { fieldControlClasses } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

/*
 * Range controls. Presets are links and the custom range is a GET form, so
 * every range is a shareable, refresh-safe URL. Links arrive precomputed from
 * the server (Kathmandu "today").
 */

const noopSubscribe = () => () => {};

export type RangePresetLink = { label: string; href: string; selected: boolean };

export function DateRangePicker({
  label,
  presets,
  from,
  to,
  preserved,
}: {
  label: string;
  presets: RangePresetLink[];
  from: string;
  to: string;
  /** Other search params to keep when applying a custom range. */
  preserved: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={buttonClasses({ variant: "tertiary", size: "md", className: "gap-3 shadow-sm" })}
      >
        <CalendarBlankIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
        <span>
          <span className="sr-only">Date range: </span>
          {label}
        </span>
        <CaretDownIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-30 mt-2 w-72 rounded-md border border-neutral-200 bg-white p-2 shadow-lg"
      >
        <ul className="flex flex-col" aria-label="Preset ranges">
          {presets.map((preset) => (
            <li key={preset.label}>
              <Link
                href={preset.href}
                aria-current={preset.selected ? "true" : undefined}
                onClick={() => setOpen(false)}
                className="flex h-11 items-center justify-between rounded-sm px-3 text-body text-neutral-900 hover:bg-neutral-100"
              >
                {preset.label}
                {preset.selected ? <CheckIcon aria-hidden="true" size={ICON_SIZE_XS} weight="bold" className="text-primary-500" /> : null}
              </Link>
            </li>
          ))}
        </ul>
        <form method="get" className="mt-2 flex flex-col gap-3 border-t border-neutral-200 px-2 pb-2 pt-4">
          {Object.entries(preserved).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <p className="text-small font-medium text-neutral-700">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-small text-neutral-500">
              From
              <input type="date" name="from" defaultValue={from} required className={cn(fieldControlClasses, "px-2")} />
            </label>
            <label className="flex flex-col gap-1 text-small text-neutral-500">
              To
              <input type="date" name="to" defaultValue={to} required className={cn(fieldControlClasses, "px-2")} />
            </label>
          </div>
          <button type="submit" className={buttonClasses({ variant: "primary", size: "md" })}>
            Apply range
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * The revenue chart's window select. Submits on change with JS; the visible
 * Apply button covers no-JS use.
 */
export function WindowSelect({
  name,
  value,
  options,
  preserved,
  label,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  preserved: Record<string, string>;
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // True once hydrated: the select then submits itself and the Apply button hides.
  const scripted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return (
    <form ref={formRef} method="get" className="flex items-center gap-2">
      {Object.entries(preserved).map(([key, preservedValue]) => (
        <input key={key} type="hidden" name={key} value={preservedValue} />
      ))}
      <div className="w-44">
        <Select name={name} defaultValue={value} aria-label={label} onChange={() => formRef.current?.requestSubmit()}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      {scripted ? null : (
        <button type="submit" className={buttonClasses({ variant: "tertiary", size: "md" })}>
          Apply
        </button>
      )}
    </form>
  );
}
