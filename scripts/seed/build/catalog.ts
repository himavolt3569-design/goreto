import {
  categorySeeds,
  collectionSeeds,
  families,
  legacyProducts,
  swatches,
  type Family,
  type Flag,
  type Item,
  type ReviewKind,
  type SizeSet,
} from "../data/catalog.ts";
import { seedId, slugify } from "../lib/ids.ts";
import { rngFor, type Rng } from "../lib/random.ts";
import { DAY, HOUR, NOW, STORE_LAUNCH, iso, npt, nptStartOfDay } from "../lib/time.ts";
import type {
  ArMode,
  CategoryRow,
  CollectionProductRow,
  CollectionRow,
  ProductArAssetRow,
  ProductMediaRow,
  ProductOptionJson,
  ProductRow,
  ProductStatus,
  ProductVariantRow,
  SeedLine,
} from "../types.ts";

const picsum = (id: number, width: number, height: number) =>
  `https://picsum.photos/id/${id}/${width}/${height}`;

const rupees = (amount: number) => amount * 100;

/** Price revision on Nepali New Year 2083: some products cost less before it. */
const PRICE_REVISION_AT = npt(2026, 4, 14);

/* ---------- Simulation view of the catalog ---------- */

export type SimVariant = {
  id: string;
  sku: string;
  title: string | null;
  /** Current effective unit price in paisa. */
  pricePaisa: number;
  isActive: boolean;
  /** Relative pick weight (M sizes sell more than XS). */
  weight: number;
};

export type SimProduct = {
  id: string;
  slug: string;
  title: string;
  kind: ReviewKind;
  tags: Set<string>;
  status: ProductStatus;
  createdAt: number;
  archivedAt: number | null;
  variants: SimVariant[];
  coverPath: string;
  popularity: number;
  /** Paisa subtracted from every variant's price before `PRICE_REVISION_AT`. */
  priceDropBeforeRevision: number;
};

export function unitPriceAt(product: SimProduct, variant: SimVariant, at: number): number {
  return at < PRICE_REVISION_AT ? variant.pricePaisa - product.priceDropBeforeRevision : variant.pricePaisa;
}

export type CatalogResult = {
  lines: {
    categories: SeedLine<"categories">[];
    products: SeedLine<"products">[];
    product_variants: SeedLine<"product_variants">[];
    product_media: SeedLine<"product_media">[];
    product_ar_assets: SeedLine<"product_ar_assets">[];
    collections: SeedLine<"collections">[];
    collection_products: SeedLine<"collection_products">[];
  };
  products: SimProduct[];
};

/* ---------- Helpers ---------- */

/** Round up to the nearest price ending in 99 rupees. */
function endIn99(amount: number): number {
  return Math.ceil((amount + 1) / 100) * 100 - 1;
}

const SIZE_WEIGHT: Record<string, number> = { xs: 0.6, s: 1.1, m: 1.4, l: 1.1, xl: 0.6, xxl: 0.3 };

function sizeCode(value: string): string {
  const hoops: Record<string, string> = { small: "SM", medium: "MD", large: "LG" };
  return hoops[value] ?? value.toUpperCase().replace(".", "");
}

const STOP_WORDS = new Set(["and", "with", "of", "the", "a", "&"]);

function skuStem(title: string, taken: Set<string>): string {
  const words = title
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()));
  let stem = words.map((word) => word[0]!.toUpperCase()).join("").slice(0, 3);
  const last = words[words.length - 1] ?? "X";
  let index = 1;
  while (stem.length < 3) stem += (last[index++] ?? "X").toUpperCase();
  let candidate = stem;
  let suffix = 2;
  while (taken.has(candidate)) candidate = `${stem}${suffix++}`;
  taken.add(candidate);
  return candidate;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/* ---------- Build ---------- */

export function buildCatalog(): CatalogResult {
  const rng = rngFor("catalog");
  const stockRng = rngFor("catalog:stock");
  const lines: CatalogResult["lines"] = {
    categories: [],
    products: [],
    product_variants: [],
    product_media: [],
    product_ar_assets: [],
    collections: [],
    collection_products: [],
  };

  /* Categories */
  const categoryIds = new Map<string, string>();
  const categoryCreated = iso(npt(2025, 9, 1, 11, 0));
  categorySeeds.forEach((category, index) => {
    const id = seedId("category", category.slug);
    categoryIds.set(category.slug, id);
    lines.categories.push({
      table: "categories",
      data: {
        id,
        parent_id: null,
        title: category.title,
        slug: category.slug,
        description: category.description,
        image_path: `categories/${category.slug}.jpg`,
        sort_order: (index + 1) * 10,
        is_active: true,
        created_at: categoryCreated,
        updated_at: categoryCreated,
      } satisfies CategoryRow,
      dev: { placeholder_url: picsum(category.picsumId, 160, 160) },
    });
  });
  for (const category of categorySeeds) {
    (category.children ?? []).forEach((child, index) => {
      const id = seedId("category", child.slug);
      categoryIds.set(child.slug, id);
      lines.categories.push({
        table: "categories",
        data: {
          id,
          parent_id: categoryIds.get(category.slug)!,
          title: child.title,
          slug: child.slug,
          description: child.description,
          image_path: `categories/${child.slug}.jpg`,
          sort_order: (index + 1) * 10,
          is_active: true,
          created_at: categoryCreated,
          updated_at: categoryCreated,
        } satisfies CategoryRow,
        dev: { placeholder_url: picsum(category.picsumId, 160, 160) },
      });
    });
  }

  const products: SimProduct[] = [];
  const skuStems = new Set(legacyProducts.map((product) => product.variants[0]!.sku.split("-")[1]!));

  /* Existing dev-seed products, verbatim */
  for (const legacy of legacyProducts) {
    const productId = seedId("product", legacy.slug);
    const [year, month, day] = legacy.launched.split("-").map(Number) as [number, number, number];
    const createdAt = npt(year, month, day, 10, 0) + rng.int(0, 120) * 60_000;
    const variants: SimVariant[] = [];

    legacy.variants.forEach((variant, index) => {
      const variantId = seedId("variant", legacy.slug, variant.key);
      const labels = legacy.options.map((option) => {
        const value = variant.optionValues[option.name];
        return option.values.find((candidate) => candidate.value === value)?.label ?? value;
      });
      const title = labels.length > 0 ? labels.join(" / ") : null;
      const pricePaisa = variant.price === undefined ? null : rupees(variant.price);
      variants.push({
        id: variantId,
        sku: variant.sku,
        title,
        pricePaisa: pricePaisa ?? rupees(legacy.price),
        isActive: true,
        weight: SIZE_WEIGHT[variant.key] ?? 1,
      });
      lines.product_variants.push({
        table: "product_variants",
        data: {
          id: variantId,
          product_id: productId,
          sku: variant.sku,
          title: title ?? "Default",
          option_values: variant.optionValues,
          price_paisa: pricePaisa,
          stock_quantity: variant.stock,
          weight_grams: legacy.weight,
          sort_order: index + 1,
          is_active: true,
          created_at: iso(createdAt),
          updated_at: iso(createdAt),
        } satisfies ProductVariantRow,
      });
    });

    legacy.photos.forEach((photo, index) => {
      lines.product_media.push({
        table: "product_media",
        data: {
          id: seedId("media", legacy.slug, index + 1),
          product_id: productId,
          variant_id: photo.variant ? seedId("variant", legacy.slug, photo.variant) : null,
          kind: "image",
          storage_path: `products/${legacy.slug}/${String(index + 1).padStart(2, "0")}.jpg`,
          alt_text: photo.alt,
          sort_order: index + 1,
          created_at: iso(createdAt),
        } satisfies ProductMediaRow,
        dev: { placeholder_url: picsum(photo.picsumId, 840, 960) },
      });
    });

    if (legacy.ar) {
      lines.product_ar_assets.push(arAssetLine(rng, productId, legacy.slug, legacy.ar.mode, legacy.ar.placement, legacy.ar.anchor, createdAt, true));
    }

    lines.products.push({
      table: "products",
      data: {
        id: productId,
        category_id: categoryIds.get(legacy.category)!,
        title: legacy.title,
        slug: legacy.slug,
        short_description: legacy.short,
        description: legacy.description,
        base_price_paisa: rupees(legacy.price),
        compare_at_price_paisa: null,
        status: "active",
        is_featured: legacy.flags.includes("featured"),
        is_bestseller: legacy.flags.includes("bestseller"),
        is_limited_edition: legacy.flags.includes("limited"),
        low_stock_threshold: legacy.lowStock,
        options: legacy.options.map((option) => ({
          name: option.name,
          values: option.values.map((value) => ({
            value: value.value,
            label: value.label,
            swatch_hex: value.swatchHex ?? null,
          })),
        })),
        specs: legacy.specs.map(([label, value]) => ({ label, value })),
        care_instructions: legacy.care,
        tags: legacy.tags,
        published_at: iso(createdAt),
        archived_at: null,
        created_at: iso(createdAt),
        updated_at: iso(createdAt),
      } satisfies ProductRow,
    });

    const hasSize = legacy.options.some((option) => option.name === "Size");
    products.push({
      id: productId,
      slug: legacy.slug,
      title: legacy.title,
      kind: legacy.kind,
      tags: new Set([...legacy.tags, ...(legacy.ar ? ["ar"] : []), ...(hasSize ? ["sized"] : [])]),
      status: "active",
      createdAt,
      archivedAt: null,
      variants,
      coverPath: `products/${legacy.slug}/01.jpg`,
      popularity: popularityFor(rng, legacy.flags) * 1.3,
      priceDropBeforeRevision: 0,
    });
  }

  /* Hand-written families */
  type Planned = { family: Family; item: Item; slug: string };
  const planned: Planned[] = families.flatMap((family) =>
    family.items.map((item) => ({ family, item, slug: slugify(item.title) })),
  );

  // Lifecycle: a few drafts (recent) and archived products, never flagged ones.
  const unflagged = planned.filter(({ item }) => !item.flags?.length);
  const lifecycleRng = rngFor("catalog:lifecycle");
  const shuffled = lifecycleRng.shuffle(unflagged);
  const drafts = new Set(shuffled.slice(0, 10).map(({ slug }) => slug));
  const archived = new Set(shuffled.slice(10, 18).map(({ slug }) => slug));
  const newArrivals = new Set(shuffled.slice(18, 30).map(({ slug }) => slug));
  const midSeason = new Set(shuffled.slice(30, 75).map(({ slug }) => slug));

  for (const { family, item, slug } of planned) {
    const productId = seedId("product", slug);
    const status: ProductStatus = drafts.has(slug) ? "draft" : archived.has(slug) ? "archived" : "active";

    let createdAt: number;
    if (drafts.has(slug)) createdAt = NOW - rng.int(1, 40) * DAY - rng.int(0, 8) * HOUR;
    else if (newArrivals.has(slug)) createdAt = NOW - rng.int(2, 28) * DAY - rng.int(0, 8) * HOUR;
    else if (midSeason.has(slug)) createdAt = STORE_LAUNCH + rng.int(20, 330) * DAY + rng.int(0, 8) * HOUR;
    else createdAt = npt(2025, 9, rng.int(1, 14), rng.int(10, 17), rng.int(0, 59));
    createdAt = nptStartOfDay(createdAt) + rng.int(10, 17) * HOUR + rng.int(0, 59) * 60_000;
    const archivedAt = status === "archived" ? npt(2026, rng.int(3, 8), rng.int(1, 28), rng.int(10, 17)) : null;

    const colors = item.colors ?? [];
    const sizeSet: SizeSet | null = item.sizes === null ? null : (item.sizes ?? family.sizes ?? null);
    const colorOption = colors.length > 1;
    const options: ProductOptionJson[] = [];
    if (colorOption) {
      options.push({
        name: family.optionName,
        values: colors.map((key) => ({ value: key, label: swatches[key]!.label, swatch_hex: swatches[key]!.hex })),
      });
    }
    if (sizeSet) {
      options.push({
        name: sizeSet.name,
        values: sizeSet.values.map(([value, label]) => ({ value, label, swatch_hex: null })),
      });
    }

    const stem = skuStem(item.title, skuStems);
    const basePaisa = rupees(item.price);
    const weightGrams = rng.int(family.weight[0], family.weight[1]);
    const colorKeys = colors.length > 0 ? colors : [null];
    const sizeValues = sizeSet ? sizeSet.values : [null];
    const variants: SimVariant[] = [];
    let sortOrder = 0;

    for (const colorKey of colorKeys) {
      for (const size of sizeValues) {
        sortOrder += 1;
        const optionValues: Record<string, string> = {};
        const labels: string[] = [];
        if (colorOption && colorKey) {
          optionValues[family.optionName] = colorKey;
          labels.push(swatches[colorKey]!.label);
        }
        if (sizeSet && size) {
          optionValues[sizeSet.name] = size[0];
          labels.push(size[1]);
        }
        const skuParts = ["GRT", stem];
        if (colorKey) skuParts.push(swatches[colorKey]!.code);
        if (size) skuParts.push(sizeCode(size[0]));
        if (!colorKey && !size) skuParts.push("STD");
        const sku = skuParts.join("-");

        let adjustment = 0;
        if (colorKey === "rose-gold") adjustment += 200;
        if (family.key === "watches" && colorKey === "gold" && colors.length > 1) adjustment += 500;
        if (size?.[0] === "medium") adjustment += 200;
        if (size?.[0] === "large") adjustment += 400;
        const pricePaisa = adjustment === 0 ? null : basePaisa + rupees(adjustment);

        const variantKey = [colorKey ?? "std", size?.[0] ?? "os"].join("-");
        const variantId = seedId("variant", slug, variantKey);
        const discontinued = status === "active" && colors.length > 2 && colorKey === colors[colors.length - 1] && rng.chance(0.08);
        const stock = stockFor(stockRng, status, family.lowStock, item.price, discontinued);

        variants.push({
          id: variantId,
          sku,
          title: labels.length > 0 ? labels.join(" / ") : null,
          pricePaisa: pricePaisa ?? basePaisa,
          isActive: !discontinued,
          weight: SIZE_WEIGHT[size?.[0] ?? ""] ?? 1,
        });
        lines.product_variants.push({
          table: "product_variants",
          data: {
            id: variantId,
            product_id: productId,
            sku,
            title: labels.length > 0 ? labels.join(" / ") : "Default",
            option_values: optionValues,
            price_paisa: pricePaisa,
            stock_quantity: stock,
            weight_grams: weightGrams,
            sort_order: sortOrder,
            is_active: !discontinued,
            created_at: iso(createdAt),
            updated_at: iso(discontinued ? NOW - rng.int(3, 60) * DAY : createdAt),
          } satisfies ProductVariantRow,
        });
      }
    }

    /* Media: one shared photo, then per-colour photos for colour-only products. */
    const media: ProductMediaRow[] = [];
    const placeholders: string[] = [];
    const angles = ["front view", "close-up of the details", "styled on a model", "side view"];
    const perColor = colorOption && !sizeSet;
    const photoCount = perColor ? 1 + Math.min(colors.length, 3) : rng.int(2, 4);
    for (let index = 0; index < photoCount; index += 1) {
      const colorKey = perColor && index > 0 ? colors[index - 1]! : null;
      const variantId = colorKey ? seedId("variant", slug, `${colorKey}-os`) : null;
      const alt = colorKey
        ? `${item.title} in ${swatches[colorKey]!.label.toLowerCase()}`
        : `${item.title}, ${angles[index % angles.length]}`;
      media.push({
        id: seedId("media", slug, index + 1),
        product_id: productId,
        variant_id: variantId,
        kind: "image",
        storage_path: `products/${slug}/${String(index + 1).padStart(2, "0")}.jpg`,
        alt_text: alt,
        sort_order: index + 1,
        created_at: iso(createdAt),
      });
      placeholders.push(picsum(family.photos[index % family.photos.length]!, 840, 960));
    }
    media.forEach((row, index) =>
      lines.product_media.push({ table: "product_media", data: row, dev: { placeholder_url: placeholders[index]! } }),
    );

    /* AR */
    let hasAr = false;
    if (family.ar && status !== "archived" && rng.chance(family.ar.share)) {
      hasAr = true;
      const mode: ArMode = family.ar.modes.includes("live_3d") && rng.chance(0.3) ? "live_3d" : "live_2d";
      lines.product_ar_assets.push(
        arAssetLine(rng, productId, slug, mode, family.ar.placement, family.ar.anchor, createdAt, !rng.chance(0.06)),
      );
    }

    /* Product */
    const flags = item.flags ?? [];
    const onSale = status === "active" && !flags.includes("limited") && rng.chance(0.1);
    const compareAt = item.compareAt ?? (onSale ? endIn99(item.price * 1.25) : null);
    const colorSummary = colors.map((key) => swatches[key]!.label).join(", ");
    const specs: [string, string][] = [["Material", item.material]];
    if (colors.length > 0) specs.push([family.optionName === "Finish" ? "Finish" : "Colour", colorSummary]);
    for (const [label, value] of [...family.specs, ...(item.specs ?? [])]) {
      const existing = specs.findIndex(([candidate]) => candidate === label);
      if (existing >= 0) specs[existing] = [label, value];
      else specs.push([label, value]);
    }
    const tags = [...new Set([...family.tags, ...(item.tags ?? []), ...colors.map((key) => slugify(swatches[key]!.label))])];
    const updatedAt = archivedAt ?? (onSale ? NOW - rng.int(2, 40) * DAY : createdAt);

    lines.products.push({
      table: "products",
      data: {
        id: productId,
        category_id: categoryIds.get(family.category)!,
        title: item.title,
        slug,
        short_description: item.short,
        description: `${item.detail} ${family.closing}`,
        base_price_paisa: basePaisa,
        compare_at_price_paisa: compareAt === null ? null : rupees(compareAt),
        status,
        is_featured: flags.includes("featured"),
        is_bestseller: flags.includes("bestseller"),
        is_limited_edition: flags.includes("limited"),
        low_stock_threshold: family.lowStock,
        options,
        specs: specs.map(([label, value]) => ({ label, value })),
        care_instructions: family.care,
        tags,
        published_at: status === "draft" ? null : iso(createdAt),
        archived_at: archivedAt === null ? null : iso(archivedAt),
        created_at: iso(createdAt),
        updated_at: iso(Math.max(createdAt, updatedAt)),
      } satisfies ProductRow,
    });

    const priceDrop =
      status !== "draft" && createdAt < npt(2026, 1, 1) && rng.chance(0.15) ? rupees(rng.pick([100, 200, 300])) : 0;

    products.push({
      id: productId,
      slug,
      title: item.title,
      kind: family.kind,
      tags: new Set([...tags, ...(hasAr ? ["ar"] : []), ...(sizeSet ? ["sized"] : [])]),
      status,
      createdAt,
      archivedAt,
      variants,
      coverPath: media[0]!.storage_path,
      popularity: popularityFor(rng, flags),
      priceDropBeforeRevision: priceDrop,
    });
  }

  /* Collections */
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const categoryOfProduct = new Map<string, string>();
  for (const line of lines.products) {
    const categorySlug = [...categoryIds.entries()].find(([, id]) => id === line.data.category_id)?.[0];
    if (categorySlug) categoryOfProduct.set(line.data.slug, categorySlug);
  }

  collectionSeeds.forEach((collection, index) => {
    const id = seedId("collection", collection.slug);
    const created = npt(2025, 9, 12, 11, 0) + index * DAY;
    const window = collection.window;
    lines.collections.push({
      table: "collections",
      data: {
        id,
        slug: collection.slug,
        eyebrow: collection.eyebrow,
        title: collection.title,
        description: collection.description,
        hero_image_path: `collections/${collection.slug}.jpg`,
        hero_image_alt: collection.alt,
        sort_order: (index + 1) * 10,
        is_active: true,
        starts_at: window ? iso(dateToNpt(window[0])) : null,
        ends_at: window ? iso(dateToNpt(window[1]) + DAY - 60_000) : null,
        created_at: iso(created),
        updated_at: iso(created),
      } satisfies CollectionRow,
      dev: { placeholder_url: picsum(collection.picsumId, 1200, 600) },
    });

    const matches = products
      .filter((product) => product.status === "active")
      .filter((product) => {
        const { tags, categories, slugs } = collection.match;
        return (
          (slugs ?? []).includes(product.slug) ||
          (categories ?? []).includes(categoryOfProduct.get(product.slug) ?? "") ||
          (tags ?? []).some((tag) => product.tags.has(tag))
        );
      })
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, collection.limit);

    matches.forEach((product, position) => {
      lines.collection_products.push({
        table: "collection_products",
        data: { collection_id: id, product_id: product.id, sort_order: position + 1 } satisfies CollectionProductRow,
      });
    });
  });

  if (productBySlug.size !== products.length) throw new Error("Duplicate product slugs in the seed catalog");
  return { lines, products };
}

function dateToNpt(date: string): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return npt(year, month, day);
}

function popularityFor(rng: Rng, flags: Flag[]): number {
  let popularity = Math.exp(rng.normal() * 0.7);
  if (flags.includes("bestseller")) popularity *= 3;
  if (flags.includes("featured")) popularity *= 1.6;
  if (flags.includes("limited")) popularity *= 0.7;
  return popularity;
}

function stockFor(rng: Rng, status: ProductStatus, lowStock: number, price: number, discontinued: boolean): number {
  if (discontinued) return 0;
  if (status === "archived") return rng.chance(0.7) ? 0 : rng.int(1, 3);
  if (status === "draft") return rng.int(5, 20);
  const roll = rng.next();
  if (roll < 0.07) return 0;
  if (roll < 0.2) return rng.int(1, lowStock);
  const ceiling = price >= 6000 ? 18 : price >= 3000 ? 35 : 80;
  return rng.int(lowStock + 1, Math.max(lowStock + 2, ceiling));
}

function arAssetLine(
  rng: Rng,
  productId: string,
  slug: string,
  mode: ArMode,
  placement: ProductArAssetRow["placement"],
  anchor: string,
  createdAt: number,
  isActive: boolean,
): SeedLine<"product_ar_assets"> {
  const is3d = mode === "live_3d";
  const created = createdAt + rng.int(1, 10) * DAY;
  const stamp = iso(Math.min(created, NOW - HOUR));
  return {
    table: "product_ar_assets",
    data: {
      id: seedId("ar-asset", slug, mode),
      product_id: productId,
      variant_id: null,
      mode,
      placement,
      asset_path: `ar/${slug}/${is3d ? "model.glb" : "overlay.png"}`,
      asset_format: is3d ? "glb" : "png",
      calibration: {
        anchor,
        scale: roundTo(rng.float(0.9, 1.1), 2),
        offset_x: 0,
        offset_y: roundTo(rng.float(-0.03, 0.03), 3),
        rotation_deg: 0,
      },
      is_active: isActive,
      created_at: stamp,
      updated_at: stamp,
    } satisfies ProductArAssetRow,
  };
}
