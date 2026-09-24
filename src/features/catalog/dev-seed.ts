/**
 * DEVELOPMENT SEED DATA — NOT REAL CATALOG, CUSTOMERS OR REVIEWS.
 *
 * Stand-in content for building the storefront before the Supabase catalog
 * exists. `getHomepageData()` only serves it outside production, so these
 * products and testimonials can never appear on the live store.
 *
 * Photos are hand-picked Lorem Picsum IDs; names describe what each photo
 * actually shows rather than the reference screenshot's products.
 */
import { picsumImage } from "@/lib/media/picsum";
import type {
  HomeCategory,
  HomeCollection,
  HomeProduct,
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

export const seedFeaturedProducts: HomeProduct[] = [
  {
    slug: "beaded-wrist-stack",
    title: "Beaded Wrist Stack",
    categorySlug: "jewelry",
    pricePaisa: 179900,
    image: {
      src: picsumImage(628, PRODUCT_PX, PRODUCT_PX),
      alt: "Layered beaded bracelets worn on the wrist",
    },
  },
  {
    slug: "leather-weekender-bag",
    title: "Leather Weekender Bag",
    categorySlug: "bags",
    pricePaisa: 399900,
    image: {
      src: picsumImage(7, PRODUCT_PX, PRODUCT_PX),
      alt: "Brown leather bag on a wooden café table",
    },
  },
  {
    slug: "white-lace-sundress",
    title: "White Lace Sundress",
    categorySlug: "dresses",
    pricePaisa: 289900,
    image: {
      src: picsumImage(325, PRODUCT_PX, PRODUCT_PX),
      alt: "White lace sundress worn outdoors",
    },
  },
  {
    slug: "aviator-sunglasses",
    title: "Aviator Sunglasses",
    categorySlug: "sunglasses",
    pricePaisa: 249900,
    image: {
      src: picsumImage(64, PRODUCT_PX, PRODUCT_PX),
      alt: "Woman wearing mirrored aviator sunglasses",
    },
  },
  {
    slug: "white-pointed-heels",
    title: "White Pointed Heels",
    categorySlug: "shoes",
    pricePaisa: 349900,
    image: {
      src: picsumImage(21, PRODUCT_PX, PRODUCT_PX),
      alt: "Pair of white pointed-toe heels",
    },
  },
];

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
