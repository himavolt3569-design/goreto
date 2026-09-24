import Image from "next/image";
import type { Testimonial } from "@/features/catalog/types";
import { Card, QuotesIcon, ICON_WEIGHT_FILLED, SectionHeading } from "@/components/ui";

/** Omitted entirely when there are no published testimonials. */
export function Testimonials({ testimonials }: { testimonials: Testimonial[] }) {
  if (testimonials.length === 0) return null;

  return (
    <section
      aria-labelledby="testimonials-title"
      className="mx-auto w-full max-w-7xl px-4 pt-16 md:px-8"
    >
      <div data-animate="reveal">
        <SectionHeading
          id="testimonials-title"
          eyebrow="Real people, real confidence"
          title="Loved by Style Seekers"
          description="Hear from our community of happy shoppers."
        />
      </div>
      <ul className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
        {testimonials.map((testimonial) => (
          <li key={testimonial.id} data-animate="reveal" className="flex">
            <Card className="flex w-full p-6">
              <figure className="flex flex-1 flex-col gap-6">
                <div className="flex gap-3">
                  <QuotesIcon
                    aria-hidden="true"
                    size={32}
                    weight={ICON_WEIGHT_FILLED}
                    className="shrink-0 text-primary-300"
                  />
                  <blockquote className="text-body text-neutral-700">
                    <p>{testimonial.quote}</p>
                  </blockquote>
                </div>
                <figcaption className="mt-auto flex items-center gap-3">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-neutral-100">
                    <Image
                      src={testimonial.avatar.src}
                      alt={testimonial.avatar.alt}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-body font-semibold text-neutral-900">
                      {testimonial.authorName}
                    </span>
                    <span className="text-small text-neutral-500">{testimonial.authorLabel}</span>
                  </span>
                </figcaption>
              </figure>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
