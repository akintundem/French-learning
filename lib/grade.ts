// Grading for both directions.
//
// en→fr (spelling): strict. Accents and articles both count — the point of
//   the app. Only case, curly quotes and trailing punctuation are forgiven.
//
// fr→en (recall): also strict on the full phrase. "le temps → time, weather"
//   requires both senses, not just one. What differs is that English has no
//   accents to grade, so a near-miss can only ever be "wrong".
//
// In both directions a "/" in the source means genuine alternatives
// ("avoir la pêche / la patate"), and any one of them is accepted.

export type Direction = "en-fr" | "fr-en";

export type Grade =
  | { status: "correct" }
  | { status: "accent"; expected: string }   // right letters, wrong accents
  | { status: "wrong"; expected: string };

const normalise = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ")
    // Curly apostrophes and the French space before ? ! : are typing noise.
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+([?!:;])/g, "$1");

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Parenthetical glosses disambiguate the prompt rather than form part of the
 * answer: "cousin (male)", "Spanish (the language)", "to know (a fact)".
 * Accept the answer with or without them.
 */
const withoutGloss = (s: string) => s.replace(/\s*\([^)]*\)/g, " ").trim();

/** A "/" means "either of these is a correct answer". */
const alternatives = (expected: string): string[] => {
  const parts = expected.split("/").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? [expected, ...parts] : [expected];
};

const accepted = (expected: string): string[] => {
  const forms = new Set<string>();
  for (const alt of alternatives(expected)) {
    forms.add(normalise(alt));
    const bare = withoutGloss(alt);
    if (bare) forms.add(normalise(bare));
  }
  return [...forms].filter(Boolean);
};

/**
 * Grades against several equally correct answers — "3:45 pm" is both
 * "quinze heures quarante-cinq" and "quatre heures moins le quart". The first
 * is treated as canonical and shown when the answer is wrong.
 */
export function gradeAny(
  input: string,
  expected: string[],
  direction: Direction = "en-fr"
): Grade {
  let best: Grade = { status: "wrong", expected: expected[0] ?? "" };
  for (const option of expected) {
    const result = grade(input, option, direction);
    if (result.status === "correct") return result;
    // An accent slip against any form beats a plain miss against all of them.
    if (result.status === "accent") best = { status: "accent", expected: option };
  }
  return best;
}

export function grade(
  input: string,
  expected: string,
  direction: Direction = "en-fr"
): Grade {
  const answer = normalise(input);
  if (!answer) return { status: "wrong", expected };

  const options = accepted(expected);
  if (options.includes(answer)) return { status: "correct" };

  // Same letters, wrong accents. Only meaningful when the answer is French —
  // an English answer that differs only by accent is just a typo.
  if (direction === "en-fr") {
    const bare = stripAccents(answer);
    if (options.some((o) => stripAccents(o) === bare)) {
      return { status: "accent", expected };
    }
  }

  return { status: "wrong", expected };
}

/**
 * Whether the answer was close enough to be worth showing a "you were near"
 * hint — one or two characters out. Used only for feedback wording.
 */
export function isNearMiss(input: string, expected: string): boolean {
  const a = normalise(input);
  if (!a) return false;
  return accepted(expected).some((b) => {
    if (Math.abs(a.length - b.length) > 2) return false;
    return editDistance(a, b) <= 2;
  });
}

function editDistance(a: string, b: string): number {
  // Standard Levenshtein, single-row. Strings here are short (< 60 chars).
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length];
}
