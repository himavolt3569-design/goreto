import { OWNER, featureFlags, staffSeeds } from "../data/commerce.ts";
import {
  districtByCode,
  districts,
  municipalities,
  provinceByCode,
  provinces,
  type Municipality,
} from "../data/nepal.ts";
import { EMAIL_DOMAINS, MOBILE_PREFIXES, nameGroups } from "../data/people.ts";
import { seedId } from "../lib/ids.ts";
import { rngFor, type Rng } from "../lib/random.ts";
import { DAY, HOUR, NOW, STORE_LAUNCH, iso, minutes, npt } from "../lib/time.ts";
import type {
  AddressSnapshot,
  CustomerAddressRow,
  DistrictRow,
  MunicipalityRow,
  ProfileRow,
  ProvinceRow,
  SeedLine,
  StaffPermissionRow,
  StoreSettingsRow,
} from "../types.ts";

export const CUSTOMER_COUNT = 600;

/* ---------- People ---------- */

export type Person = {
  firstName: string;
  surname: string;
  fullName: string;
  email: string;
  phone: string;
};

/** Generates unique fictional people (unique email and phone across the seed). */
export class PersonFactory {
  private readonly emails = new Set<string>();
  private readonly phones = new Set<string>();
  private readonly rng: Rng;

  constructor(rng: Rng) {
    this.rng = rng;
  }

  create(femaleShare = 0.7): Person {
    const group = this.rng.weighted(nameGroups.map((candidate) => [candidate, candidate.weight] as const));
    const female = this.rng.chance(femaleShare);
    const firstName = this.rng.pick(female ? group.female : group.male);
    const surname = this.rng.pick(group.surnames);
    return { firstName, surname, fullName: `${firstName} ${surname}`, email: this.email(firstName, surname), phone: this.phone() };
  }

  relative(of: Person): Person {
    const group = nameGroups.find((candidate) => candidate.surnames.includes(of.surname)) ?? nameGroups[0]!;
    const firstName = this.rng.pick(this.rng.chance(0.5) ? group.female : group.male);
    return {
      firstName,
      surname: of.surname,
      fullName: `${firstName} ${of.surname}`,
      email: this.email(firstName, of.surname),
      phone: this.phone(),
    };
  }

  email(firstName: string, surname: string): string {
    const first = firstName.toLowerCase().replace(/[^a-z]/g, "");
    const last = surname.toLowerCase().replace(/[^a-z]/g, "");
    const styles = [`${first}.${last}`, `${first}${last}`, `${first}_${last}`, `${first}${last[0]}`, `${first}.${last}`];
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const base = this.rng.pick(styles);
      const suffix = attempt === 0 && this.rng.chance(0.4) ? "" : String(this.rng.int(1, 99));
      const email = `${base}${suffix}@${this.rng.pick(EMAIL_DOMAINS)}`;
      if (!this.emails.has(email)) {
        this.emails.add(email);
        return email;
      }
    }
    throw new Error(`Could not create a unique email for ${firstName} ${surname}`);
  }

  phone(): string {
    for (;;) {
      const phone = `+977${this.rng.pick(MOBILE_PREFIXES)}${String(this.rng.int(0, 9_999_999)).padStart(7, "0")}`;
      if (!this.phones.has(phone)) {
        this.phones.add(phone);
        return phone;
      }
    }
  }
}

/* ---------- Addresses ---------- */

const nearby = ["the temple", "the school", "the chowk", "the health post", "the bus park", "the community hall", "the pharmacy", "the petrol pump", "the police beat", "the bank"];

export function pickMunicipality(rng: Rng): Municipality {
  return rng.weighted(municipalities.map((municipality) => [municipality, municipality.weight] as const));
}

export function addressSnapshot(rng: Rng, municipality: Municipality, recipient: Person, withLocation: boolean): AddressSnapshot {
  const district = districtByCode.get(municipality.districtCode)!;
  const province = provinceByCode.get(district.provinceCode as (typeof provinces)[number]["code"])!;
  const landmark = rng.pick(municipality.landmarks);
  const template = rng.int(0, 2);
  const street =
    template === 0
      ? landmark
      : template === 1
        ? `${landmark}, near ${rng.pick(nearby)}`
        : `${landmark}, house no. ${rng.int(1, 240)}`;
  const jitter = () => rng.float(-0.015, 0.015);
  return {
    recipient_name: recipient.fullName,
    phone_e164: recipient.phone,
    province_code: province.code,
    province_name: province.name,
    district_code: district.code,
    district_name: district.name,
    municipality_code: municipality.code,
    municipality_name: municipality.name,
    ward: rng.int(1, municipality.wardCount),
    street_landmark: street,
    postal_code: municipality.postalCode,
    latitude: withLocation ? Math.round((municipality.latitude + jitter()) * 1e6) / 1e6 : null,
    longitude: withLocation ? Math.round((municipality.longitude + jitter()) * 1e6) / 1e6 : null,
  };
}

/* ---------- Customers ---------- */

export type CustomerAddress = {
  id: string;
  label: string;
  isDefault: boolean;
  createdAt: number;
  snapshot: AddressSnapshot;
};

export type Customer = {
  id: string;
  clerkUserId: string;
  person: Person;
  signupAt: number;
  /** Relative chance of placing any given registered order. */
  orderWeight: number;
  addresses: CustomerAddress[];
  deletedAt: number | null;
};

export type StaffMember = { id: string; clerkUserId: string; fullName: string; createdAt: number };

export type PeopleResult = {
  owner: StaffMember;
  staff: (StaffMember & { permissions: StaffPermissionRow["permission_key"][] })[];
  customers: Customer[];
  persons: PersonFactory;
};

export function buildPeople(): PeopleResult {
  const rng = rngFor("people");
  const persons = new PersonFactory(rngFor("people:names"));

  const owner: StaffMember = {
    id: seedId("profile", OWNER.key),
    clerkUserId: "user_seed_owner",
    fullName: OWNER.fullName,
    createdAt: npt(2025, 8, 20, 10, 5),
  };

  const staff = staffSeeds.map((member, index) => ({
    id: seedId("profile", member.key),
    clerkUserId: `user_seed_staff_${member.key.replace(/-/g, "_")}`,
    fullName: member.fullName,
    createdAt: npt(2025, 9, 5 + index * 3, 11, 30),
    permissions: member.permissions,
  }));

  const customers: Customer[] = [];
  for (let index = 0; index < CUSTOMER_COUNT; index += 1) {
    const person = persons.create();
    const span = NOW - (STORE_LAUNCH - 3 * DAY);
    const signupAt = STORE_LAUNCH - 3 * DAY + Math.floor(rng.next() ** 0.8 * span * 0.98);
    const addressCount = rng.weighted([[0, 0.12], [1, 0.58], [2, 0.24], [3, 0.06]] as const);
    const home = pickMunicipality(rng);
    const addresses: CustomerAddress[] = [];
    for (let slot = 0; slot < addressCount; slot += 1) {
      const label = ["Home", "Office", "Parents' home"][slot]!;
      const municipality = slot === 1 && rng.chance(0.6) ? home : slot === 0 ? home : pickMunicipality(rng);
      const recipient = slot === 2 ? persons.relative(person) : person;
      const createdAt = Math.min(signupAt + minutes(rng.int(2, 60)) + slot * rng.int(1, 90) * DAY, NOW - HOUR);
      addresses.push({
        id: seedId("address", index, slot),
        label,
        isDefault: slot === 0,
        createdAt,
        snapshot: addressSnapshot(rng, municipality, recipient, rng.chance(0.4)),
      });
    }
    customers.push({
      id: seedId("profile", "customer", index),
      clerkUserId: `user_seed_${String(index + 1).padStart(4, "0")}`,
      person,
      signupAt,
      orderWeight: Math.min(12, 1 / (0.04 + rng.next()) ** 0.9),
      addresses,
      deletedAt: null,
    });
  }

  return { owner, staff, customers, persons };
}

/* ---------- Rows ---------- */

export function geographyLines() {
  return {
    nepal_provinces: provinces.map((province, index) => ({
      table: "nepal_provinces" as const,
      data: { code: province.code, number: province.number, name: province.name, sort_order: index + 1 } satisfies ProvinceRow,
    })),
    nepal_districts: districts.map((district, index) => ({
      table: "nepal_districts" as const,
      data: { code: district.code, province_code: district.provinceCode, name: district.name, sort_order: index + 1 } satisfies DistrictRow,
    })),
    nepal_municipalities: municipalities.map((municipality) => ({
      table: "nepal_municipalities" as const,
      data: {
        code: municipality.code,
        district_code: municipality.districtCode,
        name: municipality.name,
        type: municipality.type,
        ward_count: municipality.wardCount,
        postal_code: municipality.postalCode,
        latitude: municipality.latitude,
        longitude: municipality.longitude,
      } satisfies MunicipalityRow,
    })),
  };
}

export function storeSettingsLine(ownerCreatedAt: number): SeedLine<"store_settings"> {
  return {
    table: "store_settings",
    data: {
      id: seedId("store-settings", "singleton"),
      store_name: "Goreto.store",
      tagline: "Style it. See it. Love it.",
      support_email: null,
      support_phone_e164: null,
      currency: "NPR",
      timezone: "Asia/Kathmandu",
      country_code: "NP",
      phone_country_code: "+977",
      order_number_prefix: "GT",
      cod_enabled: true,
      cod_max_order_paisa: null,
      returns_window_days: 7,
      default_low_stock_threshold: 5,
      dispatch_municipality_code: "kathmandu-metropolitan-city",
      feature_flags: featureFlags,
      social_links: { instagram: null, youtube: null, pinterest: null },
      created_at: iso(ownerCreatedAt),
      updated_at: iso(npt(2026, 9, 1, 14, 20)),
    } satisfies StoreSettingsRow,
  };
}

export function profileLines(people: PeopleResult): SeedLine<"profiles">[] {
  const staffLine = (member: StaffMember, role: "owner" | "staff", email: string): SeedLine<"profiles"> => ({
    table: "profiles",
    data: {
      id: member.id,
      clerk_user_id: member.clerkUserId,
      full_name: member.fullName,
      email,
      phone_e164: null,
      role,
      deleted_at: null,
      created_at: iso(member.createdAt),
      updated_at: iso(member.createdAt),
    } satisfies ProfileRow,
  });

  return [
    staffLine(people.owner, "owner", "owner@example.com"),
    ...people.staff.map((member) => staffLine(member, "staff", `${member.fullName.split(" ")[0]!.toLowerCase()}.staff@example.com`)),
    ...people.customers.map((customer): SeedLine<"profiles"> => {
      const deleted = customer.deletedAt !== null;
      return {
        table: "profiles",
        data: {
          id: customer.id,
          clerk_user_id: customer.clerkUserId,
          full_name: deleted ? null : customer.person.fullName,
          email: deleted ? null : customer.person.email,
          phone_e164: deleted ? null : customer.person.phone,
          role: "customer",
          deleted_at: deleted ? iso(customer.deletedAt!) : null,
          created_at: iso(customer.signupAt),
          updated_at: iso(customer.deletedAt ?? customer.signupAt),
        } satisfies ProfileRow,
      };
    }),
  ];
}

export function staffPermissionLines(people: PeopleResult): SeedLine<"staff_permissions">[] {
  return people.staff.flatMap((member) =>
    member.permissions.map((permission) => ({
      table: "staff_permissions" as const,
      data: {
        id: seedId("staff-permission", member.id, permission),
        profile_id: member.id,
        permission_key: permission,
        granted_by: people.owner.id,
        created_at: iso(member.createdAt + HOUR),
      } satisfies StaffPermissionRow,
    })),
  );
}

export function addressLines(customers: Customer[]): SeedLine<"customer_addresses">[] {
  return customers
    .filter((customer) => customer.deletedAt === null)
    .flatMap((customer) =>
      customer.addresses.map((address): SeedLine<"customer_addresses"> => {
        const { snapshot } = address;
        return {
          table: "customer_addresses",
          data: {
            id: address.id,
            user_id: customer.id,
            label: address.label,
            recipient_name: snapshot.recipient_name,
            phone_e164: snapshot.phone_e164,
            province_code: snapshot.province_code,
            district_code: snapshot.district_code,
            municipality_code: snapshot.municipality_code,
            ward: snapshot.ward,
            street_landmark: snapshot.street_landmark,
            postal_code: snapshot.postal_code,
            latitude: snapshot.latitude,
            longitude: snapshot.longitude,
            is_default: address.isDefault,
            created_at: iso(address.createdAt),
            updated_at: iso(address.createdAt),
          } satisfies CustomerAddressRow,
        };
      }),
    );
}
