/**
 * DEVELOPMENT SEED DATA — NOT REAL CATALOG, CUSTOMERS OR REVIEWS.
 *
 * Stand-in content for building the storefront before the Supabase catalog
 * exists. `getHomepageData()` and the product-detail reads only serve it
 * outside production, so these products, ratings and testimonials can never
 * appear on the live store.
 *
 * Photos are hand-picked Lorem Picsum IDs; names describe what each photo
 * actually shows rather than the reference screenshot's products.
 */
import { picsumImage } from "@/lib/media/picsum";
import type {
  HomeCategory,
  HomeCollection,
  HomeProduct,
  ProductDetail,
  ProductOption,
  ProductSummary,
  Testimonial,
} from "./types";

const CATEGORY_PX = 160;
const PRODUCT_PX = 480;

function categoryImage(id: number, alt: string) {
  return { src: picsumImage(id, CATEGORY_PX, CATEGORY_PX), alt };
}

export const seedCategories: HomeCategory[] = [
  { slug: "dresses", title: "Dresses", image: categoryImage(325, "") },
  { slug: "jewelry", title: "Jewelry", image: categoryImage(628, "") },
  { slug: "bags", title: "Bags", image: categoryImage(7, "") },
  { slug: "shoes", title: "Shoes", image: categoryImage(21, "") },
  { slug: "sunglasses", title: "Sunglasses", image: categoryImage(26, "") },
  { slug: "tops", title: "Tops", image: categoryImage(836, "") },
  { slug: "outerwear", title: "Outerwear", image: categoryImage(669, "") },
  { slug: "hats", title: "Hats", image: categoryImage(823, "") },
  { slug: "scarves", title: "Scarves", image: categoryImage(758, "") },
  { slug: "boots", title: "Boots", image: categoryImage(604, "") },
];

/* ---------- Products ---------- */

/** Gallery photos are served at the product frame's 7:8 aspect. */
const GALLERY_W = 840;
const GALLERY_H = 960;

type SeedPhoto = {
  picsumId: number;
  alt: string;
  /** Variant key (see `SeedVariant.key`) when the photo shows that variant only. */
  variant?: string;
};

type SeedVariant = {
  /** Unique within the product; becomes part of the variant id. */
  key: string;
  sku: string;
  optionValues: Record<string, string>;
  pricePaisa?: number;
  stock: number;
};

type SeedProduct = Omit<ProductDetail, "category" | "variants" | "media"> & {
  categorySlug: string;
  variants: SeedVariant[];
  photos: SeedPhoto[];
};

const categoryTitles: Record<string, string> = Object.fromEntries(
  seedCategories.map((category) => [category.slug, category.title]),
);

function colorOption(values: ProductOption["values"]): ProductOption {
  return { name: "Color", values };
}

function sizeOption(sizes: string[]): ProductOption {
  return {
    name: "Size",
    values: sizes.map((size) => ({ value: size.toLowerCase(), label: size })),
  };
}

function sizeVariants(prefix: string, stockBySize: Record<string, number>): SeedVariant[] {
  return Object.entries(stockBySize).map(([size, stock]) => ({
    key: size.toLowerCase(),
    sku: `${prefix}-${size}`,
    optionValues: { Size: size.toLowerCase() },
    stock,
  }));
}

const seedProductList: SeedProduct[] = [
  {
    slug: "beaded-wrist-stack",
    title: "Beaded Wrist Stack",
    categorySlug: "jewelry",
    badge: { tone: "bestseller", label: "Bestseller" },
    rating: { value: 4.8, count: 120 },
    shortDescription:
      "A relaxed stack of beaded and leather bands. Easy to wear every day or to layer with your favourite watch.",
    description:
      "Three hand-strung bracelets in wooden beads, glass beads and braided leather. The stretch cord slips on without a clasp, and the warm tones pair with denim and neutrals alike.",
    basePricePaisa: 179900,
    lowStockThreshold: 5,
    options: [
      colorOption([
        { value: "tan", label: "Tan", swatchHex: "#B07A4F" },
        { value: "black", label: "Black", swatchHex: "#1F2937" },
      ]),
    ],
    variants: [
      { key: "tan", sku: "GRT-BWS-TAN", optionValues: { Color: "tan" }, stock: 24 },
      { key: "black", sku: "GRT-BWS-BLK", optionValues: { Color: "black" }, stock: 3 },
    ],
    photos: [
      { picsumId: 628, alt: "Layered beaded bracelets worn on the wrist" },
      { picsumId: 996, alt: "Bracelet worn in warm evening light" },
    ],
    specs: [
      { label: "Material", value: "Wooden & glass beads, braided leather" },
      { label: "Closure", value: "Stretch cord, slip-on" },
      { label: "Fit", value: "Fits most wrists (16–18 cm)" },
      { label: "Pieces", value: "Set of 3 bracelets" },
      { label: "Style", value: "Boho, everyday wear" },
      { label: "What's in the box", value: "3 bracelets, cotton pouch" },
    ],
    careInstructions:
      "Keep away from water, perfume and lotions. Store flat in the cotton pouch so the cord keeps its stretch.",
    tryOn: {
      modes: ["live"],
      placement: "wrist",
      previewImage: { src: picsumImage(996, 480, 360), alt: "" },
    },
  },
  {
    slug: "leather-weekender-bag",
    title: "Leather Weekender Bag",
    categorySlug: "bags",
    badge: null,
    rating: { value: 4.6, count: 54 },
    shortDescription:
      "A roomy full-grain leather bag for short trips, workdays and everything in between.",
    description:
      "Soft full-grain leather with a canvas-lined main compartment, an inner zip pocket and a detachable shoulder strap. Sized for a two-day trip, or a laptop and a change of clothes.",
    basePricePaisa: 399900,
    lowStockThreshold: 3,
    options: [],
    variants: [{ key: "brown", sku: "GRT-LWB-BRN", optionValues: {}, stock: 8 }],
    photos: [{ picsumId: 7, alt: "Brown leather bag on a wooden café table" }],
    specs: [
      { label: "Material", value: "Full-grain leather, canvas lining" },
      { label: "Colour", value: "Brown" },
      { label: "Dimensions", value: "45 × 25 × 22 cm" },
      { label: "Strap", value: "Detachable, adjustable" },
      { label: "Pockets", value: "1 inner zip, 2 slip" },
      { label: "What's in the box", value: "Bag, shoulder strap, dust bag" },
    ],
    careInstructions:
      "Wipe with a dry cloth. Condition the leather every few months and keep it out of direct sunlight when stored.",
    tryOn: null,
  },
  {
    slug: "white-lace-sundress",
    title: "White Lace Sundress",
    categorySlug: "dresses",
    badge: { tone: "new", label: "New" },
    rating: { value: 4.7, count: 88 },
    shortDescription:
      "A light cotton sundress with a lace hem, made for warm days and garden gatherings.",
    description:
      "Breathable cotton with a scalloped lace hem and a relaxed, knee-length fit. Fully lined, with a hidden side zip.",
    basePricePaisa: 289900,
    lowStockThreshold: 3,
    options: [sizeOption(["XS", "S", "M", "L"])],
    variants: sizeVariants("GRT-WLS", { XS: 6, S: 2, M: 9, L: 0 }),
    photos: [{ picsumId: 325, alt: "White lace sundress worn outdoors" }],
    specs: [
      { label: "Material", value: "100% cotton, cotton lining" },
      { label: "Length", value: "Knee length" },
      { label: "Fit", value: "Relaxed" },
      { label: "Closure", value: "Hidden side zip" },
      { label: "Style", value: "Summer, casual" },
    ],
    careInstructions: "Hand wash cold with similar colours. Dry flat in the shade and iron on low.",
    tryOn: null,
  },
  {
    slug: "aviator-sunglasses",
    title: "Aviator Sunglasses",
    categorySlug: "sunglasses",
    badge: { tone: "new", label: "New" },
    rating: { value: 4.5, count: 64 },
    shortDescription: "Classic aviators with mirrored lenses and a lightweight metal frame.",
    description:
      "A timeless teardrop shape with UV400 mirrored lenses, adjustable nose pads and spring hinges for a comfortable fit all day.",
    basePricePaisa: 249900,
    lowStockThreshold: 5,
    options: [
      colorOption([
        { value: "gold-blue", label: "Gold / Blue", swatchHex: "#C9A24A" },
        { value: "silver-grey", label: "Silver / Grey", swatchHex: "#9CA3AF" },
      ]),
    ],
    variants: [
      { key: "gold-blue", sku: "GRT-AVS-GLD", optionValues: { Color: "gold-blue" }, stock: 14 },
      {
        key: "silver-grey",
        sku: "GRT-AVS-SLV",
        optionValues: { Color: "silver-grey" },
        pricePaisa: 229900,
        stock: 7,
      },
    ],
    photos: [
      { picsumId: 64, alt: "Woman wearing mirrored aviator sunglasses" },
      { picsumId: 26, alt: "Aviator sunglasses laid out with travel essentials" },
    ],
    specs: [
      { label: "Frame", value: "Metal, spring hinges" },
      { label: "Lenses", value: "Mirrored, UV400" },
      { label: "Lens width", value: "58 mm" },
      { label: "Fit", value: "Adjustable nose pads" },
      { label: "What's in the box", value: "Sunglasses, case, cleaning cloth" },
    ],
    careInstructions:
      "Clean the lenses with the included cloth. Store in the case, lenses up, to avoid scratches.",
    tryOn: {
      modes: ["live"],
      placement: "face",
      previewImage: { src: picsumImage(64, 480, 360), alt: "" },
    },
  },
  {
    slug: "white-pointed-heels",
    title: "White Pointed Heels",
    categorySlug: "shoes",
    badge: null,
    rating: { value: 4.4, count: 41 },
    shortDescription: "Sleek pointed-toe heels that dress up everything from jeans to gowns.",
    description:
      "Smooth faux-leather uppers on a 7 cm stiletto heel, with a cushioned insole for longer evenings.",
    basePricePaisa: 349900,
    lowStockThreshold: 2,
    options: [sizeOption(["36", "37", "38", "39", "40"])],
    variants: sizeVariants("GRT-WPH", { "36": 5, "37": 5, "38": 5, "39": 5, "40": 1 }),
    photos: [{ picsumId: 21, alt: "Pair of white pointed-toe heels" }],
    specs: [
      { label: "Upper", value: "Faux leather" },
      { label: "Heel height", value: "7 cm" },
      { label: "Toe", value: "Pointed" },
      { label: "Sizing", value: "EU sizes, true to size" },
    ],
    careInstructions: "Wipe with a damp cloth. Store in the dust bag, stuffed to keep their shape.",
    tryOn: null,
  },
  {
    slug: "knit-slouch-beanie",
    title: "Knit Slouch Beanie",
    categorySlug: "hats",
    badge: { tone: "bestseller", label: "Bestseller" },
    rating: { value: 4.9, count: 45 },
    shortDescription: "A chunky, slouchy knit beanie to keep you warm on misty hill mornings.",
    description:
      "A soft acrylic-wool blend in a chunky rib knit, with a generous slouch that sits comfortably over the ears.",
    basePricePaisa: 99900,
    lowStockThreshold: 5,
    options: [
      colorOption([
        { value: "grey", label: "Grey" },
        { value: "red", label: "Red" },
      ]),
    ],
    variants: [
      { key: "grey", sku: "GRT-KSB-GRY", optionValues: { Color: "grey" }, stock: 15 },
      { key: "red", sku: "GRT-KSB-RED", optionValues: { Color: "red" }, stock: 4 },
    ],
    photos: [
      { picsumId: 669, alt: "Grey knit beanie worn with a corduroy jacket", variant: "grey" },
      { picsumId: 823, alt: "Red knit beanie worn in a forest", variant: "red" },
    ],
    specs: [
      { label: "Material", value: "70% acrylic, 30% wool" },
      { label: "Knit", value: "Chunky rib" },
      { label: "Fit", value: "Slouchy, one size" },
    ],
    careInstructions: "Hand wash cold and dry flat. Do not tumble dry.",
    tryOn: null,
  },
  {
    slug: "felt-fedora",
    title: "Felt Fedora",
    categorySlug: "hats",
    badge: null,
    rating: { value: 4.6, count: 37 },
    shortDescription: "A soft grey felt fedora with a tonal band.",
    description:
      "Structured wool felt with a pinched crown, a medium brim and a grosgrain band. It adds polish to a casual outfit.",
    basePricePaisa: 169900,
    lowStockThreshold: 3,
    options: [],
    variants: [{ key: "grey", sku: "GRT-FFD-GRY", optionValues: {}, stock: 10 }],
    photos: [{ picsumId: 836, alt: "Woman in a grey felt fedora playing guitar" }],
    specs: [
      { label: "Material", value: "Wool felt" },
      { label: "Brim", value: "6 cm" },
      { label: "Band", value: "Grosgrain" },
    ],
    careInstructions: "Brush gently with a soft brush. Store crown-down on a flat surface.",
    tryOn: null,
  },
  {
    slug: "aztec-blanket-scarf",
    title: "Aztec Blanket Scarf",
    categorySlug: "scarves",
    badge: null,
    rating: { value: 4.7, count: 76 },
    shortDescription: "An oversized, colourful blanket scarf with a fringed edge.",
    description:
      "A bold geometric pattern woven in a soft, brushed yarn. Wear it wrapped, draped or belted as a shawl.",
    basePricePaisa: 149900,
    lowStockThreshold: 5,
    options: [],
    variants: [{ key: "multi", sku: "GRT-ABS-MLT", optionValues: {}, stock: 18 }],
    photos: [{ picsumId: 758, alt: "Woven wrap in warm autumn colours" }],
    specs: [
      { label: "Material", value: "Brushed acrylic" },
      { label: "Size", value: "140 × 140 cm" },
      { label: "Edge", value: "Fringed" },
    ],
    careInstructions: "Hand wash cold and dry flat. Steam to remove creases.",
    tryOn: null,
  },
  {
    slug: "leather-moto-jacket",
    title: "Leather Moto Jacket",
    categorySlug: "outerwear",
    badge: null,
    rating: { value: 4.8, count: 29 },
    shortDescription: "A classic black moto jacket in soft, lived-in leather.",
    description:
      "Lambskin leather with an asymmetric zip, snap lapels and zip cuffs. Fully lined for the cooler months.",
    basePricePaisa: 899900,
    lowStockThreshold: 2,
    options: [sizeOption(["S", "M", "L"])],
    variants: sizeVariants("GRT-LMJ", { S: 3, M: 4, L: 2 }),
    photos: [{ picsumId: 1005, alt: "Person in a leather jacket and knit scarf by the sea" }],
    specs: [
      { label: "Material", value: "Lambskin leather, polyester lining" },
      { label: "Closure", value: "Asymmetric zip" },
      { label: "Fit", value: "Regular" },
    ],
    careInstructions: "Professional leather clean only. Hang on a wide hanger away from heat.",
    tryOn: null,
  },
  {
    slug: "suede-ankle-boots",
    title: "Suede Ankle Boots",
    categorySlug: "boots",
    badge: null,
    rating: { value: 4.5, count: 58 },
    shortDescription: "Tan suede ankle boots with a stacked heel.",
    description:
      "Soft suede uppers, a side zip and a 5 cm stacked heel on a grippy rubber sole for everyday walking.",
    basePricePaisa: 549900,
    lowStockThreshold: 2,
    options: [sizeOption(["37", "38", "39", "40"])],
    variants: sizeVariants("GRT-SAB", { "37": 4, "38": 4, "39": 4, "40": 4 }),
    photos: [{ picsumId: 604, alt: "Tan suede ankle boots worn with jeans" }],
    specs: [
      { label: "Upper", value: "Suede" },
      { label: "Heel height", value: "5 cm, stacked" },
      { label: "Sole", value: "Rubber" },
      { label: "Closure", value: "Side zip" },
    ],
    careInstructions: "Brush with a suede brush and treat with a suede protector before wearing.",
    tryOn: null,
  },
];

function toProductDetail({ categorySlug, variants, photos, ...product }: SeedProduct): ProductDetail {
  const variantId = (key: string) => `${product.slug}--${key}`;
  return {
    ...product,
    category: { slug: categorySlug, title: categoryTitles[categorySlug] ?? categorySlug },
    variants: variants.map(({ key, stock, pricePaisa, ...variant }) => ({
      ...variant,
      id: variantId(key),
      pricePaisa: pricePaisa ?? null,
      stockQuantity: stock,
    })),
    media: photos.map((photo, index) => ({
      id: `${product.slug}--photo-${index + 1}`,
      image: { src: picsumImage(photo.picsumId, GALLERY_W, GALLERY_H), alt: photo.alt },
      variantId: photo.variant ? variantId(photo.variant) : null,
    })),
  };
}

function toHomeProduct(product: SeedProduct): HomeProduct {
  const cover = product.photos[0];
  return {
    slug: product.slug,
    title: product.title,
    categorySlug: product.categorySlug,
    pricePaisa: product.basePricePaisa,
    image: { src: picsumImage(cover.picsumId, PRODUCT_PX, PRODUCT_PX), alt: cover.alt },
  };
}

/** Homepage "Handpicked Just for You" grid, in display order. */
const FEATURED_SLUGS = [
  "beaded-wrist-stack",
  "leather-weekender-bag",
  "white-lace-sundress",
  "aviator-sunglasses",
  "white-pointed-heels",
];

export const seedProducts: ProductDetail[] = seedProductList.map(toProductDetail);

export const seedProductSummaries: ProductSummary[] = seedProductList.map((product) => ({
  ...toHomeProduct(product),
  rating: product.rating,
}));

export const seedFeaturedProducts: HomeProduct[] = FEATURED_SLUGS.flatMap((slug) => {
  const product = seedProductList.find((candidate) => candidate.slug === slug);
  return product ? [toHomeProduct(product)] : [];
});

export const seedCollections: HomeCollection[] = [
  {
    slug: "autumn-styles",
    eyebrow: "New collection",
    title: "Autumn Styles Just Arrived",
    description: "Warm tones, modern silhouettes and everyday essentials.",
    image: {
      src: picsumImage(758, 1200, 600),
      alt: "Woven wrap in warm autumn colours",
    },
  },
  {
    slug: "layer-up",
    eyebrow: "Outerwear edit",
    title: "Layer Up for Cooler Days",
    description: "Cosy jackets, knit beanies and soft layers for the hills.",
    image: {
      src: picsumImage(669, 1200, 600),
      alt: "Person in a corduroy jacket and knit beanie facing the mist",
    },
  },
  {
    slug: "leather-and-knits",
    eyebrow: "Staff picks",
    title: "Leather & Knit Classics",
    description: "Timeless leather jackets paired with chunky scarves.",
    image: {
      src: picsumImage(1005, 1200, 600),
      alt: "Person in a leather jacket and knit scarf by the sea",
    },
  },
];

export const seedTestimonials: Testimonial[] = [
  {
    id: "seed-priya",
    quote:
      "The AR try-on made such a difference! I could see exactly how it looks on me before buying. Love the quality and style.",
    authorName: "Priya S.",
    authorLabel: "Verified Customer",
    avatar: { src: picsumImage(1027, 96, 96), alt: "" },
  },
  {
    id: "seed-radhika",
    quote:
      "Beautiful designs and such a smooth shopping experience. Everything arrived quickly and looked even better in person.",
    authorName: "Radhika M.",
    authorLabel: "Verified Customer",
    avatar: { src: picsumImage(64, 96, 96), alt: "" },
  },
  {
    id: "seed-ananya",
    quote:
      "Goreto.store has become my go-to for stylish and unique pieces. The AR feature is a game changer!",
    authorName: "Ananya K.",
    authorLabel: "Verified Customer",
    avatar: { src: picsumImage(996, 96, 96), alt: "" },
  },
];
