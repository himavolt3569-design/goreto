"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type Ref,
} from "react";
import { CaretDownIcon, CheckIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "./icon";
import { fieldControlClasses } from "./input";
import { popoverItemClasses, popoverPanelClasses } from "./popover";

/*
 * Design-system Select (Design System §08). A select-only combobox
 * (WAI-ARIA APG): the trigger keeps focus and points at the active option with
 * aria-activedescendant. A hidden native <select> mirrors the value so forms,
 * FormData, `required` and form reset behave as before. Until hydration (and
 * without JavaScript) the native select is shown instead, styled the same.
 */

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** 1 = nested under the closest depth-0 option above it (e.g. a subcategory). */
  depth?: 0 | 1;
  /** Muted prefix in the closed field, e.g. the parent category ("Jewelry › Earrings"). */
  context?: string;
};

export type SelectProps = {
  options: readonly SelectOption[];
  id?: string;
  name?: string;
  form?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
  /** Shown muted while the value is "" and no option has the value "". */
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

const noopSubscribe = () => () => {};
const TYPEAHEAD_RESET_MS = 500;
const PAGE_STEP = 10;
const PANEL_GAP = 8;
/** Matches max-h-72. */
const PANEL_MAX_HEIGHT = 288;
/** Matches min-w-56 used by the other popovers. */
const PANEL_MIN_WIDTH = 224;
const NESTED_INDENT = "    ";

const triggerClasses = cn(fieldControlClasses, "flex cursor-pointer items-center gap-1 pr-12 text-left font-medium");

function Caret({ open = false }: { open?: boolean }) {
  return (
    <CaretDownIcon
      aria-hidden="true"
      size={ICON_SIZE_SM}
      weight={ICON_WEIGHT_OUTLINE}
      className={cn(
        "pointer-events-none absolute right-4 text-neutral-700 transition-transform duration-150 motion-reduce:transition-none",
        open && "rotate-180",
      )}
    />
  );
}

/** <option>s for the native select; nested rows are indented since <optgroup> labels can't be chosen. */
function NativeOptions({ options, placeholder, required }: { options: readonly SelectOption[]; placeholder?: string; required?: boolean }) {
  return (
    <>
      {placeholder !== undefined ? (
        <option value="" disabled={required}>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.depth === 1 ? `${NESTED_INDENT}${option.label}` : option.label}
        </option>
      ))}
    </>
  );
}

export function Select(props: SelectProps) {
  // False on the server and during hydration, so the no-JS native select is the first paint.
  const scripted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return scripted ? <ListboxSelect {...props} /> : <NativeSelect {...props} />;
}

function NativeSelect({ options, value, defaultValue, placeholder, className, onValueChange, onBlur, ...rest }: Omit<SelectProps, "ref">) {
  const showPlaceholder = placeholder !== undefined && !options.some((option) => option.value === "");
  return (
    <div className="relative flex w-full items-center">
      <select
        {...rest}
        defaultValue={value ?? defaultValue ?? (showPlaceholder ? "" : undefined)}
        onChange={(event) => onValueChange?.(event.currentTarget.value)}
        onBlur={onBlur}
        className={cn(fieldControlClasses, "cursor-pointer appearance-none pr-12 font-medium", className)}
      >
        <NativeOptions options={options} placeholder={showPlaceholder ? placeholder : undefined} required={rest.required} />
      </select>
      <Caret />
    </div>
  );
}

type Position = { top?: number; bottom?: number; left: number; width: number; maxHeight: number };

/** Below the trigger unless the list doesn't fit and there is more room above. */
function positionFor(trigger: HTMLElement, contentHeight: number): Position {
  const rect = trigger.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const below = viewportHeight - rect.bottom - PANEL_GAP * 2;
  const above = rect.top - PANEL_GAP * 2;
  const wanted = Math.min(contentHeight, PANEL_MAX_HEIGHT);
  const up = below < wanted && above > below;
  const maxHeight = Math.max(0, Math.min(PANEL_MAX_HEIGHT, up ? above : below));
  const width = Math.min(Math.max(rect.width, PANEL_MIN_WIDTH), window.innerWidth - PANEL_GAP * 2);
  const left = Math.max(PANEL_GAP, Math.min(rect.left, window.innerWidth - width - PANEL_GAP));
  return up
    ? { bottom: viewportHeight - rect.top + PANEL_GAP, left, width, maxHeight }
    : { top: rect.bottom + PANEL_GAP, left, width, maxHeight };
}

function ListboxSelect({
  options,
  id,
  name,
  form,
  value,
  defaultValue,
  onValueChange,
  onBlur,
  placeholder,
  required,
  disabled,
  className,
  ref,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? `${generatedId}-trigger`;
  const listId = `${generatedId}-list`;
  const optionId = (index: number) => `${generatedId}-option-${index}`;

  const showPlaceholder = placeholder !== undefined && !options.some((option) => option.value === "");
  const firstEnabled = options.find((option) => !option.disabled)?.value ?? "";
  // Same fallback as a native select: no explicit value selects the first option unless there's a placeholder.
  const initial = defaultValue ?? (showPlaceholder ? "" : firstEnabled);
  const [internal, setInternal] = useState(initial);
  const current = value ?? internal;
  const selectedIndex = options.findIndex((option) => option.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<Position | null>(null);
  const [listLabel, setListLabel] = useState<string | undefined>(ariaLabel);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const mirrorRef = useRef<HTMLSelectElement>(null);
  const typeahead = useRef({ buffer: "", timer: 0 });
  const initialRef = useRef(initial);

  const setTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const commit = useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      if (next !== current) onValueChange?.(next);
    },
    [current, onValueChange, value],
  );

  const enabledIndexes = options.flatMap((option, index) => (option.disabled ? [] : [index]));

  function openList(active: number) {
    if (disabled) return;
    setListLabel(ariaLabel ?? triggerRef.current?.labels?.[0]?.textContent?.trim() ?? undefined);
    setActiveIndex(active);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setPosition(null);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    commit(option.value);
    close();
  }

  /** Next enabled index from `from` in `direction`, clamped at the ends. */
  function step(from: number, direction: 1 | -1, count = 1) {
    if (enabledIndexes.length === 0) return -1;
    const position = enabledIndexes.indexOf(from);
    if (position === -1) return direction === 1 ? enabledIndexes[0]! : enabledIndexes[enabledIndexes.length - 1]!;
    const target = Math.max(0, Math.min(enabledIndexes.length - 1, position + direction * count));
    return enabledIndexes[target]!;
  }

  function startIndex() {
    return selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : (enabledIndexes[0] ?? -1);
  }

  /** Type-ahead: repeated single letters cycle; a typed word matches from the start. */
  function matchTypeahead(char: string, from: number) {
    const state = typeahead.current;
    window.clearTimeout(state.timer);
    state.buffer += char.toLowerCase();
    state.timer = window.setTimeout(() => {
      state.buffer = "";
    }, TYPEAHEAD_RESET_MS);

    const cycling = state.buffer.split("").every((letter) => letter === state.buffer[0]);
    const search = cycling ? state.buffer[0]! : state.buffer;
    const ordered = [...enabledIndexes.filter((index) => index > from), ...enabledIndexes.filter((index) => index <= from)];
    const pool = cycling ? ordered : [from, ...ordered];
    return pool.find((index) => options[index]?.label.toLowerCase().startsWith(search)) ?? -1;
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event;
    const printable = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        openList(startIndex());
      } else if (key === "Home" || key === "End") {
        event.preventDefault();
        openList(key === "Home" ? (enabledIndexes[0] ?? -1) : (enabledIndexes[enabledIndexes.length - 1] ?? -1));
      } else if (printable) {
        event.preventDefault();
        const match = matchTypeahead(key, selectedIndex);
        openList(match >= 0 ? match : startIndex());
      }
      return;
    }

    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => step(index, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (event.altKey) choose(activeIndex);
        else setActiveIndex((index) => step(index, -1));
        break;
      case "PageDown":
        event.preventDefault();
        setActiveIndex((index) => step(index, 1, PAGE_STEP));
        break;
      case "PageUp":
        event.preventDefault();
        setActiveIndex((index) => step(index, -1, PAGE_STEP));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(enabledIndexes[0] ?? -1);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? -1);
        break;
      case "Enter":
        event.preventDefault();
        choose(activeIndex);
        break;
      case " ":
        event.preventDefault();
        if (typeahead.current.buffer) {
          const match = matchTypeahead(key, activeIndex);
          if (match >= 0) setActiveIndex(match);
        } else {
          choose(activeIndex);
        }
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        // APG select-only combobox: Tab commits the active option and moves on.
        choose(activeIndex);
        break;
      default:
        if (printable) {
          event.preventDefault();
          const match = matchTypeahead(key, activeIndex);
          if (match >= 0) setActiveIndex(match);
        }
    }
  }

  // Place the list before paint, then follow the trigger on scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (triggerRef.current) setPosition(positionFor(triggerRef.current, panelRef.current?.scrollHeight ?? PANEL_MAX_HEIGHT));
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: "nearest" });
    // optionId is derived from a stable useId value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // A form reset restores the initial value, as it would for a native select.
  useEffect(() => {
    const owner = mirrorRef.current?.form;
    if (!owner || value !== undefined) return;
    const onReset = () => setInternal(initialRef.current);
    owner.addEventListener("reset", onReset);
    return () => owner.removeEventListener("reset", onReset);
  }, [value]);

  useEffect(() => () => window.clearTimeout(typeahead.current.timer), []);

  const panelStyle: CSSProperties | undefined = position
    ? { position: "fixed", top: position.top, bottom: position.bottom, left: position.left, width: position.width, maxHeight: position.maxHeight }
    : { position: "fixed", visibility: "hidden" };

  return (
    <div className="relative flex w-full items-center">
      <button
        ref={setTriggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList(startIndex()))}
        onKeyDown={onKeyDown}
        onBlur={() => {
          close();
          onBlur?.();
        }}
        className={cn(triggerClasses, open && "border-primary-500 ring-2 ring-primary-500/30", className)}
      >
        {selected ? (
          <span className="min-w-0 truncate">
            {selected.context ? <span className="font-normal text-neutral-500">{selected.context} › </span> : null}
            {selected.label}
          </span>
        ) : (
          <span className="min-w-0 truncate font-normal text-neutral-500">{placeholder ?? ""}</span>
        )}
      </button>
      <Caret open={open} />

      {/* Mirror for forms: submitted value, `required` and reset. Not focusable or announced. */}
      <select
        ref={mirrorRef}
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        form={form}
        value={current}
        required={required}
        disabled={disabled}
        onChange={(event) => commit(event.currentTarget.value)}
        onInvalid={() => triggerRef.current?.focus()}
        className="sr-only"
      >
        <NativeOptions options={options} placeholder={showPlaceholder ? placeholder : undefined} />
      </select>

      {open ? (
        <ul
          ref={panelRef}
          id={listId}
          role="listbox"
          aria-label={listLabel}
          tabIndex={-1}
          style={panelStyle}
          // Keep focus on the trigger when clicking options or the scrollbar.
          onMouseDown={(event) => event.preventDefault()}
          className={cn(popoverPanelClasses, "flex flex-col gap-0.5 overflow-y-auto overscroll-contain")}
        >
          {options.length === 0 ? <li className="px-3 py-3 text-body text-neutral-500">No options</li> : null}
          {options.map((option, index) => {
            const isSelected = index === selectedIndex;
            const isActive = index === activeIndex;
            const isParent = (option.depth ?? 0) === 0 && options[index + 1]?.depth === 1;
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onPointerMove={() => {
                  if (!option.disabled && activeIndex !== index) setActiveIndex(index);
                }}
                onClick={() => choose(index)}
                className={cn(
                  popoverItemClasses,
                  "cursor-pointer",
                  option.depth === 1 && "pl-8",
                  isParent && "font-medium",
                  isActive && "bg-neutral-100",
                  isSelected && "bg-primary-100 font-medium text-primary-700 hover:bg-primary-100",
                  isSelected && isActive && "bg-primary-200/60 hover:bg-primary-200/60",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected ? <CheckIcon aria-hidden="true" size={ICON_SIZE_XS} weight="bold" className="shrink-0 text-primary-500" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
