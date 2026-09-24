import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import {
  CaretDownIcon,
  ClockCounterClockwiseIcon,
  HandbagSimpleIcon,
  HeartIcon,
  TruckIcon,
  type Icon,
} from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";

export type AccordionSection = {
  id: string;
  title: string;
  icon: Icon;
  content: ReactNode;
  defaultOpen?: boolean;
};

export const accordionIcons = {
  description: HandbagSimpleIcon,
  shipping: TruckIcon,
  returns: ClockCounterClockwiseIcon,
  care: HeartIcon,
} satisfies Record<string, Icon>;

/**
 * Description / Shipping / Returns / Care. Native <details> disclosures:
 * keyboard-operable and readable without JavaScript.
 */
export function ProductAccordions({ sections }: { sections: AccordionSection[] }) {
  return (
    <Card className="flex flex-col divide-y divide-neutral-200 px-6 py-2">
      {sections.map(({ id, title, icon: SectionIcon, content, defaultOpen }) => (
        <details key={id} open={defaultOpen} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-4 rounded-sm py-4 [&::-webkit-details-marker]:hidden">
            <SectionIcon
              aria-hidden="true"
              size={ICON_SIZE}
              weight={ICON_WEIGHT_OUTLINE}
              className="shrink-0 text-neutral-900"
            />
            <h2 className="flex-1 font-display text-h2 text-neutral-900">{title}</h2>
            <CaretDownIcon
              aria-hidden="true"
              size={ICON_SIZE_SM}
              weight={ICON_WEIGHT_OUTLINE}
              className="shrink-0 text-neutral-700 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="pb-6 pl-10 text-body text-neutral-500">{content}</div>
        </details>
      ))}
    </Card>
  );
}
