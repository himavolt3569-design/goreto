"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LocationMap } from "@/components/store/map/location-map";
import type { MapControls } from "@/components/store/map/location-map-client";
import { Button, buttonClasses } from "@/components/ui/button";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { CheckCircleIcon, CornersOutIcon, MapPinIcon, NavigationArrowIcon, WarningCircleIcon, XIcon } from "@/components/ui/icons";
import { lookupPoint, positionErrorMessage, type PointArea } from "@/features/delivery/area-client";
import type { NepalAddressData } from "@/features/delivery/nepal-address";

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;

export type PickedLocation = { latitude: number; longitude: number; area: PointArea };

/** Where the map opens: a saved pin (already a choice) or just a place to look. */
export type MapStart = { latitude: number; longitude: number; chosen: boolean };

type Point = { latitude: number; longitude: number };
type Status =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "looking" }
  | { kind: "found"; area: PointArea }
  | { kind: "error"; message: string };

/** "Ward 24 · Kathmandu Metropolitan City · Kathmandu · Bagmati Province". */
export function describeArea(area: PointArea, data: NepalAddressData): string {
  const municipality = data.municipalities.find((item) => item.code === area.municipalityCode)?.name;
  const district = data.districts.find((item) => item.code === area.districtCode)?.name;
  const province = data.provinces.find((item) => item.code === area.provinceCode)?.name;
  return [area.ward ? `Ward ${area.ward}` : null, municipality, district, province].filter(Boolean).join(" · ");
}

/**
 * "Pick on map" (AGENTS §4.4, §15.4): a Leaflet/OpenStreetMap dialog where the
 * shopper taps the map, drags the pin, uses their GPS or drops the pin at the
 * map centre (keyboard: arrow keys pan). Each point is looked up in our own
 * boundary data; "Use this location" hands back the area to fill the fields.
 * Geolocation is asked for only when the button is pressed.
 */
export function MapPicker({
  data,
  start,
  onPick,
}: {
  data: NepalAddressData;
  start: MapStart;
  onPick: (location: PickedLocation) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="md"
        aria-haspopup="dialog"
        leadingIcon={<MapPinIcon {...iconProps} />}
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        Pick on map
      </Button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-labelledby="map-picker-title"
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 backdrop:bg-neutral-900/50 sm:m-auto sm:h-[min(44rem,calc(100dvh-4rem))] sm:w-[min(48rem,calc(100vw-4rem))] sm:rounded-lg sm:border sm:border-neutral-200 sm:shadow-xl"
      >
        {open ? (
          <MapPickerPanel
            data={data}
            start={start}
            onCancel={close}
            onConfirm={(location) => {
              close();
              onPick(location);
            }}
          />
        ) : null}
      </dialog>
    </>
  );
}

function MapPickerPanel({
  data,
  start,
  onCancel,
  onConfirm,
}: {
  data: NepalAddressData;
  start: MapStart;
  onCancel: () => void;
  onConfirm: (location: PickedLocation) => void;
}) {
  const statusId = useId();
  const controls = useRef<MapControls | null>(null);
  const [point, setPoint] = useState<Point | null>(start.chosen ? { latitude: start.latitude, longitude: start.longitude } : null);
  const [status, setStatus] = useState<Status>(start.chosen ? { kind: "looking" } : { kind: "idle" });
  const pending = useRef<AbortController | null>(null);

  function lookUp(next: Point) {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    lookupPoint(next.latitude, next.longitude, request.signal)
      .then((result) => setStatus(result.ok ? { kind: "found", area: result.area } : { kind: "error", message: result.message }))
      .catch(() => undefined); // aborted by a newer point
  }

  function choose(next: Point) {
    setPoint(next);
    setStatus({ kind: "looking" });
    lookUp(next);
  }

  // A saved pin is looked up once when the dialog opens.
  useEffect(() => {
    if (start.chosen) lookUp({ latitude: start.latitude, longitude: start.longitude });
    return () => pending.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, []);

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setStatus({ kind: "error", message: "This browser can't share your location. Tap the map instead." });
      return;
    }
    setStatus({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        choose({ latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)) }),
      (error) => setStatus({ kind: "error", message: positionErrorMessage(error) }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  const shown = point ?? start;
  const found = status.kind === "found" ? status.area : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 id="map-picker-title" className="text-h3 text-neutral-900">
            Pick your location
          </h2>
          <p className="text-small text-neutral-500">Tap the map or drag the pin. We fill in your province, district, municipality and ward.</p>
        </div>
        <button type="button" aria-label="Close map" onClick={onCancel} className={iconButtonClasses({ variant: "ghost", className: "-mr-2" })}>
          <XIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3 sm:px-6">
        <Button
          type="button"
          variant="secondary"
          size="md"
          loading={status.kind === "locating"}
          leadingIcon={<NavigationArrowIcon {...iconProps} />}
          onClick={locateMe}
        >
          {status.kind === "locating" ? "Finding you…" : "Use my current location"}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          size="md"
          leadingIcon={<CornersOutIcon {...iconProps} />}
          onClick={() => {
            const centre = controls.current?.centre();
            if (centre) choose(centre);
          }}
        >
          Place pin at centre
        </Button>
      </div>

      <div className="relative min-h-64 flex-1 px-4 sm:px-6">
        <LocationMap
          latitude={shown.latitude}
          longitude={shown.longitude}
          zoom={start.chosen ? 16 : 13}
          showPin={point !== null}
          scrollWheelZoom
          label="Your delivery location. Drag to adjust."
          caption="Map for choosing your delivery location. Use the arrow keys to move the map, then Place pin at centre."
          onMove={(latitude, longitude) => choose({ latitude, longitude })}
          onPick={(latitude, longitude) => choose({ latitude, longitude })}
          onReady={(value) => {
            controls.current = value;
          }}
          className="size-full"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-200 px-4 py-3 sm:px-6">
        <div id={statusId} role="status" aria-live="polite" className="min-h-11 text-body">
          {status.kind === "found" ? (
            <p className="flex items-start gap-2 text-neutral-900">
              <CheckCircleIcon {...iconProps} className="mt-0.5 shrink-0 text-success-700" />
              <span>
                {describeArea(status.area, data)}
                {status.area.ward === null ? (
                  <span className="block text-small text-neutral-500">The map has no ward boundary here, so you&apos;ll choose the ward.</span>
                ) : null}
              </span>
            </p>
          ) : status.kind === "error" ? (
            <p className="flex items-start gap-2 text-neutral-900">
              <WarningCircleIcon {...iconProps} className="mt-0.5 shrink-0 text-warning-700" />
              {status.message}
            </p>
          ) : status.kind === "looking" ? (
            <p className="text-neutral-500">Finding the area…</p>
          ) : (
            <p className="text-neutral-500">No spot chosen yet.</p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-neutral-500">
            Boundaries: Open Knowledge Nepal (CC BY 4.0) and © OpenStreetMap contributors (ODbL).
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className={buttonClasses({ variant: "tertiary", size: "md", className: "flex-1 sm:flex-none" })}>
              Cancel
            </button>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1 sm:flex-none"
              disabled={!found || !point}
              aria-describedby={statusId}
              onClick={() => {
                if (found && point) onConfirm({ ...point, area: found });
              }}
            >
              Use this location
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
