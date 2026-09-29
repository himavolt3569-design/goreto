/*
 * Rough Devanagari → Latin transliteration plus a spelling-tolerant key, used
 * only to match the government's Nepali local-level names to the English
 * names in the boundary data. Not for display.
 */

const VOWELS: Record<string, string> = {
  "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
};
const MATRAS: Record<string, string> = {
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};
const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "w", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h", "क्ष": "ksh", "त्र": "tr", "ज्ञ": "gy",
};
const VIRAMA = "्";
const MARKS: Record<string, string> = { "ं": "n", "ँ": "n", "ः": "h", "़": "" };

export function transliterate(text: string): string {
  let out = "";
  const chars = [...text.normalize("NFC")];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]!;
    if (CONSONANTS[char] !== undefined) {
      out += CONSONANTS[char];
      const next = chars[i + 1];
      if (next === VIRAMA) {
        i++;
      } else if (next && MATRAS[next] !== undefined) {
        out += MATRAS[next];
        i++;
      } else if (next && MARKS[next] === "") {
        i++;
        out += "a";
      } else {
        out += "a";
      }
    } else if (VOWELS[char] !== undefined) {
      out += VOWELS[char];
    } else if (MARKS[char] !== undefined) {
      out += MARKS[char];
    } else if (MATRAS[char] !== undefined) {
      out += MATRAS[char];
    } else {
      out += char;
    }
  }
  return out;
}

const TYPE_WORDS = [
  "gaunpalika", "gaupalika", "nagarpalika", "upamahanagarpalika", "mahanagarpalika",
  "rural municipality", "sub-metropolitan city", "metropolitan city", "municipality",
];

/** Spelling-tolerant comparison key: "Budhanilakantha" and "Budhanilkantha" meet. */
export function nameKey(latin: string): string {
  let key = latin.toLowerCase();
  for (const word of TYPE_WORDS) key = key.replaceAll(word, " ");
  return key
    .replace(/[^a-z]/g, "")
    .replace(/chh/g, "c").replace(/ch/g, "c")
    .replace(/([kgjtdpb])h/g, "$1")
    .replace(/sh/g, "s").replace(/v/g, "b").replace(/w/g, "b")
    .replace(/ee|ii|y/g, "i").replace(/oo|uu/g, "u").replace(/ai/g, "e").replace(/au/g, "o")
    .replace(/[aeiou]/g, (vowel) => (vowel === "a" ? "" : vowel))
    .replace(/(.)\1+/g, "$1");
}

export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

const NEPALI_TYPES: [string, "metropolitan_city" | "sub_metropolitan_city" | "municipality" | "rural_municipality"][] = [
  ["उपमहानगरपालिका", "sub_metropolitan_city"],
  ["महानगरपालिका", "metropolitan_city"],
  ["गाउँपालिका", "rural_municipality"],
  ["गाउपालिका", "rural_municipality"],
  ["नगरपालिका", "municipality"],
];

/** Splits "बुढानिलकण्ठ नगरपालिका" into its name and local-level type. */
export function splitNepaliLocalLevel(text: string): { name: string; type: (typeof NEPALI_TYPES)[number][1] | null } {
  const trimmed = text.normalize("NFC").trim();
  for (const [word, type] of NEPALI_TYPES) {
    if (trimmed.endsWith(word)) return { name: trimmed.slice(0, -word.length).trim(), type };
  }
  return { name: trimmed, type: null };
}
