import { slugify } from "../lib/ids.ts";
import type { MunicipalityType } from "../types.ts";

/**
 * Nepal administrative geography for the seed.
 *
 * Provinces (7) and districts (77) are complete. Municipalities are a
 * DEVELOPMENT SUBSET (the metros, sub-metros and towns the seed addresses
 * use), not the full 753 local levels. The canonical dataset belongs in
 * `src/data/nepal/` once sourced and verified (AGENTS §15.5). Postal codes are
 * given only where well known; the rest are null, as the field is optional.
 * Coordinates are approximate town centres for "location detected" examples.
 */

export const provinces = [
  { code: "koshi", number: 1, name: "Koshi Province" },
  { code: "madhesh", number: 2, name: "Madhesh Province" },
  { code: "bagmati", number: 3, name: "Bagmati Province" },
  { code: "gandaki", number: 4, name: "Gandaki Province" },
  { code: "lumbini", number: 5, name: "Lumbini Province" },
  { code: "karnali", number: 6, name: "Karnali Province" },
  { code: "sudurpashchim", number: 7, name: "Sudurpashchim Province" },
] as const;

const districtNamesByProvince: Record<string, string[]> = {
  koshi: [
    "Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", "Okhaldhunga",
    "Panchthar", "Sankhuwasabha", "Solukhumbu", "Sunsari", "Taplejung", "Terhathum", "Udayapur",
  ],
  madhesh: ["Bara", "Dhanusha", "Mahottari", "Parsa", "Rautahat", "Saptari", "Sarlahi", "Siraha"],
  bagmati: [
    "Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu", "Kavrepalanchok", "Lalitpur",
    "Makwanpur", "Nuwakot", "Ramechhap", "Rasuwa", "Sindhuli", "Sindhupalchok",
  ],
  gandaki: [
    "Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", "Mustang", "Myagdi", "Nawalpur",
    "Parbat", "Syangja", "Tanahun",
  ],
  lumbini: [
    "Arghakhanchi", "Banke", "Bardiya", "Dang", "Gulmi", "Kapilvastu", "Parasi", "Palpa",
    "Pyuthan", "Rolpa", "Rukum East", "Rupandehi",
  ],
  karnali: [
    "Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla", "Kalikot", "Mugu", "Rukum West",
    "Salyan", "Surkhet",
  ],
  sudurpashchim: [
    "Achham", "Baitadi", "Bajhang", "Bajura", "Dadeldhura", "Darchula", "Doti", "Kailali",
    "Kanchanpur",
  ],
};

export type District = { code: string; name: string; provinceCode: string };

export const districts: District[] = provinces.flatMap((province) =>
  (districtNamesByProvince[province.code] ?? []).map((name) => ({
    code: slugify(name),
    name,
    provinceCode: province.code,
  })),
);

export type Municipality = {
  code: string;
  name: string;
  type: MunicipalityType;
  districtCode: string;
  wardCount: number;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  /** Relative share of seed customers living here. */
  weight: number;
  /** Well-known neighbourhoods used for the street/landmark field. */
  landmarks: string[];
};

const typeSuffix: Record<MunicipalityType, string> = {
  metropolitan_city: "Metropolitan City",
  sub_metropolitan_city: "Sub-Metropolitan City",
  municipality: "Municipality",
  rural_municipality: "Rural Municipality",
};

type MunicipalitySeed = [
  name: string,
  type: MunicipalityType,
  districtCode: string,
  wardCount: number,
  postalCode: string | null,
  latitude: number,
  longitude: number,
  weight: number,
  landmarks: string[],
];

const M: MunicipalityType = "municipality";
const MC: MunicipalityType = "metropolitan_city";
const SMC: MunicipalityType = "sub_metropolitan_city";
const RM: MunicipalityType = "rural_municipality";

const municipalitySeeds: MunicipalitySeed[] = [
  // Kathmandu Valley
  ["Kathmandu", MC, "kathmandu", 32, "44600", 27.7172, 85.324, 40, [
    "Thamel", "New Baneshwor", "Koteshwor", "Kalanki", "Baluwatar", "Maharajgunj", "Chabahil",
    "Boudha", "Sinamangal", "Tinkune", "Balaju", "Lazimpat", "Naxal", "Kalimati", "Gaushala",
    "Old Baneshwor", "Putalisadak", "Dillibazar", "Battisputali", "Samakhusi", "Gongabu",
    "Swayambhu", "Kuleshwor", "Teku", "Tripureshwor", "Kamaladi", "Maitidevi", "Handigaun",
  ]],
  ["Lalitpur", MC, "lalitpur", 29, "44700", 27.6644, 85.3188, 18, [
    "Jawalakhel", "Pulchowk", "Kupondole", "Sanepa", "Lagankhel", "Patan Dhoka", "Mangal Bazar",
    "Kumaripati", "Ekantakuna", "Jhamsikhel", "Gwarko", "Nakhipot",
  ]],
  ["Bhaktapur", M, "bhaktapur", 10, "44800", 27.671, 85.4298, 5, [
    "Kamalbinayak", "Suryamadhi", "Dudhpati", "Byasi", "Siddhapokhari",
  ]],
  ["Madhyapur Thimi", M, "bhaktapur", 9, null, 27.681, 85.387, 4, [
    "Sanothimi", "Bode", "Lokanthali", "Thimi Bazar",
  ]],
  ["Suryabinayak", M, "bhaktapur", 10, null, 27.662, 85.44, 2, ["Balkot", "Jagati", "Sallaghari"]],
  ["Kirtipur", M, "kathmandu", 10, "44618", 27.6781, 85.2775, 4, ["Naya Bazar", "Panga", "Chovar"]],
  ["Budhanilkantha", M, "kathmandu", 13, null, 27.765, 85.365, 6, [
    "Kapan", "Chappal Karkhana", "Hattigauda", "Golfutar", "Narayanthan",
  ]],
  ["Tokha", M, "kathmandu", 11, null, 27.756, 85.329, 4, ["Dhapasi", "Grande", "Jhor", "Tokha Bazar"]],
  ["Tarakeshwar", M, "kathmandu", 11, null, 27.747, 85.298, 3, ["Manamaiju", "Kavresthali", "Dharmasthali"]],
  ["Chandragiri", M, "kathmandu", 15, null, 27.68, 85.23, 3, ["Naikap", "Thankot", "Satungal", "Balambu"]],
  ["Nagarjun", M, "kathmandu", 10, null, 27.73, 85.26, 2, ["Sitapaila", "Ramkot", "Ichangu"]],
  ["Kageshwari Manohara", M, "kathmandu", 9, null, 27.72, 85.42, 2, ["Mulpani", "Gothatar", "Danchhi"]],
  ["Gokarneshwar", M, "kathmandu", 9, null, 27.75, 85.39, 2, ["Jorpati", "Sundarijal", "Gokarna"]],
  ["Mahalaxmi", M, "lalitpur", 10, null, 27.66, 85.35, 3, ["Imadol", "Lubhu", "Tikathali"]],
  ["Godawari", M, "lalitpur", 14, null, 27.59, 85.38, 2, ["Godawari Bazar", "Badikhel", "Bishankhu Narayan"]],

  // Kavrepalanchok (major-city zone: close to the valley)
  ["Banepa", M, "kavrepalanchok", 14, "45210", 27.632, 85.521, 2, ["Chardobato", "Banepa Bazar"]],
  ["Dhulikhel", M, "kavrepalanchok", 12, "45200", 27.62, 85.55, 2, ["Dhulikhel Bazar", "Kathmandu University area"]],
  ["Panauti", M, "kavrepalanchok", 12, null, 27.584, 85.521, 1, ["Panauti Bazar"]],

  // Major cities
  ["Pokhara", MC, "kaski", 33, "33700", 28.2096, 83.9856, 14, [
    "Lakeside", "Newroad", "Chipledhunga", "Mahendrapul", "Prithvi Chowk", "Bagar", "Lamachaur",
    "Srijana Chowk", "Damside", "Birauta", "Nadipur", "Lekhnath",
  ]],
  ["Bharatpur", MC, "chitwan", 29, "44200", 27.6833, 84.4333, 7, [
    "Narayangarh", "Chaubiskoti", "Pulchowk", "Bharatpur Height", "Hakimchowk",
  ]],
  ["Ratnanagar", M, "chitwan", 16, null, 27.6167, 84.5, 1, ["Tandi", "Sauraha"]],
  ["Khairahani", M, "chitwan", 13, null, 27.6, 84.55, 1, ["Parsa Bazar"]],
  ["Biratnagar", MC, "morang", 19, "56613", 26.4525, 87.2718, 6, [
    "Main Road", "Traffic Chowk", "Bargachhi", "Tinpaini", "Rani", "Hatkhola",
  ]],
  ["Birgunj", MC, "parsa", 32, "44300", 27.0104, 84.877, 5, [
    "Ghantaghar", "Adarsha Nagar", "Powerhouse Chowk", "Chhapkaiya",
  ]],
  ["Dharan", SMC, "sunsari", 20, "56700", 26.812, 87.2836, 5, [
    "Bhanu Chowk", "Putali Line", "Chatara Line", "BP Chowk",
  ]],
  ["Itahari", SMC, "sunsari", 20, "56705", 26.6646, 87.2718, 4, ["Itahari Chowk", "Pakali", "Hattisar"]],
  ["Inaruwa", M, "sunsari", 10, null, 26.6, 87.15, 1, ["Inaruwa Bazar"]],
  ["Hetauda", SMC, "makwanpur", 19, "44107", 27.4284, 85.0322, 3, ["Hetauda Bazar", "Bhutandevi", "Kamane"]],
  ["Janakpurdham", SMC, "dhanusha", 25, "45600", 26.7288, 85.9263, 3, [
    "Janaki Mandir area", "Bhanu Chowk", "Mills Area",
  ]],
  ["Butwal", SMC, "rupandehi", 19, "32907", 27.7006, 83.4483, 5, [
    "Traffic Chowk", "Milan Chowk", "Golpark", "Kalikanagar",
  ]],
  ["Siddharthanagar", M, "rupandehi", 13, "32900", 27.5047, 83.4538, 3, [
    "Bhairahawa Bazar", "Buddha Chowk", "Devkota Chowk",
  ]],
  ["Tilottama", M, "rupandehi", 17, null, 27.63, 83.47, 3, ["Manigram", "Yogikuti", "Drivertole"]],
  ["Lumbini Sanskritik", M, "rupandehi", 13, null, 27.48, 83.28, 1, ["Lumbini Bazar"]],
  ["Nepalgunj", SMC, "banke", 23, "21900", 28.05, 81.6167, 3, ["Dhamboji", "Surkhet Road", "Tribhuvan Chowk"]],
  ["Kohalpur", M, "banke", 15, null, 28.196, 81.688, 1, ["Kohalpur Chowk"]],
  ["Dhangadhi", SMC, "kailali", 19, "10900", 28.6852, 80.6216, 3, ["Chauraha", "Campus Road", "Hasanpur"]],
  ["Tikapur", M, "kailali", 9, null, 28.5, 81.1333, 1, ["Tikapur Park area"]],
  ["Bhimdatta", M, "kanchanpur", 19, "10400", 28.9873, 80.1652, 2, ["Mahendranagar Bazar", "Bhasi"]],
  ["Kalaiya", SMC, "bara", 27, null, 27.03, 85.0, 1, ["Kalaiya Bazar"]],
  ["Jitpur Simara", SMC, "bara", 24, null, 27.17, 84.98, 1, ["Simara Chowk"]],
  ["Ghorahi", SMC, "dang", 19, "22400", 28.0333, 82.4833, 2, ["Ghorahi Bazar", "Narayanpur"]],
  ["Tulsipur", SMC, "dang", 19, "22412", 28.131, 82.2973, 2, ["Tulsipur Bazar", "BP Chowk"]],
  ["Birendranagar", M, "surkhet", 16, "21700", 28.6019, 81.6339, 2, ["Birendra Chowk", "Itram"]],
  ["Damak", M, "jhapa", 10, "57217", 26.659, 87.702, 2, ["Damak Chowk"]],
  ["Birtamod", M, "jhapa", 10, "57204", 26.642, 87.991, 3, ["Birtamod Chowk", "Anarmani"]],
  ["Mechinagar", M, "jhapa", 15, null, 26.65, 88.15, 1, ["Kakarbhitta", "Dhulabari"]],
  ["Bhadrapur", M, "jhapa", 10, null, 26.544, 88.094, 1, ["Bhadrapur Bazar"]],

  // Rest of Nepal
  ["Tansen", M, "palpa", 14, "32500", 27.8667, 83.55, 1, ["Sitalpati", "Tansen Durbar area"]],
  ["Rajbiraj", M, "saptari", 16, "56400", 26.54, 86.75, 1, ["Rajbiraj Bazar"]],
  ["Lahan", M, "siraha", 24, "56502", 26.72, 86.48, 1, ["Lahan Chowk"]],
  ["Gorkha", M, "gorkha", 14, "34000", 28.0, 84.63, 1, ["Gorkha Bazar"]],
  ["Besisahar", M, "lamjung", 11, null, 28.23, 84.38, 1, ["Besisahar Bazar"]],
  ["Waling", M, "syangja", 14, null, 27.99, 83.77, 1, ["Waling Bazar"]],
  ["Putalibazar", M, "syangja", 14, null, 28.1, 83.87, 1, ["Syangja Bazar"]],
  ["Baglung", M, "baglung", 14, "33300", 28.27, 83.59, 1, ["Baglung Bazar"]],
  ["Byas", M, "tanahun", 14, null, 27.98, 84.27, 1, ["Damauli"]],
  ["Ilam", M, "ilam", 12, "57300", 26.91, 87.93, 1, ["Ilam Bazar"]],
  ["Dhankuta", M, "dhankuta", 10, "56800", 26.98, 87.34, 1, ["Dhankuta Bazar"]],
  ["Triyuga", M, "udayapur", 16, null, 26.79, 86.7, 1, ["Gaighat"]],
  ["Bidur", M, "nuwakot", 13, null, 27.9, 85.15, 1, ["Battar"]],
  ["Kamalamai", M, "sindhuli", 14, null, 27.2, 85.92, 1, ["Sindhuli Bazar"]],
  ["Kawasoti", M, "nawalpur", 17, null, 27.64, 84.12, 1, ["Kawasoti Bazar"]],
  ["Gulariya", M, "bardiya", 12, null, 28.23, 81.35, 1, ["Gulariya Bazar"]],
  ["Dipayal Silgadhi", M, "doti", 9, null, 29.26, 80.94, 0.5, ["Silgadhi Bazar"]],
  ["Kapilvastu", M, "kapilvastu", 12, null, 27.55, 83.05, 1, ["Taulihawa"]],
  ["Jaleshwar", M, "mahottari", 12, null, 26.65, 85.8, 0.6, ["Jaleshwar Bazar"]],
  ["Malangwa", M, "sarlahi", 12, null, 26.86, 85.56, 0.6, ["Malangwa Bazar"]],

  // Remote Himalayan
  ["Simkot", RM, "humla", 8, null, 29.97, 81.83, 0.3, ["Simkot Bazar"]],
  ["Thuli Bheri", M, "dolpa", 11, null, 28.96, 82.88, 0.3, ["Dunai"]],
  ["Chame", RM, "manang", 5, null, 28.55, 84.24, 0.2, ["Chame"]],
  ["Gharapjhong", RM, "mustang", 5, null, 28.78, 83.72, 0.3, ["Jomsom"]],
  ["Chhayanath Rara", M, "mugu", 14, null, 29.55, 82.17, 0.2, ["Gamgadhi"]],
  ["Chandannath", M, "jumla", 10, null, 29.27, 82.18, 0.4, ["Khalanga"]],
  ["Solududhkunda", M, "solukhumbu", 11, null, 27.5, 86.58, 0.4, ["Salleri"]],
  ["Phungling", M, "taplejung", 11, null, 27.35, 87.67, 0.4, ["Phungling Bazar"]],
  ["Khandbari", M, "sankhuwasabha", 11, null, 27.37, 87.2, 0.4, ["Khandbari Bazar"]],
];

export const municipalities: Municipality[] = municipalitySeeds.map(
  ([name, type, districtCode, wardCount, postalCode, latitude, longitude, weight, landmarks]) => {
    const fullName = `${name} ${typeSuffix[type]}`;
    return {
      code: slugify(fullName),
      name: fullName,
      type,
      districtCode,
      wardCount,
      postalCode,
      latitude,
      longitude,
      weight,
      landmarks,
    };
  },
);

export const districtByCode = new Map(districts.map((district) => [district.code, district]));
export const provinceByCode = new Map(provinces.map((province) => [province.code, province]));
export const municipalityByCode = new Map(municipalities.map((item) => [item.code, item]));

/* ---------- Delivery zones (every district in exactly one zone) ---------- */

export const VALLEY_DISTRICTS = ["kathmandu", "lalitpur", "bhaktapur"];

export const MAJOR_CITY_DISTRICTS = [
  "kaski", "chitwan", "morang", "sunsari", "parsa", "bara", "makwanpur", "dhanusha",
  "rupandehi", "banke", "kailali", "kanchanpur", "dang", "surkhet", "jhapa", "kavrepalanchok",
];

export const REMOTE_DISTRICTS = [
  "humla", "dolpa", "mugu", "manang", "mustang", "jumla", "kalikot", "bajura", "bajhang",
  "darchula", "taplejung", "solukhumbu", "sankhuwasabha", "rasuwa",
];

const assigned = new Set([...VALLEY_DISTRICTS, ...MAJOR_CITY_DISTRICTS, ...REMOTE_DISTRICTS]);

export const REST_OF_NEPAL_DISTRICTS = districts
  .map((district) => district.code)
  .filter((code) => !assigned.has(code));
