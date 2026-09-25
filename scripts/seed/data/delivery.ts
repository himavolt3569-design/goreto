import type { ServiceLevel } from "../types.ts";
import {
  MAJOR_CITY_DISTRICTS,
  REMOTE_DISTRICTS,
  REST_OF_NEPAL_DISTRICTS,
  VALLEY_DISTRICTS,
} from "./nepal.ts";

/**
 * Delivery configuration. Couriers are manual integrations: no API supplies
 * live status or coordinates, so shipment events are entered by staff and
 * carry no GPS (AGENTS §26.3). Support phones and websites are left null
 * rather than invented.
 */

export type CourierSeed = {
  slug: string;
  name: string;
  trackingPrefix: string;
  isActive: boolean;
};

export const courierSeeds: CourierSeed[] = [
  { slug: "goreto-valley-riders", name: "Goreto Valley Riders", trackingPrefix: "GVR", isActive: true },
  { slug: "pathao", name: "Pathao", trackingPrefix: "PTH", isActive: true },
  { slug: "nepal-can-move", name: "Nepal Can Move", trackingPrefix: "NCM", isActive: true },
  { slug: "upaya-city-cargo", name: "Upaya City Cargo", trackingPrefix: "UPY", isActive: true },
  { slug: "aramex-nepal", name: "Aramex Nepal", trackingPrefix: "ARX", isActive: false },
];

export type ServiceSeed = {
  code: string;
  courier: string;
  name: string;
  level: ServiceLevel;
  description: string;
  minDays: number;
  maxDays: number;
  isActive: boolean;
};

export const serviceSeeds: ServiceSeed[] = [
  { code: "GVR-STD", courier: "goreto-valley-riders", name: "Standard Delivery", level: "standard", description: "Our own riders deliver across the Kathmandu Valley.", minDays: 1, maxDays: 3, isActive: true },
  { code: "PTH-EXP", courier: "pathao", name: "Express Delivery", level: "express", description: "Faster delivery to the valley and major cities.", minDays: 1, maxDays: 2, isActive: true },
  { code: "PTH-STD", courier: "pathao", name: "Standard Delivery", level: "standard", description: "Paused while Goreto Valley Riders covers standard valley delivery.", minDays: 2, maxDays: 4, isActive: false },
  { code: "NCM-STD", courier: "nepal-can-move", name: "Standard Delivery", level: "standard", description: "Reliable delivery to major cities across Nepal.", minDays: 3, maxDays: 5, isActive: true },
  { code: "NCM-PUP", courier: "nepal-can-move", name: "Pickup Point", level: "pickup", description: "Collect from the nearest Nepal Can Move branch.", minDays: 2, maxDays: 4, isActive: true },
  { code: "UPY-STD", courier: "upaya-city-cargo", name: "Standard Delivery", level: "standard", description: "Door delivery to district towns across Nepal.", minDays: 4, maxDays: 7, isActive: true },
  { code: "UPY-RMT", courier: "upaya-city-cargo", name: "Remote Area Delivery", level: "standard", description: "Delivery to remote Himalayan districts; timing depends on road and flight conditions.", minDays: 7, maxDays: 14, isActive: true },
  { code: "ARX-DOM", courier: "aramex-nepal", name: "Domestic Express", level: "express", description: "Not in use.", minDays: 1, maxDays: 3, isActive: false },
];

export type ZoneSeed = {
  slug: string;
  name: string;
  description: string;
  districts: string[];
};

export const zoneSeeds: ZoneSeed[] = [
  { slug: "kathmandu-valley", name: "Kathmandu Valley", description: "Kathmandu, Lalitpur and Bhaktapur districts.", districts: VALLEY_DISTRICTS },
  { slug: "major-cities", name: "Major Cities", description: "Districts of Nepal's larger cities and transport hubs.", districts: MAJOR_CITY_DISTRICTS },
  { slug: "rest-of-nepal", name: "Rest of Nepal", description: "District towns served by road.", districts: REST_OF_NEPAL_DISTRICTS },
  { slug: "remote-himalayan", name: "Remote Himalayan", description: "High-mountain districts with limited road access.", districts: REMOTE_DISTRICTS },
];

export type RateSeed = {
  zone: string;
  service: string;
  /** Whole rupees. */
  price: number;
  minDays?: number;
  maxDays?: number;
  isActive?: boolean;
};

/** Valley prices match the checkout reference: Standard 100, Express 200, Pickup 50. */
export const rateSeeds: RateSeed[] = [
  { zone: "kathmandu-valley", service: "GVR-STD", price: 100 },
  { zone: "kathmandu-valley", service: "PTH-EXP", price: 200 },
  { zone: "kathmandu-valley", service: "NCM-PUP", price: 50, minDays: 1, maxDays: 2 },
  { zone: "kathmandu-valley", service: "PTH-STD", price: 100, isActive: false },
  { zone: "major-cities", service: "NCM-STD", price: 150 },
  { zone: "major-cities", service: "PTH-EXP", price: 250, minDays: 2, maxDays: 3 },
  { zone: "major-cities", service: "NCM-PUP", price: 80 },
  { zone: "rest-of-nepal", service: "UPY-STD", price: 200 },
  { zone: "rest-of-nepal", service: "NCM-PUP", price: 120, minDays: 4, maxDays: 6 },
  { zone: "remote-himalayan", service: "UPY-RMT", price: 350 },
];
