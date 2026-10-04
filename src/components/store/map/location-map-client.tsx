"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

/*
 * Leaflet map with one pin. Loaded only through ./location-map (next/dynamic,
 * no SSR), so Leaflet never reaches pages without a map. Tiles default to
 * OpenStreetMap; NEXT_PUBLIC_MAP_TILE_URL switches provider (e.g. a paid tile
 * service for production traffic), with its attribution.
 */

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Classes live in this file so Tailwind generates them.
const PIN_HTML =
  '<span class="flex size-12 items-center justify-center rounded-full bg-primary-500/20">' +
  '<span class="size-5 rounded-full border-4 border-white bg-primary-500 shadow-md"></span></span>';

export type MapControls = {
  /** The point at the middle of the visible map. */
  centre: () => { latitude: number; longitude: number };
};

export type LocationMapProps = {
  latitude: number;
  longitude: number;
  /** Accessible name of the pin, e.g. "Your delivery location". */
  label: string;
  /** Makes the pin draggable and reports where it was dropped. */
  onMove?: (latitude: number, longitude: number) => void;
  /** Clicking the map moves the pin there and reports the point. */
  onPick?: (latitude: number, longitude: number) => void;
  /** Receives controls once the map exists (e.g. for a "pin at centre" button). */
  onReady?: (controls: MapControls) => void;
  /** False hides the pin until a point is chosen. */
  showPin?: boolean;
  /** Mouse-wheel zoom; off for small previews so the page scrolls past them. */
  scrollWheelZoom?: boolean;
  zoom?: number;
};

const round6 = (value: number) => Number(value.toFixed(6));

export default function LocationMapClient({
  latitude,
  longitude,
  label,
  onMove,
  onPick,
  onReady,
  showPin = true,
  scrollWheelZoom = false,
  zoom = 15,
}: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const callbacks = useRef({ onMove, onPick, onReady });
  const draggable = Boolean(onMove);
  const initial = useRef({ latitude, longitude, zoom, label, showPin, scrollWheelZoom });

  useEffect(() => {
    callbacks.current = { onMove, onPick, onReady };
  }, [onMove, onPick, onReady]);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !container.current || map.current) return;
      const start = initial.current;
      const instance = L.map(container.current, { scrollWheelZoom: start.scrollWheelZoom }).setView(
        [start.latitude, start.longitude],
        start.zoom,
      );
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(instance);
      const pin = L.marker([start.latitude, start.longitude], {
        icon: L.divIcon({ className: "", html: PIN_HTML, iconSize: [48, 48], iconAnchor: [24, 24] }),
        draggable,
        keyboard: true,
        title: start.label,
        alt: start.label,
      });
      if (start.showPin) pin.addTo(instance);
      pin.on("dragend", () => {
        const position = pin.getLatLng();
        callbacks.current.onMove?.(round6(position.lat), round6(position.lng));
      });
      instance.on("click", (event) => {
        if (!callbacks.current.onPick) return;
        pin.setLatLng(event.latlng);
        if (!instance.hasLayer(pin)) pin.addTo(instance);
        callbacks.current.onPick(round6(event.latlng.lat), round6(event.latlng.lng));
      });
      map.current = instance;
      marker.current = pin;
      callbacks.current.onReady?.({
        centre: () => {
          const centre = instance.getCenter();
          return { latitude: round6(centre.lat), longitude: round6(centre.lng) };
        },
      });
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [draggable]);

  useEffect(() => {
    const pin = marker.current;
    const instance = map.current;
    if (!pin || !instance) return;
    if (showPin && !instance.hasLayer(pin)) pin.addTo(instance);
    if (!showPin && instance.hasLayer(pin)) pin.remove();
    const current = pin.getLatLng();
    if (current.lat === latitude && current.lng === longitude) return;
    pin.setLatLng([latitude, longitude]);
    // A far jump (e.g. from GPS) zooms in on the new point; a nearby one just pans.
    if (instance.getBounds().contains([latitude, longitude])) instance.panTo([latitude, longitude]);
    else instance.setView([latitude, longitude], Math.max(instance.getZoom(), 16));
  }, [latitude, longitude, showPin]);

  return <div ref={container} className="size-full" />;
}
