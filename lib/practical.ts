// Generated practice for numbers, money, time and dates — the things a
// vocabulary list can't cover, because the variations are endless.
//
// Each generator returns a prompt (what you read, in English/figures) and
// every French form that counts as correct. Rules follow D5 of the dictionary.

import { spellNumber, spellOrdinal } from "./numbers";

export type Generated = {
  id: string;        // stable within a session, for React keys
  prompt: string;    // what the learner reads
  answers: string[]; // every accepted French form, first is canonical
  hint?: string;
};

export type TopicId =
  | "cardinals" | "prices" | "times" | "dates" | "years"
  | "percentages" | "fractions" | "ordinals";

export type Topic = {
  id: TopicId;
  title: string;
  blurb: string;
  generate: (rng: () => number) => Generated;
};

const pick = <T,>(rng: () => number, xs: readonly T[]): T =>
  xs[Math.floor(rng() * xs.length)];

const int = (rng: () => number, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

export const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

export const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const DAYS = [
  "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
] as const;

export const DAYS_EN = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;

/** Days of the month use cardinals, except the 1st. */
const dayOfMonth = (d: number) => (d === 1 ? "premier" : spellNumber(d));

// ---------------------------------------------------------------- cardinals

const cardinals = (rng: () => number): Generated => {
  // Weighted so the genuinely awkward ranges (70–99) come up often.
  const band = rng();
  const n =
    band < 0.25 ? int(rng, 0, 20) :
    band < 0.45 ? int(rng, 21, 69) :
    band < 0.75 ? int(rng, 70, 99) :
    band < 0.92 ? int(rng, 100, 999) :
                  int(rng, 1000, 9999);
  return { id: `card-${n}`, prompt: String(n), answers: [spellNumber(n)] };
};

// ------------------------------------------------------------------- prices

const prices = (rng: () => number): Generated => {
  const euros = int(rng, 1, 199);
  const cents = pick(rng, [0, 0, 5, 10, 25, 50, 75, 90, 99]);
  const shown = `€${euros}${cents ? "." + String(cents).padStart(2, "0") : ""}`;

  const unit = euros === 1 ? "euro" : "euros";
  if (!cents) {
    return {
      id: `price-${euros}`,
      prompt: shown,
      answers: [`${spellNumber(euros)} ${unit}`],
    };
  }
  // "douze euros cinquante" is how it's said; the fuller form is also right.
  return {
    id: `price-${euros}-${cents}`,
    prompt: shown,
    answers: [
      `${spellNumber(euros)} ${unit} ${spellNumber(cents)}`,
      `${spellNumber(euros)} ${unit} ${spellNumber(cents)} centimes`,
    ],
  };
};

// --------------------------------------------------------------------- time

const times = (rng: () => number): Generated => {
  const h24 = int(rng, 0, 23);
  const minute = pick(rng, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);

  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? "am" : "pm";
  const prompt = `${h12}:${String(minute).padStart(2, "0")} ${suffix}`;

  const answers = new Set<string>();

  // 24-hour, the official form: "quinze heures quarante-cinq".
  const hourWord = (h: number) =>
    h === 0 ? "zéro heure" : h === 1 ? "une heure" : `${spellNumber(h)} heures`;

  answers.add(
    minute === 0 ? hourWord(h24) : `${hourWord(h24)} ${spellNumber(minute)}`
  );

  // Conversational 12-hour, with the quarter/half idioms.
  const conv = hourWord(h12);
  if (minute === 0) answers.add(conv);
  else if (minute === 15) answers.add(`${conv} et quart`);
  else if (minute === 30) answers.add(`${conv} et demie`);
  else if (minute === 45) {
    const next = h12 === 12 ? 1 : h12 + 1;
    answers.add(`${hourWord(next)} moins le quart`);
  } else if (minute > 30) {
    const next = h12 === 12 ? 1 : h12 + 1;
    answers.add(`${hourWord(next)} moins ${spellNumber(60 - minute)}`);
    answers.add(`${conv} ${spellNumber(minute)}`);
  } else {
    answers.add(`${conv} ${spellNumber(minute)}`);
  }

  // Midday and midnight have their own words.
  if (h24 === 12 && minute === 0) answers.add("midi");
  if (h24 === 0 && minute === 0) answers.add("minuit");
  if (h24 === 12 && minute === 30) answers.add("midi et demie");
  if (h24 === 0 && minute === 30) answers.add("minuit et demie");

  return {
    id: `time-${h24}-${minute}`,
    prompt,
    answers: [...answers],
    hint: "24-hour or conversational form",
  };
};

// -------------------------------------------------------------------- dates

const dates = (rng: () => number): Generated => {
  const monthIndex = int(rng, 0, 11);
  const day = int(rng, 1, 28);
  const withYear = rng() < 0.5;
  const year = int(rng, 1990, 2030);

  const prompt = `${day} ${MONTHS_EN[monthIndex]}${withYear ? ` ${year}` : ""}`;
  const core = `le ${dayOfMonth(day)} ${MONTHS[monthIndex]}`;
  const full = withYear ? `${core} ${spellNumber(year)}` : core;

  return {
    id: `date-${day}-${monthIndex}-${withYear ? year : "x"}`,
    prompt,
    answers: [full],
    hint: day === 1 ? "the 1st is the only ordinal" : undefined,
  };
};

// -------------------------------------------------------------------- years

const years = (rng: () => number): Generated => {
  const y = pick(rng, [
    int(rng, 1900, 1999),
    int(rng, 2000, 2030),
    int(rng, 1800, 1899),
  ]);
  const answers = [spellNumber(y)];

  // 1900–1999 is also said in hundreds: "dix-neuf cent trente-huit".
  if (y >= 1100 && y < 2000) {
    const hundreds = Math.floor(y / 100);
    const rest = y % 100;
    const head = `${spellNumber(hundreds)} cent${rest === 0 ? "s" : ""}`;
    answers.push(rest === 0 ? head : `${head} ${spellNumber(rest)}`);
  }

  return { id: `year-${y}`, prompt: String(y), answers };
};

// -------------------------------------------------------------- percentages

const percentages = (rng: () => number): Generated => {
  const n = pick(rng, [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100]);
  return {
    id: `pct-${n}`,
    prompt: `${n}%`,
    answers: [`${spellNumber(n)} pour cent`],
  };
};

// ---------------------------------------------------------------- fractions

const FRACTIONS: Record<string, string[]> = {
  "1/2": ["un demi", "une demie"],
  "1/3": ["un tiers"],
  "2/3": ["deux tiers"],
  "1/4": ["un quart"],
  "3/4": ["trois quarts"],
  "1/5": ["un cinquième"],
  "2/5": ["deux cinquièmes"],
  "1/10": ["un dixième"],
};

const fractions = (rng: () => number): Generated => {
  const key = pick(rng, Object.keys(FRACTIONS));
  return { id: `frac-${key}`, prompt: key, answers: FRACTIONS[key] };
};

// ----------------------------------------------------------------- ordinals

const ORDINAL_SUFFIX = (n: number) => {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
};

const ordinals = (rng: () => number): Generated => {
  const n = pick(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 21, 30, 100]);
  return {
    id: `ord-${n}`,
    prompt: `${n}${ORDINAL_SUFFIX(n)}`,
    answers: n === 1 ? ["premier", "première"] : [spellOrdinal(n)],
  };
};

export const TOPICS: Topic[] = [
  { id: "cardinals",   title: "Numbers",     blurb: "0 – 9,999",            generate: cardinals },
  { id: "prices",      title: "Prices",      blurb: "Euros and centimes",   generate: prices },
  { id: "times",       title: "Telling time", blurb: "24-hour and spoken",  generate: times },
  { id: "dates",       title: "Dates",       blurb: "Days and months",      generate: dates },
  { id: "years",       title: "Years",       blurb: "1800 – 2030",          generate: years },
  { id: "percentages", title: "Percentages", blurb: "pour cent",            generate: percentages },
  { id: "fractions",   title: "Fractions",   blurb: "demi, tiers, quart",   generate: fractions },
  { id: "ordinals",    title: "Ordinals",    blurb: "premier, deuxième…",   generate: ordinals },
];

export const TOPIC_IDS = TOPICS.map((t) => t.id);
