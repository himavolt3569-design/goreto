import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function CategoryNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-4 px-4 py-16 md:px-8">
      <p className="text-small font-semibold uppercase tracking-widest text-primary-500">
        Category not found
      </p>
      <h1 className="font-display text-h1 text-neutral-900 md:text-display-2">
        We couldn&apos;t find that category
      </h1>
      <p className="max-w-xl text-body-lg text-neutral-500">
        It may have been renamed, or the link may be mistyped. Browse every category instead.
      </p>
      <Link href="/categories" className={buttonClasses({ variant: "primary" })}>
        Browse all categories
      </Link>
    </div>
  );
}
