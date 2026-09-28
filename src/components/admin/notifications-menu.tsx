"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  BellIcon,
  CheckIcon,
  FileTextIcon,
  PackageIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  StarIcon,
  WarningCircleIcon,
  WhatsappLogoIcon,
} from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import type { AttentionItem } from "@/features/admin/attention";
import { loadBellAction, markNotificationsReadAction, type BellData } from "@/features/admin/actions/notifications";
import { relativeTime } from "@/features/admin/format";
import { arrivalAnnouncement, newArrivals, type NotificationFeed } from "@/features/admin/notifications";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";
import { Menu, MenuButton, MenuLink, MenuSeparator } from "./menu";

/*
 * Header bell (worklog §4.0): the owner's and orders.read staff's order
 * notifications, live, plus the "needs attention" counts. Supabase Realtime
 * only signals that something changed; the bell then refetches from the
 * server, so RLS decides what it shows. Polls every minute if Realtime is
 * unavailable, and refreshes when the window regains focus.
 */

const ATTENTION_ICONS = {
  orders: FileTextIcon,
  reviews: StarIcon,
  low_stock: PackageIcon,
  sold_out: WarningCircleIcon,
} as const;

const POLL_MS = 60_000;
const REFETCH_DELAY_MS = 300;
const SOUND_KEY = "goreto.admin.order-sound";

function readSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

function writeSoundPreference(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the toggle still works for this page.
  }
}

type AudioContextConstructor = typeof AudioContext;

/** A short two-note chime from Web Audio; no audio file. Needs a context a user gesture unlocked. */
function playChime(context: AudioContext) {
  const start = context.currentTime;
  [880, 1320].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const at = start + index * 0.16;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.32);
  });
}

/** "Notifications: 2 new order notifications, 5 items need attention". `attentionTotal` null = counts failed. */
export function bellLabel(unread: number, attentionTotal: number | null): string {
  const parts: string[] = [];
  if (unread > 0) parts.push(`${unread} new order ${unread === 1 ? "notification" : "notifications"}`);
  if (attentionTotal === null) parts.push("counts couldn't load");
  else if (attentionTotal > 0) parts.push(`${attentionTotal} ${attentionTotal === 1 ? "item needs" : "items need"} attention`);
  return `Notifications: ${parts.length > 0 ? parts.join(", ") : "nothing new"}`;
}

export function NotificationsMenu({
  profileId,
  initialFeed,
  initialAttention,
}: {
  profileId: string;
  /** null without orders.read, or when it couldn't load. */
  initialFeed: NotificationFeed | null;
  /** null when the counts couldn't be loaded; the menu says so instead of showing zeros. */
  initialAttention: AttentionItem[] | null;
}) {
  const [feed, setFeed] = useState(initialFeed);
  const [attention, setAttention] = useState(initialAttention);
  const [announcement, setAnnouncement] = useState("");
  // Only rendered inside the (closed on load) menu, so reading storage up front can't mismatch hydration.
  const [soundOn, setSoundOn] = useState(() => typeof window !== "undefined" && readSoundPreference());
  const [, startTransition] = useTransition();
  const supabase = useBrowserSupabase();
  const feedRef = useRef(initialFeed);
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(soundOn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFeed = initialFeed !== null;

  const apply = useCallback((data: BellData | null) => {
    if (!data) return;
    if (data.feed) {
      const arrivals = newArrivals(feedRef.current, data.feed);
      if (arrivals.length > 0) {
        setAnnouncement(arrivalAnnouncement(arrivals));
        if (soundRef.current && audioRef.current) playChime(audioRef.current);
      }
      feedRef.current = data.feed;
      setFeed(data.feed);
    }
    setAttention(data.attention);
  }, []);

  // Several changes often land together (e.g. "mark all read"): refetch once.
  const refetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => startTransition(async () => apply(await loadBellAction())), REFETCH_DELAY_MS);
  }, [apply]);

  // With sound on, the next user gesture unlocks an audio context for the chime.
  useEffect(() => {
    if (!soundRef.current) return;
    const unlock = () => {
      const Context: AudioContextConstructor | undefined = window.AudioContext;
      if (Context && !audioRef.current) audioRef.current = new Context();
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  // Live signal: Realtime on this admin's notification rows, with polling as the fallback.
  useEffect(() => {
    if (!hasFeed || !supabase) return;
    let disposed = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (disposed) return;
      poll ??= setInterval(refetch, POLL_MS);
    };
    const channel = supabase
      .channel(`admin-notifications:${profileId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${profileId}` }, refetch)
      .subscribe((status) => {
        // removeChannel reports CLOSED after cleanup; don't start polling for a dead effect.
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          if (poll) clearInterval(poll);
          poll = null;
          refetch(); // Catch anything that arrived while connecting.
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          startPolling();
        }
      });
    return () => {
      disposed = true;
      if (poll) clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [hasFeed, supabase, profileId, refetch]);

  useEffect(() => {
    window.addEventListener("focus", refetch);
    return () => {
      window.removeEventListener("focus", refetch);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refetch]);

  function toggleSound() {
    const next = !soundOn;
    soundRef.current = next;
    setSoundOn(next);
    writeSoundPreference(next);
    if (next) {
      const Context: AudioContextConstructor | undefined = window.AudioContext;
      if (Context) {
        audioRef.current ??= new Context();
        playChime(audioRef.current); // A sample, so staff know what to listen for.
      }
    }
  }

  function markRead(id: string | null) {
    startTransition(async () => apply(await markNotificationsReadAction(id)));
  }

  const unread = feed?.unreadCount ?? 0;
  const attentionTotal = attention?.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const allCaughtUp = unread === 0 && attentionTotal === 0 && attention !== null;

  return (
    <>
      <Menu
        triggerLabel={bellLabel(unread, attention === null ? null : attentionTotal)}
        triggerClassName={cn(iconButtonClasses({ variant: "ghost" }), "relative")}
        panelClassName="max-h-[70vh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto"
        trigger={
          <>
            <BellIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
            {unread > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-neutral-50 bg-primary-500 px-1 text-small font-semibold text-white"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            ) : attentionTotal > 0 ? (
              <span aria-hidden="true" className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-white bg-primary-500" />
            ) : null}
          </>
        }
        header={
          <div className="px-3 pb-2 pt-1">
            <p className="text-body font-semibold text-neutral-900">Notifications</p>
            {allCaughtUp ? <p className="text-small text-neutral-500">You&apos;re all caught up.</p> : null}
          </div>
        }
      >
        {feed ? (
          <>
            <p className="px-3 pb-1 pt-2 text-small font-medium uppercase tracking-wide text-neutral-500" aria-hidden="true">
              Orders
            </p>
            {feed.items.length === 0 ? <p className="px-3 pb-2 text-small text-neutral-500">No order notifications yet.</p> : null}
            {feed.items.map((item) => (
              <MenuLink
                key={item.id}
                href={item.href}
                onSelect={item.read ? undefined : () => markRead(item.id)}
                className="items-start gap-3 py-2"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                    item.kind === "order_auto_accepted" ? "bg-success-100 text-success-700" : "bg-primary-100 text-primary-700",
                  )}
                >
                  {item.channel === "whatsapp" ? (
                    <WhatsappLogoIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                  ) : (
                    <FileTextIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("text-body", item.read ? "text-neutral-700" : "font-semibold text-neutral-900")}>
                    {item.title}
                    {item.read ? null : <span className="sr-only"> (new)</span>}
                  </span>
                  {item.body ? <span className="text-small text-neutral-700">{item.body}</span> : null}
                  <span className="text-small text-neutral-500">
                    {[item.totalPaisa !== null ? `${formatNpr(item.totalPaisa)} COD` : null, relativeTime(item.createdAt)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {item.read ? null : <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-primary-500" />}
              </MenuLink>
            ))}
            {unread > 0 ? (
              <MenuButton keepOpen onClick={() => markRead(null)}>
                <CheckIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
                Mark all as read
              </MenuButton>
            ) : null}
            <MenuButton keepOpen onClick={toggleSound}>
              {soundOn ? (
                <SpeakerHighIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
              ) : (
                <SpeakerSlashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
              )}
              {soundOn ? "Turn off sound for new orders" : "Turn on sound for new orders"}
            </MenuButton>
            <MenuSeparator />
          </>
        ) : null}

        {attention === null ? (
          <p className="px-3 py-2 text-small text-error-700">Couldn&apos;t load the counts. Refresh to try again.</p>
        ) : (
          <>
            <p className="px-3 pb-1 pt-2 text-small font-medium uppercase tracking-wide text-neutral-500" aria-hidden="true">
              Needs attention
            </p>
            {attention.map((item) => {
              const ItemIcon = ATTENTION_ICONS[item.key];
              return (
                <MenuLink key={item.key} href={item.href}>
                  <ItemIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
                  <span className="flex-1">{item.label}</span>
                  <span
                    className={cn(
                      "min-w-8 rounded-full px-2 text-center text-small font-semibold",
                      item.count > 0 ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-500",
                    )}
                  >
                    {item.count}
                  </span>
                </MenuLink>
              );
            })}
          </>
        )}
      </Menu>
      <span className="sr-only" aria-live="polite" role="status">
        {announcement}
      </span>
    </>
  );
}
