"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { PencilSimpleIcon, PlusIcon, TrashIcon, XIcon } from "@/components/ui/icons";
import { Input, fieldControlClasses } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { deleteCourierServiceAction, saveCourierServiceAction } from "@/features/admin/actions/delivery";
import type { CourierServiceValues } from "@/features/admin/queries/delivery-editor";
import { cn } from "@/lib/utils/cn";
import { ActionMessage, FormDialog } from "./action-forms";
import { tableClasses, tdClasses, thClasses, theadRowClasses } from "./admin-ui";
import { CheckboxField, useEditorForm } from "./editor-parts";
import { ActivePill, Pill } from "./status-pills";

/*
 * A courier's services, on its edit page (admin phase 3). Add and Edit open
 * a dialog; the form is mounted fresh each time it opens, so a new service
 * always starts empty. Services that orders used can't be deleted.
 */

const LEVELS = [
  { value: "standard", label: "Standard" },
  { value: "express", label: "Express" },
  { value: "pickup", label: "Pickup" },
];

type Editing = { service: CourierServiceValues | null } | null;

export function CourierServices({ courierId, courierName, services }: { courierId: string; courierName: string; services: CourierServiceValues[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Card className="flex min-w-0 flex-col">
      <div className="flex flex-col gap-4 px-6 pb-4 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-h2 text-neutral-900">Services</h2>
          <p className="text-body text-neutral-500">What customers choose at checkout. Each service needs a rate per zone to be offered there.</p>
        </div>
        <Button type="button" variant="secondary" size="md" onClick={() => setEditing({ service: null })}>
          <PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          Add service
        </Button>
      </div>
      {message ? <ActionMessage state={{ ok: true, message }} className="px-6 pb-4" /> : null}

      {services.length === 0 ? (
        <p className="px-6 pb-6 text-body text-neutral-500">No services yet. Add one so customers can choose this courier.</p>
      ) : (
        <div className="relative min-w-0 overflow-x-auto px-2 pb-4" role="region" aria-label={`${courierName} services`} tabIndex={0}>
          <table className={cn(tableClasses, "min-w-[600px]")}>
            <thead>
              <tr className={theadRowClasses}>
                <th scope="col" className={thClasses}>Service</th>
                <th scope="col" className={thClasses}>Level</th>
                <th scope="col" className={thClasses}>Estimate</th>
                <th scope="col" className={thClasses}>Rates</th>
                <th scope="col" className={thClasses}>Status</th>
                <th scope="col" className={thClasses}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td className={tdClasses}>
                    <span className="flex flex-col">
                      <span className="font-medium">{service.name}</span>
                      <span className="text-small text-neutral-500">{service.serviceCode}</span>
                    </span>
                  </td>
                  <td className={tdClasses}>
                    <Pill tone={service.level === "express" ? "primary" : service.level === "pickup" ? "limited" : "neutral"}>
                      {LEVELS.find((level) => level.value === service.level)?.label}
                    </Pill>
                  </td>
                  <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>
                    {service.minDays}–{service.maxDays} days
                  </td>
                  <td className={cn(tdClasses, "tabular-nums text-neutral-700")}>{service.rateCount}</td>
                  <td className={tdClasses}>
                    <ActivePill active={service.isActive} />
                  </td>
                  <td className={tdClasses}>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className={buttonClasses({ variant: "tertiary", size: "md" })}
                        onClick={() => {
                          setMessage(null);
                          setEditing({ service });
                        }}
                      >
                        <PencilSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                        Edit <span className="sr-only">{service.name}</span>
                      </button>
                      {service.useCount === 0 ? (
                        <FormDialog
                          action={deleteCourierServiceAction}
                          hidden={{ serviceId: service.id }}
                          title={`Delete “${service.name}”?`}
                          description="This can't be undone."
                          triggerLabel="Delete"
                          triggerIcon={<TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
                          submitLabel="Delete service"
                        >
                          <p className="text-body text-neutral-700">
                            {service.rateCount === 0
                              ? "It has no rates."
                              : `Its ${service.rateCount === 1 ? "rate is" : `${service.rateCount} rates are`} deleted with it.`}
                          </p>
                        </FormDialog>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <ServiceDialog
          courierId={courierId}
          service={editing.service}
          onSaved={(saved) => {
            setEditing(null);
            setMessage(saved);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}

function ServiceDialog({
  courierId,
  service,
  onSaved,
  onClose,
}: {
  courierId: string;
  service: CourierServiceValues | null;
  onSaved: (message: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { state, errors, pending, onSubmit } = useEditorForm(saveCourierServiceAction);
  const [level, setLevel] = useState<string>(service?.level ?? "standard");
  const [code, setCode] = useState(service?.serviceCode ?? "");

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      opener?.focus();
    };
  }, []);

  // Only a new result reports a save.
  const reportSaved = useEffectEvent((message: string) => onSaved(message));
  useEffect(() => {
    if (state?.ok) reportSaved(state.message ?? "Saved.");
  }, [state]);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-neutral-900/50"
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 p-6">
        <input type="hidden" name="courierId" value={courierId} />
        {service ? <input type="hidden" name="serviceId" value={service.id} /> : null}

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-h2 text-neutral-900">
              {service ? `Edit ${service.name}` : "Add service"}
            </h2>
            <p className="text-body text-neutral-500">Customers see the name, the estimate and the description at checkout.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className={iconButtonClasses({ variant: "ghost", className: "-mr-2 -mt-2" })}>
            <XIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Service name" required error={errors.name}>
            {(control) => <Input {...control} name="name" defaultValue={service?.name ?? ""} maxLength={80} placeholder="e.g. Express Delivery" required />}
          </Field>
          <Field label="Service code" required error={errors.serviceCode} hint="Unique across couriers, e.g. PTH-EXP.">
            {(control) => (
              <Input
                {...control}
                name="serviceCode"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s+/g, "-"))}
                maxLength={40}
                autoComplete="off"
                spellCheck={false}
                required
              />
            )}
          </Field>
          <Field label="Level" required error={errors.level}>
            {(control) => <Select {...control} name="level" options={LEVELS} value={level} onValueChange={setLevel} required />}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Min. days" required error={errors.minDays}>
              {(control) => <Input {...control} name="minDays" type="number" min={0} max={60} step={1} defaultValue={service?.minDays ?? 1} required />}
            </Field>
            <Field label="Max. days" required error={errors.maxDays}>
              {(control) => <Input {...control} name="maxDays" type="number" min={0} max={60} step={1} defaultValue={service?.maxDays ?? 3} required />}
            </Field>
          </div>
        </div>
        <Field label="Description" error={errors.description} hint="Up to 200 characters.">
          {(control) => (
            <textarea {...control} name="description" defaultValue={service?.description ?? ""} rows={2} maxLength={200} className={cn(fieldControlClasses, "h-auto py-3")} />
          )}
        </Field>
        <CheckboxField name="isActive" defaultChecked={service?.isActive ?? true} label="Offered at checkout" description="Only when the courier is active too." />

        {state && !state.ok ? <ActionMessage state={state} /> : null}
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <button type="button" onClick={onClose} className={buttonClasses({ variant: "tertiary", size: "md" })}>
            Cancel
          </button>
          <Button type="submit" size="md" loading={pending}>
            {service ? "Save service" : "Add service"}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
