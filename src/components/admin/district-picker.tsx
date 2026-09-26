"use client";

import { useId, useState } from "react";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { MagnifyingGlassIcon, WarningCircleIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import type { ProvinceDistricts } from "@/features/admin/queries/delivery-editor";
import { cn } from "@/lib/utils/cn";

/*
 * The districts a delivery zone covers, grouped by province. A district that
 * another zone already covers is shown with that zone's name and can't be
 * picked (the database enforces one zone per district too). The choice is
 * submitted as one comma-separated `districtCodes` value.
 */

export function DistrictPicker({
  groups,
  zoneId,
  defaultSelected,
  error,
}: {
  groups: ProvinceDistricts[];
  /** The zone being edited (its own districts stay pickable); null when creating. */
  zoneId: string | null;
  defaultSelected: string[];
  error?: string;
}) {
  const [selected, setSelected] = useState(() => new Set(defaultSelected));
  const [filter, setFilter] = useState("");
  const filterId = useId();
  const errorId = useId();
  const query = filter.trim().toLowerCase();

  const takenElsewhere = (zone: { id: string } | null) => zone !== null && zone.id !== zoneId;

  function toggle(codes: string[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const code of codes) {
        if (on) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="districtCodes" value={[...selected].sort().join(",")} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-xs">
          <label htmlFor={filterId} className="text-body font-medium text-neutral-900">
            Find a district
          </label>
          <Input
            id={filterId}
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="e.g. Kaski"
            leadingIcon={<MagnifyingGlassIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
          />
        </div>
        <p className="text-body font-medium text-neutral-900" aria-live="polite">
          {selected.size === 1 ? "1 district selected" : `${selected.size} districts selected`}
        </p>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-small text-error-700">
          <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {groups.map((province) => {
          const visible = province.districts.filter((district) => query === "" || district.name.toLowerCase().includes(query));
          if (visible.length === 0) return null;
          const available = province.districts.filter((district) => !takenElsewhere(district.zone)).map((district) => district.code);
          const allOn = available.length > 0 && available.every((code) => selected.has(code));
          const chosen = province.districts.filter((district) => selected.has(district.code)).length;
          return (
            <fieldset key={province.code} className="flex min-w-0 flex-col gap-2 rounded-md border border-neutral-200 p-4">
              <legend className="sr-only">{province.name}</legend>
              <div className="flex items-center justify-between gap-2">
                <p aria-hidden="true" className="text-h3 text-neutral-900">
                  {province.name}
                </p>
                <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                  <span className="text-small text-neutral-500">{chosen} selected</span>
                  <button
                    type="button"
                    disabled={available.length === 0}
                    onClick={() => toggle(available, !allOn)}
                    className="rounded-xs px-1 text-small font-medium text-primary-700 hover:text-primary-600 disabled:cursor-not-allowed disabled:text-neutral-500"
                  >
                    {allOn ? "Clear" : "Select all"}{" "}
                    <span className="sr-only">in {province.name}</span>
                  </button>
                </span>
              </div>
              <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((district) => {
                  const taken = takenElsewhere(district.zone);
                  return (
                    <li key={district.code}>
                      <label className={cn("flex min-h-11 items-center gap-3 rounded-sm px-2", taken ? "cursor-not-allowed" : "cursor-pointer hover:bg-neutral-50")}>
                        <input
                          type="checkbox"
                          checked={selected.has(district.code)}
                          disabled={taken && !selected.has(district.code)}
                          onChange={(event) => toggle([district.code], event.target.checked)}
                          className="size-5 shrink-0 cursor-pointer rounded-xs border-neutral-300 accent-primary-500 disabled:cursor-not-allowed"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className={cn("text-body", taken ? "text-neutral-500" : "text-neutral-900")}>{district.name}</span>
                          {taken ? <span className="text-small text-neutral-500">In {district.zone!.name}</span> : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
