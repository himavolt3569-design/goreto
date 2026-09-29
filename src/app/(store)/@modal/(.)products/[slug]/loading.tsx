import { QUICK_VIEW_TITLE_ID } from "@/components/store/quick-view/ids";
import { cn } from "@/lib/utils/cn";

const block = "rounded-md bg-neutral-100 motion-safe:animate-pulse";

export default function QuickViewLoading() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <h2 id={QUICK_VIEW_TITLE_ID} className="sr-only">
        Loading product
      </h2>
      <div className={cn(block, "aspect-[7/8] w-full rounded-lg")} />
      <div className="flex flex-col gap-4">
        <div className={cn(block, "h-9 w-3/4")} />
        <div className={cn(block, "h-6 w-1/3")} />
        <div className={cn(block, "h-9 w-1/2")} />
        <div className={cn(block, "h-16 w-full")} />
        <div className={cn(block, "h-11 w-full")} />
        <div className={cn(block, "h-11 w-full")} />
      </div>
    </div>
  );
}
