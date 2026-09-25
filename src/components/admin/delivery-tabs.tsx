import { LinkTabs } from "./admin-ui";

/** Sub-navigation shared by the three delivery configuration pages. */
export function DeliveryTabs({ active }: { active: "couriers" | "zones" | "rates" }) {
  return (
    <LinkTabs
      label="Delivery configuration"
      tabs={[
        { label: "Couriers & services", href: "/admin/delivery", active: active === "couriers" },
        { label: "Delivery zones", href: "/admin/delivery/zones", active: active === "zones" },
        { label: "Rates", href: "/admin/delivery/rates", active: active === "rates" },
      ]}
    />
  );
}
