"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
import type { LookupResult } from "@/features/admin/queries/manual-orders";

const SEARCH_DELAY_MS = 250;

/**
 * Type-ahead search with "Choose" buttons (the ProductPicker pattern, for any
 * result type). The search action checks permission; results are announced
 * politely. Enter never submits the surrounding order form.
 */
export function LookupSearch<T>({
  label,
  hint,
  placeholder,
  search,
  resultKey,
  renderResult,
  chooseLabel,
  onChoose,
  noun,
  disabled = false,
}: {
  label: string;
  hint?: ReactNode;
  placeholder: string;
  search: (query: string) => Promise<LookupResult<T>>;
  resultKey: (result: T) => string;
  renderResult: (result: T) => ReactNode;
  /** Screen-reader name of the result for its Choose button. */
  chooseLabel: (result: T) => string;
  onChoose: (result: T) => void;
  noun: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const latest = useRef("");
  const resultsId = useId();
  const term = query.trim();

  useEffect(() => {
    latest.current = term;
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const response = await search(term).catch(() => ({ ok: false as const, message: "Search didn't work. Please try again." }));
        if (latest.current !== term) return; // A newer search is on its way.
        if (response.ok) {
          setResults(response.results);
          setError(null);
        } else {
          setResults([]);
          setError(response.message);
        }
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [term, search]);

  const shown = term.length < 2 ? [] : results;

  return (
    <div className="flex flex-col gap-2">
      <Field label={label} hint={hint}>
        {(control) => (
          <SearchInput
            {...control}
            value={query}
            disabled={disabled}
            autoComplete="off"
            placeholder={placeholder}
            aria-controls={resultsId}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
        )}
      </Field>
      <div id={resultsId} aria-live="polite" aria-busy={searching || undefined}>
        {error ? <p className="text-small text-error-700">{error}</p> : null}
        {term.length >= 2 && !searching && !error && shown.length === 0 ? (
          <p className="text-small text-neutral-500">
            No {noun} match “{term}”.
          </p>
        ) : null}
        {shown.length > 0 ? (
          <ul aria-label={`Matching ${noun}`} className="flex max-h-80 flex-col divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
            {shown.map((result) => (
              <li key={resultKey(result)} className="flex items-center gap-3 px-4 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-3">{renderResult(result)}</div>
                <button
                  type="button"
                  onClick={() => {
                    onChoose(result);
                    setQuery("");
                    setResults([]);
                  }}
                  className={buttonClasses({ variant: "secondary", size: "md" })}
                >
                  Choose <span className="sr-only">{chooseLabel(result)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
