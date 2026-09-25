import { deliveryPhrases, rejectedReviews, reviewPhrases, reviewTitles } from "../data/commerce.ts";
import { seedId } from "../lib/ids.ts";
import { rngFor, type Rng } from "../lib/random.ts";
import { DAY, HOUR, NOW, iso, minutes } from "../lib/time.ts";
import type { NewsletterSubscriberRow, ReviewRow, ReviewStatus, SeedLine, WishlistItemRow } from "../types.ts";
import type { SimProduct } from "./catalog.ts";
import type { DeliveredItem } from "./orders.ts";
import type { Customer, PersonFactory } from "./people.ts";

export type EngagementResult = {
  reviews: SeedLine<"reviews">[];
  wishlist_items: SeedLine<"wishlist_items">[];
  newsletter_subscribers: SeedLine<"newsletter_subscribers">[];
};

type Moderators = { support: string; owner: string };

/** Phrases may be prefixed `tag|…` to apply only to products with that tag. */
function phrasesFor(pool: readonly string[], tags: Set<string>): string[] {
  return pool.flatMap((phrase) => {
    const bar = phrase.indexOf("|");
    if (bar < 0) return [phrase];
    return tags.has(phrase.slice(0, bar)) ? [phrase.slice(bar + 1)] : [];
  });
}

function ratingFor(rng: Rng, refunded: boolean): 1 | 2 | 3 | 4 | 5 {
  return refunded
    ? rng.weighted([[1, 0.35], [2, 0.35], [3, 0.2], [4, 0.1]] as const)
    : rng.weighted([[5, 0.55], [4, 0.28], [3, 0.1], [2, 0.04], [1, 0.03]] as const);
}

function reviewBody(rng: Rng, product: SimProduct, rating: number, delivery: DeliveredItem | null): string {
  const pools = reviewPhrases[product.kind];
  const positive = phrasesFor(pools.positive, product.tags);
  const mixed = phrasesFor(pools.mixed, product.tags);
  const negative = phrasesFor(pools.negative, product.tags);
  let sentences: string[];
  if (rating >= 4) sentences = rng.sample(positive, rating === 5 ? rng.int(1, 2) : 1);
  else if (rating === 3) sentences = [rng.pick(mixed), ...(rng.chance(0.4) ? [rng.pick(positive)] : [])];
  else sentences = [rng.pick(negative), ...(rng.chance(0.3) ? [rng.pick(mixed)] : [])];
  if (rating === 4 && rng.chance(0.4)) sentences.push(rng.pick(mixed));
  if (delivery && rating >= 3 && rng.chance(0.45)) {
    sentences.push(
      rng.pick(deliveryPhrases).replace("{town}", delivery.town).replace("{days}", String(delivery.transitDays)),
    );
  }
  return sentences.join(" ");
}

function moderation(rng: Rng, createdAt: number, moderators: Moderators): { status: ReviewStatus; by: string | null; at: number | null } {
  const moderatedAt = createdAt + minutes(rng.int(120, 36 * 60));
  const recent = NOW - createdAt < 3 * DAY;
  if (moderatedAt > NOW || (recent && rng.chance(0.8))) return { status: "pending", by: null, at: null };
  return { status: "published", by: rng.chance(0.8) ? moderators.support : moderators.owner, at: moderatedAt };
}

export function buildEngagement(input: {
  customers: Customer[];
  products: SimProduct[];
  deliveredItemsByCustomer: Map<string, DeliveredItem[]>;
  persons: PersonFactory;
  moderators: Moderators;
}): EngagementResult {
  const rng = rngFor("engagement");
  const productById = new Map(input.products.map((product) => [product.id, product]));
  const active = input.products.filter((product) => product.status === "active");
  const living = input.customers.filter((customer) => customer.deletedAt === null);
  const result: EngagementResult = { reviews: [], wishlist_items: [], newsletter_subscribers: [] };

  /* Reviews */
  const reviewed = new Set<string>();
  const pushReview = (customer: Customer, product: SimProduct, delivery: DeliveredItem | null, createdAt: number) => {
    const key = `${customer.id}:${product.id}`;
    if (reviewed.has(key) || createdAt > NOW) return;
    reviewed.add(key);
    const rejected = rng.chance(0.04);
    const template = rejected ? rng.pick(rejectedReviews) : null;
    const rating = template ? 3 : ratingFor(rng, delivery?.refunded ?? false);
    const titles = reviewTitles[rating as keyof typeof reviewTitles];
    const decision = moderation(rng, createdAt, input.moderators);
    const status: ReviewStatus = template && decision.status === "published" ? "rejected" : decision.status;
    const row: ReviewRow = {
      id: seedId("review", customer.id, product.id),
      user_id: customer.id,
      product_id: product.id,
      order_item_id: delivery?.orderItemId ?? null,
      rating,
      title: template ? template.title : rng.pick(titles),
      body: template ? template.body : reviewBody(rng, product, rating, delivery),
      status,
      moderated_by: decision.by,
      moderated_at: decision.at === null ? null : iso(decision.at),
      moderation_note: status === "rejected" ? template!.note : null,
      created_at: iso(createdAt),
      updated_at: iso(decision.at ?? createdAt),
    };
    result.reviews.push({ table: "reviews", data: row });
  };

  for (const customer of living) {
    for (const item of input.deliveredItemsByCustomer.get(customer.id) ?? []) {
      if (!rng.chance(item.refunded ? 0.6 : 0.55)) continue;
      const product = productById.get(item.productId)!;
      const createdAt = item.deliveredAt + rng.int(1, 14) * DAY + minutes(rng.int(-300, 300));
      pushReview(customer, product, item, createdAt);
    }
  }
  // A smaller set of unverified reviews (bought in person, or as a gift).
  for (let index = 0; index < 260; index += 1) {
    const customer = rng.pick(living);
    const product = rng.pick(active);
    const earliest = Math.max(customer.signupAt, product.createdAt) + DAY;
    if (earliest >= NOW - HOUR) continue;
    pushReview(customer, product, null, earliest + Math.floor(rng.next() * (NOW - HOUR - earliest)));
  }

  /* Wishlist */
  for (const customer of living) {
    const count = rng.weighted([[0, 0.35], [1, 0.2], [2, 0.15], [3, 0.1], [4, 0.08], [6, 0.07], [9, 0.05]] as const);
    const picks = new Set<string>();
    for (let attempt = 0; picks.size < count && attempt < count * 4; attempt += 1) {
      const pool = rng.chance(0.03) ? input.products.filter((product) => product.status === "archived") : active;
      const product = rng.weighted(pool.map((item) => [item, item.popularity] as const));
      if (picks.has(product.id)) continue;
      const earliest = Math.max(customer.signupAt, product.createdAt) + HOUR;
      const latest = product.archivedAt ?? NOW - HOUR;
      if (earliest >= latest) continue;
      picks.add(product.id);
      result.wishlist_items.push({
        table: "wishlist_items",
        data: {
          id: seedId("wishlist", customer.id, product.id),
          user_id: customer.id,
          product_id: product.id,
          created_at: iso(earliest + Math.floor(rng.next() * (latest - earliest))),
        } satisfies WishlistItemRow,
      });
    }
  }

  /* Newsletter */
  const subscriber = (email: string, profileId: string | null, source: NewsletterSubscriberRow["source"], subscribedAt: number) => {
    const unsubscribed = rng.chance(0.12) ? subscribedAt + Math.floor(rng.next() * (NOW - subscribedAt)) : null;
    result.newsletter_subscribers.push({
      table: "newsletter_subscribers",
      data: {
        id: seedId("newsletter", email),
        email,
        profile_id: profileId,
        status: unsubscribed === null ? "subscribed" : "unsubscribed",
        source,
        subscribed_at: iso(subscribedAt),
        unsubscribed_at: unsubscribed === null ? null : iso(unsubscribed),
      } satisfies NewsletterSubscriberRow,
    });
  };
  for (const customer of rng.sample(living, 260)) {
    const at = Math.min(customer.signupAt + minutes(rng.int(1, 60 * 24 * 30)), NOW - HOUR);
    subscriber(customer.person.email, customer.id, rng.chance(0.6) ? "checkout" : "account", at);
  }
  const launch = Math.min(...input.customers.map((customer) => customer.signupAt));
  for (let index = 0; index < 150; index += 1) {
    const person = input.persons.create();
    subscriber(person.email, null, "homepage", launch + Math.floor(rng.next() ** 0.8 * (NOW - HOUR - launch)));
  }

  return result;
}
