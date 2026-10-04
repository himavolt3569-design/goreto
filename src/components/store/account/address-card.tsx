"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { CheckCircleIcon, MapPinIcon, PencilSimpleIcon, PhoneIcon, TrashIcon } from "@/components/ui/icons";
import { deleteAddressAction, setDefaultAddressAction, type AddressActionResult } from "@/features/account/address-actions";

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;
const FAILED: AddressActionResult = { ok: false, message: "Something went wrong. Check your connection and try again." };

/** A saved address ready for display: names resolved and the phone formatted on the server. */
export type AddressView = {
  id: string;
  label: string;
  isDefault: boolean;
  recipientName: string;
  phone: string;
  lines: string[];
};

/** One saved address with Edit, Set as default and Delete (confirmed in a dialog). */
export function AddressCard({ address }: { address: AddressView }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"default" | "delete" | null>(null);

  function run(kind: "default" | "delete") {
    setMessage(null);
    setAction(kind);
    startTransition(async () => {
      const result = await (kind === "default" ? setDefaultAddressAction(address.id) : deleteAddressAction(address.id)).catch(() => FAILED);
      if (kind === "delete") dialogRef.current?.close();
      if (!result.ok) setMessage(result.message);
    });
  }

  return (
    <Card className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-h3 text-neutral-900">
          <MapPinIcon {...iconProps} className="shrink-0 text-primary-500" />
          <span className="truncate">{address.label}</span>
        </h2>
        {address.isDefault ? (
          <Badge tone="new" size="sm">
            Default
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 text-body text-neutral-700">
        <p className="font-medium text-neutral-900">{address.recipientName}</p>
        <p className="flex items-center gap-2">
          <PhoneIcon {...iconProps} className="text-neutral-500" />
          {address.phone}
        </p>
        <address className="not-italic">
          {address.lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Link
          href={`/account/addresses/${address.id}/edit`}
          aria-label={`Edit ${address.label} address`}
          className={buttonClasses({ variant: "tertiary", size: "md" })}
        >
          <PencilSimpleIcon {...iconProps} />
          Edit
        </Link>
        {!address.isDefault ? (
          <Button
            type="button"
            variant="tertiary"
            size="md"
            loading={pending && action === "default"}
            leadingIcon={<CheckCircleIcon {...iconProps} />}
            aria-label={`Set ${address.label} as default`}
            onClick={() => run("default")}
          >
            Set as default
          </Button>
        ) : null}
        <Button
          type="button"
          variant="tertiary"
          size="md"
          leadingIcon={<TrashIcon {...iconProps} />}
          aria-label={`Delete ${address.label} address`}
          onClick={() => dialogRef.current?.showModal()}
        >
          Delete
        </Button>
      </div>

      {message ? (
        <p role="alert" className="text-small text-error-700">
          {message}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-neutral-900/50"
      >
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-h2 text-neutral-900">
              Delete this address?
            </h2>
            <p className="text-body text-neutral-500">
              {address.label}: {address.lines[0]}.
              {address.isDefault ? " Another saved address will become your default." : null}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className={buttonClasses({ variant: "tertiary", size: "md" })}>
              Keep it
            </button>
            <Button type="button" variant="primary" size="md" loading={pending && action === "delete"} onClick={() => run("delete")}>
              Delete address
            </Button>
          </div>
        </div>
      </dialog>
    </Card>
  );
}
