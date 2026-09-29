"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { WarningCircleIcon } from "@/components/ui/icons";

/** Account page failures keep the account navigation and offer a retry. */
export default function AccountError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-error-100 text-error-700">
        <WarningCircleIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 text-neutral-900">We couldn&apos;t load this page</h1>
        <p className="text-body text-neutral-500">
          Something went wrong reaching your account. Check your connection and try again.
          {error.digest ? <span className="block text-small">Reference: {error.digest}</span> : null}
        </p>
      </div>
      <Button onClick={() => retry()}>Try again</Button>
    </Card>
  );
}
