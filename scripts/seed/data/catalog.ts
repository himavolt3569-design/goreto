import type { ArMode, ArPlacement } from "../types.ts";

/**
 * Hand-written seed catalog. Every product has its own title, short
 * description and description line; families add the shared specs, care text
 * and closing sentence for their kind of product. Prices are whole rupees here
 * and become paisa in the builder.
 */

/* ---------- Colours and finishes ---------- */

export type Swatch = { label: string; hex: string | null; code: string };

export const swatches: Record<string, Swatch> = {
  black: { label: "Black", hex: "#1F2937", code: "BLK" },
  white: { label: "White", hex: "#F8FAFC", code: "WHT" },
  ivory: { label: "Ivory", hex: "#F5F0E6", code: "IVR" },
  cream: { label: "Cream", hex: "#F3E9D2", code: "CRM" },
  beige: { label: "Beige", hex: "#D6C3A5", code: "BEI" },
  natural: { label: "Natural", hex: "#D9C7A7", code: "NAT" },
  camel: { label: "Camel", hex: "#B98A5A", code: "CML" },
  tan: { label: "Tan", hex: "#B07A4F", code: "TAN" },
  brown: { label: "Brown", hex: "#6B4226", code: "BRN" },
  tortoise: { label: "Tortoise", hex: "#7C4A2D", code: "TRT" },
  maroon: { label: "Maroon", hex: "#7F1D1D", code: "MRN" },
  burgundy: { label: "Burgundy", hex: "#6D1B2B", code: "BRG" },
  red: { label: "Red", hex: "#B91C1C", code: "RED" },
  rust: { label: "Rust", hex: "#B45309", code: "RST" },
  orange: { label: "Orange", hex: "#F97316", code: "ORG" },
  peach: { label: "Peach", hex: "#FDBA74", code: "PCH" },
  mustard: { label: "Mustard", hex: "#CA8A04", code: "MST" },
  olive: { label: "Olive", hex: "#4D5B2A", code: "OLV" },
  sage: { label: "Sage", hex: "#9CAF88", code: "SGE" },
  green: { label: "Green", hex: "#166534", code: "GRN" },
  emerald: { label: "Emerald", hex: "#047857", code: "EMR" },
  mint: { label: "Mint", hex: "#A7F3D0", code: "MNT" },
  sky: { label: "Sky Blue", hex: "#7DD3FC", code: "SKY" },
  blue: { label: "Blue", hex: "#2563EB", code: "BLU" },
  "royal-blue": { label: "Royal Blue", hex: "#1D4ED8", code: "RYB" },
  navy: { label: "Navy", hex: "#1E3A8A", code: "NVY" },
  indigo: { label: "Indigo", hex: "#312E81", code: "IND" },
  lavender: { label: "Lavender", hex: "#A78BFA", code: "LAV" },
  pink: { label: "Pink", hex: "#F472B6", code: "PNK" },
  blush: { label: "Blush", hex: "#F9C9C2", code: "BLS" },
  champagne: { label: "Champagne", hex: "#E8D5B0", code: "CHM" },
  grey: { label: "Grey", hex: "#9CA3AF", code: "GRY" },
  charcoal: { label: "Charcoal", hex: "#374151", code: "CHR" },
  gold: { label: "Gold", hex: "#C9A24A", code: "GLD" },
  silver: { label: "Silver", hex: "#C0C4CC", code: "SLV" },
  "rose-gold": { label: "Rose Gold", hex: "#D4A08A", code: "RSG" },
  oxidised: { label: "Oxidised Silver", hex: "#5B5B5B", code: "OXS" },
  multi: { label: "Multicolour", hex: null, code: "MLT" },
  "classic-red": { label: "Classic Red", hex: null, code: "CRD" },
  "black-gold": { label: "Black & Gold", hex: null, code: "BKG" },
  palpali: { label: "Palpali Multi", hex: null, code: "PLP" },
};

/* ---------- Size sets ---------- */

export type SizeSet = { name: string; values: readonly (readonly [value: string, label: string])[] };

function sizes(name: string, labels: string[]): SizeSet {
  return { name, values: labels.map((label) => [label.toLowerCase(), label] as const) };
}

export const APPAREL = sizes("Size", ["XS", "S", "M", "L", "XL"]);
export const APPAREL_CORE = sizes("Size", ["S", "M", "L", "XL"]);
export const HEELS = sizes("Size", ["36", "37", "38", "39", "40"]);
export const SNEAKERS = sizes("Size", ["37", "38", "39", "40", "41", "42", "43"]);
export const BOOTS = sizes("Size", ["36", "37", "38", "39", "40", "41"]);
export const RINGS: SizeSet = {
  name: "Ring Size",
  values: [["6", "US 6"], ["7", "US 7"], ["8", "US 8"], ["9", "US 9"]],
};
export const BANGLES: SizeSet = {
  name: "Bangle Size",
  values: [["2.4", "2.4"], ["2.6", "2.6"], ["2.8", "2.8"]],
};
export const HOOPS: SizeSet = {
  name: "Size",
  values: [["small", "Small (20 mm)"], ["medium", "Medium (30 mm)"], ["large", "Large (45 mm)"]],
};
export const TOPI = sizes("Size", ["S", "M", "L"]);

/* ---------- Categories ---------- */

export type CategorySeed = {
  slug: string;
  title: string;
  description: string;
  /** Picsum id for the category tile (development placeholder). */
  picsumId: number;
  children?: { slug: string; title: string; description: string }[];
};

/** The first ten slugs and images match the homepage rail in dev-seed.ts. */
export const categorySeeds: CategorySeed[] = [
  {
    slug: "dresses",
    title: "Dresses",
    description: "Maxi, midi and party dresses for every season and celebration.",
    picsumId: 325,
    children: [
      { slug: "maxi-dresses", title: "Maxi Dresses", description: "Floor-grazing dresses in breezy and dressy fabrics." },
      { slug: "midi-dresses", title: "Midi Dresses", description: "Knee-to-calf dresses for workdays and weekends." },
      { slug: "party-dresses", title: "Party Dresses", description: "Satin, sequin and velvet for evenings out." },
    ],
  },
  {
    slug: "jewelry",
    title: "Jewelry",
    description: "Everyday gold and silver, pote beads and festive statement pieces.",
    picsumId: 628,
    children: [
      { slug: "earrings", title: "Earrings", description: "Studs, hoops, jhumkas and drops." },
      { slug: "necklaces", title: "Necklaces", description: "Chains, pendants, pote and tilhari necklaces." },
      { slug: "bracelets-bangles", title: "Bracelets & Bangles", description: "Stacks, cuffs, kadas and glass bangles." },
      { slug: "rings", title: "Rings", description: "Stackable bands and statement rings." },
    ],
  },
  {
    slug: "bags",
    title: "Bags",
    description: "Handbags, totes, backpacks and clutches, including allo and felt made in Nepal.",
    picsumId: 7,
    children: [
      { slug: "handbags", title: "Handbags", description: "Top handles, satchels and shoulder bags." },
      { slug: "tote-bags", title: "Tote Bags", description: "Roomy totes for work, college and the bazaar." },
      { slug: "backpacks", title: "Backpacks", description: "Daypacks and everyday backpacks." },
      { slug: "clutches", title: "Clutches", description: "Evening clutches and potli bags." },
      { slug: "travel-bags", title: "Travel Bags", description: "Weekenders, duffels and carry-ons." },
    ],
  },
  {
    slug: "shoes",
    title: "Shoes",
    description: "Heels, flats, sneakers and sandals.",
    picsumId: 21,
    children: [
      { slug: "heels", title: "Heels", description: "Stilettos, block heels and mules." },
      { slug: "flats", title: "Flats", description: "Ballet flats, loafers and juttis." },
      { slug: "sneakers", title: "Sneakers", description: "Everyday sneakers, trainers and hiking shoes." },
      { slug: "sandals", title: "Sandals", description: "Slides, strappy sandals and sports sandals." },
    ],
  },
  { slug: "sunglasses", title: "Sunglasses", description: "UV400 sunglasses, from aviators to glacier glasses.", picsumId: 26 },
  {
    slug: "tops",
    title: "Tops",
    description: "Blouses, tees and knitwear.",
    picsumId: 836,
    children: [
      { slug: "blouses", title: "Blouses & Shirts", description: "Silk, satin and linen tops." },
      { slug: "t-shirts", title: "T-Shirts & Tanks", description: "Cotton basics and graphic tees." },
      { slug: "knitwear", title: "Knitwear", description: "Sweaters and cardigans, including hand-knits." },
    ],
  },
  {
    slug: "outerwear",
    title: "Outerwear",
    description: "Jackets and coats for Kathmandu winters and mountain mornings.",
    picsumId: 669,
    children: [
      { slug: "jackets", title: "Jackets", description: "Leather, denim, puffer and down jackets." },
      { slug: "coats", title: "Coats", description: "Wool, trench and teddy coats." },
    ],
  },
  { slug: "hats", title: "Hats", description: "Beanies, fedoras, caps and Dhaka topi.", picsumId: 823 },
  {
    slug: "scarves",
    title: "Scarves",
    description: "Pashmina shawls, stoles and printed scarves.",
    picsumId: 758,
    children: [
      { slug: "pashmina", title: "Pashmina", description: "Chyangra pashmina shawls, stoles and mufflers." },
      { slug: "scarves-wraps", title: "Scarves & Wraps", description: "Printed, knitted and woven scarves." },
    ],
  },
  { slug: "boots", title: "Boots", description: "Ankle, knee-high and trekking boots.", picsumId: 604 },
  {
    slug: "ethnic-wear",
    title: "Ethnic Wear",
    description: "Kurta sets, sarees and the Dhaka collection for festivals and weddings.",
    picsumId: 1027,
    children: [
      { slug: "kurta-sets", title: "Kurta Sets", description: "Kurta suruwal and kurta sets with dupatta." },
      { slug: "sarees", title: "Sarees", description: "Silk, georgette, chiffon and handloom sarees." },
      { slug: "dhaka-collection", title: "Dhaka Collection", description: "Hand-woven Dhaka blouses, shawls and waistcoats." },
    ],
  },
  { slug: "watches", title: "Watches", description: "Leather, mesh and steel watches.", picsumId: 996 },
];

/* ---------- Families and items ---------- */

export type Flag = "featured" | "bestseller" | "limited";

export type ReviewKind =
  | "jewelry"
  | "eyewear"
  | "headwear"
  | "scarf"
  | "clothing"
  | "footwear"
  | "bag"
  | "watch";

export type Item = {
  title: string;
  /** Whole rupees. */
  price: number;
  colors?: string[];
  /** `null` removes the family's default sizes (e.g. an adjustable ring). */
  sizes?: SizeSet | null;
  material: string;
  short: string;
  detail: string;
  flags?: Flag[];
  specs?: [string, string][];
  tags?: string[];
  /** Whole rupees; marks the product as on sale. */
  compareAt?: number;
};

export type Family = {
  key: string;
  category: string;
  kind: ReviewKind;
  optionName: "Color" | "Finish";
  sizes?: SizeSet;
  /** Package weight range in grams, used by delivery rating. */
  weight: readonly [number, number];
  lowStock: number;
  care: string;
  closing: string;
  /** Vetted Picsum ids used as development placeholders. */
  photos: number[];
  ar?: { placement: ArPlacement; share: number; modes: ArMode[]; anchor: string };
  specs: [string, string][];
  tags: string[];
  items: Item[];
};

export const families: Family[] = [
  {
    key: "earrings",
    category: "earrings",
    kind: "jewelry",
    optionName: "Finish",
    weight: [40, 80],
    lowStock: 5,
    care: "Keep away from water, perfume and lotions. Wipe with a soft dry cloth and store in the pouch provided.",
    closing: "Hypoallergenic, nickel-free fittings. Packed in a Goreto gift pouch.",
    photos: [628, 996],
    ar: { placement: "ear", share: 0.5, modes: ["live_2d"], anchor: "ear_lobe" },
    specs: [["Closure", "Hook"], ["What's in the box", "1 pair, gift pouch"]],
    tags: ["earrings", "jewelry"],
    items: [
      { title: "Pearl Drop Earrings", price: 2499, colors: ["gold", "silver"], material: "Gold-plated brass, shell pearl", short: "Luminous pearl drops on a slim hook that go from office to wedding.", detail: "A single round shell pearl hangs from a polished bar, catching the light with every turn of the head.", flags: ["featured", "bestseller"], tags: ["pearl", "festive"] },
      { title: "Classic Gold Hoops", price: 1499, colors: ["gold", "silver"], sizes: HOOPS, material: "18k gold-plated stainless steel", short: "The hoop you will reach for every day, in three sizes.", detail: "Lightweight hollow tubing keeps even the large size comfortable from morning to night.", specs: [["Closure", "Hinged snap"]], tags: ["hoops", "everyday"] },
      { title: "Oxidised Silver Jhumkas", price: 1899, material: "Oxidised German silver", short: "Temple-style bell jhumkas with tiny ghungroo beads.", detail: "Carved domes and a fringe of ghungroo beads give these jhumkas a soft chime as you move.", tags: ["jhumka", "ethnic", "festive"] },
      { title: "Kundan Chandbali Earrings", price: 3299, material: "Gold-plated alloy, kundan stones, faux pearls", short: "Crescent chandbalis set with kundan stones for weddings and Teej.", detail: "Hand-set kundan stones sit inside a crescent frame finished with a row of seed pearls.", flags: ["limited"], tags: ["kundan", "wedding", "teej", "festive"] },
      { title: "Minimal Stud Set", price: 999, colors: ["gold", "silver"], material: "Gold-plated sterling silver", short: "Three pairs of tiny studs: a ball, a star and a crystal.", detail: "A starter set for multiple piercings or quiet everyday wear.", specs: [["Closure", "Push back"], ["What's in the box", "3 pairs, gift pouch"]], tags: ["studs", "everyday", "gift"] },
      { title: "Tassel Drop Earrings", price: 1299, colors: ["maroon", "emerald", "navy"], material: "Silk thread, gold-plated brass", short: "Swingy silk tassels with a gold cap.", detail: "Hand-wrapped silk tassels in rich jewel tones, light enough to wear all evening.", tags: ["tassel", "festive"] },
      { title: "Crystal Huggie Hoops", price: 1699, colors: ["gold", "silver", "rose-gold"], material: "Plated brass, cubic zirconia", short: "Small hoops that hug the lobe, lined with crystals.", detail: "A continuous row of pavé crystals on a snug 12 mm hoop.", specs: [["Closure", "Hinged snap"]], tags: ["huggies", "everyday"] },
      { title: "Leaf Threader Earrings", price: 1399, colors: ["gold", "silver"], material: "Plated sterling silver", short: "Fine threader chains ending in a tiny leaf.", detail: "Thread the chain through the piercing and let the leaf fall at the length you like.", specs: [["Closure", "Threader"]], tags: ["minimal"] },
      { title: "Turquoise Stone Drops", price: 2199, colors: ["silver"], material: "Sterling silver, turquoise-coloured howlite", short: "Himalayan-inspired drops with a turquoise-blue stone.", detail: "A cabochon stone in a rope-edged bezel, inspired by jewellery sold along the Thamel lanes.", tags: ["turquoise", "boho"] },
      { title: "Beaded Fringe Earrings", price: 1199, material: "Glass seed beads, nylon thread", short: "Hand-beaded fringe in a sunset gradient.", detail: "Each pair is beaded by hand, so the colour gradient varies slightly from pair to pair.", tags: ["handmade", "boho"] },
      { title: "Golden Dhungri Studs", price: 2799, material: "Gold-plated brass", short: "The round dhungri stud, a classic of Nepali jewellery.", detail: "A domed disc with fine filigree, traditionally worn with a sari or chaubandi cholo.", tags: ["dhungri", "ethnic", "made-in-nepal"] },
      { title: "Geometric Hoop Earrings", price: 1599, colors: ["gold", "black"], material: "Plated stainless steel", short: "Hexagonal hoops with a modern edge.", detail: "Clean angles and a brushed finish that pairs well with tailored looks.", tags: ["hoops", "modern"] },
    ],
  },
  {
    key: "necklaces",
    category: "necklaces",
    kind: "jewelry",
    optionName: "Finish",
    weight: [60, 180],
    lowStock: 4,
    care: "Store flat or hanging to prevent tangles. Keep away from water and perfume.",
    closing: "Adjustable length with a 5 cm extender. Packed in a Goreto gift box.",
    photos: [628, 996],
    ar: { placement: "neck", share: 0.4, modes: ["live_2d"], anchor: "collarbone_center" },
    specs: [["Closure", "Lobster clasp"], ["Length", "40 cm + 5 cm extender"]],
    tags: ["necklaces", "jewelry"],
    items: [
      { title: "Red Pote Tilhari Necklace", price: 3499, colors: ["red"], material: "Glass pote beads, gold-plated tilhari", short: "Strands of red pote beads gathered in a gold-plated tilhari.", detail: "The necklace many married women in Nepal wear every day, made with fine glass beads that shimmer in sunlight.", flags: ["featured", "bestseller"], specs: [["Length", "60 cm"]], tags: ["pote", "tilhari", "teej", "made-in-nepal", "festive"] },
      { title: "Green Pote Bead Necklace", price: 1999, colors: ["green"], material: "Glass pote beads, brass caps", short: "Multi-strand green pote with gold-tone caps.", detail: "Green pote is worn for Teej and weddings; this lighter version also works over a plain kurta.", specs: [["Length", "55 cm"]], tags: ["pote", "teej", "made-in-nepal"] },
      { title: "Layered Gold Chain Necklace", price: 2299, colors: ["gold", "silver"], material: "18k gold-plated stainless steel", short: "Three fine chains pre-layered on one clasp.", detail: "A satellite chain, a paperclip chain and a snake chain, spaced so they never tangle.", tags: ["layered", "everyday"] },
      { title: "Pearl Choker", price: 2699, material: "Shell pearls, gold-plated clasp", short: "A single row of round pearls that sits at the collarbone.", detail: "Uniform 6 mm pearls, knotted between each bead for strength and drape.", specs: [["Length", "35 cm + 5 cm extender"]], tags: ["pearl", "wedding"] },
      { title: "Coin Pendant Necklace", price: 1799, colors: ["gold"], material: "Gold-plated brass", short: "A hammered coin pendant on a fine rope chain.", detail: "The textured coin catches light from every angle and layers well with shorter chains.", tags: ["pendant", "everyday"] },
      { title: "Kundan Bridal Necklace Set", price: 7999, colors: ["gold"], material: "Gold-plated alloy, kundan stones, faux pearls", short: "A full kundan necklace with matching earrings for the wedding day.", detail: "A bib of hand-set kundan stones edged with pearl drops, with a matching pair of chandbali earrings.", flags: ["limited"], specs: [["What's in the box", "Necklace, earrings, gift box"], ["Closure", "Adjustable dori"]], tags: ["kundan", "bridal", "wedding"] },
      { title: "Evil Eye Pendant Necklace", price: 1299, colors: ["gold", "silver"], material: "Plated sterling silver, enamel", short: "A tiny blue evil-eye charm for everyday protection.", detail: "Enamel on sterling silver, hung on a fine cable chain.", tags: ["pendant", "gift"] },
      { title: "Oxidised Silver Statement Necklace", price: 2499, colors: ["oxidised"], material: "Oxidised German silver", short: "A bold carved collar for cotton kurtas and sarees.", detail: "Engraved discs and a fringe of drops, finished with a cotton dori tie.", specs: [["Closure", "Adjustable dori"]], tags: ["oxidised", "ethnic"] },
      { title: "Rudraksha Bead Mala", price: 1599, colors: ["brown"], material: "Rudraksha beads, silk thread", short: "A 108-bead rudraksha mala with a silk tassel.", detail: "Five-faced rudraksha beads, hand-knotted, for everyday wear or meditation.", specs: [["Length", "108 beads"], ["Closure", "None, slip-on"]], tags: ["rudraksha", "spiritual"] },
      { title: "Turquoise & Coral Tibetan Necklace", price: 3999, colors: ["multi"], material: "Turquoise-coloured howlite, coral-coloured resin, brass", short: "A Himalayan-style strand of turquoise and coral beads.", detail: "Chunky beads separated by brass spacers, inspired by jewellery from the northern hills.", tags: ["turquoise", "boho"] },
      { title: "Heart Locket Necklace", price: 1899, colors: ["gold", "rose-gold"], material: "Plated brass", short: "A heart locket that holds two small photos.", detail: "Opens to two photo windows; a thoughtful gift for Valentine's Day or an anniversary.", tags: ["locket", "gift"] },
    ],
  },
  {
    key: "bracelets",
    category: "bracelets-bangles",
    kind: "jewelry",
    optionName: "Finish",
    weight: [50, 250],
    lowStock: 5,
    care: "Remove before washing hands or bathing. Wipe with a soft cloth after wearing.",
    closing: "Packed in a Goreto gift pouch.",
    photos: [628, 996],
    ar: { placement: "wrist", share: 0.3, modes: ["live_2d"], anchor: "wrist_center" },
    specs: [["Fit", "Fits most wrists (15–18 cm)"]],
    tags: ["bracelets", "jewelry"],
    items: [
      { title: "Minimal Gold Bracelet", price: 1799, colors: ["gold"], material: "18k gold-plated stainless steel", short: "A fine chain bracelet with a single bar charm.", detail: "Tarnish-resistant and waterproof enough for daily wear, with a sliding clasp to adjust the fit.", specs: [["Closure", "Sliding bead"]], tags: ["minimal", "everyday"] },
      { title: "Glass Bangle Set", price: 899, colors: ["red", "green", "royal-blue", "multi"], sizes: BANGLES, material: "Glass", short: "A set of 24 shimmering glass bangles.", detail: "Worn in sets for Teej, weddings and festivals; the glitter finish sparkles under lights.", flags: ["bestseller"], specs: [["Pieces", "24 bangles"], ["Fit", "Choose your bangle size"]], tags: ["bangles", "teej", "festive"] },
      { title: "Gold-plated Kada Pair", price: 2499, colors: ["gold"], sizes: BANGLES, material: "Gold-plated brass", short: "A pair of carved kadas for festive dressing.", detail: "Hand-carved floral bands with a screw-open hinge for easy wear.", specs: [["Pieces", "2 kadas"], ["Closure", "Screw hinge"]], tags: ["kada", "festive", "wedding"] },
      { title: "Tennis Bracelet", price: 2999, colors: ["silver", "gold"], material: "Rhodium-plated brass, cubic zirconia", short: "A continuous line of sparkling stones.", detail: "Each stone is claw-set, with a safety catch on the box clasp.", specs: [["Closure", "Box clasp with safety catch"]], tags: ["evening", "gift"] },
      { title: "Charm Bracelet", price: 1999, colors: ["silver"], material: "Sterling silver", short: "A link bracelet with five removable charms.", detail: "Comes with a heart, a star, a mountain, a lotus and a key charm.", tags: ["charms", "gift"] },
      { title: "Braided Leather Cuff", price: 1299, colors: ["brown", "black"], material: "Braided leather, steel clasp", short: "A thick braided cuff with a magnetic clasp.", detail: "Soft leather that darkens and softens with wear.", specs: [["Closure", "Magnetic"]], tags: ["leather", "unisex"] },
      { title: "Evil Eye Beaded Bracelet", price: 699, colors: ["blue"], material: "Glass beads, stretch cord", short: "A stretch bracelet with glass evil-eye beads.", detail: "Slips on without a clasp; stack two or three.", specs: [["Closure", "Stretch cord"]], tags: ["beaded", "gift"] },
      { title: "Pearl Stretch Bracelet", price: 1199, colors: ["ivory"], material: "Shell pearls, stretch cord", short: "Soft pearls on an easy stretch cord.", detail: "Pairs with the Pearl Choker and Pearl Drop Earrings.", specs: [["Closure", "Stretch cord"]], tags: ["pearl"] },
      { title: "Oxidised Silver Cuff", price: 1699, colors: ["oxidised"], material: "Oxidised German silver", short: "An open cuff engraved with a paisley pattern.", detail: "The open back flexes gently to fit most wrists.", specs: [["Closure", "Open cuff"]], tags: ["oxidised", "ethnic"] },
    ],
  },
  {
    key: "rings",
    category: "rings",
    kind: "jewelry",
    optionName: "Finish",
    sizes: RINGS,
    weight: [30, 60],
    lowStock: 3,
    care: "Take off before washing hands or using sanitiser. Store separately to avoid scratches.",
    closing: "Unworn rings can be exchanged for another size within 7 days of delivery.",
    photos: [628, 996],
    ar: { placement: "hand", share: 0.3, modes: ["live_2d"], anchor: "ring_finger_base" },
    specs: [["What's in the box", "Ring, gift pouch"]],
    tags: ["rings", "jewelry"],
    items: [
      { title: "Stackable Band Set", price: 1299, colors: ["gold", "silver"], material: "Plated sterling silver", short: "Three thin bands: plain, twisted and beaded.", detail: "Wear them together or split them across fingers.", specs: [["Pieces", "3 rings"]], tags: ["stackable", "everyday"] },
      { title: "Solitaire Crystal Ring", price: 1999, colors: ["silver", "rose-gold"], material: "Plated sterling silver, cubic zirconia", short: "A classic single-stone ring on a fine band.", detail: "A 6 mm round crystal in a four-claw setting.", tags: ["solitaire", "gift"] },
      { title: "Turquoise Cocktail Ring", price: 2299, colors: ["silver"], material: "Sterling silver, turquoise-coloured howlite", short: "An oval turquoise-blue stone on a wide band.", detail: "A statement ring with a rope-twist bezel.", tags: ["turquoise", "boho"] },
      { title: "Signet Ring", price: 1799, colors: ["gold"], material: "18k gold-plated stainless steel", short: "A polished oval signet for everyday wear.", detail: "Chunky but light, with a smooth face.", tags: ["signet", "unisex"] },
      { title: "Adjustable Leaf Ring", price: 899, colors: ["gold", "silver"], sizes: null, material: "Plated brass", short: "An open leaf wrap that adjusts to fit.", detail: "Gently squeeze or open the band to size it.", specs: [["Fit", "Adjustable, one size"]], tags: ["adjustable", "minimal"] },
      { title: "Pearl Statement Ring", price: 1599, colors: ["gold"], material: "Gold-plated brass, shell pearl", short: "A large baroque-style pearl on an open band.", detail: "An easy way to add one dramatic piece to a simple outfit.", tags: ["pearl"] },
      { title: "Oxidised Mandala Ring", price: 1199, colors: ["oxidised"], sizes: null, material: "Oxidised German silver", short: "A carved mandala ring with an adjustable band.", detail: "Inspired by the mandalas painted on Kathmandu's thangkas.", specs: [["Fit", "Adjustable, one size"]], tags: ["oxidised", "ethnic", "adjustable"] },
    ],
  },
  {
    key: "watches",
    category: "watches",
    kind: "watch",
    optionName: "Color",
    weight: [180, 320],
    lowStock: 3,
    care: "Splash-resistant only: remove before swimming or bathing. Replace the battery at an authorised shop.",
    closing: "Japanese quartz movement with a one-year warranty on the movement.",
    photos: [996, 628],
    ar: { placement: "wrist", share: 0.5, modes: ["live_2d", "live_3d"], anchor: "wrist_center" },
    specs: [["Movement", "Japanese quartz"], ["Water resistance", "3 ATM (splash-resistant)"], ["What's in the box", "Watch, box, warranty card"]],
    tags: ["watches"],
    items: [
      { title: "Classic Leather Strap Watch", price: 4999, colors: ["brown", "black"], material: "Stainless steel case, leather strap", short: "A clean white dial on a genuine leather strap.", detail: "A 36 mm case that suits every wrist, with slim baton hands.", specs: [["Case size", "36 mm"]], flags: ["bestseller"], tags: ["leather", "unisex"] },
      { title: "Minimal Mesh Watch", price: 5499, colors: ["silver", "rose-gold", "gold"], material: "Stainless steel, mesh strap", short: "An ultra-thin dial on an adjustable mesh strap.", detail: "The sliding clasp adjusts the mesh to any wrist without tools.", specs: [["Case size", "32 mm"]], tags: ["minimal"] },
      { title: "Chronograph Steel Watch", price: 8999, colors: ["silver", "black"], material: "Stainless steel", short: "A three-dial chronograph with a date window.", detail: "A working stopwatch, a tachymeter bezel and a solid link bracelet.", specs: [["Case size", "42 mm"], ["Water resistance", "5 ATM"]], tags: ["chronograph", "men"] },
      { title: "Petite Gold Bracelet Watch", price: 5999, colors: ["gold"], material: "Gold-plated stainless steel", short: "A tiny dial on a bracelet you can dress up.", detail: "Doubles as a bracelet with its slim link band.", specs: [["Case size", "26 mm"]], tags: ["dress", "gift"] },
      { title: "Everyday Canvas Strap Watch", price: 3499, colors: ["olive", "navy", "beige"], material: "Steel case, canvas strap", short: "A field watch with a washable canvas strap.", detail: "Easy-to-read numerals and luminous hands for early mornings.", specs: [["Case size", "38 mm"]], tags: ["casual", "unisex"] },
      { title: "Square Dial Watch", price: 4499, colors: ["black", "tan"], material: "Steel case, leather strap", short: "A vintage-inspired square case.", detail: "A rectangular dial with Roman numerals on a soft leather strap.", specs: [["Case size", "28 × 34 mm"]], tags: ["vintage"] },
      { title: "Digital Sports Watch", price: 2999, colors: ["black", "olive"], material: "Resin case and strap", short: "Alarm, stopwatch and backlight in a tough resin case.", detail: "Built for treks and runs, with 10 ATM water resistance.", specs: [["Movement", "Digital quartz"], ["Water resistance", "10 ATM"]], tags: ["sports", "trek"] },
    ],
  },
  {
    key: "sunglasses",
    category: "sunglasses",
    kind: "eyewear",
    optionName: "Color",
    weight: [120, 200],
    lowStock: 5,
    care: "Clean with the included microfibre cloth. Store in the case, lenses up.",
    closing: "UV400 lenses block 100% of UVA and UVB. Includes a hard case and cleaning cloth.",
    photos: [64, 26],
    ar: { placement: "face", share: 0.8, modes: ["live_2d", "live_3d"], anchor: "nose_bridge" },
    specs: [["Lenses", "UV400"], ["What's in the box", "Sunglasses, case, cleaning cloth"]],
    tags: ["sunglasses", "eyewear"],
    items: [
      { title: "Cat-Eye Sunglasses", price: 2199, colors: ["black", "tortoise"], material: "Acetate frame", short: "A lifted cat-eye with a retro edge.", detail: "Softly pointed corners flatter most face shapes.", specs: [["Lens width", "52 mm"]], flags: ["bestseller"], tags: ["cat-eye", "retro"] },
      { title: "Round Retro Sunglasses", price: 1999, colors: ["gold", "black"], material: "Metal frame", short: "Round lenses on a thin wire frame.", detail: "A light metal frame with adjustable nose pads.", specs: [["Lens width", "49 mm"]], tags: ["round", "retro"] },
      { title: "Oversized Square Sunglasses", price: 2499, colors: ["black", "brown"], material: "Acetate frame", short: "Big, bold square lenses with gradient tint.", detail: "Maximum coverage for bright days and Pokhara boat rides.", specs: [["Lens width", "58 mm"]], tags: ["oversized"] },
      { title: "Polarised Wayfarers", price: 2799, colors: ["black", "tortoise", "navy"], material: "Acetate frame, polarised lenses", short: "The classic wayfarer with polarised lenses.", detail: "Polarised lenses cut glare from roads, water and snow.", specs: [["Lens width", "54 mm"], ["Lenses", "Polarised, UV400"]], tags: ["polarised", "unisex"] },
      { title: "Rimless Gradient Sunglasses", price: 2299, colors: ["brown", "grey"], material: "Metal temples, rimless lenses", short: "Frameless lenses with a soft gradient.", detail: "Weighs just 18 g, so you forget you're wearing them.", specs: [["Lens width", "56 mm"]], tags: ["rimless"] },
      { title: "Sport Wrap Sunglasses", price: 2999, colors: ["black"], material: "TR90 frame, polycarbonate lenses", short: "A wraparound frame that stays put on rides.", detail: "Rubber nose pads and temple tips grip even when you sweat.", specs: [["Lens width", "One-piece shield"]], tags: ["sports", "unisex"] },
      { title: "Clubmaster Browline Sunglasses", price: 2599, colors: ["black", "tortoise"], material: "Acetate brow, metal rim", short: "A browline frame with a sharp, vintage look.", detail: "The acetate brow sits above a thin metal lower rim.", specs: [["Lens width", "51 mm"]], tags: ["browline", "vintage"] },
      { title: "Hexagon Metal Sunglasses", price: 2099, colors: ["gold", "silver"], material: "Metal frame", short: "Six-sided lenses on a fine metal frame.", detail: "A geometric update to the classic round frame.", specs: [["Lens width", "51 mm"]], tags: ["geometric"] },
      { title: "Mountain Glacier Sunglasses", price: 3499, colors: ["black"], material: "TR90 frame, category 4 lenses, leather side shields", short: "Dark glacier lenses with side shields for high altitude.", detail: "Category 4 lenses and removable side shields protect your eyes from snow glare on treks.", specs: [["Lenses", "Category 4, UV400"], ["Lens width", "55 mm"]], flags: ["limited"], tags: ["trek", "glacier"] },
    ],
  },
  {
    key: "hats",
    category: "hats",
    kind: "headwear",
    optionName: "Color",
    weight: [120, 260],
    lowStock: 5,
    care: "Spot clean only unless the label says otherwise. Store without crushing the crown.",
    closing: "Packed flat-free in a box so it arrives in shape.",
    photos: [823, 669, 836],
    specs: [],
    tags: ["hats"],
    items: [
      { title: "Dhaka Topi", price: 899, colors: ["classic-red", "black-gold", "palpali"], sizes: TOPI, material: "Hand-woven Dhaka cotton", short: "The Nepali topi in hand-woven Dhaka fabric.", detail: "Woven on traditional looms, each topi's pattern placement is slightly different. Worn for Dashain, Tihar, weddings and official occasions.", flags: ["featured"], specs: [["Fit", "S 21\", M 22\", L 23\""]], tags: ["dhaka", "topi", "made-in-nepal", "festive", "men"] },
      { title: "Straw Sun Hat", price: 1499, colors: ["natural"], material: "Paper straw", short: "A wide-brim sun hat for summer and beach trips.", detail: "A 10 cm brim shades your face and shoulders; the inner band keeps it steady.", specs: [["Brim", "10 cm"]], tags: ["summer", "straw"] },
      { title: "Classic Baseball Cap", price: 799, colors: ["black", "navy", "beige", "olive"], material: "Cotton twill", short: "A six-panel cap with an adjustable strap.", detail: "Washed cotton twill with a curved brim.", specs: [["Fit", "Adjustable strap"]], tags: ["cap", "unisex"] },
      { title: "Bucket Hat", price: 999, colors: ["black", "beige", "sage"], material: "Cotton canvas", short: "A soft cotton bucket hat that packs flat.", detail: "Roll it into a bag for rain or shine.", tags: ["bucket", "unisex"] },
      { title: "Wool Beret", price: 1199, colors: ["black", "burgundy", "camel"], material: "100% wool", short: "A soft wool beret for cool days.", detail: "Wear it slouched to one side over loose hair.", tags: ["beret", "winter"] },
      { title: "Hand-knit Woolen Earflap Hat", price: 1299, colors: ["grey", "multi"], material: "Sheep wool, fleece lining", short: "A hand-knit earflap hat with braided ties.", detail: "Knitted by hand in the Kathmandu valley with a warm fleece lining for trekking and winter mornings.", tags: ["hand-knit", "winter", "made-in-nepal", "trek"] },
      { title: "Pashmina Blend Beanie", price: 1699, colors: ["grey", "beige", "black"], material: "Pashmina and wool blend", short: "A fine-knit beanie with pashmina softness.", detail: "Thin enough to wear under a hood, warm enough for Kathmandu winter.", tags: ["pashmina", "winter", "beanie"] },
    ],
  },
  {
    key: "pashmina",
    category: "pashmina",
    kind: "scarf",
    optionName: "Color",
    weight: [180, 420],
    lowStock: 3,
    care: "Dry clean, or hand wash cold with a mild wool shampoo. Dry flat in the shade. Store folded with a cedar block.",
    closing: "Each piece is woven in Nepal and may show small irregularities that mark it as handmade.",
    photos: [758, 1005],
    specs: [["Origin", "Hand-woven in Nepal"]],
    tags: ["pashmina", "scarves", "made-in-nepal", "winter"],
    items: [
      { title: "Pure Pashmina Shawl", price: 8999, colors: ["ivory", "grey", "maroon", "black"], material: "100% chyangra pashmina", short: "A feather-light shawl woven from Himalayan chyangra pashmina.", detail: "Chyangra goats graze high in the Himalaya; their fine undercoat is hand-spun and woven into this full-size shawl.", flags: ["limited", "featured"], specs: [["Size", "200 × 100 cm"]], tags: ["shawl", "gift", "wedding"] },
      { title: "Pashmina Silk Blend Stole", price: 4499, colors: ["beige", "blush", "navy", "emerald"], material: "70% pashmina, 30% silk", short: "A pashmina and silk stole with a soft sheen.", detail: "The silk adds a gentle lustre and makes the stole light enough for autumn evenings.", specs: [["Size", "180 × 70 cm"]], flags: ["bestseller"], tags: ["stole"] },
      { title: "Embroidered Pashmina Shawl", price: 11999, colors: ["black", "maroon"], material: "Pashmina with silk-thread embroidery", short: "A pashmina shawl with hand embroidery along the borders.", detail: "Paisley vines are embroidered by hand along both borders, taking several days per shawl.", flags: ["limited"], specs: [["Size", "200 × 100 cm"]], tags: ["embroidered", "wedding"] },
      { title: "Reversible Pashmina Wrap", price: 6499, colors: ["charcoal", "camel"], material: "100% pashmina", short: "Two tones, one wrap: wear it either side out.", detail: "A double-faced weave gives a different colour on each side.", specs: [["Size", "190 × 70 cm"]], tags: ["reversible"] },
      { title: "Pashmina Muffler", price: 2999, colors: ["grey", "brown", "navy", "maroon"], material: "100% pashmina", short: "A narrow muffler for coat collars.", detail: "Short and warm, with a fine fringe at both ends.", specs: [["Size", "160 × 30 cm"]], tags: ["muffler", "men", "gift"] },
      { title: "Kani Weave Pashmina Stole", price: 5999, colors: ["multi"], material: "Pashmina", short: "A stole with an intricate woven paisley pattern.", detail: "The pattern is woven in, not printed, so it shows on both sides.", specs: [["Size", "180 × 70 cm"]], tags: ["stole", "festive"] },
    ],
  },
  {
    key: "scarves",
    category: "scarves-wraps",
    kind: "scarf",
    optionName: "Color",
    weight: [120, 350],
    lowStock: 5,
    care: "Hand wash cold and dry flat. Steam to remove creases.",
    closing: "Generous sizing so you can wrap, drape or knot it.",
    photos: [758, 1005],
    specs: [],
    tags: ["scarves"],
    items: [
      { title: "Printed Silk Square Scarf", price: 1499, colors: ["rust", "navy", "emerald"], material: "Silk twill", short: "A 70 cm silk square with a vintage print.", detail: "Tie it at the neck, on a bag handle or in your hair.", specs: [["Size", "70 × 70 cm"]], tags: ["silk"] },
      { title: "Chunky Knit Infinity Scarf", price: 1299, colors: ["grey", "mustard", "cream"], material: "Acrylic-wool blend", short: "A chunky loop scarf that stays in place.", detail: "No ends to tie: just loop it twice around the neck.", tags: ["knit", "winter"] },
      { title: "Lightweight Cotton Stole", price: 899, colors: ["white", "peach", "sky", "mint"], material: "100% cotton voile", short: "An airy cotton stole for summer and travel.", detail: "Sheer, breathable and quick to dry.", specs: [["Size", "180 × 70 cm"]], tags: ["summer", "cotton"] },
      { title: "Tie-dye Chiffon Dupatta", price: 1199, colors: ["pink", "blue", "orange"], material: "Chiffon", short: "A hand-dyed chiffon dupatta with lace edging.", detail: "Each dupatta is tied and dyed by hand, so the pattern is unique.", specs: [["Size", "225 × 100 cm"]], tags: ["dupatta", "ethnic"] },
      { title: "Plaid Wool Blend Scarf", price: 1799, colors: ["red", "grey", "green"], material: "Wool-acrylic blend", short: "A classic plaid scarf with fringed ends.", detail: "Brushed for softness, in a check that works with any coat.", tags: ["plaid", "winter", "unisex"] },
      { title: "Allo Nettle Wrap", price: 3299, colors: ["natural"], material: "Allo (Himalayan giant nettle) fibre", short: "A wrap woven from allo, Himalayan nettle fibre.", detail: "Allo is harvested and spun by hand in the hills of eastern Nepal; it softens with every wash.", specs: [["Size", "180 × 60 cm"], ["Origin", "Hand-woven in Nepal"]], tags: ["allo", "made-in-nepal", "sustainable"] },
    ],
  },
  {
    key: "maxi-dresses",
    category: "maxi-dresses",
    kind: "clothing",
    optionName: "Color",
    sizes: APPAREL,
    weight: [300, 550],
    lowStock: 3,
    care: "Hand wash cold or machine wash on a gentle cycle. Dry in the shade and iron on low.",
    closing: "Model is 5'5\" and wears size S.",
    photos: [325, 1027],
    specs: [["Length", "Ankle length"]],
    tags: ["dresses", "maxi"],
    items: [
      { title: "Floral Wrap Maxi Dress", price: 3499, colors: ["peach", "navy"], material: "Viscose crepe", short: "A true wrap dress in a soft floral print.", detail: "Ties at the waist and flutters at the hem; works for a garden party or a day out in Lakeside.", flags: ["bestseller"], tags: ["floral", "wrap"] },
      { title: "Tiered Cotton Maxi Dress", price: 2999, colors: ["white", "mustard"], material: "100% cotton", short: "A breezy tiered maxi in crisp cotton.", detail: "Three tiers of gathered cotton with side pockets and adjustable straps.", tags: ["cotton", "summer"] },
      { title: "Satin Slip Maxi Dress", price: 3999, colors: ["emerald", "champagne", "black"], material: "Satin (polyester)", short: "A bias-cut satin slip that skims the body.", detail: "Wear it alone for evenings or layer a knit over it by day.", tags: ["satin", "evening"] },
      { title: "Boho Printed Maxi Dress", price: 3299, colors: ["rust", "blue"], material: "Rayon", short: "A flowing boho print with a smocked waist.", detail: "Balloon sleeves and a keyhole neckline tied with tassels.", tags: ["boho", "printed"] },
      { title: "Pleated Chiffon Maxi Dress", price: 4299, colors: ["blush", "lavender"], material: "Chiffon, satin lining", short: "Sunray pleats that move beautifully.", detail: "A fully lined chiffon dress for weddings, receptions and Tihar gatherings.", tags: ["pleated", "wedding"] },
      { title: "Halter Neck Maxi Dress", price: 3199, colors: ["black", "red"], material: "Jersey", short: "A sleek halter maxi in stretch jersey.", detail: "Wrinkle-resistant jersey that packs well for trips.", tags: ["halter", "evening"] },
    ],
  },
  {
    key: "midi-dresses",
    category: "midi-dresses",
    kind: "clothing",
    optionName: "Color",
    sizes: APPAREL,
    weight: [280, 500],
    lowStock: 3,
    care: "Machine wash cold on a gentle cycle. Dry in the shade and iron on low.",
    closing: "Model is 5'5\" and wears size S.",
    photos: [325, 1027],
    specs: [["Length", "Midi"]],
    tags: ["dresses", "midi"],
    items: [
      { title: "Floral A-Line Dress", price: 2899, colors: ["pink", "blue"], material: "Cotton poplin", short: "A fitted bodice and a full A-line skirt in a fresh floral.", detail: "Flutter sleeves, a square neckline and a hidden back zip.", flags: ["featured", "bestseller"], tags: ["floral"] },
      { title: "Linen Shirt Dress", price: 3199, colors: ["beige", "sky", "white"], material: "Linen-cotton blend", short: "A relaxed button-front shirt dress with a belt.", detail: "Breathable linen blend, perfect for hot days in the Terai.", tags: ["linen", "summer"] },
      { title: "Puff Sleeve Midi Dress", price: 3399, colors: ["lavender", "mint"], material: "Cotton", short: "Romantic puff sleeves and a smocked bodice.", detail: "The stretchy smocked back fits a range of sizes comfortably.", tags: ["puff-sleeve"] },
      { title: "Knit Bodycon Midi Dress", price: 2799, colors: ["black", "brown", "cream"], material: "Rib knit", short: "A figure-skimming rib knit for cooler days.", detail: "A mock neck and long sleeves; pair with ankle boots in winter.", tags: ["knit", "winter"] },
      { title: "Polka Dot Tea Dress", price: 2699, colors: ["navy", "black"], material: "Georgette", short: "A vintage-style tea dress in polka dots.", detail: "A tie neck and a softly flared skirt.", tags: ["polka-dot", "vintage"] },
      { title: "Smocked Cotton Midi Dress", price: 2499, colors: ["mustard", "white"], material: "100% cotton", short: "An easy smocked sundress with tie straps.", detail: "Pull it on, tie the straps and go.", tags: ["cotton", "summer"] },
      { title: "Denim Button-Front Midi Dress", price: 3599, colors: ["blue"], material: "Cotton denim", short: "A structured denim dress with patch pockets.", detail: "Mid-wash denim that softens over time.", tags: ["denim"] },
    ],
  },
  {
    key: "party-dresses",
    category: "party-dresses",
    kind: "clothing",
    optionName: "Color",
    sizes: APPAREL,
    weight: [300, 600],
    lowStock: 3,
    care: "Dry clean recommended. Store on a padded hanger.",
    closing: "Model is 5'5\" and wears size S.",
    photos: [325, 1027],
    specs: [],
    tags: ["dresses", "party"],
    items: [
      { title: "Sequin Mini Dress", price: 4999, colors: ["gold", "silver", "black"], material: "Sequinned mesh, jersey lining", short: "A shimmering sequin mini for New Year's Eve.", detail: "Fully lined so the sequins never scratch.", specs: [["Length", "Mini"]], tags: ["sequin", "new-year"] },
      { title: "Velvet Wrap Dress", price: 4599, colors: ["burgundy", "emerald"], material: "Stretch velvet", short: "Rich velvet in a flattering wrap shape.", detail: "Warm enough for winter weddings, with long sleeves and a tie waist.", specs: [["Length", "Midi"]], tags: ["velvet", "winter", "wedding"] },
      { title: "One-Shoulder Cocktail Dress", price: 4299, colors: ["red", "black"], material: "Crepe", short: "A sculpted one-shoulder dress.", detail: "A clean asymmetric neckline with a side slit.", specs: [["Length", "Knee length"]], tags: ["cocktail"] },
      { title: "Organza Ruffle Dress", price: 5299, colors: ["blush", "ivory"], material: "Organza, satin lining", short: "Layers of organza ruffles for receptions.", detail: "Tiered ruffles over a satin slip lining.", specs: [["Length", "Midi"]], tags: ["organza", "wedding"] },
      { title: "Satin Cowl Neck Dress", price: 3799, colors: ["champagne", "navy"], material: "Satin", short: "A liquid satin dress with a draped cowl neck.", detail: "Adjustable straps and a bias cut.", specs: [["Length", "Midi"]], tags: ["satin", "evening"] },
      { title: "Off-Shoulder Bodycon Dress", price: 3499, colors: ["black", "maroon"], material: "Stretch crepe", short: "A sleek off-shoulder dress with stretch.", detail: "Structured crepe that holds its shape all night.", specs: [["Length", "Knee length"]], tags: ["bodycon"] },
    ],
  },
  {
    key: "blouses",
    category: "blouses",
    kind: "clothing",
    optionName: "Color",
    sizes: APPAREL,
    weight: [180, 320],
    lowStock: 4,
    care: "Hand wash cold. Hang to dry and iron on low.",
    closing: "True to size; size up for a looser fit.",
    photos: [836, 1027],
    specs: [],
    tags: ["tops", "blouses"],
    items: [
      { title: "Silk Button-Down Blouse", price: 2699, colors: ["ivory", "black", "blush"], material: "Mulberry silk blend", short: "A fluid button-down for the office and beyond.", detail: "Covered buttons and a relaxed drop shoulder.", tags: ["silk", "workwear"] },
      { title: "Ruffle Collar Blouse", price: 1999, colors: ["white", "pink"], material: "Cotton voile", short: "A sweet ruffle collar on a sheer cotton blouse.", detail: "Balloon sleeves and a keyhole back.", tags: ["ruffle"] },
      { title: "Embroidered Peasant Top", price: 1799, colors: ["white", "mustard"], material: "Cotton", short: "A relaxed peasant top with hand embroidery.", detail: "Chain-stitch florals around the neckline.", tags: ["embroidered", "boho"] },
      { title: "Satin Wrap Top", price: 2199, colors: ["emerald", "black", "champagne"], material: "Satin", short: "A glossy satin wrap top with a tie waist.", detail: "Tuck it into trousers or wear it over a skirt.", tags: ["satin", "evening"] },
      { title: "Linen Camp Collar Shirt", price: 2299, colors: ["beige", "olive", "white"], material: "100% linen", short: "A boxy camp-collar shirt in pure linen.", detail: "Cool and relaxed for warm days.", tags: ["linen", "unisex", "summer"] },
    ],
  },
  {
    key: "t-shirts",
    category: "t-shirts",
    kind: "clothing",
    optionName: "Color",
    sizes: APPAREL,
    weight: [150, 260],
    lowStock: 6,
    care: "Machine wash cold, inside out. Tumble dry low.",
    closing: "Pre-shrunk cotton that holds its shape wash after wash.",
    photos: [836, 669],
    specs: [],
    tags: ["tops", "t-shirts"],
    items: [
      { title: "Organic Cotton Crew Tee", price: 899, colors: ["white", "black", "grey", "olive"], material: "100% organic cotton", short: "The everyday crew-neck tee in organic cotton.", detail: "A mid-weight 180 gsm jersey that isn't see-through.", flags: ["bestseller"], tags: ["basics", "unisex"] },
      { title: "Striped Breton Tee", price: 1199, colors: ["navy", "red"], material: "Cotton", short: "A classic Breton stripe with a boat neck.", detail: "Three-quarter sleeves and a relaxed body.", tags: ["stripes"] },
      { title: "Himalaya Line Graphic Tee", price: 1299, colors: ["cream", "black"], material: "100% cotton", short: "An oversized tee with a line drawing of the Himalaya.", detail: "The skyline from Nagarkot, screen-printed by hand in Kathmandu.", tags: ["graphic", "made-in-nepal", "unisex"] },
      { title: "Ribbed Tank Top", price: 699, colors: ["white", "black", "beige"], material: "Cotton-elastane rib", short: "A fitted ribbed tank for layering.", detail: "Stretchy rib knit that stays in place.", tags: ["basics"] },
      { title: "Long Sleeve Henley", price: 1399, colors: ["grey", "maroon", "cream"], material: "Cotton waffle knit", short: "A waffle-knit henley for chilly mornings.", detail: "A three-button placket and a relaxed fit.", tags: ["henley", "unisex"] },
    ],
  },
  {
    key: "knitwear",
    category: "knitwear",
    kind: "clothing",
    optionName: "Color",
    sizes: APPAREL,
    weight: [350, 700],
    lowStock: 3,
    care: "Hand wash cold with wool shampoo. Reshape and dry flat. Do not hang.",
    closing: "Relaxed fit; take your usual size.",
    photos: [669, 836],
    specs: [],
    tags: ["tops", "knitwear", "winter"],
    items: [
      { title: "Cable Knit Sweater", price: 3299, colors: ["cream", "grey", "rust"], material: "Wool-acrylic blend", short: "A chunky cable knit for winter.", detail: "Classic cables down the front and a ribbed crew neck.", tags: ["cable-knit"] },
      { title: "Hand-knit Woolen Cardigan", price: 3999, colors: ["grey", "multi"], material: "Sheep wool", short: "A hand-knit cardigan with wooden buttons.", detail: "Knitted by hand in the Kathmandu valley; each one takes about a week to make.", flags: ["featured"], tags: ["hand-knit", "made-in-nepal"] },
      { title: "Cropped Mohair-blend Cardigan", price: 2999, colors: ["lavender", "cream", "sage"], material: "Mohair-nylon blend", short: "A fluffy cropped cardigan with pearl buttons.", detail: "Layer it over slip dresses or a tee.", tags: ["cropped", "mohair"] },
      { title: "Turtleneck Ribbed Sweater", price: 2499, colors: ["black", "camel", "burgundy"], material: "Viscose-nylon rib", short: "A slim ribbed turtleneck for layering.", detail: "Fine rib that fits under blazers and coats.", tags: ["turtleneck"] },
      { title: "Yak Wool Pullover", price: 5499, colors: ["brown", "grey"], material: "Yak and sheep wool blend", short: "A warm pullover blended with Himalayan yak wool.", detail: "Yak wool is soft, warm and breathable, ideal for Kathmandu winters and treks.", flags: ["limited"], tags: ["yak-wool", "made-in-nepal", "trek"] },
      { title: "Fair Isle Sweater", price: 3599, colors: ["navy", "red"], material: "Wool blend", short: "A cosy Fair Isle yoke sweater.", detail: "A festive pattern that's just right for December.", tags: ["fair-isle", "unisex"] },
    ],
  },
  {
    key: "jackets",
    category: "jackets",
    kind: "clothing",
    optionName: "Color",
    sizes: APPAREL_CORE,
    weight: [600, 1400],
    lowStock: 2,
    care: "Spot clean or follow the care label. Hang on a wide hanger away from heat.",
    closing: "Regular fit, with room for a sweater underneath.",
    photos: [1005, 669],
    specs: [],
    tags: ["outerwear", "jackets", "winter"],
    items: [
      { title: "Denim Trucker Jacket", price: 3999, colors: ["blue", "black"], material: "Cotton denim", short: "The classic trucker jacket in rigid denim.", detail: "Chest pockets, button cuffs and a boxy fit.", tags: ["denim", "unisex"] },
      { title: "Quilted Puffer Jacket", price: 5999, colors: ["black", "olive", "beige"], material: "Nylon shell, polyester fill", short: "A warm, light puffer for Kathmandu winters.", detail: "A water-repellent shell and a stand collar.", flags: ["bestseller"], tags: ["puffer"] },
      { title: "Corduroy Shacket", price: 3499, colors: ["tan", "olive"], material: "Cotton corduroy", short: "A shirt-jacket in soft corduroy.", detail: "Wear it open over a tee or buttoned as a light jacket.", tags: ["corduroy", "unisex"] },
      { title: "Lightweight Down Jacket", price: 8999, colors: ["red", "navy", "black"], material: "Nylon ripstop, duck down fill", short: "A packable down jacket for treks and winter mornings.", detail: "Packs into its own pocket and weighs under 350 g.", specs: [["Fill", "Duck down"]], tags: ["down", "trek", "unisex"] },
      { title: "Suede Bomber Jacket", price: 6999, colors: ["tan"], material: "Faux suede", short: "A soft faux-suede bomber with rib trims.", detail: "A relaxed bomber shape with zip pockets.", tags: ["bomber"] },
      { title: "Fleece Zip Jacket", price: 2799, colors: ["grey", "navy", "green"], material: "Polyester fleece", short: "A cosy fleece for layering on the trail.", detail: "Anti-pill fleece with zip hand pockets.", tags: ["fleece", "trek", "unisex"] },
      { title: "Windbreaker Anorak", price: 3299, colors: ["mustard", "navy"], material: "Nylon", short: "A pullover anorak that blocks wind and drizzle.", detail: "A kangaroo pocket and a drawcord hood.", tags: ["windbreaker", "monsoon"] },
    ],
  },
  {
    key: "coats",
    category: "coats",
    kind: "clothing",
    optionName: "Color",
    sizes: APPAREL_CORE,
    weight: [900, 1600],
    lowStock: 2,
    care: "Dry clean only. Brush gently and hang on a wide hanger.",
    closing: "Designed to fit over knitwear.",
    photos: [1005, 669],
    specs: [],
    tags: ["outerwear", "coats", "winter"],
    items: [
      { title: "Wool Blend Long Coat", price: 8499, colors: ["camel", "charcoal", "black"], material: "Wool blend", short: "A timeless long coat in warm wool blend.", detail: "Notched lapels, a single-breasted front and full lining.", tags: ["wool"] },
      { title: "Belted Trench Coat", price: 7499, colors: ["beige", "olive"], material: "Cotton gabardine", short: "A belted trench for monsoon and autumn.", detail: "Water-repellent gabardine with a storm flap.", tags: ["trench", "monsoon"] },
      { title: "Teddy Borg Coat", price: 5999, colors: ["cream", "brown"], material: "Polyester borg", short: "A cuddly teddy coat that's warm as a blanket.", detail: "An oversized fit with deep pockets.", tags: ["teddy"] },
      { title: "Double-Breasted Peacoat", price: 7999, colors: ["navy", "black"], material: "Wool blend", short: "A structured peacoat with anchor buttons.", detail: "A wide collar that stands up against the wind.", tags: ["peacoat", "unisex"] },
      { title: "Pashmina Blend Cape Coat", price: 9999, colors: ["grey", "maroon"], material: "Pashmina and wool blend", short: "An elegant cape coat woven with pashmina.", detail: "Woven in Nepal with a soft pashmina blend, it drapes over sarees and kurtas.", flags: ["limited"], tags: ["pashmina", "made-in-nepal", "wedding"] },
    ],
  },
  {
    key: "heels",
    category: "heels",
    kind: "footwear",
    optionName: "Color",
    sizes: HEELS,
    weight: [700, 1000],
    lowStock: 2,
    care: "Wipe with a damp cloth. Store in the dust bag, stuffed to keep the shape.",
    closing: "EU sizing, true to size. Unworn pairs can be exchanged for another size within 7 days of delivery.",
    photos: [21, 604],
    specs: [],
    tags: ["shoes", "heels"],
    items: [
      { title: "Block Heel Sandals", price: 2999, colors: ["black", "tan", "beige"], material: "Faux leather", short: "Comfortable block heels with an ankle strap.", detail: "A stable 6 cm block heel for weddings where you'll stand all evening.", specs: [["Heel height", "6 cm"]], flags: ["bestseller"], tags: ["block-heel", "wedding"] },
      { title: "Kitten Heel Mules", price: 2699, colors: ["black", "red"], material: "Faux leather", short: "Slip-on mules with a low kitten heel.", detail: "A pointed toe and a padded footbed.", specs: [["Heel height", "4 cm"]], tags: ["mules"] },
      { title: "Strappy Stiletto Sandals", price: 3499, colors: ["gold", "silver", "black"], material: "Metallic faux leather", short: "Barely-there straps on a slim stiletto.", detail: "Made for parties and receptions.", specs: [["Heel height", "9 cm"]], tags: ["stiletto", "party"] },
      { title: "Platform Heels", price: 3799, colors: ["black", "beige"], material: "Faux suede", short: "Height without the wobble, on a chunky platform.", detail: "A 3 cm platform makes the 11 cm heel feel like 8 cm.", specs: [["Heel height", "11 cm, 3 cm platform"]], tags: ["platform"] },
      { title: "Embroidered Wedding Heels", price: 3299, colors: ["maroon", "gold"], material: "Velvet, zari embroidery", short: "Velvet heels embroidered with zari thread.", detail: "Designed to be seen under a lehenga or saree.", specs: [["Heel height", "5 cm"]], tags: ["wedding", "ethnic", "festive"] },
    ],
  },
  {
    key: "flats",
    category: "flats",
    kind: "footwear",
    optionName: "Color",
    sizes: HEELS,
    weight: [500, 800],
    lowStock: 2,
    care: "Wipe clean. Air dry away from direct heat.",
    closing: "EU sizing, true to size. Unworn pairs can be exchanged for another size within 7 days of delivery.",
    photos: [21, 604],
    specs: [],
    tags: ["shoes", "flats"],
    items: [
      { title: "Classic Ballet Flats", price: 1999, colors: ["black", "beige", "red"], material: "Faux leather", short: "Soft ballet flats with a bow.", detail: "A cushioned insole and a flexible sole.", tags: ["ballet"] },
      { title: "Embroidered Juttis", price: 1799, colors: ["gold", "maroon", "emerald"], material: "Leather, zari embroidery", short: "Traditional juttis with rich embroidery.", detail: "Hand-embroidered uppers on a leather sole; they soften after a few wears.", flags: ["bestseller"], tags: ["jutti", "ethnic", "festive"] },
      { title: "Loafer Flats", price: 2499, colors: ["black", "tan"], material: "Leather", short: "Polished loafers for office days.", detail: "A metal bar detail and a low stacked heel.", tags: ["loafer", "workwear"] },
      { title: "Pointed Slingback Flats", price: 2299, colors: ["white", "black"], material: "Faux leather", short: "Pointed slingbacks with an elastic strap.", detail: "Elegant without a heel.", tags: ["slingback"] },
    ],
  },
  {
    key: "sneakers",
    category: "sneakers",
    kind: "footwear",
    optionName: "Color",
    sizes: SNEAKERS,
    weight: [800, 1300],
    lowStock: 2,
    care: "Wipe uppers with a damp cloth. Remove insoles to air dry.",
    closing: "EU sizing. Unworn pairs can be exchanged for another size within 7 days of delivery.",
    photos: [21, 604],
    specs: [],
    tags: ["shoes", "sneakers", "unisex"],
    items: [
      { title: "Classic White Sneakers", price: 3499, colors: ["white"], material: "Leather upper, rubber sole", short: "Clean white leather sneakers that go with everything.", detail: "A cupsole with a padded collar and a cushioned insole.", flags: ["featured", "bestseller"], tags: ["white", "everyday"] },
      { title: "Canvas Low-Top Sneakers", price: 1999, colors: ["white", "black", "navy"], material: "Cotton canvas, rubber sole", short: "Everyday canvas low-tops.", detail: "Lightweight and easy to wash.", tags: ["canvas"] },
      { title: "Chunky Dad Sneakers", price: 4499, colors: ["white", "grey"], material: "Mesh and synthetic overlays", short: "Chunky, comfortable, a little retro.", detail: "A layered midsole adds height and cushioning.", tags: ["chunky"] },
      { title: "Running Trainers", price: 4999, colors: ["black", "blue"], material: "Knit mesh, EVA midsole", short: "Light, breathable trainers for runs and the gym.", detail: "A responsive midsole and a grippy rubber outsole.", tags: ["running", "sports"] },
      { title: "Slip-On Canvas Shoes", price: 1599, colors: ["black", "beige"], material: "Canvas", short: "No-lace canvas slip-ons.", detail: "Elastic side panels for quick wear.", tags: ["slip-on"] },
      { title: "Waterproof Hiking Shoes", price: 6499, colors: ["brown", "grey"], material: "Suede and mesh, waterproof membrane, lug sole", short: "Waterproof hiking shoes for Himalayan trails.", detail: "A waterproof membrane and deep lugs for muddy monsoon paths and rocky ascents.", specs: [["Sole", "Rubber lug"]], tags: ["hiking", "trek", "monsoon"] },
    ],
  },
  {
    key: "sandals",
    category: "sandals",
    kind: "footwear",
    optionName: "Color",
    sizes: HEELS,
    weight: [400, 700],
    lowStock: 2,
    care: "Wipe clean and air dry.",
    closing: "EU sizing, true to size. Unworn pairs can be exchanged for another size within 7 days of delivery.",
    photos: [21, 604],
    specs: [],
    tags: ["shoes", "sandals", "summer"],
    items: [
      { title: "Leather Kolhapuri Sandals", price: 1999, colors: ["tan", "brown"], material: "Vegetable-tanned leather", short: "Hand-stitched Kolhapuris in soft leather.", detail: "A toe loop and braided straps; they mould to your feet.", tags: ["kolhapuri", "ethnic"] },
      { title: "Slide Sandals", price: 1299, colors: ["black", "beige"], material: "Faux leather, EVA footbed", short: "Padded slides for everyday wear.", detail: "A contoured footbed and a wide strap.", tags: ["slides"] },
      { title: "Strappy Flat Sandals", price: 1599, colors: ["gold", "black"], material: "Faux leather", short: "Minimal strappy sandals with a buckle.", detail: "An adjustable ankle strap and a padded sole.", tags: ["strappy"] },
      { title: "Sports Sandals", price: 2499, colors: ["black", "olive"], material: "Webbing straps, rubber sole", short: "Adjustable sports sandals for rivers and rain.", detail: "Quick-drying straps and a grippy sole for monsoon days.", tags: ["sports", "monsoon", "unisex"] },
    ],
  },
  {
    key: "boots",
    category: "boots",
    kind: "footwear",
    optionName: "Color",
    sizes: BOOTS,
    weight: [1100, 1800],
    lowStock: 2,
    care: "Brush off dirt and condition leather regularly. Stuff with paper to dry.",
    closing: "EU sizing. Unworn pairs can be exchanged for another size within 7 days of delivery.",
    photos: [604, 21],
    specs: [],
    tags: ["boots", "winter"],
    items: [
      { title: "Chelsea Boots", price: 5999, colors: ["black", "brown"], material: "Leather, rubber sole", short: "Classic Chelsea boots with elastic sides.", detail: "Pull tabs front and back, and a low stacked heel.", flags: ["bestseller"], tags: ["chelsea", "unisex"] },
      { title: "Knee-High Riding Boots", price: 7999, colors: ["black", "brown"], material: "Leather", short: "Sleek knee-high boots with an inner zip.", detail: "A slim shaft that fits over skinny jeans and leggings.", flags: ["limited"], tags: ["knee-high"] },
      { title: "Lace-Up Combat Boots", price: 5499, colors: ["black"], material: "Faux leather, lug sole", short: "Tough lace-ups with a chunky sole.", detail: "A side zip for quick on and off.", tags: ["combat"] },
      { title: "Shearling-Lined Winter Boots", price: 6499, colors: ["tan", "grey"], material: "Suede, faux shearling lining", short: "Cosy lined boots for the coldest mornings.", detail: "Faux shearling inside and a grippy sole outside.", tags: ["shearling"] },
      { title: "Block Heel Knee Boots", price: 7499, colors: ["black", "burgundy"], material: "Faux suede", short: "Knee boots on a walkable block heel.", detail: "A 7 cm block heel and a full-length zip.", tags: ["knee-high", "block-heel"] },
      { title: "Leather Trekking Boots", price: 8999, colors: ["brown"], material: "Full-grain leather, waterproof membrane, Vibram-style sole", short: "Mid-height trekking boots built for the Annapurna trails.", detail: "Ankle support, a waterproof membrane and a stiff sole for long days on rocky paths.", tags: ["trek", "hiking", "unisex"] },
    ],
  },
  {
    key: "handbags",
    category: "handbags",
    kind: "bag",
    optionName: "Color",
    weight: [600, 1100],
    lowStock: 3,
    care: "Wipe with a dry cloth. Stuff with paper and store in the dust bag.",
    closing: "Comes with a dust bag.",
    photos: [7],
    specs: [],
    tags: ["bags", "handbags"],
    items: [
      { title: "Classic Top Handle Bag", price: 3999, colors: ["maroon", "black", "tan"], material: "Faux leather, fabric lining", short: "A structured top-handle bag with a detachable strap.", detail: "A gold-tone turn lock, two inner compartments and a zip pocket.", flags: ["featured", "bestseller"], specs: [["Dimensions", "28 × 20 × 12 cm"], ["Strap", "Detachable, adjustable"]], tags: ["top-handle"] },
      { title: "Classic Leather Handbag", price: 3799, colors: ["brown", "black"], material: "Genuine leather, cotton lining", short: "A soft leather handbag for every day.", detail: "Roomy enough for a tablet, with a magnetic snap and an inner zip pocket.", specs: [["Dimensions", "30 × 24 × 12 cm"]], tags: ["leather"] },
      { title: "Quilted Chain Shoulder Bag", price: 3499, colors: ["black", "cream"], material: "Quilted faux leather", short: "A quilted flap bag on a chain strap.", detail: "Wear it on the shoulder or double the chain as a handle.", specs: [["Dimensions", "24 × 15 × 7 cm"]], tags: ["quilted", "party"] },
      { title: "Structured Satchel", price: 4499, colors: ["tan", "olive"], material: "Faux leather", short: "A satchel that fits a 13\" laptop.", detail: "A padded laptop sleeve and a structured base that stands on its own.", specs: [["Dimensions", "35 × 26 × 12 cm"]], tags: ["workwear"] },
      { title: "Mini Bucket Bag", price: 2699, colors: ["brown", "black", "red"], material: "Faux leather", short: "A drawstring bucket bag in a mini size.", detail: "Holds your phone, wallet and keys.", specs: [["Dimensions", "18 × 20 × 12 cm"]], tags: ["mini"] },
      { title: "Woven Straw Handbag", price: 1999, colors: ["natural"], material: "Woven straw, cotton lining", short: "A summery straw handbag with leather handles.", detail: "Lined, with a magnetic closure.", specs: [["Dimensions", "32 × 22 × 12 cm"]], tags: ["straw", "summer"] },
      { title: "Crossbody Camera Bag", price: 2499, colors: ["black", "tan", "burgundy"], material: "Faux leather", short: "A compact crossbody with a front zip pocket.", detail: "Hands-free for busy bazaars and travel days.", specs: [["Dimensions", "22 × 15 × 7 cm"]], tags: ["crossbody", "travel"] },
    ],
  },
  {
    key: "tote-bags",
    category: "tote-bags",
    kind: "bag",
    optionName: "Color",
    weight: [350, 900],
    lowStock: 3,
    care: "Spot clean. Air dry away from direct sunlight.",
    closing: "Inner zip pocket for keys and phone.",
    photos: [7],
    specs: [],
    tags: ["bags", "totes"],
    items: [
      { title: "Allo Hemp Tote", price: 1799, colors: ["natural"], material: "Allo (Himalayan nettle) and hemp", short: "A sturdy tote woven from allo and hemp.", detail: "Hand-woven in Nepal from Himalayan giant nettle fibre, a tough, sustainable textile.", flags: ["bestseller"], specs: [["Dimensions", "40 × 36 × 10 cm"], ["Origin", "Hand-woven in Nepal"]], tags: ["allo", "made-in-nepal", "sustainable"] },
      { title: "Canvas Everyday Tote", price: 1299, colors: ["cream", "black"], material: "Heavy cotton canvas", short: "A heavy canvas tote for college and groceries.", detail: "Reinforced handles and an open top.", specs: [["Dimensions", "42 × 38 × 12 cm"]], tags: ["canvas"] },
      { title: "Leather Work Tote", price: 5499, colors: ["black", "tan"], material: "Genuine leather", short: "A leather tote with a laptop sleeve.", detail: "Fits a 15\" laptop, with a zip top and a detachable pouch.", specs: [["Dimensions", "40 × 30 × 14 cm"]], tags: ["leather", "workwear"] },
      { title: "Dhaka Weave Tote", price: 2299, colors: ["multi"], material: "Dhaka fabric, cotton canvas", short: "A canvas tote with hand-woven Dhaka panels.", detail: "Traditional Dhaka weave from Nepal meets a practical everyday tote.", specs: [["Dimensions", "38 × 34 × 10 cm"]], tags: ["dhaka", "made-in-nepal"] },
      { title: "Felt Wool Tote", price: 1999, colors: ["grey", "multi"], material: "Hand-felted wool", short: "A soft hand-felted wool tote.", detail: "Felted by hand in Kathmandu from New Zealand and Tibetan wool.", specs: [["Dimensions", "36 × 32 × 8 cm"]], tags: ["felt", "made-in-nepal"] },
    ],
  },
  {
    key: "backpacks",
    category: "backpacks",
    kind: "bag",
    optionName: "Color",
    weight: [700, 1300],
    lowStock: 3,
    care: "Spot clean with a damp cloth. Air dry fully before storing.",
    closing: "Padded straps and a back panel for all-day comfort.",
    photos: [7],
    specs: [],
    tags: ["bags", "backpacks"],
    items: [
      { title: "Hemp Rolltop Backpack", price: 3499, colors: ["beige", "olive"], material: "Hemp canvas", short: "A rolltop backpack in durable hemp.", detail: "Roll the top to expand or compress; a laptop sleeve inside.", specs: [["Capacity", "20 L"]], tags: ["hemp", "made-in-nepal", "sustainable"] },
      { title: "Leather Mini Backpack", price: 3999, colors: ["black", "tan"], material: "Faux leather", short: "A mini backpack that converts to a shoulder bag.", detail: "Adjustable straps clip together into a single shoulder strap.", specs: [["Capacity", "7 L"]], tags: ["mini"] },
      { title: "Nylon Commuter Backpack", price: 2999, colors: ["black", "navy"], material: "Water-resistant nylon", short: "A slim commuter pack with a laptop sleeve.", detail: "Water-resistant fabric for monsoon commutes.", specs: [["Capacity", "18 L"]], tags: ["commuter", "monsoon"] },
      { title: "Trekking Daypack 25L", price: 4499, colors: ["red", "black"], material: "Ripstop nylon", short: "A 25 L daypack for day hikes and tea-house treks.", detail: "Hip belt, rain cover and hydration sleeve included.", specs: [["Capacity", "25 L"]], tags: ["trek", "hiking", "unisex"] },
    ],
  },
  {
    key: "clutches",
    category: "clutches",
    kind: "bag",
    optionName: "Color",
    weight: [250, 500],
    lowStock: 3,
    care: "Store in the dust bag, away from moisture.",
    closing: "Includes a detachable chain strap.",
    photos: [7],
    specs: [],
    tags: ["bags", "clutches", "party"],
    items: [
      { title: "Beaded Evening Clutch", price: 2799, colors: ["gold", "silver"], material: "Glass beads, satin lining", short: "A hand-beaded clutch for weddings and parties.", detail: "Thousands of glass beads stitched by hand.", specs: [["Dimensions", "22 × 12 × 5 cm"]], tags: ["beaded", "wedding"] },
      { title: "Satin Bow Clutch", price: 1999, colors: ["black", "blush"], material: "Satin", short: "A soft satin clutch with an oversized bow.", detail: "A frame closure and a chain strap.", specs: [["Dimensions", "24 × 13 × 4 cm"]], tags: ["satin"] },
      { title: "Dhaka Envelope Clutch", price: 1499, colors: ["multi"], material: "Dhaka fabric", short: "An envelope clutch in hand-woven Dhaka.", detail: "Pairs with a plain saree or kurta for Tihar.", specs: [["Dimensions", "26 × 15 × 2 cm"]], tags: ["dhaka", "made-in-nepal", "festive"] },
      { title: "Brocade Potli Bag", price: 1299, colors: ["maroon", "gold"], material: "Brocade, tassel drawstring", short: "A brocade potli with a tasselled drawstring.", detail: "Big enough for your phone and a lipstick.", tags: ["potli", "ethnic", "wedding"] },
    ],
  },
  {
    key: "travel-bags",
    category: "travel-bags",
    kind: "bag",
    optionName: "Color",
    weight: [900, 3200],
    lowStock: 2,
    care: "Wipe clean. Store stuffed so it keeps its shape.",
    closing: "Sized for bus trips, flights and weekends away.",
    photos: [7],
    specs: [],
    tags: ["bags", "travel"],
    items: [
      { title: "Canvas Duffel", price: 3999, colors: ["olive", "navy"], material: "Waxed canvas, leather trims", short: "A roomy canvas duffel with a shoe compartment.", detail: "Waxed canvas shrugs off light rain.", specs: [["Capacity", "40 L"]], tags: ["duffel"] },
      { title: "Hardshell Carry-on Trolley", price: 8999, colors: ["black", "grey"], material: "Polycarbonate shell", short: "A 20\" hardshell carry-on with spinner wheels.", detail: "A combination lock, and an expandable zip that adds 20% more space.", specs: [["Size", "20\" cabin size"]], tags: ["trolley", "luggage"] },
      { title: "Packable Travel Tote", price: 1799, colors: ["black"], material: "Ripstop nylon", short: "A tote that folds into its own pocket.", detail: "Slips over a trolley handle.", specs: [["Capacity", "25 L"]], tags: ["packable"] },
    ],
  },
  {
    key: "kurta-sets",
    category: "kurta-sets",
    kind: "clothing",
    optionName: "Color",
    sizes: APPAREL_CORE,
    weight: [400, 800],
    lowStock: 3,
    care: "Hand wash cold separately. Dry in the shade and iron on medium.",
    closing: "Sizes follow our kurta size chart; alterations are easy at any local tailor.",
    photos: [1027, 325],
    specs: [],
    tags: ["ethnic-wear", "kurta"],
    items: [
      { title: "Cotton Kurta Suruwal Set", price: 3499, colors: ["white", "peach", "sky"], material: "Cotton", short: "An everyday kurta suruwal with a printed dupatta.", detail: "A straight kurta, a comfortable suruwal and a matching dupatta.", flags: ["bestseller"], specs: [["What's in the box", "Kurta, suruwal, dupatta"]], tags: ["kurta-suruwal", "everyday"] },
      { title: "Chanderi Kurta Set with Dupatta", price: 4999, colors: ["mint", "blush"], material: "Chanderi silk-cotton", short: "A festive chanderi kurta set with zari detailing.", detail: "Light and lustrous, ideal for Dashain visits and pujas.", specs: [["What's in the box", "Kurta, pants, dupatta"]], tags: ["festive", "dashain"] },
      { title: "Block Print Kurta", price: 2299, colors: ["indigo", "rust"], material: "Cotton", short: "A hand block-printed straight kurta.", detail: "Printed with carved wooden blocks for a slightly irregular, handmade look.", specs: [["What's in the box", "Kurta only"]], tags: ["block-print", "everyday"] },
      { title: "Embroidered Georgette Kurta Set", price: 5999, colors: ["maroon", "emerald"], material: "Georgette, cotton lining", short: "A flowing georgette set with thread embroidery.", detail: "Sequin and thread work at the yoke and hem for weddings and receptions.", flags: ["featured"], specs: [["What's in the box", "Kurta, palazzo, dupatta"]], tags: ["wedding", "festive"] },
      { title: "Daura Suruwal Set", price: 6999, colors: ["white", "grey"], material: "Cotton", short: "The traditional daura suruwal for men.", detail: "Eight ties across the daura and a tapered suruwal; add a Dhaka topi and waistcoat for Dashain.", specs: [["What's in the box", "Daura, suruwal"]], tags: ["daura-suruwal", "men", "dashain", "made-in-nepal"] },
      { title: "Linen Straight Kurta", price: 2799, colors: ["beige", "olive"], material: "Linen", short: "A minimalist linen kurta with side slits.", detail: "Wear it over jeans or with the matching pants.", specs: [["What's in the box", "Kurta only"]], tags: ["linen", "everyday"] },
    ],
  },
  {
    key: "sarees",
    category: "sarees",
    kind: "clothing",
    optionName: "Color",
    weight: [500, 900],
    lowStock: 2,
    care: "Dry clean for silk and embellished sarees. Store folded in muslin.",
    closing: "5.5 m saree with a 0.8 m unstitched blouse piece.",
    photos: [1027, 325],
    specs: [["Length", "5.5 m + 0.8 m blouse piece"]],
    tags: ["ethnic-wear", "sarees"],
    items: [
      { title: "Red Banarasi Silk Saree", price: 9999, colors: ["red"], material: "Banarasi silk with zari", short: "A rich red Banarasi silk saree for Teej and weddings.", detail: "Gold zari buttis across the body and a heavy woven pallu.", flags: ["featured", "limited"], tags: ["banarasi", "teej", "wedding", "festive"] },
      { title: "Georgette Printed Saree", price: 3999, colors: ["pink", "green", "blue"], material: "Georgette", short: "A light georgette saree with a floral print.", detail: "Drapes easily and doesn't crease; good for office functions.", tags: ["printed"] },
      { title: "Hand-woven Dhaka Saree", price: 6999, colors: ["multi"], material: "Dhaka cotton", short: "A hand-woven Dhaka saree in traditional motifs.", detail: "Woven on a handloom in Nepal; a statement piece for national festivals.", tags: ["dhaka", "made-in-nepal", "festive"] },
      { title: "Chiffon Party Saree", price: 5499, colors: ["black", "emerald"], material: "Chiffon, sequin border", short: "A chiffon saree with a sequinned border.", detail: "A glamorous choice for receptions and New Year parties.", tags: ["party", "sequin"] },
      { title: "Cotton Handloom Saree", price: 3499, colors: ["white", "mustard"], material: "Handloom cotton", short: "A breathable handloom cotton saree.", detail: "A contrast border and tassels on the pallu.", tags: ["handloom", "everyday"] },
      { title: "Organza Floral Saree", price: 6499, colors: ["peach", "lavender"], material: "Organza", short: "A sheer organza saree with painted florals.", detail: "Lightweight and airy for daytime weddings.", tags: ["organza", "wedding"] },
    ],
  },
  {
    key: "dhaka",
    category: "dhaka-collection",
    kind: "clothing",
    optionName: "Color",
    weight: [250, 700],
    lowStock: 3,
    care: "Hand wash cold separately; Dhaka colours may bleed in the first wash. Iron on the reverse.",
    closing: "Dhaka is hand-woven in Nepal; pattern placement varies from piece to piece.",
    photos: [1027, 823],
    specs: [["Origin", "Hand-woven in Nepal"]],
    tags: ["ethnic-wear", "dhaka", "made-in-nepal"],
    items: [
      { title: "Dhaka Choli Blouse", price: 2499, colors: ["red", "multi"], sizes: sizes("Size", ["S", "M", "L"]), material: "Dhaka cotton", short: "A fitted Dhaka blouse to pair with sarees.", detail: "Tie-front detailing inspired by the traditional chaubandi cholo.", tags: ["blouse", "festive"] },
      { title: "Dhaka Shawl", price: 3499, colors: ["multi"], material: "Dhaka cotton", short: "A warm Dhaka shawl in bold geometric patterns.", detail: "Wear it over a kurta for Losar or Maghe Sankranti.", tags: ["shawl", "winter"] },
      { title: "Dhaka Waistcoat", price: 3999, colors: ["black", "multi"], sizes: APPAREL_CORE, material: "Dhaka cotton, satin lining", short: "A Dhaka waistcoat for daura suruwal or shirts.", detail: "Fully lined with a Nehru collar.", flags: ["bestseller"], tags: ["waistcoat", "men", "dashain"] },
      { title: "Dhaka Pattern Kurta", price: 3299, colors: ["multi"], sizes: APPAREL_CORE, material: "Dhaka cotton", short: "A kurta with Dhaka yoke and cuffs.", detail: "A plain cotton body with Dhaka panels at the yoke and sleeves.", tags: ["kurta", "men"] },
    ],
  },
];

/* ---------- Existing dev-seed products (kept identical) ---------- */

export type LegacyVariant = {
  key: string;
  sku: string;
  optionValues: Record<string, string>;
  price?: number;
  stock: number;
};

export type LegacyProduct = {
  slug: string;
  title: string;
  category: string;
  kind: ReviewKind;
  flags: Flag[];
  short: string;
  description: string;
  price: number;
  lowStock: number;
  options: { name: string; values: { value: string; label: string; swatchHex?: string }[] }[];
  variants: LegacyVariant[];
  photos: { picsumId: number; alt: string; variant?: string }[];
  specs: [string, string][];
  care: string;
  tags: string[];
  weight: number;
  /** Nepal date the product went live, `YYYY-MM-DD`. */
  launched: string;
  ar?: { placement: ArPlacement; mode: ArMode; anchor: string };
};

/**
 * Mirrors `src/features/catalog/dev-seed.ts` exactly (slugs, SKUs, prices,
 * options, stock, photos) so today's pages match the database later.
 */
export const legacyProducts: LegacyProduct[] = [
  {
    slug: "beaded-wrist-stack",
    title: "Beaded Wrist Stack",
    category: "bracelets-bangles",
    kind: "jewelry",
    flags: ["featured", "bestseller"],
    short: "A relaxed stack of beaded and leather bands. Easy to wear every day or to layer with your favourite watch.",
    description: "Three hand-strung bracelets in wooden beads, glass beads and braided leather. The stretch cord slips on without a clasp, and the warm tones pair with denim and neutrals alike.",
    price: 1799,
    lowStock: 5,
    options: [{ name: "Color", values: [{ value: "tan", label: "Tan", swatchHex: "#B07A4F" }, { value: "black", label: "Black", swatchHex: "#1F2937" }] }],
    variants: [
      { key: "tan", sku: "GRT-BWS-TAN", optionValues: { Color: "tan" }, stock: 24 },
      { key: "black", sku: "GRT-BWS-BLK", optionValues: { Color: "black" }, stock: 3 },
    ],
    photos: [
      { picsumId: 628, alt: "Layered beaded bracelets worn on the wrist" },
      { picsumId: 996, alt: "Bracelet worn in warm evening light" },
    ],
    specs: [
      ["Material", "Wooden & glass beads, braided leather"],
      ["Closure", "Stretch cord, slip-on"],
      ["Fit", "Fits most wrists (16–18 cm)"],
      ["Pieces", "Set of 3 bracelets"],
      ["Style", "Boho, everyday wear"],
      ["What's in the box", "3 bracelets, cotton pouch"],
    ],
    care: "Keep away from water, perfume and lotions. Store flat in the cotton pouch so the cord keeps its stretch.",
    tags: ["bracelets", "jewelry", "beaded", "boho"],
    weight: 90,
    launched: "2025-09-10",
    ar: { placement: "wrist", mode: "live_2d", anchor: "wrist_center" },
  },
  {
    slug: "leather-weekender-bag",
    title: "Leather Weekender Bag",
    category: "travel-bags",
    kind: "bag",
    flags: ["featured"],
    short: "A roomy full-grain leather bag for short trips, workdays and everything in between.",
    description: "Soft full-grain leather with a canvas-lined main compartment, an inner zip pocket and a detachable shoulder strap. Sized for a two-day trip, or a laptop and a change of clothes.",
    price: 3999,
    lowStock: 3,
    options: [],
    variants: [{ key: "brown", sku: "GRT-LWB-BRN", optionValues: {}, stock: 8 }],
    photos: [{ picsumId: 7, alt: "Brown leather bag on a wooden café table" }],
    specs: [
      ["Material", "Full-grain leather, canvas lining"],
      ["Colour", "Brown"],
      ["Dimensions", "45 × 25 × 22 cm"],
      ["Strap", "Detachable, adjustable"],
      ["Pockets", "1 inner zip, 2 slip"],
      ["What's in the box", "Bag, shoulder strap, dust bag"],
    ],
    care: "Wipe with a dry cloth. Condition the leather every few months and keep it out of direct sunlight when stored.",
    tags: ["bags", "travel", "leather"],
    weight: 1600,
    launched: "2025-09-10",
  },
  {
    slug: "white-lace-sundress",
    title: "White Lace Sundress",
    category: "midi-dresses",
    kind: "clothing",
    flags: ["featured"],
    short: "A light cotton sundress with a lace hem, made for warm days and garden gatherings.",
    description: "Breathable cotton with a scalloped lace hem and a relaxed, knee-length fit. Fully lined, with a hidden side zip.",
    price: 2899,
    lowStock: 3,
    options: [{ name: "Size", values: ["XS", "S", "M", "L"].map((size) => ({ value: size.toLowerCase(), label: size })) }],
    variants: [
      { key: "xs", sku: "GRT-WLS-XS", optionValues: { Size: "xs" }, stock: 6 },
      { key: "s", sku: "GRT-WLS-S", optionValues: { Size: "s" }, stock: 2 },
      { key: "m", sku: "GRT-WLS-M", optionValues: { Size: "m" }, stock: 9 },
      { key: "l", sku: "GRT-WLS-L", optionValues: { Size: "l" }, stock: 0 },
    ],
    photos: [{ picsumId: 325, alt: "White lace sundress worn outdoors" }],
    specs: [
      ["Material", "100% cotton, cotton lining"],
      ["Length", "Knee length"],
      ["Fit", "Relaxed"],
      ["Closure", "Hidden side zip"],
      ["Style", "Summer, casual"],
    ],
    care: "Hand wash cold with similar colours. Dry flat in the shade and iron on low.",
    tags: ["dresses", "midi", "lace", "summer"],
    weight: 350,
    launched: "2026-09-02",
  },
  {
    slug: "aviator-sunglasses",
    title: "Aviator Sunglasses",
    category: "sunglasses",
    kind: "eyewear",
    flags: ["featured"],
    short: "Classic aviators with mirrored lenses and a lightweight metal frame.",
    description: "A timeless teardrop shape with UV400 mirrored lenses, adjustable nose pads and spring hinges for a comfortable fit all day.",
    price: 2499,
    lowStock: 5,
    options: [{ name: "Color", values: [{ value: "gold-blue", label: "Gold / Blue", swatchHex: "#C9A24A" }, { value: "silver-grey", label: "Silver / Grey", swatchHex: "#9CA3AF" }] }],
    variants: [
      { key: "gold-blue", sku: "GRT-AVS-GLD", optionValues: { Color: "gold-blue" }, stock: 14 },
      { key: "silver-grey", sku: "GRT-AVS-SLV", optionValues: { Color: "silver-grey" }, price: 2299, stock: 7 },
    ],
    photos: [
      { picsumId: 64, alt: "Woman wearing mirrored aviator sunglasses" },
      { picsumId: 26, alt: "Aviator sunglasses laid out with travel essentials" },
    ],
    specs: [
      ["Frame", "Metal, spring hinges"],
      ["Lenses", "Mirrored, UV400"],
      ["Lens width", "58 mm"],
      ["Fit", "Adjustable nose pads"],
      ["What's in the box", "Sunglasses, case, cleaning cloth"],
    ],
    care: "Clean the lenses with the included cloth. Store in the case, lenses up, to avoid scratches.",
    tags: ["sunglasses", "eyewear", "aviator"],
    weight: 160,
    launched: "2026-09-02",
    ar: { placement: "face", mode: "live_2d", anchor: "nose_bridge" },
  },
  {
    slug: "white-pointed-heels",
    title: "White Pointed Heels",
    category: "heels",
    kind: "footwear",
    flags: ["featured"],
    short: "Sleek pointed-toe heels that dress up everything from jeans to gowns.",
    description: "Smooth faux-leather uppers on a 7 cm stiletto heel, with a cushioned insole for longer evenings.",
    price: 3499,
    lowStock: 2,
    options: [{ name: "Size", values: ["36", "37", "38", "39", "40"].map((size) => ({ value: size, label: size })) }],
    variants: ["36", "37", "38", "39", "40"].map((size) => ({
      key: size,
      sku: `GRT-WPH-${size}`,
      optionValues: { Size: size },
      stock: size === "40" ? 1 : 5,
    })),
    photos: [{ picsumId: 21, alt: "Pair of white pointed-toe heels" }],
    specs: [
      ["Upper", "Faux leather"],
      ["Heel height", "7 cm"],
      ["Toe", "Pointed"],
      ["Sizing", "EU sizes, true to size"],
    ],
    care: "Wipe with a damp cloth. Store in the dust bag, stuffed to keep their shape.",
    tags: ["shoes", "heels", "wedding"],
    weight: 850,
    launched: "2025-09-10",
  },
  {
    slug: "knit-slouch-beanie",
    title: "Knit Slouch Beanie",
    category: "hats",
    kind: "headwear",
    flags: ["bestseller"],
    short: "A chunky, slouchy knit beanie to keep you warm on misty hill mornings.",
    description: "A soft acrylic-wool blend in a chunky rib knit, with a generous slouch that sits comfortably over the ears.",
    price: 999,
    lowStock: 5,
    options: [{ name: "Color", values: [{ value: "grey", label: "Grey" }, { value: "red", label: "Red" }] }],
    variants: [
      { key: "grey", sku: "GRT-KSB-GRY", optionValues: { Color: "grey" }, stock: 15 },
      { key: "red", sku: "GRT-KSB-RED", optionValues: { Color: "red" }, stock: 4 },
    ],
    photos: [
      { picsumId: 669, alt: "Grey knit beanie worn with a corduroy jacket", variant: "grey" },
      { picsumId: 823, alt: "Red knit beanie worn in a forest", variant: "red" },
    ],
    specs: [
      ["Material", "70% acrylic, 30% wool"],
      ["Knit", "Chunky rib"],
      ["Fit", "Slouchy, one size"],
    ],
    care: "Hand wash cold and dry flat. Do not tumble dry.",
    tags: ["hats", "beanie", "winter"],
    weight: 150,
    launched: "2025-09-10",
  },
  {
    slug: "felt-fedora",
    title: "Felt Fedora",
    category: "hats",
    kind: "headwear",
    flags: [],
    short: "A soft grey felt fedora with a tonal band.",
    description: "Structured wool felt with a pinched crown, a medium brim and a grosgrain band. It adds polish to a casual outfit.",
    price: 1699,
    lowStock: 3,
    options: [],
    variants: [{ key: "grey", sku: "GRT-FFD-GRY", optionValues: {}, stock: 10 }],
    photos: [{ picsumId: 836, alt: "Woman in a grey felt fedora playing guitar" }],
    specs: [
      ["Material", "Wool felt"],
      ["Brim", "6 cm"],
      ["Band", "Grosgrain"],
    ],
    care: "Brush gently with a soft brush. Store crown-down on a flat surface.",
    tags: ["hats", "fedora"],
    weight: 220,
    launched: "2025-09-10",
  },
  {
    slug: "aztec-blanket-scarf",
    title: "Aztec Blanket Scarf",
    category: "scarves-wraps",
    kind: "scarf",
    flags: [],
    short: "An oversized, colourful blanket scarf with a fringed edge.",
    description: "A bold geometric pattern woven in a soft, brushed yarn. Wear it wrapped, draped or belted as a shawl.",
    price: 1499,
    lowStock: 5,
    options: [],
    variants: [{ key: "multi", sku: "GRT-ABS-MLT", optionValues: {}, stock: 18 }],
    photos: [{ picsumId: 758, alt: "Woven wrap in warm autumn colours" }],
    specs: [
      ["Material", "Brushed acrylic"],
      ["Size", "140 × 140 cm"],
      ["Edge", "Fringed"],
    ],
    care: "Hand wash cold and dry flat. Steam to remove creases.",
    tags: ["scarves", "blanket-scarf", "winter"],
    weight: 380,
    launched: "2025-09-10",
  },
  {
    slug: "leather-moto-jacket",
    title: "Leather Moto Jacket",
    category: "jackets",
    kind: "clothing",
    flags: [],
    short: "A classic black moto jacket in soft, lived-in leather.",
    description: "Lambskin leather with an asymmetric zip, snap lapels and zip cuffs. Fully lined for the cooler months.",
    price: 8999,
    lowStock: 2,
    options: [{ name: "Size", values: ["S", "M", "L"].map((size) => ({ value: size.toLowerCase(), label: size })) }],
    variants: [
      { key: "s", sku: "GRT-LMJ-S", optionValues: { Size: "s" }, stock: 3 },
      { key: "m", sku: "GRT-LMJ-M", optionValues: { Size: "m" }, stock: 4 },
      { key: "l", sku: "GRT-LMJ-L", optionValues: { Size: "l" }, stock: 2 },
    ],
    photos: [{ picsumId: 1005, alt: "Person in a leather jacket and knit scarf by the sea" }],
    specs: [
      ["Material", "Lambskin leather, polyester lining"],
      ["Closure", "Asymmetric zip"],
      ["Fit", "Regular"],
    ],
    care: "Professional leather clean only. Hang on a wide hanger away from heat.",
    tags: ["outerwear", "jackets", "leather", "winter"],
    weight: 1400,
    launched: "2025-09-10",
  },
  {
    slug: "suede-ankle-boots",
    title: "Suede Ankle Boots",
    category: "boots",
    kind: "footwear",
    flags: [],
    short: "Tan suede ankle boots with a stacked heel.",
    description: "Soft suede uppers, a side zip and a 5 cm stacked heel on a grippy rubber sole for everyday walking.",
    price: 5499,
    lowStock: 2,
    options: [{ name: "Size", values: ["37", "38", "39", "40"].map((size) => ({ value: size, label: size })) }],
    variants: ["37", "38", "39", "40"].map((size) => ({
      key: size,
      sku: `GRT-SAB-${size}`,
      optionValues: { Size: size },
      stock: 4,
    })),
    photos: [{ picsumId: 604, alt: "Tan suede ankle boots worn with jeans" }],
    specs: [
      ["Upper", "Suede"],
      ["Heel height", "5 cm, stacked"],
      ["Sole", "Rubber"],
      ["Closure", "Side zip"],
    ],
    care: "Brush with a suede brush and treat with a suede protector before wearing.",
    tags: ["boots", "suede", "winter"],
    weight: 1300,
    launched: "2025-09-10",
  },
];

/* ---------- Collections ---------- */

export type CollectionSeed = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  picsumId: number;
  alt: string;
  /** Products are picked by tag or category, then capped. */
  match: { tags?: string[]; categories?: string[]; slugs?: string[] };
  limit: number;
  /** NPT dates; null = always on. */
  window: [string, string] | null;
};

/** The first three mirror `seedCollections` in dev-seed.ts. */
export const collectionSeeds: CollectionSeed[] = [
  {
    slug: "autumn-styles",
    eyebrow: "New collection",
    title: "Autumn Styles Just Arrived",
    description: "Warm tones, modern silhouettes and everyday essentials.",
    picsumId: 758,
    alt: "Woven wrap in warm autumn colours",
    match: { tags: ["knit", "corduroy", "boho", "blanket-scarf"], categories: ["knitwear", "scarves-wraps"] },
    limit: 16,
    window: null,
  },
  {
    slug: "layer-up",
    eyebrow: "Outerwear edit",
    title: "Layer Up for Cooler Days",
    description: "Cosy jackets, knit beanies and soft layers for the hills.",
    picsumId: 669,
    alt: "Person in a corduroy jacket and knit beanie facing the mist",
    match: { categories: ["jackets", "coats", "hats"], tags: ["winter"] },
    limit: 18,
    window: null,
  },
  {
    slug: "leather-and-knits",
    eyebrow: "Staff picks",
    title: "Leather & Knit Classics",
    description: "Timeless leather jackets paired with chunky scarves.",
    picsumId: 1005,
    alt: "Person in a leather jacket and knit scarf by the sea",
    match: { tags: ["leather", "knit", "hand-knit"] },
    limit: 14,
    window: null,
  },
  {
    slug: "dashain-edit",
    eyebrow: "Festive edit",
    title: "Dressed for Dashain",
    description: "Kurta sets, Dhaka topi and jewellery for tika day and family visits.",
    picsumId: 1027,
    alt: "Woman in festive dress looking over her shoulder",
    match: { tags: ["dashain", "festive", "dhaka"] },
    limit: 18,
    window: ["2026-09-25", "2026-10-25"],
  },
  {
    slug: "teej-collection",
    eyebrow: "Teej",
    title: "Red for Teej",
    description: "Red sarees, green pote and glass bangles for the women's festival.",
    picsumId: 325,
    alt: "Woman in a flowing dress outdoors",
    match: { tags: ["teej", "pote", "bangles"], slugs: ["red-banarasi-silk-saree"] },
    limit: 12,
    window: ["2026-08-20", "2026-09-20"],
  },
  {
    slug: "pashmina-edit",
    eyebrow: "Made in Nepal",
    title: "The Pashmina Edit",
    description: "Chyangra pashmina shawls, stoles and mufflers, hand-woven in Nepal.",
    picsumId: 758,
    alt: "Soft woven wrap in warm tones",
    match: { categories: ["pashmina"], tags: ["pashmina"] },
    limit: 10,
    window: null,
  },
];
