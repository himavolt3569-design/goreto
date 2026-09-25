/** Skeleton while an admin page loads its data (shell stays interactive). */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <div className="h-10 w-64 animate-pulse rounded-sm bg-neutral-200" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded-sm bg-neutral-100" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-36 animate-pulse rounded-lg border border-neutral-200 bg-white" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="h-96 animate-pulse rounded-lg border border-neutral-200 bg-white" />
        <div className="h-96 animate-pulse rounded-lg border border-neutral-200 bg-white" />
      </div>
    </div>
  );
}
