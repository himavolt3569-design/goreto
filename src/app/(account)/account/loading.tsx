/** Account page skeleton, shown inside the account shell while a page loads. */
export default function AccountLoading() {
  const block = "rounded-lg bg-neutral-100 motion-safe:animate-pulse";
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading your account…</span>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-4 w-40 rounded-sm bg-neutral-100 motion-safe:animate-pulse" />
        <div className="h-9 w-64 rounded-sm bg-neutral-100 motion-safe:animate-pulse" />
      </div>
      <div aria-hidden="true" className="grid gap-6 sm:grid-cols-3">
        <div className={`h-28 ${block}`} />
        <div className={`h-28 ${block}`} />
        <div className={`h-28 ${block}`} />
      </div>
      <div aria-hidden="true" className={`h-64 ${block}`} />
    </div>
  );
}
