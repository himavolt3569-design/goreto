import { courierSeeds, rateSeeds, serviceSeeds, zoneSeeds } from "../data/delivery.ts";
import { seedId } from "../lib/ids.ts";
import { iso, npt } from "../lib/time.ts";
import type {
  CourierRow,
  CourierServiceRow,
  DeliveryRateRow,
  DeliveryZoneRow,
  SeedLine,
  ServiceLevel,
} from "../types.ts";

export type SimRate = {
  rateId: string;
  zoneId: string;
  zoneSlug: string;
  zoneName: string;
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  level: ServiceLevel;
  courierId: string;
  courierName: string;
  trackingPrefix: string;
  pricePaisa: number;
  minDays: number;
  maxDays: number;
};

export type DeliveryResult = {
  lines: {
    couriers: SeedLine<"couriers">[];
    courier_services: SeedLine<"courier_services">[];
    delivery_zones: SeedLine<"delivery_zones">[];
    delivery_rates: SeedLine<"delivery_rates">[];
  };
  /** Active rates for each district code. */
  ratesByDistrict: Map<string, SimRate[]>;
};

export function buildDelivery(): DeliveryResult {
  const created = iso(npt(2025, 9, 8, 15, 0));
  const updated = iso(npt(2026, 5, 12, 11, 40));

  const couriers = courierSeeds.map((courier) => ({ seed: courier, id: seedId("courier", courier.slug) }));
  const courierBySlug = new Map(couriers.map((courier) => [courier.seed.slug, courier]));
  const services = serviceSeeds.map((service) => ({ seed: service, id: seedId("courier-service", service.code) }));
  const serviceByCode = new Map(services.map((service) => [service.seed.code, service]));
  const zones = zoneSeeds.map((zone) => ({ seed: zone, id: seedId("delivery-zone", zone.slug) }));
  const zoneBySlug = new Map(zones.map((zone) => [zone.seed.slug, zone]));

  const lines: DeliveryResult["lines"] = {
    couriers: couriers.map(({ seed, id }) => ({
      table: "couriers",
      data: {
        id,
        name: seed.name,
        slug: seed.slug,
        logo_path: null,
        support_phone: null,
        website_url: null,
        integration_mode: "manual",
        is_active: seed.isActive,
        created_at: created,
        updated_at: seed.isActive ? created : updated,
      } satisfies CourierRow,
    })),
    courier_services: services.map(({ seed, id }) => ({
      table: "courier_services",
      data: {
        id,
        courier_id: courierBySlug.get(seed.courier)!.id,
        name: seed.name,
        service_code: seed.code,
        service_level: seed.level,
        description: seed.description,
        estimated_min_days: seed.minDays,
        estimated_max_days: seed.maxDays,
        is_active: seed.isActive,
        created_at: created,
        updated_at: seed.isActive ? created : updated,
      } satisfies CourierServiceRow,
    })),
    delivery_zones: zones.map(({ seed, id }, index) => ({
      table: "delivery_zones",
      data: {
        id,
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        district_codes: seed.districts,
        sort_order: (index + 1) * 10,
        is_active: true,
        created_at: created,
        updated_at: created,
      } satisfies DeliveryZoneRow,
    })),
    delivery_rates: rateSeeds.map((rate) => ({
      table: "delivery_rates",
      data: {
        id: seedId("delivery-rate", rate.zone, rate.service),
        zone_id: zoneBySlug.get(rate.zone)!.id,
        courier_service_id: serviceByCode.get(rate.service)!.id,
        price_paisa: rate.price * 100,
        estimated_min_days: rate.minDays ?? null,
        estimated_max_days: rate.maxDays ?? null,
        min_weight_grams: null,
        max_weight_grams: null,
        min_order_paisa: null,
        is_active: rate.isActive ?? true,
        created_at: created,
        updated_at: rate.isActive === false ? updated : created,
      } satisfies DeliveryRateRow,
    })),
  };

  const ratesByDistrict = new Map<string, SimRate[]>();
  for (const zone of zones) {
    const active: SimRate[] = rateSeeds
      .filter((rate) => rate.zone === zone.seed.slug && rate.isActive !== false)
      .map((rate) => {
        const service = serviceByCode.get(rate.service)!;
        const courier = courierBySlug.get(service.seed.courier)!;
        if (!service.seed.isActive || !courier.seed.isActive) {
          throw new Error(`Active rate ${rate.zone}/${rate.service} uses an inactive service or courier`);
        }
        return {
          rateId: seedId("delivery-rate", rate.zone, rate.service),
          zoneId: zone.id,
          zoneSlug: zone.seed.slug,
          zoneName: zone.seed.name,
          serviceId: service.id,
          serviceCode: service.seed.code,
          serviceName: service.seed.name,
          level: service.seed.level,
          courierId: courier.id,
          courierName: courier.seed.name,
          trackingPrefix: courier.seed.trackingPrefix,
          pricePaisa: rate.price * 100,
          minDays: rate.minDays ?? service.seed.minDays,
          maxDays: rate.maxDays ?? service.seed.maxDays,
        };
      });
    for (const district of zone.seed.districts) ratesByDistrict.set(district, active);
  }

  return { lines, ratesByDistrict };
}
