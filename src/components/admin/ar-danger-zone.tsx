"use client";

import { deleteArAssetAction } from "@/features/admin/actions/ar";
import { DangerZone } from "./delivery-danger-zones";

/** Delete an AR asset and its uploaded file. Turning it off keeps it for later. */
export function ArAssetDangerZone({ assetId, name }: { assetId: string; name: string }) {
  return (
    <DangerZone
      blocked={null}
      summary="Deleting removes the asset and its file for good. Turn it off instead to hide it for now."
      action={deleteArAssetAction}
      hidden={{ assetId }}
      title={name}
      label="Delete AR asset"
    >
      The product stops offering this try-on. Order history isn&apos;t affected.
    </DangerZone>
  );
}
