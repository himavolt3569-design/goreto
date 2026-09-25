import type { PermissionKey } from "../types.ts";
import type { ReviewKind } from "./catalog.ts";

/* ---------- Coupons ---------- */

export type CouponSeed = {
  code: string;
  description: string;
  type: "fixed" | "percentage";
  percentOff?: number;
  /** Whole rupees. */
  amountOff?: number;
  minOrder?: number;
  maxDiscount?: number;
  /** NPT `YYYY-MM-DD`, inclusive. */
  starts: string;
  ends: string | null;
  usageLimit: number | null;
  perCustomer: number | null;
  isActive: boolean;
  /** Chance an eligible shopper applies it (simulation only). */
  uptake: number;
  firstOrderOnly?: boolean;
};

export const couponSeeds: CouponSeed[] = [
  { code: "WELCOME10", description: "10% off your first order (up to Rs. 500).", type: "percentage", percentOff: 10, minOrder: 1500, maxDiscount: 500, starts: "2025-09-15", ends: null, usageLimit: null, perCustomer: 1, isActive: true, uptake: 0.35, firstOrderOnly: true },
  { code: "DASHAIN25", description: "Dashain 2025: 15% off orders over Rs. 3,000 (up to Rs. 1,500).", type: "percentage", percentOff: 15, minOrder: 3000, maxDiscount: 1500, starts: "2025-09-20", ends: "2025-10-05", usageLimit: 400, perCustomer: 2, isActive: true, uptake: 0.45 },
  { code: "TIHAR500", description: "Tihar 2025: Rs. 500 off orders over Rs. 4,000.", type: "fixed", amountOff: 500, minOrder: 4000, starts: "2025-10-15", ends: "2025-10-25", usageLimit: 300, perCustomer: 1, isActive: true, uptake: 0.5 },
  { code: "WINTER20", description: "Winter sale: 20% off orders over Rs. 2,500 (up to Rs. 1,000).", type: "percentage", percentOff: 20, minOrder: 2500, maxDiscount: 1000, starts: "2025-12-01", ends: "2026-01-31", usageLimit: null, perCustomer: 3, isActive: true, uptake: 0.3 },
  { code: "NEWYEAR2083", description: "Nepali New Year 2083: Rs. 300 off orders over Rs. 2,500.", type: "fixed", amountOff: 300, minOrder: 2500, starts: "2026-04-10", ends: "2026-04-20", usageLimit: 200, perCustomer: 1, isActive: true, uptake: 0.45 },
  { code: "FLASH1000", description: "Flash sale: Rs. 1,000 off orders over Rs. 4,000. First 10 orders only.", type: "fixed", amountOff: 1000, minOrder: 4000, starts: "2026-07-10", ends: "2026-07-17", usageLimit: 10, perCustomer: 1, isActive: true, uptake: 0.9 },
  { code: "SAVE300", description: "Rs. 300 off orders over Rs. 3,000.", type: "fixed", amountOff: 300, minOrder: 3000, starts: "2026-06-01", ends: "2026-12-31", usageLimit: null, perCustomer: 2, isActive: true, uptake: 0.12 },
  { code: "TEEJ26", description: "Teej 2026: 12% off orders over Rs. 2,000 (up to Rs. 1,200).", type: "percentage", percentOff: 12, minOrder: 2000, maxDiscount: 1200, starts: "2026-09-01", ends: "2026-09-15", usageLimit: 300, perCustomer: 1, isActive: true, uptake: 0.45 },
  { code: "DASHAIN26", description: "Dashain 2026: 15% off orders over Rs. 3,000 (up to Rs. 1,500). Starts 1 October.", type: "percentage", percentOff: 15, minOrder: 3000, maxDiscount: 1500, starts: "2026-10-01", ends: "2026-10-25", usageLimit: 500, perCustomer: 2, isActive: true, uptake: 0 },
  { code: "VIP15", description: "Invite-only 15% code, disabled pending the loyalty programme.", type: "percentage", percentOff: 15, maxDiscount: 2000, starts: "2026-01-01", ends: null, usageLimit: 100, perCustomer: 1, isActive: false, uptake: 0 },
];

/* ---------- Store settings ---------- */

export const featureFlags = {
  ar_live_try_on: true,
  ar_photo_try_on: false,
  product_quick_view: true,
  reviews: true,
  wishlist: true,
  newsletter: true,
  guest_checkout: true,
};

/* ---------- Staff ---------- */

export type StaffSeed = {
  key: string;
  fullName: string;
  title: string;
  permissions: PermissionKey[];
};

export const OWNER = { key: "owner", fullName: "Sanjeev Maharjan" };

export const staffSeeds: StaffSeed[] = [
  {
    key: "catalog-manager",
    fullName: "Nirmala Gurung",
    title: "Catalog manager",
    permissions: ["catalog.read", "catalog.write", "inventory.write", "ar.manage", "content.manage", "promotions.manage", "analytics.read"],
  },
  {
    key: "fulfilment",
    fullName: "Bikash Tamang",
    title: "Fulfilment lead",
    permissions: ["orders.read", "orders.write", "inventory.write", "delivery.manage", "customers.read", "catalog.read"],
  },
  {
    key: "support",
    fullName: "Asmita Rai",
    title: "Customer support",
    permissions: ["orders.read", "customers.read", "reviews.manage", "catalog.read"],
  },
];

/* ---------- Order copy ---------- */

export const customerNotes = [
  "Please call before delivery.",
  "Please call before delivery, the lane is narrow.",
  "Leave it with the security guard if I'm not home.",
  "Deliver after 5 PM, I'm at the office before that.",
  "It's a gift, please don't include the invoice.",
  "Near the blue gate, second floor.",
  "House is behind the temple, call when you reach the chowk.",
  "Please deliver on Saturday if possible.",
  "Call my sister on the same number if I don't pick up.",
  "Please pack it well, it's a gift.",
  "Deliver before 10 AM please.",
  "Opposite the school, green building.",
];

export const festivalNotes = [
  "Needed before Dashain tika, please deliver quickly.",
  "For Tihar, please deliver before Bhai Tika.",
];

export const teejNotes = ["Needed for Teej, please deliver before the weekend."];

export const preDispatchCancelReasons = [
  "Customer requested cancellation.",
  "Customer ordered the wrong size and placed a new order.",
  "Could not reach the customer to confirm the order.",
  "Duplicate order.",
  "Customer changed their mind before dispatch.",
];

export const failedDeliveryReason = "Delivery failed after two attempts; parcel returned to the store.";

/* ---------- Reviews ---------- */

type Phrases = { positive: string[]; mixed: string[]; negative: string[] };

export const reviewPhrases: Record<ReviewKind, Phrases> = {
  jewelry: {
    positive: [
      "The finish is beautiful and it hasn't tarnished yet.",
      "Looks much more expensive than it is.",
      "earrings|Light enough to wear the whole day without my ears hurting.",
      "Got so many compliments at my cousin's wedding.",
      "Exactly like the photos, the gold tone is warm and not too yellow.",
      "festive|Wore it for Teej with my red saree and it was perfect.",
      "The packaging was lovely, I gave it as a gift.",
      "Delicate but sturdy, the clasp feels secure.",
    ],
    mixed: [
      "Pretty, but a little smaller than I expected.",
      "Nice design, the colour is slightly different from the photo.",
      "necklaces|Good for the price, though the chain tangles easily.",
    ],
    negative: [
      "The plating started fading after two weeks.",
      "One of the stones came loose on the first day.",
      "Much smaller than it looked in the pictures.",
    ],
  },
  eyewear: {
    positive: [
      "Fit my face well and the lenses are really clear.",
      "polarised|Great for riding my scooty, no glare at all.",
      "The case is solid and the cloth is a nice touch.",
      "ar|Tried them in AR first, and they look exactly the same in person.",
      "Took them to Pokhara, perfect for the lake.",
      "Lightweight, I forget I'm wearing them.",
    ],
    mixed: [
      "Good quality but a bit wide for my face.",
      "Nice lenses, the nose pads needed adjusting.",
    ],
    negative: [
      "The hinge was loose when it arrived.",
      "Scratched easily even though I kept them in the case.",
    ],
  },
  headwear: {
    positive: [
      "winter|Warm and soft, perfect for Kathmandu winter mornings.",
      "Fits well and doesn't itch.",
      "topi|My father loved the topi, the weave is very fine.",
      "The colour is lovely and it keeps its shape.",
      "winter|Wore it on the Nagarkot hike, very cosy.",
    ],
    mixed: [
      "Nice, but runs slightly small.",
      "Good quality, the colour is a bit darker than shown.",
    ],
    negative: ["winter|Started pilling after a few washes.", "Too tight for me, had to exchange it."],
  },
  scarf: {
    positive: [
      "pashmina|So soft and warm, and very light.",
      "pashmina|The pashmina is genuine quality, I compared it with one from Thamel.",
      "Bought one for my mother and one for myself.",
      "The colour is rich and exactly as pictured.",
      "winter|Perfect for evening functions in winter.",
      "Great gift for relatives abroad.",
    ],
    mixed: ["Beautiful but sheds a little at first.", "Lovely, though a bit smaller than I expected."],
    negative: ["Not as soft as I hoped for the price.", "The colour bled on the first hand wash."],
  },
  clothing: {
    positive: [
      "The fit is perfect and the fabric feels premium.",
      "sized|True to size, I ordered my usual M.",
      "Wore it to a wedding reception and felt great.",
      "Comfortable enough to wear all day.",
      "The stitching is neat and the colour is gorgeous.",
      "Washed it twice already, no shrinking or fading.",
      "Perfect for Dashain visits, my family loved it.",
      "winter|Really warm, exactly what I needed for December.",
    ],
    mixed: [
      "sized|Nice fabric but runs slightly large, size down.",
      "Good quality, the length is a bit long for me.",
      "The colour is lovely but it creases easily.",
    ],
    negative: [
      "The fabric is thinner than it looks in the photos.",
      "sized|Sizing is off, had to return it.",
      "A seam came loose after the first wash.",
    ],
  },
  footwear: {
    positive: [
      "Comfortable from day one, no bite at all.",
      "True to size and the cushioning is great.",
      "Walked around Durbar Square all day without any pain.",
      "Looks classy and goes with everything.",
      "monsoon|Good grip even on wet roads during the monsoon.",
    ],
    mixed: ["Nice shoes but a little narrow.", "Took a few days to break in."],
    negative: ["The sole started peeling within a month.", "Runs a full size small."],
  },
  bag: {
    positive: [
      "workwear|Roomy and well made, fits my laptop and lunch box.",
      "leather|The leather quality is excellent for the price.",
      "Sturdy handles and lots of pockets.",
      "Everyone asks where I got it.",
      "Carried it every day to college for months, still looks new.",
      "made-in-nepal|Love that it's made in Nepal and still looks so modern.",
    ],
    mixed: ["Nice bag, the strap is a bit short for me.", "Good quality, smaller than I imagined."],
    negative: ["The zip broke after two weeks.", "The colour is darker than the photos."],
  },
  watch: {
    positive: [
      "Elegant and keeps perfect time.",
      "The strap is comfortable and the dial is easy to read.",
      "unisex|Bought it as a gift for my husband, he loves it.",
      "Looks much more expensive than it is.",
    ],
    mixed: ["Nice watch, but the strap was stiff at first.", "Good, though the dial is smaller than I thought."],
    negative: ["Stopped working after a month.", "The strap buckle broke quickly."],
  },
};

export const deliveryPhrases = [
  "Arrived in {town} in {days} days.",
  "Delivered to {town} quicker than expected.",
  "The rider called before coming, very polite.",
  "Paying cash on delivery made it easy.",
  "Packaging was neat and secure.",
  "Reached {town} safely, nothing was damaged.",
];

export const reviewTitles = {
  5: ["Love it", "Absolutely beautiful", "Exactly as pictured", "Worth every rupee", "Great quality", "Perfect gift", "Highly recommend"],
  4: ["Really nice", "Very good", "Happy with it", "Good quality", "Nice purchase"],
  3: ["Okay for the price", "Good, not great", "Decent", "Mixed feelings"],
  2: ["Not as expected", "Disappointed", "Could be better"],
  1: ["Poor quality", "Would not buy again", "Very disappointed"],
} as const;

export const rejectedReviews = [
  { title: "Where is my order", body: "I placed an order and nobody is answering the phone. Please call me back.", note: "Order issue, forwarded to support." },
  { title: "Cheap prices here", body: "Visit my page for cheaper items and free delivery!!!", note: "Promotional content." },
  { title: "test", body: "test test review", note: "Spam or test content." },
  { title: "Wrong product", body: "This review is for a different item I bought at another shop.", note: "Not about this product." },
];
