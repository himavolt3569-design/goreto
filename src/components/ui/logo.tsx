import Link from "next/link";
import { HandbagSimpleIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_WEIGHT_FILLED } from "./icon";

export type LogoProps = {
  /** Wrap in a link (usually "/"). Omit for a static wordmark. */
  href?: string;
  showMark?: boolean;
  className?: string;
};

export function Logo({ href, showMark = true, className }: LogoProps) {
  const content = (
    <>
      {showMark ? (
        <HandbagSimpleIcon
          aria-hidden="true"
          size={32}
          weight={ICON_WEIGHT_FILLED}
          className="text-primary-500"
        />
      ) : null}
      <span className="font-display text-h1 font-bold tracking-tight text-neutral-900">
        Goreto<span className="font-normal text-neutral-500">.store</span>
      </span>
    </>
  );

  const classes = cn("inline-flex items-center gap-2", className);

  if (href) {
    return (
      <Link href={href} className={cn(classes, "rounded-sm")} aria-label="Goreto.store home">
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}
