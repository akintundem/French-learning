// Parses French-Dictionary-A2-B1.md into lib/vocab.ts
// Run: npm run build:vocab

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "data", "French-Dictionary-A2-B1.md");

const PARTS = [
  { id: "A", title: "A2 Core", blurb: "Everyday foundations" },
  { id: "B", title: "B1 Vocabulary", blurb: "Connectors, abstraction, nuance" },
  { id: "C", title: "Occupations", blurb: "Jobs and talking about work" },
  { id: "D", title: "Supplement", blurb: "Prepositions, idioms, register" },
  { id: "F", title: "Situations & Themes", blurb: "The phrases a word list misses" },
];

// Tables that aren't French→English vocabulary.
const SKIP_SECTIONS = new Set([
  "C1", // -eur/-euse ending patterns
  "D5", // numbers in practice: "Price → 12,50 €"
  "D6", // tu/vous register grid
]);

// "**Colours:** blanc, noir, rouge, ..." is prose, not a table, and is given
// without English. These are the glosses; feminine forms are noted where they
// are irregular, since colours are adjectives and must agree.
const COLOURS = {
  "blanc": "white (m) — f. blanche",
  "noir": "black",
  "rouge": "red",
  "bleu": "blue",
  "vert": "green",
  "jaune": "yellow",
  "orange": "orange (invariable)",
  "rose": "pink",
  "gris": "grey",
  "marron": "brown (invariable)",
};

const stripMd = (s) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();

const splitPair = (s) => s.split("/").map((p) => p.trim()).filter(Boolean);

// Prompts too generic to answer once removed from their table.
const isBadPrompt = (en) =>
  // A digit is a fine prompt ("7" -> sept); a stray short word is not.
  (en.length < 2 && !/^\d$/.test(en)) ||
  /^(and|or|the|a|some|to|of|in|on|not)$/i.test(en);

function parse() {
  const lines = readFileSync(SOURCE, "utf8").split("\n");
  const modules = [];
  let current = null;
  let header = null;

  for (const raw of lines) {
    const line = raw.trim();

    const h2 = line.match(/^##\s+([ABCDF])(\d+)\.\s+(.+)$/);
    if (h2) {
      const [, part, num, title] = h2;
      current = { id: `${part}${num}`, part, order: Number(num), title: stripMd(title), words: [] };
      modules.push(current);
      header = null;
      continue;
    }

    const colours = line.match(/^\*\*Colours:\*\*\s*(.+)$/i);
    if (colours && current) {
      for (const word of colours[1].split(",").map((c) => stripMd(c))) {
        const en = COLOURS[word.toLowerCase()];
        if (en) add(current, word, en);
      }
      header = null;
      continue;
    }

    // A top-level heading ends the module; a "###" sub-heading only ends the
    // current table, so D1's four sub-tables still collect into one module.
    if (/^#{1,2}\s/.test(line)) {
      current = null;
      header = null;
      continue;
    }
    if (line.startsWith("#")) {
      header = null;
      continue;
    }

    if (!line.startsWith("|")) {
      header = null;
      continue;
    }
    if (!current) continue;

    const cells = line.slice(1, -1).split("|").map((c) => c.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;

    if (!header) {
      header = cells.map((c) => stripMd(c).toLowerCase());
      continue;
    }
    if (SKIP_SECTIONS.has(current.id)) continue;

    addRow(current, header, cells.map(stripMd));
  }

  return modules.filter((m) => m.words.length > 0);
}

function addRow(mod, header, cells) {
  // Days and months arrive grouped, three or four to a row, paired one-to-one
  // with their English. Split them into a question each.
  if (mod.id === "A4" && header.length === 2) {
    const fr = cells[0].split(",").map((c) => c.trim());
    const en = cells[1].split(",").map((c) => c.trim());
    if (fr.length > 1 && fr.length === en.length) {
      fr.forEach((f, i) => add(mod, f, en[i]));
      return;
    }
  }

  if (mod.id === "A5") {
    // A5 is a | French | English | table whose rows group several numbers:
    // "sept, huit, neuf, dix" | "7, 8, 9, 10". Zip them back into one
    // question per number — the digit prompts, the French word is the answer.
    const [frCol, enCol] = cells;
    const words = frCol.split(",").map((c) => c.trim());
    const nums = enCol.split(",").map((c) => c.trim());
    if (words.length === nums.length) {
      words.forEach((w, i) => push(mod, w, nums[i]));
    } else {
      push(mod, frCol, enCol);
    }
    return;
  }

  // A14: | Country | Nationality (m / f) | Language |
  // Ask the country and the language; nationality pairs are adjective forms
  // that the m/f split handles cleanly.
  if (header[0] === "country") {
    const [country, nationality, language] = cells;
    add(mod, country, countryEnglish(country));
    if (nationality) {
      const en = COUNTRY_EN[country]?.replace(/^the /, "");
      if (en) {
        const label = DEMONYM[country] ?? en;
        const forms = splitPair(nationality);
        if (forms.length === 2) {
          add(mod, forms[0], `${label} (masculine)`);
          add(mod, forms[1], `${label} (feminine)`);
        } else {
          add(mod, nationality, `${label}`);
        }
      }
    }
    // Languages are worth drilling in their own right ("le français").
    // Keyed off the language, not the country — Ireland's language is English.
    if (language && splitPair(language).length === 1) {
      const name = LANGUAGE_EN[language];
      if (name) add(mod, language, `${name} (the language)`);
    }
    return;
  }

  const [french, second, third] = cells;

  if (header.length === 3) {
    // | French | Literally | Means |   and   | French | Actually means | NOT |
    push(mod, french, third ?? second, {
      note: header[1] === "literally" ? `literally: ${second}` : null,
    });
    return;
  }

  push(mod, french, second);
}

// The dictionary gives countries only in French, so derive the English prompt
// from a small table — these are the ones that actually differ.
const COUNTRY_EN = {
  "la France": "France", "l'Angleterre": "England", "le Royaume-Uni": "the United Kingdom",
  "l'Irlande": "Ireland", "l'Écosse": "Scotland", "l'Espagne": "Spain", "l'Italie": "Italy",
  "l'Allemagne": "Germany", "le Portugal": "Portugal", "la Belgique": "Belgium",
  "la Suisse": "Switzerland", "les Pays-Bas": "the Netherlands", "la Grèce": "Greece",
  "la Pologne": "Poland", "la Russie": "Russia", "la Chine": "China", "le Japon": "Japan",
  "l'Inde": "India", "les États-Unis": "the United States", "le Canada": "Canada",
  "le Mexique": "Mexico", "le Brésil": "Brazil", "l'Argentine": "Argentina",
  "le Maroc": "Morocco", "l'Algérie": "Algeria", "la Tunisie": "Tunisia",
  "le Sénégal": "Senegal", "l'Australie": "Australia", "la Suède": "Sweden",
  "la Norvège": "Norway", "le Danemark": "Denmark", "la Turquie": "Turkey",
  "l'Égypte": "Egypt", "le Nigeria": "Nigeria", "l'Afrique du Sud": "South Africa",
  "la Corée du Sud": "South Korea", "le Viêt Nam": "Vietnam", "la Thaïlande": "Thailand",
  "l'Autriche": "Austria", "la Roumanie": "Romania", "la Hongrie": "Hungary",
  "la République tchèque": "the Czech Republic", "l'Ukraine": "Ukraine",
  "la Finlande": "Finland", "l'Islande": "Iceland", "le Luxembourg": "Luxembourg",
};

// English demonyms, so the prompt reads "Spanish (feminine)" not "Spain (feminine)".
const DEMONYM = {
  "la France": "French", "l'Angleterre": "English", "le Royaume-Uni": "British",
  "l'Irlande": "Irish", "l'Écosse": "Scottish", "l'Espagne": "Spanish", "l'Italie": "Italian",
  "l'Allemagne": "German", "le Portugal": "Portuguese", "la Belgique": "Belgian",
  "la Suisse": "Swiss", "les Pays-Bas": "Dutch", "la Grèce": "Greek", "la Pologne": "Polish",
  "la Russie": "Russian", "la Chine": "Chinese", "le Japon": "Japanese", "l'Inde": "Indian",
  "les États-Unis": "American", "le Canada": "Canadian", "le Mexique": "Mexican",
  "le Brésil": "Brazilian", "l'Argentine": "Argentinian", "le Maroc": "Moroccan",
  "l'Algérie": "Algerian", "la Tunisie": "Tunisian", "le Sénégal": "Senegalese",
  "l'Australie": "Australian", "la Suède": "Swedish", "la Norvège": "Norwegian",
  "le Danemark": "Danish", "la Turquie": "Turkish", "l'Égypte": "Egyptian",
  "le Nigeria": "Nigerian", "l'Afrique du Sud": "South African",
  "la Corée du Sud": "South Korean", "le Viêt Nam": "Vietnamese",
  "la Thaïlande": "Thai", "l'Autriche": "Austrian", "la Roumanie": "Romanian",
  "la Hongrie": "Hungarian", "la République tchèque": "Czech", "l'Ukraine": "Ukrainian",
  "la Finlande": "Finnish", "l'Islande": "Icelandic", "le Luxembourg": "Luxembourgish",
};

// French language names → English, so the prompt names the language itself.
const LANGUAGE_EN = {
  "le français": "French", "l'anglais": "English", "l'espagnol": "Spanish",
  "l'italien": "Italian", "l'allemand": "German", "le portugais": "Portuguese",
  "le néerlandais": "Dutch", "le grec": "Greek", "le polonais": "Polish",
  "le russe": "Russian", "le chinois": "Chinese", "le japonais": "Japanese",
  "l'hindi": "Hindi", "l'arabe": "Arabic", "le suédois": "Swedish",
  "le norvégien": "Norwegian", "le danois": "Danish", "le turc": "Turkish",
  "le coréen": "Korean", "le vietnamien": "Vietnamese", "le thaï": "Thai",
  "le roumain": "Romanian", "le hongrois": "Hungarian", "le tchèque": "Czech",
  "l'ukrainien": "Ukrainian", "le finnois": "Finnish", "l'islandais": "Icelandic",
};

function countryEnglish(fr) {
  return COUNTRY_EN[fr] ?? null;
}

function push(mod, fr, en, opts = {}) {
  if (!fr || !en) return;
  const frParts = splitPair(fr);
  const enParts = splitPair(en);

  // "le père / la mère" ↔ "father / mother" → two questions.
  if (frParts.length > 1 && frParts.length === enParts.length && frParts.length <= 3) {
    frParts.forEach((f, i) => add(mod, f, enParts[i], opts));
    return;
  }
  add(mod, fr, en, opts);
}

const seen = new Set();
const seenFr = new Set();

function add(mod, fr, en, opts = {}) {
  if (!fr || !en) return;
  fr = fr.trim();
  en = en.trim();
  if (isBadPrompt(en)) return;
  if (fr.length > 60 || en.length > 70) return; // prose row, not an entry
  if (fr.includes("→") || en.includes("→")) return;
  // Paradigm rows ("je, tu, il/elle, ...") are recitations, not spellings.
  if (fr.split(",").length > 2) return;
  // A handful of source rows are written the other way round.
  if (/^(Je|Tu|Il|Elle|On|Nous|Vous|C'est)\b/.test(en)) return;
  if (/\+/.test(fr)) return; // template rows like "Je suis + job"

  const key = `${mod.id}|${fr}|${en}`;
  if (seen.has(key)) return;
  seen.add(key);

  // Reverse mode asks the French word, so two entries in one module sharing a
  // French side with different English is an unanswerable coin flip
  // ("penser à" appears in two D1 tables). Keep the first.
  const frKey = `${mod.id}|${fr.toLowerCase()}`;
  if (seenFr.has(frKey)) return;
  seenFr.add(frKey);

  mod.words.push({ fr, en, ...(opts.note ? { note: opts.note } : {}) });
}

const modules = parse();
const out = modules.map(({ id, part, title, words }) => ({ id, part, title, words }));
const total = out.reduce((n, m) => n + m.words.length, 0);

writeFileSync(
  join(root, "lib", "vocab.ts"),
  `// GENERATED by scripts/build-vocab.mjs — do not edit by hand.
// Source: French-Dictionary-A2-B1.md · ${out.length} modules · ${total} words

export type PartId = "A" | "B" | "C" | "D" | "F";
export type Word = { fr: string; en: string; note?: string };
export type Module = { id: string; part: PartId; title: string; words: Word[] };

export const PARTS: { id: PartId; title: string; blurb: string }[] = ${JSON.stringify(PARTS, null, 2)};

export const MODULES: Module[] = ${JSON.stringify(out, null, 2)};

export const TOTAL_WORDS = ${total};
`
);

console.log(`${out.length} modules · ${total} words`);
for (const m of out) console.log(`  ${m.id.padEnd(4)} ${String(m.words.length).padStart(4)}  ${m.title}`);
