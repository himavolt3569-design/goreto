/**
 * Row shapes written to `supabase/seed.ndjson`. They follow AGENTS §11 and are
 * the contract the database migration will implement. Timestamps are UTC ISO
 * strings, dates are `YYYY-MM-DD`, money is integer paisa.
 */

export type Uuid = string;
export type Timestamp = string;
export type IsoDate = string;

export type Role = "customer" | "owner" | "staff";

export type PermissionKey =
  | "analytics.read"
  | "catalog.read"
  | "catalog.write"
  | "inventory.write"
  | "orders.read"
  | "orders.write"
  | "customers.read"
  | "reviews.manage"
  | "promotions.manage"
  | "content.manage"
  | "ar.manage"
  | "delivery.manage"
  | "settings.manage"
  | "staff.manage";

export type ProductStatus = "draft" | "active" | "archived";
export type ArMode = "live_2d" | "live_3d" | "photo_ai";
export type ArPlacement =
  | "ear"
  | "face"
  | "neck"
  | "wrist"
  | "hand"
  | "upper_body"
  | "full_body"
  | "freeform";
export type ReviewStatus = "pending" | "published" | "rejected";
export type CouponType = "fixed" | "percentage";
export type IntegrationMode = "manual" | "api";
export type ServiceLevel = "standard" | "express" | "pickup";
export type OrderStatus =
  | "pending_confirmation"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "canceled";
export type PaymentStatus = "pending" | "collected" | "failed" | "refunded";
export type ShipmentStatus =
  | "awaiting_assignment"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "returned";
export type MunicipalityType =
  | "metropolitan_city"
  | "sub_metropolitan_city"
  | "municipality"
  | "rural_municipality";

type Timestamps = { created_at: Timestamp; updated_at: Timestamp };

export type StoreSettingsRow = Timestamps & {
  id: Uuid;
  store_name: string;
  tagline: string;
  support_email: string | null;
  support_phone_e164: string | null;
  currency: "NPR";
  timezone: "Asia/Kathmandu";
  country_code: "NP";
  phone_country_code: "+977";
  order_number_prefix: string;
  cod_enabled: boolean;
  cod_max_order_paisa: number | null;
  returns_window_days: number;
  default_low_stock_threshold: number;
  dispatch_municipality_code: string;
  feature_flags: Record<string, boolean>;
  social_links: Record<string, string | null>;
};

export type ProvinceRow = { code: string; number: number; name: string; sort_order: number };
export type DistrictRow = { code: string; province_code: string; name: string; sort_order: number };
export type MunicipalityRow = {
  code: string;
  district_code: string;
  name: string;
  type: MunicipalityType;
  ward_count: number;
  postal_code: string | null;
  latitude: number;
  longitude: number;
};

export type ProfileRow = Timestamps & {
  id: Uuid;
  clerk_user_id: string;
  full_name: string | null;
  email: string | null;
  phone_e164: string | null;
  role: Role;
  deleted_at: Timestamp | null;
};

export type StaffPermissionRow = {
  id: Uuid;
  profile_id: Uuid;
  permission_key: PermissionKey;
  granted_by: Uuid;
  created_at: Timestamp;
};

export type CustomerAddressRow = Timestamps & {
  id: Uuid;
  user_id: Uuid;
  label: string;
  recipient_name: string;
  phone_e164: string;
  province_code: string;
  district_code: string;
  municipality_code: string;
  ward: number;
  street_landmark: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

export type CategoryRow = Timestamps & {
  id: Uuid;
  parent_id: Uuid | null;
  title: string;
  slug: string;
  description: string;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ProductOptionJson = {
  name: string;
  values: { value: string; label: string; swatch_hex: string | null }[];
};

export type ProductRow = Timestamps & {
  id: Uuid;
  category_id: Uuid;
  title: string;
  slug: string;
  short_description: string;
  description: string;
  base_price_paisa: number;
  compare_at_price_paisa: number | null;
  status: ProductStatus;
  is_featured: boolean;
  is_bestseller: boolean;
  is_limited_edition: boolean;
  low_stock_threshold: number;
  options: ProductOptionJson[];
  specs: { label: string; value: string }[];
  care_instructions: string;
  tags: string[];
  published_at: Timestamp | null;
  archived_at: Timestamp | null;
};

export type ProductVariantRow = Timestamps & {
  id: Uuid;
  product_id: Uuid;
  sku: string;
  title: string;
  option_values: Record<string, string>;
  price_paisa: number | null;
  stock_quantity: number;
  weight_grams: number;
  sort_order: number;
  is_active: boolean;
};

export type ProductMediaRow = {
  id: Uuid;
  product_id: Uuid;
  variant_id: Uuid | null;
  kind: "image" | "video";
  storage_path: string;
  alt_text: string;
  sort_order: number;
  created_at: Timestamp;
};

export type ProductArAssetRow = Timestamps & {
  id: Uuid;
  product_id: Uuid;
  variant_id: Uuid | null;
  mode: ArMode;
  placement: ArPlacement;
  asset_path: string;
  asset_format: "png" | "glb";
  calibration: {
    anchor: string;
    scale: number;
    offset_x: number;
    offset_y: number;
    rotation_deg: number;
  };
  is_active: boolean;
};

export type CollectionRow = Timestamps & {
  id: Uuid;
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  hero_image_path: string;
  hero_image_alt: string;
  sort_order: number;
  is_active: boolean;
  starts_at: Timestamp | null;
  ends_at: Timestamp | null;
};

export type CollectionProductRow = {
  collection_id: Uuid;
  product_id: Uuid;
  sort_order: number;
};

export type CourierRow = Timestamps & {
  id: Uuid;
  name: string;
  slug: string;
  logo_path: string | null;
  support_phone: string | null;
  website_url: string | null;
  integration_mode: IntegrationMode;
  is_active: boolean;
};

export type CourierServiceRow = Timestamps & {
  id: Uuid;
  courier_id: Uuid;
  name: string;
  service_code: string;
  service_level: ServiceLevel;
  description: string;
  estimated_min_days: number;
  estimated_max_days: number;
  is_active: boolean;
};

export type DeliveryZoneRow = Timestamps & {
  id: Uuid;
  name: string;
  slug: string;
  description: string;
  district_codes: string[];
  sort_order: number;
  is_active: boolean;
};

export type DeliveryRateRow = Timestamps & {
  id: Uuid;
  zone_id: Uuid;
  courier_service_id: Uuid;
  price_paisa: number;
  estimated_min_days: number | null;
  estimated_max_days: number | null;
  min_weight_grams: number | null;
  max_weight_grams: number | null;
  min_order_paisa: number | null;
  is_active: boolean;
};

export type CouponRow = Timestamps & {
  id: Uuid;
  code: string;
  description: string;
  type: CouponType;
  percent_off: number | null;
  amount_off_paisa: number | null;
  min_order_paisa: number | null;
  max_discount_paisa: number | null;
  starts_at: Timestamp;
  ends_at: Timestamp | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  times_used: number;
  is_active: boolean;
};

export type AddressSnapshot = {
  recipient_name: string;
  phone_e164: string;
  province_code: string;
  province_name: string;
  district_code: string;
  district_name: string;
  municipality_code: string;
  municipality_name: string;
  ward: number;
  street_landmark: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type DeliverySnapshot = {
  zone_id: Uuid;
  zone_name: string;
  courier_id: Uuid;
  courier_name: string;
  courier_service_id: Uuid;
  service_name: string;
  service_level: ServiceLevel;
  price_paisa: number;
  estimated_min_days: number;
  estimated_max_days: number;
};

export type OrderRow = Timestamps & {
  id: Uuid;
  order_number: string;
  user_id: Uuid | null;
  contact_name: string;
  contact_email: string;
  contact_phone_e164: string;
  shipping_address: AddressSnapshot;
  status: OrderStatus;
  payment_method: "cod";
  payment_status: PaymentStatus;
  currency: "NPR";
  subtotal_paisa: number;
  discount_paisa: number;
  delivery_fee_paisa: number;
  total_paisa: number;
  courier_service_id: Uuid;
  delivery_snapshot: DeliverySnapshot;
  coupon_id: Uuid | null;
  coupon_code: string | null;
  customer_note: string | null;
  guest_tracking_hash: string | null;
  confirmed_at: Timestamp | null;
  packed_at: Timestamp | null;
  shipped_at: Timestamp | null;
  delivered_at: Timestamp | null;
  canceled_at: Timestamp | null;
  cancellation_reason: string | null;
  payment_collected_at: Timestamp | null;
  refunded_at: Timestamp | null;
};

export type OrderItemRow = {
  id: Uuid;
  order_id: Uuid;
  product_id: Uuid;
  variant_id: Uuid;
  product_title: string;
  variant_title: string | null;
  sku: string;
  image_path: string;
  unit_price_paisa: number;
  quantity: number;
  line_total_paisa: number;
  created_at: Timestamp;
};

export type ShipmentRow = Timestamps & {
  id: Uuid;
  order_id: Uuid;
  courier_id: Uuid | null;
  courier_service_id: Uuid;
  tracking_number: string | null;
  status: ShipmentStatus;
  estimated_delivery_from: IsoDate;
  estimated_delivery_to: IsoDate;
  assigned_at: Timestamp | null;
  delivered_at: Timestamp | null;
};

export type ShipmentEventRow = {
  id: Uuid;
  shipment_id: Uuid;
  status: ShipmentStatus;
  message: string;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  source: "system" | "staff" | "courier_manual";
  occurred_at: Timestamp;
  created_at: Timestamp;
};

export type ReviewRow = Timestamps & {
  id: Uuid;
  user_id: Uuid;
  product_id: Uuid;
  order_item_id: Uuid | null;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  moderated_by: Uuid | null;
  moderated_at: Timestamp | null;
  moderation_note: string | null;
};

export type WishlistItemRow = {
  id: Uuid;
  user_id: Uuid;
  product_id: Uuid;
  created_at: Timestamp;
};

export type NewsletterSubscriberRow = {
  id: Uuid;
  email: string;
  profile_id: Uuid | null;
  status: "subscribed" | "unsubscribed";
  source: "homepage" | "checkout" | "account";
  subscribed_at: Timestamp;
  unsubscribed_at: Timestamp | null;
};

/** Every table the seed writes, in foreign-key order. */
export type SeedTables = {
  nepal_provinces: ProvinceRow;
  nepal_districts: DistrictRow;
  nepal_municipalities: MunicipalityRow;
  store_settings: StoreSettingsRow;
  profiles: ProfileRow;
  staff_permissions: StaffPermissionRow;
  customer_addresses: CustomerAddressRow;
  categories: CategoryRow;
  products: ProductRow;
  product_variants: ProductVariantRow;
  product_media: ProductMediaRow;
  product_ar_assets: ProductArAssetRow;
  collections: CollectionRow;
  collection_products: CollectionProductRow;
  couriers: CourierRow;
  courier_services: CourierServiceRow;
  delivery_zones: DeliveryZoneRow;
  delivery_rates: DeliveryRateRow;
  coupons: CouponRow;
  orders: OrderRow;
  order_items: OrderItemRow;
  shipments: ShipmentRow;
  shipment_events: ShipmentEventRow;
  reviews: ReviewRow;
  wishlist_items: WishlistItemRow;
  newsletter_subscribers: NewsletterSubscriberRow;
};

export type TableName = keyof SeedTables;

export const TABLE_ORDER: readonly TableName[] = [
  "nepal_provinces",
  "nepal_districts",
  "nepal_municipalities",
  "store_settings",
  "profiles",
  "staff_permissions",
  "customer_addresses",
  "categories",
  "products",
  "product_variants",
  "product_media",
  "product_ar_assets",
  "collections",
  "collection_products",
  "couriers",
  "courier_services",
  "delivery_zones",
  "delivery_rates",
  "coupons",
  "orders",
  "order_items",
  "shipments",
  "shipment_events",
  "reviews",
  "wishlist_items",
  "newsletter_subscribers",
];

/** Loader-only hints; never inserted as columns. */
export type DevHints = {
  placeholder_url?: string;
  tracking_secret?: string;
};

export type SeedLine<T extends TableName = TableName> = {
  table: T;
  data: SeedTables[T];
  dev?: DevHints;
};
