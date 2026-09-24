import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  CameraIcon,
  CaretDownIcon,
  ChatCircleDotsIcon,
  CubeIcon,
  EyeIcon,
  GiftIcon,
  HandbagIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PersonArmsSpreadIcon,
  PlayCircleIcon,
  ScanSmileyIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  SquaresFourIcon,
  StarIcon,
  TagIcon,
  TruckIcon,
  UserIcon,
} from "@/components/ui/icons";
import type { Icon } from "@/components/ui/icons";
import {
  Badge,
  Button,
  CartButton,
  Field,
  ICON_SIZE,
  ICON_SIZE_SM,
  ICON_WEIGHT_FILLED,
  ICON_WEIGHT_OUTLINE,
  IconButton,
  Input,
  Logo,
  LookbookCard,
  NavItem,
  OrderStatusPill,
  ProductCard,
  ProgressBar,
  ResourceCard,
  SearchInput,
  Select,
  StatusIndicator,
  VideoCard,
  type BadgeTone,
  type IndicatorStatus,
  type OrderStatus,
} from "@/components/ui";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Design System",
  robots: { index: false, follow: false },
};

// Living style guide for comparing against designs/Goreto-designsystem.png.
// Development only; links point at in-page anchors and media uses placeholders.

const primarySwatches = [
  { name: "Primary 500", hex: "#F97316", className: "bg-primary-500" },
  { name: "Primary 400", hex: "#FB923C", className: "bg-primary-400" },
  { name: "Primary 300", hex: "#FDBA74", className: "bg-primary-300" },
  { name: "Primary 200", hex: "#FED7AA", className: "bg-primary-200" },
  { name: "Primary 100", hex: "#FFF2E4", className: "bg-primary-100" },
];

const neutralSwatches = [
  { name: "Neutral 900", hex: "#0F172A", className: "bg-neutral-900" },
  { name: "Neutral 700", hex: "#334155", className: "bg-neutral-700" },
  { name: "Neutral 500", hex: "#64748B", className: "bg-neutral-500" },
  { name: "Neutral 300", hex: "#CBD5E1", className: "bg-neutral-300" },
  { name: "Neutral 200", hex: "#E2E8F0", className: "bg-neutral-200" },
  { name: "Neutral 100", hex: "#F1F5F9", className: "bg-neutral-100" },
  { name: "Neutral 50", hex: "#FAFAFB", className: "bg-neutral-50" },
  { name: "White", hex: "#FFFFFF", className: "bg-white" },
];

const typeScale = [
  { style: "Display 1", font: "Playfair Display", size: "48 / 56", weight: "Bold", use: "Hero titles", className: "font-display text-display-1" },
  { style: "Display 2", font: "Playfair Display", size: "36 / 44", weight: "Bold", use: "Section titles", className: "font-display text-display-2" },
  { style: "Heading 1", font: "Inter", size: "28 / 36", weight: "Semibold", use: "Product titles", className: "text-h1" },
  { style: "Heading 2", font: "Inter", size: "22 / 30", weight: "Semibold", use: "Card titles", className: "text-h2" },
  { style: "Heading 3", font: "Inter", size: "18 / 26", weight: "Medium", use: "Section labels", className: "text-h3" },
  { style: "Body Large", font: "Inter", size: "16 / 24", weight: "Regular", use: "Body copy", className: "text-body-lg" },
  { style: "Body", font: "Inter", size: "14 / 20", weight: "Regular", use: "Supporting text", className: "text-body" },
  { style: "Small", font: "Inter", size: "12 / 16", weight: "Regular", use: "Captions, meta", className: "text-small" },
];

const spacing = [
  { px: 4, rem: "0.25rem", className: "size-1" },
  { px: 8, rem: "0.5rem", className: "size-2" },
  { px: 12, rem: "0.75rem", className: "size-3" },
  { px: 16, rem: "1rem", className: "size-4" },
  { px: 24, rem: "1.5rem", className: "size-6" },
  { px: 32, rem: "2rem", className: "size-8" },
  { px: 40, rem: "2.5rem", className: "size-10" },
  { px: 48, rem: "3rem", className: "size-12" },
  { px: 64, rem: "4rem", className: "size-16" },
];

const radii = [
  { label: "4px", name: "xs", className: "rounded-xs" },
  { label: "8px", name: "sm", className: "rounded-sm" },
  { label: "12px", name: "md", className: "rounded-md" },
  { label: "16px", name: "lg", className: "rounded-lg" },
  { label: "24px", name: "xl", className: "rounded-xl" },
  { label: "Full", name: "circle", className: "rounded-full" },
];

const shadows = [
  { name: "Sm", value: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", className: "shadow-sm" },
  { name: "Md", value: "0 4px 12px -2px rgba(0, 0, 0, 0.08)", className: "shadow-md" },
  { name: "Lg", value: "0 12px 24px -4px rgba(0, 0, 0, 0.10)", className: "shadow-lg" },
  { name: "Xl", value: "0 20px 40px -8px rgba(0, 0, 0, 0.12)", className: "shadow-xl" },
];

const icons: { name: string; icon: Icon }[] = [
  { name: "Search", icon: MagnifyingGlassIcon },
  { name: "Wishlist", icon: HeartIcon },
  { name: "Bag", icon: HandbagIcon },
  { name: "Cart", icon: ShoppingCartIcon },
  { name: "Profile", icon: UserIcon },
  { name: "Delivery", icon: TruckIcon },
  { name: "Camera", icon: CameraIcon },
  { name: "Gift", icon: GiftIcon },
  { name: "Play", icon: PlayCircleIcon },
  { name: "Rating", icon: StarIcon },
  { name: "Offer", icon: TagIcon },
  { name: "Location", icon: MapPinIcon },
  { name: "Support", icon: ChatCircleDotsIcon },
  { name: "AR Try-On", icon: ScanSmileyIcon },
];

const badges: { tone: BadgeTone; label: string }[] = [
  { tone: "new", label: "New" },
  { tone: "bestseller", label: "Bestseller" },
  { tone: "limited", label: "Limited" },
  { tone: "cod", label: "COD" },
  { tone: "ar-ready", label: "AR Ready" },
];

const indicators: IndicatorStatus[] = [
  "in_stock",
  "low_stock",
  "sold_out",
  "now_playing",
  "ar_live",
];

const orderStatuses: OrderStatus[] = [
  "pending_confirmation",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "canceled",
];

const principles: { title: string; body: string; icon: Icon }[] = [
  { title: "Clarity First", body: "Present information clearly and reduce cognitive load.", icon: EyeIcon },
  { title: "Consistency", body: "Use consistent patterns across the platform.", icon: SquaresFourIcon },
  { title: "Confidence & Trust", body: "Secure, transparent and reliable shopping experiences.", icon: ShieldCheckIcon },
  { title: "Accessible by Default", body: "Design for everyone, including all abilities and devices.", icon: PersonArmsSpreadIcon },
];

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 md:px-8">
      <div className="grid gap-4 lg:grid-flow-dense lg:grid-cols-12">
        {/* Intro */}
        <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm lg:col-span-5">
          <Logo />
          <h1 className="font-display text-display-1 text-neutral-900">Design System</h1>
          <p className="text-body-lg text-neutral-700">
            A clean, premium design language for Goreto.store. Built for clarity, trust,
            fashion discovery, and AR shopping experiences.
          </p>
          <p className="mt-auto text-small font-medium uppercase tracking-wide text-neutral-500">
            Version 1.0 • Sept 2026
          </p>
        </section>

        {/* 01 Colors */}
        <Section number="01" title="Colors" className="lg:col-span-7">
          <SubLabel>Primary – Warm &amp; Vibrant</SubLabel>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
            {primarySwatches.map((swatch) => (
              <Swatch key={swatch.hex} {...swatch} />
            ))}
          </div>
          <SubLabel>Neutral – Charcoal &amp; Warm Grey</SubLabel>
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
            {neutralSwatches.map((swatch) => (
              <Swatch key={swatch.hex} {...swatch} />
            ))}
          </div>
        </Section>

        {/* 02 Typography */}
        <Section number="02" title="Typography" className="lg:col-span-5">
          <div className="flex items-center gap-8">
            <span aria-hidden="true" className="font-display text-display-1">Ag</span>
            <div>
              <p className="font-display text-h1 font-normal">Playfair Display</p>
              <p className="text-body-lg text-neutral-500">Elegant • Premium • Expressive</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <span aria-hidden="true" className="text-display-1 font-semibold">Ag</span>
            <div>
              <p className="text-h1 font-normal">Inter</p>
              <p className="text-body-lg text-neutral-500">Clean • Modern • Highly legible</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
            {typeScale.map((row) => (
              <p key={row.style} className={cn("text-neutral-900", row.className)}>
                {row.style}
              </p>
            ))}
          </div>
        </Section>

        {/* 03 Type scale */}
        <Section number="03" title="Type Scale" className="lg:col-span-7">
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-body">
              <caption className="sr-only">Type scale</caption>
              <thead className="text-small text-neutral-500">
                <tr>
                  <th scope="col" className="pb-2 font-medium">Style</th>
                  <th scope="col" className="pb-2 font-medium">Font</th>
                  <th scope="col" className="pb-2 font-medium">Size / Line Height</th>
                  <th scope="col" className="pb-2 font-medium">Weight</th>
                  <th scope="col" className="pb-2 font-medium">Use</th>
                </tr>
              </thead>
              <tbody className="text-neutral-500">
                {typeScale.map((row) => (
                  <tr key={row.style}>
                    <th scope="row" className="py-1 text-body-lg font-medium text-neutral-900">
                      {row.style}
                    </th>
                    <td className="py-1">{row.font}</td>
                    <td className="py-1">{row.size}</td>
                    <td className="py-1">{row.weight}</td>
                    <td className="py-1">{row.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 04 Spacing */}
        <Section number="04" title="Spacing System" className="lg:col-span-6">
          <SubLabel>Base unit: 4px</SubLabel>
          <ul className="grid grid-cols-5 items-end gap-x-2 gap-y-4 sm:grid-cols-9">
            {spacing.map((step) => (
              <li key={step.px} className="flex flex-col items-center gap-2">
                <span aria-hidden="true" className={cn("rounded-xs bg-primary-200", step.className)} />
                <span className="text-small font-medium text-neutral-900">{step.px}</span>
                <span className="text-small text-neutral-500">({step.rem})</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* 05 Radius & Shadows */}
        <Section number="05" title="Radius & Shadows" className="lg:col-span-6">
          <SubLabel>Radius</SubLabel>
          <ul className="flex flex-wrap gap-6">
            {radii.map((radius) => (
              <li key={radius.name} className="flex flex-col items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn("size-12 border border-neutral-200 bg-white shadow-sm", radius.className)}
                />
                <span className="text-center text-small text-neutral-700">
                  {radius.label}
                  <br />
                  <span className="text-neutral-500">({radius.name})</span>
                </span>
              </li>
            ))}
          </ul>
          <SubLabel>Shadows</SubLabel>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {shadows.map((shadow) => (
              <li key={shadow.name} className={cn("rounded-md bg-white p-3", shadow.className)}>
                <p className="text-body font-semibold text-neutral-900">{shadow.name}</p>
                <p className="text-small text-neutral-500">{shadow.value}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* 06 Icons */}
        <Section number="06" title="Icons" className="lg:col-span-4">
          <SubLabel>Outline Style</SubLabel>
          <IconGrid weight="outline" />
          <SubLabel>Filled Style</SubLabel>
          <IconGrid weight="filled" />
          <SpecList
            title="Icon Specs"
            items={[
              "24×24px grid",
              "~2px stroke (Phosphor bold)",
              "Rounded line caps & corners",
              "Filled only for active states",
            ]}
          />
        </Section>

        {/* 07 Buttons */}
        <Section number="07" title="Buttons" className="lg:col-span-8">
          <div className="overflow-x-auto">
            <div className="grid w-max grid-cols-[repeat(5,max-content)] items-center justify-items-start gap-x-6 gap-y-3">
              <span />
              {["Primary", "Secondary", "Tertiary", "Text"].map((label) => (
                <span key={label} className="text-small text-neutral-500">{label}</span>
              ))}

              <RowLabel>Default</RowLabel>
              <Button size="md">Shop Now</Button>
              <Button size="md" variant="secondary" leadingIcon={<CubeIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} aria-hidden="true" />}>
                Try in AR
              </Button>
              <Button size="md" variant="tertiary" leadingIcon={<HandbagIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} aria-hidden="true" />}>
                Add to Cart
              </Button>
              <Button size="md" variant="text" trailingIcon={<ArrowRightIcon size={ICON_SIZE_SM - 4} weight={ICON_WEIGHT_OUTLINE} aria-hidden="true" />}>
                View Details
              </Button>

              <RowLabel>Hover</RowLabel>
              <Button size="md" className="bg-primary-600">Shop Now</Button>
              <Button size="md" variant="secondary" className="bg-primary-100" leadingIcon={<CubeIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} aria-hidden="true" />}>
                Try in AR
              </Button>
              <Button size="md" variant="tertiary" className="bg-neutral-100" leadingIcon={<HandbagIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} aria-hidden="true" />}>
                Add to Cart
              </Button>
              <Button size="md" variant="text" className="text-primary-600 underline" trailingIcon={<ArrowRightIcon size={ICON_SIZE_SM - 4} weight={ICON_WEIGHT_OUTLINE} aria-hidden="true" />}>
                View Details
              </Button>

              <RowLabel>Disabled</RowLabel>
              <Button size="md" disabled>Shop Now</Button>
              <Button size="md" variant="secondary" disabled leadingIcon={<CubeIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} aria-hidden="true" />}>
                Try in AR
              </Button>
              <Button size="md" variant="tertiary" disabled leadingIcon={<HandbagIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} aria-hidden="true" />}>
                Add to Cart
              </Button>
              <Button size="md" variant="text" disabled trailingIcon={<ArrowRightIcon size={ICON_SIZE_SM - 4} weight={ICON_WEIGHT_OUTLINE} aria-hidden="true" />}>
                View Details
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button>Large (16px padding)</Button>
            <Button loading>Placing order</Button>
          </div>
          <SpecList
            title="Button Specs"
            items={[
              "Height: 44px (default)",
              "Padding: 0 16px (lg), 0 12px (md)",
              "Radius: 12px",
              "Font: Inter Medium (14–16px)",
              "Icon spacing: 8px",
            ]}
          />
        </Section>

        {/* 08 Inputs */}
        <Section number="08" title="Inputs" className="lg:col-span-4 lg:row-span-2">
          <Field label="Search / Text Input">
            {(control) => (
              <SearchInput
                {...control}
                placeholder="Search dresses, jewelry, bags…"
                trailing={
                  <IconButton
                    label="Filters"
                    size="sm"
                    icon={<SlidersHorizontalIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
                  />
                }
              />
            )}
          </Field>
          <Field label="Select">
            {(control) => (
              <Select {...control} defaultValue="relevant">
                <option value="relevant">Most Relevant</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </Select>
            )}
          </Field>
          <Field label="Phone number" error="Enter a valid Nepal mobile number." required>
            {(control) => (
              <Input {...control} inputMode="tel" defaultValue="98123" autoComplete="tel-national" />
            )}
          </Field>
          <SpecList
            title="Field Specs"
            items={[
              "Height: 44px",
              "Radius: 12px",
              "Border: 1px solid #E2E8F0",
              "Padding: 0 16px",
              "Focus: Border color #F97316",
            ]}
          />
        </Section>

        {/* 09 Badges */}
        <Section number="09" title="Badges / Tags" className="lg:col-span-4">
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <Badge key={badge.tone} tone={badge.tone}>{badge.label}</Badge>
            ))}
          </div>
        </Section>

        {/* 10 Status */}
        <Section number="10" title="Status / Indicators" className="lg:col-span-8">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {indicators.map((status) => (
              <StatusIndicator key={status} status={status} />
            ))}
          </div>
          <SubLabel>Order status</SubLabel>
          <div className="flex flex-wrap gap-2">
            {orderStatuses.map((status) => (
              <OrderStatusPill key={status} status={status} />
            ))}
          </div>
        </Section>

        {/* 11 Progress */}
        <Section number="11" title="Progress Bar" className="lg:col-span-4">
          <ProgressBar label="Uploading product media" value={35} />
        </Section>

        {/* 12 Cards */}
        <Section number="12" title="Cards" className="lg:col-span-12" id="cards">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <CardSample label="Product Card">
              <ProductCard
                layout="horizontal"
                title="Pearl Drop Earrings"
                href="#cards"
                pricePaisa={249900}
                badge={{ tone: "bestseller", label: "Bestseller" }}
                rating={{ value: 4.8, count: 120 }}
                wishlistAction={
                  <IconButton
                    label="Add Pearl Drop Earrings to wishlist"
                    size="sm"
                    icon={<HeartIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
                  />
                }
                cartAction={
                  <IconButton
                    label="Add Pearl Drop Earrings to cart"
                    size="sm"
                    variant="soft"
                    icon={<HandbagIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
                  />
                }
              />
            </CardSample>
            <CardSample label="Lookbook Card">
              <LookbookCard
                title="Festive Jewelry Edit"
                description="Tradition meets modern style for every celebration."
                href="#cards"
              />
            </CardSample>
            <CardSample label="Video Card">
              <VideoCard
                title="How it looks on you"
                description="See real fit with our AR try-on."
                href="#cards"
                duration="0:28"
                isPlaying
              />
            </CardSample>
            <CardSample label="Resource Card">
              <ResourceCard
                title="Size & Care Guide"
                description="Find your perfect fit and keep it looking new."
                href="#cards"
                meta={["PDF", "1.2 MB"]}
              />
            </CardSample>
          </div>
          <SubLabel>Product Card — grid layout (homepage)</SubLabel>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { title: "Pearl Drop Earrings", price: 249900 },
              { title: "Classic Top Handle Bag", price: 399900 },
              { title: "Floral A-Line Dress", price: 289900 },
            ].map((product) => (
              <ProductCard
                key={product.title}
                title={product.title}
                href="#cards"
                pricePaisa={product.price}
                wishlistAction={
                  <IconButton
                    label={`Add ${product.title} to wishlist`}
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    icon={<HeartIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
                  />
                }
                cartAction={
                  <IconButton
                    label={`Add ${product.title} to cart`}
                    size="sm"
                    variant="primary"
                    icon={<HandbagIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
                  />
                }
              />
            ))}
          </div>
        </Section>

        {/* 13 Navigation */}
        <Section number="13" title="Navigation" className="lg:col-span-12" id="navigation">
          <nav
            aria-label="Example storefront"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md lg:flex-nowrap border border-neutral-200 bg-white px-4 py-2"
          >
            <Logo href="#navigation" />
            <ul className="flex flex-wrap items-center gap-1 lg:flex-nowrap">
              <li><NavItem href="#navigation" active>Go to Store</NavItem></li>
              <li>
                <NavItem
                  href="#navigation"
                  trailingIcon={<CaretDownIcon size={ICON_SIZE_SM - 4} weight={ICON_WEIGHT_OUTLINE} />}
                >
                  Categories
                </NavItem>
              </li>
              <li><NavItem href="#navigation" icon={<CubeIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}>AR Try-On</NavItem></li>
              <li><NavItem href="#navigation" icon={<TruckIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}>Delivery</NavItem></li>
              <li><NavItem href="#navigation" icon={<HeartIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}>Wishlist</NavItem></li>
              <li><NavItem href="#navigation" icon={<UserIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}>Profile</NavItem></li>
            </ul>
            <div className="ml-auto flex w-full items-center gap-2 lg:w-auto">
              <form role="search" action="#navigation" className="flex-1 lg:w-56 lg:flex-none">
                <SearchInput aria-label="Search products" placeholder="Search products…" name="q" />
              </form>
              <CartButton href="#navigation" count={3} />
            </div>
          </nav>
        </Section>

        {/* 14 Principles */}
        <Section number="14" title="Principles" className="lg:col-span-12">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map(({ title, body, icon: PrincipleIcon }) => (
              <li key={title} className="flex items-start gap-4">
                <PrincipleIcon
                  aria-hidden="true"
                  size={32}
                  weight={ICON_WEIGHT_OUTLINE}
                  className="shrink-0 text-neutral-900"
                />
                <div>
                  <p className="text-body font-semibold text-neutral-900">{title}</p>
                  <p className="text-small text-neutral-500">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  );
}

function Section({
  number,
  title,
  className,
  id,
  children,
}: {
  number: string;
  title: string;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  const headingId = `section-${number}`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm",
        className,
      )}
    >
      <h2 id={headingId} className="flex items-center gap-4 text-body font-semibold uppercase tracking-widest text-neutral-900">
        <span className="text-primary-500">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
  return <p className="text-body font-medium text-neutral-900">{children}</p>;
}

function RowLabel({ children }: { children: ReactNode }) {
  return <span className="pr-2 text-small text-neutral-700">{children}</span>;
}

function Swatch({ name, hex, className }: { name: string; hex: string; className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden="true" className={cn("h-12 rounded-sm border border-neutral-200", className)} />
      <span className="text-small text-neutral-700">
        {name}
        <br />
        <span className="text-neutral-500">{hex}</span>
      </span>
    </div>
  );
}

function IconGrid({ weight }: { weight: "outline" | "filled" }) {
  return (
    <ul className="grid grid-cols-7 gap-3">
      {icons.map(({ name, icon: GridIcon }) => (
        <li key={name} className="flex">
          <GridIcon
            size={ICON_SIZE}
            weight={weight === "outline" ? ICON_WEIGHT_OUTLINE : ICON_WEIGHT_FILLED}
            className="text-neutral-900"
            aria-label={name}
            role="img"
          />
        </li>
      ))}
    </ul>
  );
}

function SpecList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-auto flex flex-col gap-1">
      <p className="text-body font-medium text-neutral-900">{title}</p>
      <ul className="list-disc pl-5 text-small text-neutral-500">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function CardSample({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <SubLabel>{label}</SubLabel>
      {children}
    </div>
  );
}
