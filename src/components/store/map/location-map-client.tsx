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

export type LocationMapProps = {
  latitude: number;
  longitude: number;
  /** Accessible name of the pin, e.g. "Your delivery location". */
  label: string;
  /** Makes the pin draggable and reports where it was dropped. */
  onMove?: (latitude: number, longitude: number) => void;
  zoom?: number;
};

export default function LocationMapClient({ latitude, longitude, label, onMove, zoom = 15 }: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onMoveRef = useRef(onMove);
  const draggable = Boolean(onMove);
  const initial = useRef({ latitude, longitude, zoom, label });

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !container.current || map.current) return;
      const start = initial.current;
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView([start.latitude, start.longitude], start.zoom);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(instance);
      const pin = L.marker([start.latitude, start.longitude], {
        icon: L.divIcon({ className: "", html: PIN_HTML, iconSize: [48, 48], iconAnchor: [24, 24] }),
        draggable,
        keyboard: true,
        title: start.label,
        alt: start.label,
      }).addTo(instance);
      pin.on("dragend", () => {
        const position = pin.getLatLng();
        onMoveRef.current?.(Number(position.lat.toFixed(6)), Number(position.lng.toFixed(6)));
      });
      map.current = instance;
      marker.current = pin;
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
    if (!pin || !map.current) return;
    const current = pin.getLatLng();
    if (current.lat === latitude && current.lng === longitude) return;
    pin.setLatLng([latitude, longitude]);
    map.current.panTo([latitude, longitude]);
  }, [latitude, longitude]);

  return <div ref={container} className="size-full" />;
}
