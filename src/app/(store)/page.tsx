import { HomeMotion } from "@/components/motion/home-motion";
import { CategoryRail } from "@/components/store/home/category-rail";
import { CollectionCarousel } from "@/components/store/home/collection-carousel";
import { FeaturedProducts } from "@/components/store/home/featured-products";
import { Hero } from "@/components/store/home/hero";
import { HowItWorks } from "@/components/store/home/how-it-works";
import { Newsletter } from "@/components/store/home/newsletter";
import { Testimonials } from "@/components/store/home/testimonials";
import { SectionHeading } from "@/components/ui";
import { getHomepageData } from "@/features/catalog/homepage";

export default async function HomePage() {
  const { categories, featuredProducts, collections, testimonials } = await getHomepageData();

  return (
    <HomeMotion>
      <Hero />

      <CategoryRail categories={categories} />

      <section
        id="featured"
        aria-labelledby="featured-title"
        className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 pt-12 md:px-8 md:pt-16"
      >
        <FeaturedProducts
          products={featuredProducts}
          heading={
            <SectionHeading
              id="featured-title"
              eyebrow="Featured products"
              title="Handpicked Just for You"
              description="Discover standout styles loved for their quality and design."
            />
          }
        />
      </section>

      {collections.length > 0 ? (
        <section
          aria-label="Collections"
          className="mx-auto w-full max-w-7xl px-4 pt-12 md:px-8 md:pt-16"
        >
          <div data-animate="reveal">
            <CollectionCarousel collections={collections} />
          </div>
        </section>
      ) : null}

      <HowItWorks />

      <Testimonials testimonials={testimonials} />

      <Newsletter />
    </HomeMotion>
  );
}
