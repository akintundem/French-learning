// Generated grammar practice for A1 — conjugation, questions, frequency.
//
// Same shape as lib/practical.ts: each generator returns a prompt and every
// French form that counts as correct. Nothing is drawn from a fixed list of
// sentences, so you learn the rule rather than the examples.
//
// Vocabulary is restricted to verbs from A2 of the dictionary, so a question
// never turns into a vocabulary test by accident.

import type { Generated } from "./practical";

export type GrammarId =
  | "er-present"
  | "ir-present"
  | "est-ce-que"
  | "interrogatives"
  | "en-train-de"
  | "frequency";

export type GrammarTopic = {
  id: GrammarId;
  title: string;
  blurb: string;
  generate: (rng: () => number) => Generated;
};

const pick = <T,>(rng: () => number, xs: readonly T[]): T =>
  xs[Math.floor(rng() * xs.length)];

// ------------------------------------------------------------------ pronouns

/**
 * `ils` and `elles` share an ending, as do `il` and `elle`. The drill asks for
 * one specific pronoun, so each entry carries the English that pins it down.
 */
type Person = {
  fr: string;
  en: string;
  /** Index into the ending tables below. */
  slot: 0 | 1 | 2 | 3 | 4 | 5;
  /** `j'` before a vowel. */
  elides?: boolean;
};

const PEOPLE: readonly Person[] = [
  { fr: "je", en: "I", slot: 0, elides: true },
  { fr: "tu", en: "you", slot: 1 },
  { fr: "il", en: "he", slot: 2 },
  { fr: "elle", en: "she", slot: 2 },
  { fr: "nous", en: "we", slot: 3 },
  { fr: "vous", en: "you (plural)", slot: 4 },
  { fr: "ils", en: "they", slot: 5 },
  { fr: "elles", en: "they (feminine)", slot: 5 },
];

const VOWEL = /^[aeiouâêîôûéèh]/i;

/** "je" + "aime" -> "j'aime". */
const join = (p: Person, form: string) =>
  p.elides && VOWEL.test(form) ? `j'${form}` : `${p.fr} ${form}`;

// --------------------------------------------------------------- -er verbs

const ER_ENDINGS = ["e", "es", "e", "ons", "ez", "ent"] as const;

/** -er verbs from A2. Spelling-change verbs are deliberately excluded. */
const ER_VERBS: readonly { inf: string; en: string; ing: string }[] = [
  { inf: "parler", en: "to speak", ing: "speaking" },
  { inf: "habiter", en: "to live", ing: "living" },
  { inf: "travailler", en: "to work", ing: "working" },
  { inf: "aimer", en: "to like", ing: "liking" },
  { inf: "détester", en: "to hate", ing: "hating" },
  { inf: "chercher", en: "to look for", ing: "looking for" },
  { inf: "trouver", en: "to find", ing: "finding" },
  { inf: "donner", en: "to give", ing: "giving" },
  { inf: "demander", en: "to ask", ing: "asking" },
  { inf: "écouter", en: "to listen", ing: "listening" },
  { inf: "regarder", en: "to watch", ing: "watching" },
  { inf: "penser", en: "to think", ing: "thinking" },
  { inf: "jouer", en: "to play", ing: "playing" },
  { inf: "marcher", en: "to walk", ing: "walking" },
  { inf: "aider", en: "to help", ing: "helping" },
  { inf: "oublier", en: "to forget", ing: "forgetting" },
  { inf: "porter", en: "to wear", ing: "wearing" },
  { inf: "rencontrer", en: "to meet", ing: "meeting" },
  { inf: "téléphoner", en: "to phone", ing: "phoning" },
  { inf: "rester", en: "to stay", ing: "staying" },
  { inf: "visiter", en: "to visit", ing: "visiting" },
  { inf: "utiliser", en: "to use", ing: "using" },
];

const conjugateEr = (inf: string, p: Person) =>
  inf.slice(0, -2) + ER_ENDINGS[p.slot];

const erPresent = (rng: () => number): Generated => {
  const v = pick(rng, ER_VERBS);
  const p = pick(rng, PEOPLE);
  const form = conjugateEr(v.inf, p);

  return {
    id: `erpres-${v.inf}-${p.fr}`,
    prompt: `${p.en} + ${v.inf}`,
    answers: [join(p, form)],
    hint: `${v.en} · write the pronoun and the verb`,
  };
};

// --------------------------------------------------------------- -ir verbs

// Regular -ir verbs take -iss- in the plural: finir -> nous finissons.
const IR_ENDINGS = ["is", "is", "it", "issons", "issez", "issent"] as const;

const IR_VERBS: readonly { inf: string; en: string; ing: string }[] = [
  { inf: "finir", en: "to finish", ing: "finishing" },
  { inf: "choisir", en: "to choose", ing: "choosing" },
  { inf: "réussir", en: "to succeed", ing: "succeeding" },
  { inf: "grandir", en: "to grow", ing: "growing" },
  { inf: "obéir", en: "to obey", ing: "obeying" },
  { inf: "remplir", en: "to fill", ing: "filling" },
  { inf: "réfléchir", en: "to think it over", ing: "thinking it over" },
  { inf: "punir", en: "to punish", ing: "punishing" },
  { inf: "bâtir", en: "to build", ing: "building" },
  { inf: "guérir", en: "to heal", ing: "healing" },
];

const conjugateIr = (inf: string, p: Person) =>
  inf.slice(0, -2) + IR_ENDINGS[p.slot];

const irPresent = (rng: () => number): Generated => {
  const v = pick(rng, IR_VERBS);
  const p = pick(rng, PEOPLE);
  const form = conjugateIr(v.inf, p);

  return {
    id: `irpres-${v.inf}-${p.fr}`,
    prompt: `${p.en} + ${v.inf}`,
    answers: [join(p, form)],
    hint:
      p.slot >= 3
        ? `${v.en} · the plural takes -iss-`
        : `${v.en} · write the pronoun and the verb`,
  };
};

// ---------------------------------------------------------------- est-ce que

/** A ready-made clause to wrap in a question. */
type Clause = { fr: string; en: string };

const clause = (rng: () => number): Clause => {
  const p = pick(rng, PEOPLE);
  const useIr = rng() < 0.35;
  const v = useIr ? pick(rng, IR_VERBS) : pick(rng, ER_VERBS);
  const form = useIr ? conjugateIr(v.inf, p) : conjugateEr(v.inf, p);

  // "he speaks", but "you speak" / "we speak".
  const third = p.slot === 2;
  const enVerb = v.en.replace(/^to /, "");
  const enForm = third ? enVerb.replace(/^(\w+)/, "$1s") : enVerb;

  return { fr: join(p, form), en: `${p.en} ${enForm}` };
};

const estCeQue = (rng: () => number): Generated => {
  const c = clause(rng);
  // est-ce qu' before a vowel: "est-ce qu'il parle".
  const head = VOWEL.test(c.fr) ? "est-ce qu'" : "est-ce que ";

  return {
    id: `ecq-${c.fr.replace(/\s+/g, "_")}`,
    prompt: `Ask: do ${c.en}?`,
    answers: [`${head}${c.fr} ?`],
    hint: "use est-ce que",
  };
};

// ----------------------------------------------------------- interrogatives

const INTERROGATIVES: readonly {
  fr: string;
  cue: string;
  frame: (c: Clause) => string;
}[] = [
  { fr: "où", cue: "where", frame: (c) => `where do ${c.en}` },
  { fr: "quand", cue: "when", frame: (c) => `when do ${c.en}` },
  { fr: "pourquoi", cue: "why", frame: (c) => `why do ${c.en}` },
  { fr: "comment", cue: "how", frame: (c) => `how do ${c.en}` },
  { fr: "combien", cue: "how much", frame: (c) => `how much do ${c.en}` },
];

const interrogatives = (rng: () => number): Generated => {
  const q = pick(rng, INTERROGATIVES);
  const c = clause(rng);
  const head = VOWEL.test(c.fr) ? "est-ce qu'" : "est-ce que ";

  return {
    id: `interro-${q.fr}-${c.fr.replace(/\s+/g, "_")}`,
    prompt: `Ask: ${q.frame(c)}?`,
    answers: [`${q.fr} ${head}${c.fr} ?`],
    hint: `start with ${q.fr}`,
  };
};

// ------------------------------------------------------------- en train de

// French has no present continuous; "être en train de" carries the sense of
// an action under way, so the drill is really être + en train de + infinitive.
const ETRE = ["suis", "es", "est", "sommes", "êtes", "sont"] as const;

const enTrainDe = (rng: () => number): Generated => {
  const p = pick(rng, PEOPLE);
  const useIr = rng() < 0.35;
  const v = useIr ? pick(rng, IR_VERBS) : pick(rng, ER_VERBS);

  const be = ETRE[p.slot];
  // "en train d'écouter" before a vowel.
  const de = VOWEL.test(v.inf) ? "d'" : "de ";
  const subject = p.elides ? "je" : p.fr;

  const beEn =
    p.slot === 0 ? "am" : p.slot === 2 ? "is" : "are";

  return {
    id: `etd-${v.inf}-${p.fr}`,
    prompt: `${p.en} ${beEn} ${v.ing} (right now)`,
    answers: [`${subject} ${be} en train ${de}${v.inf}`],
    hint: "être en train de + infinitive",
  };
};

// -------------------------------------------------------------- frequency

/**
 * Placement is the whole lesson. Single-word adverbs sit straight after the
 * verb; the longer phrases sit at either end of the sentence.
 */
const AFTER_VERB: readonly { fr: string; en: string }[] = [
  { fr: "toujours", en: "always" },
  { fr: "souvent", en: "often" },
  { fr: "parfois", en: "sometimes" },
  { fr: "rarement", en: "rarely" },
  { fr: "quelquefois", en: "sometimes" },
];

const MOVABLE: readonly { fr: string; en: string }[] = [
  { fr: "tous les jours", en: "every day" },
  { fr: "de temps en temps", en: "from time to time" },
  { fr: "une fois par semaine", en: "once a week" },
  { fr: "le week-end", en: "at the weekend" },
];

const frequency = (rng: () => number): Generated => {
  const c = clause(rng);
  const movable = rng() < 0.4;
  const adv = movable ? pick(rng, MOVABLE) : pick(rng, AFTER_VERB);

  if (movable) {
    // Either end is correct; front-placement takes a comma in writing.
    return {
      id: `freq-${adv.fr.replace(/\s+/g, "_")}-${c.fr.replace(/\s+/g, "_")}`,
      prompt: `${c.en} ${adv.en}`,
      answers: [`${c.fr} ${adv.fr}`, `${adv.fr}, ${c.fr}`, `${adv.fr} ${c.fr}`],
      hint: "a phrase this long goes at the start or the end",
    };
  }

  // "il parle souvent" — never "il souvent parle".
  const [subject, ...rest] = c.fr.split(" ");
  const verb = rest.join(" ");

  return {
    id: `freq-${adv.fr}-${c.fr.replace(/\s+/g, "_")}`,
    prompt: `${c.en} ${adv.en}`,
    answers: [`${subject} ${verb} ${adv.fr}`],
    hint: "one word — it follows the verb",
  };
};

export const GRAMMAR_TOPICS: GrammarTopic[] = [
  { id: "er-present",     title: "-er verbs",        blurb: "je, tu, il, nous, vous, ils", generate: erPresent },
  { id: "ir-present",     title: "-ir verbs",        blurb: "finir, choisir, réussir",     generate: irPresent },
  { id: "est-ce-que",     title: "Est-ce que",       blurb: "Yes/no questions",            generate: estCeQue },
  { id: "interrogatives", title: "Question words",   blurb: "où, quand, pourquoi…",        generate: interrogatives },
  { id: "en-train-de",    title: "Happening now",    blurb: "être en train de",            generate: enTrainDe },
  { id: "frequency",      title: "How often",        blurb: "souvent, toujours, rarement", generate: frequency },
];

export const GRAMMAR_IDS = GRAMMAR_TOPICS.map((t) => t.id);
