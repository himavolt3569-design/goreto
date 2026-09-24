import { NewsletterForm } from "./newsletter-form";

export function Newsletter() {
  return (
    <section
      aria-labelledby="newsletter-title"
      className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8"
    >
      <div
        data-animate="reveal"
        className="flex flex-col gap-6 rounded-xl bg-primary-100 p-6 md:p-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12"
      >
        <div className="flex flex-col gap-2">
          <p className="text-small font-semibold uppercase tracking-widest text-primary-500">
            Get the latest
          </p>
          <h2 id="newsletter-title" className="font-display text-h1 md:text-display-2">
            New Styles &amp; Exclusive Offers
          </h2>
          <p className="text-body md:text-body-lg text-neutral-700">
            Be the first to know about new arrivals, style inspiration and special offers.
          </p>
        </div>
        <div className="w-full lg:max-w-md">
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}
