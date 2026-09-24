import type { MediaImage } from "@/components/ui/media-frame";

/** Homepage view models: the minimum each section needs, never whole DB rows. */

export type HomeCategory = {
  slug: string;
  title: string;
  image: MediaImage;
};

export type HomeProduct = {
  slug: string;
  title: string;
  categorySlug: string;
  pricePaisa: number;
  image: MediaImage;
};

export type HomeCollection = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  image: MediaImage;
};

export type Testimonial = {
  id: string;
  quote: string;
  authorName: string;
  authorLabel: string;
  avatar: MediaImage;
};

export type HomepageData = {
  categories: HomeCategory[];
  featuredProducts: HomeProduct[];
  collections: HomeCollection[];
  testimonials: Testimonial[];
};
