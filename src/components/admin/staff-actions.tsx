"use client";

import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ProhibitIcon, UserMinusIcon } from "@/components/ui/icons";
import { removeStaffAction, revokeInvitationAction } from "@/features/admin/actions/staff";
import { FormDialog } from "./action-forms";

/* Row actions on /admin/staff (admin phase 4), each behind a confirm dialog. */

export function RevokeInvitationButton({ invitationId, email }: { invitationId: string; email: string }) {
  return (
    <FormDialog
      action={revokeInvitationAction}
      hidden={{ invitationId }}
      title="Revoke this invitation?"
      description={email}
      triggerLabel="Revoke"
      triggerContext={`invitation for ${email}`}
      triggerIcon={<ProhibitIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
      submitLabel="Revoke invitation"
      submitVariant="primary"
    >
      <p className="text-body text-neutral-700">
        The link in their email stops giving staff access. You can invite them again later.
      </p>
    </FormDialog>
  );
}

export function RemoveStaffButton({ profileId, name }: { profileId: string; name: string }) {
  return (
    <FormDialog
      action={removeStaffAction}
      hidden={{ profileId }}
      title={`Remove ${name} from staff?`}
      triggerLabel="Remove"
      triggerContext={`${name} from staff`}
      triggerIcon={<UserMinusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
      submitLabel="Remove from staff"
    >
      <p className="text-body text-neutral-700">
        They lose access to the admin area straight away and all their permissions are cleared. They keep their customer
        account and order history.
      </p>
    </FormDialog>
  );
}
