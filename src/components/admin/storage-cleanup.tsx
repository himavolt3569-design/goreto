"use client";

import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { TrashIcon } from "@/components/ui/icons";
import { cleanUpStorageAction } from "@/features/admin/actions/media";
import { Panel } from "./admin-ui";
import { FormDialog } from "./action-forms";

/*
 * Unused uploads: files staff uploaded more than 24 hours ago that no record
 * uses (an abandoned Add product page, a replaced upload that wasn't saved).
 * The server re-reads the list when deleting, so nothing in use is removed.
 */

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("en-IN")} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("en-IN", { maximumFractionDigits: 1 })} MB`;
}

export function StorageCleanup({ bucket, count, bytes, noun }: { bucket: "product-media" | "ar-assets"; count: number; bytes: number; noun: string }) {
  const files = count === 1 ? "1 file" : `${count.toLocaleString("en-IN")} files`;
  return (
    <Panel
      title="Storage cleanup"
      description={
        count === 0
          ? `No unused ${noun}. Uploads that nothing uses are listed here after 24 hours.`
          : `${files} (${formatBytes(bytes)}) uploaded more than 24 hours ago ${count === 1 ? "isn't" : "aren't"} used by anything.`
      }
      bodyClassName="px-6 pb-6"
    >
      {count > 0 ? (
        <div className="flex flex-wrap items-center gap-4">
          <FormDialog
            action={cleanUpStorageAction}
            hidden={{ bucket }}
            title={`Delete ${files}?`}
            description="This can't be undone."
            triggerLabel="Delete unused files"
            triggerVariant="secondary"
            triggerIcon={<TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
            submitLabel="Delete files"
          >
            <p className="text-body text-neutral-700">
              Only files no product{bucket === "product-media" ? ", category or collection" : " or AR asset"} uses are deleted. Up to 500 go per click.
            </p>
          </FormDialog>
        </div>
      ) : null}
    </Panel>
  );
}
