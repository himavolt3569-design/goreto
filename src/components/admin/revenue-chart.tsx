"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { areaPath, compactRupees, linePath, niceTicks, scaleLinear, type Point } from "@/features/admin/charts";
import { formatNpr } from "@/lib/money/format";

/*
 * Revenue Overview area chart (designs/goreto-admin.png). Hand-built SVG:
 * 2px line, soft wash, ringed markers, hairline grid, crosshair tooltip on
 * hover and on keyboard focus (arrow keys move between points). A visually
 * hidden table carries every value for screen readers.
 */

export type RevenueChartPoint = {
  /** Axis label, e.g. "Sep 5". */
  label: string;
  /** Tooltip/table label, e.g. "Sep 5, 2026". */
  longLabel: string;
  salesPaisa: number;
  orders: number;
};

const HEIGHT = 240;
const MARGIN = { top: 16, right: 16, bottom: 32, left: 48 };
const MAX_X_LABELS = 7;

export function RevenueChart({ points, caption }: { points: RevenueChartPoint[]; caption: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const max = Math.max(0, ...points.map((point) => point.salesPaisa));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;

  const coords: Point[] = points.map((point, index) => ({
    x: MARGIN.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: scaleLinear(point.salesPaisa, [0, top], [MARGIN.top + plotHeight, MARGIN.top]),
  }));
  const baseline = MARGIN.top + plotHeight;
  const labelEvery = Math.max(1, Math.ceil(points.length / MAX_X_LABELS));
  const showMarkers = points.length <= 31;

  function nearestIndex(clientX: number): number {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return 0;
    const x = clientX - rect.left - MARGIN.left;
    const ratio = points.length === 1 ? 0 : x / plotWidth;
    return Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))));
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    setActive(nearestIndex(event.clientX));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (points.length === 0) return;
    const current = active ?? points.length - 1;
    const next =
      event.key === "ArrowRight" ? Math.min(points.length - 1, current + 1)
      : event.key === "ArrowLeft" ? Math.max(0, current - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? points.length - 1
      : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  const activePoint = active !== null ? points[active] : undefined;
  const activeCoord = active !== null ? coords[active] : undefined;
  const tooltipLeft = activeCoord ? Math.min(Math.max(activeCoord.x, 80), width - 80) : 0;

  return (
    <div className="flex flex-col">
      <div
        ref={containerRef}
        className="relative w-full touch-pan-y rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={`${caption}. Use the left and right arrow keys to read each value.`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((value) => value ?? points.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <svg width="100%" height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true" className="block">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => {
            const y = scaleLinear(tick, [0, top], [baseline, MARGIN.top]);
            return (
              <g key={tick}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y} y2={y} stroke="var(--color-neutral-200)" strokeWidth={1} />
                <text x={MARGIN.left - 12} y={y} textAnchor="end" dominantBaseline="middle" className="fill-neutral-500 text-small tabular-nums">
                  {compactRupees(tick)}
                </text>
              </g>
            );
          })}

          {points.map((point, index) =>
            index % labelEvery === 0 || index === points.length - 1 ? (
              <text
                key={point.longLabel}
                x={coords[index]!.x}
                y={HEIGHT - 8}
                textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                className="fill-neutral-500 text-small"
              >
                {point.label}
              </text>
            ) : null,
          )}

          <path d={areaPath(coords, baseline)} fill={`url(#${gradientId})`} />
          <path d={linePath(coords)} fill="none" stroke="var(--color-primary-500)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {activeCoord ? (
            <line x1={activeCoord.x} x2={activeCoord.x} y1={MARGIN.top} y2={baseline} stroke="var(--color-neutral-300)" strokeWidth={1} />
          ) : null}

          {coords.map((coord, index) =>
            showMarkers || index === active ? (
              <circle
                key={points[index]!.longLabel}
                cx={coord.x}
                cy={coord.y}
                r={index === active ? 6 : 4}
                fill="var(--color-primary-500)"
                stroke="var(--color-white)"
                strokeWidth={2}
              />
            ) : null,
          )}
        </svg>

        {activePoint && activeCoord ? (
          <div
            className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col gap-1 rounded-sm border border-neutral-200 bg-white px-3 py-2 shadow-md"
            style={{ left: tooltipLeft, top: Math.max(activeCoord.y - 12, 56) }}
          >
            <span className="text-small text-neutral-500">{activePoint.longLabel}</span>
            <span className="text-body font-semibold text-neutral-900 tabular-nums">{formatNpr(activePoint.salesPaisa)}</span>
            <span className="text-small text-neutral-500">
              {activePoint.orders} {activePoint.orders === 1 ? "order" : "orders"}
            </span>
          </div>
        ) : null}
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Sales</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.longLabel}>
              <th scope="row">{point.longLabel}</th>
              <td>{formatNpr(point.salesPaisa)}</td>
              <td>{point.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
