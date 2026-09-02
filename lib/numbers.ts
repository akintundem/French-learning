// Spelling French numbers in words.
//
// The awkward parts, all of which the tests below pin down:
//   17–19  dix-sept, dix-huit, dix-neuf   (not *dix-sept as one word)
//   21, 31 vingt-et-un, trente-et-un      ("et" only for 1, and not for 81)
//   70–79  soixante-dix … soixante-dix-neuf
//   71     soixante-et-onze
//   80     quatre-vingts   (with -s)
//   81     quatre-vingt-un (no -s once something follows)
//   90–99  quatre-vingt-dix … quatre-vingt-dix-neuf
//   100    cent      200 deux cents      201 deux cent un (-s drops again)

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
  "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
];

const TENS: Record<number, string> = {
  20: "vingt", 30: "trente", 40: "quarante", 50: "cinquante", 60: "soixante",
};

/** 0–99. */
function underHundred(n: number): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;

  if (n < 70) {
    const tens = Math.floor(n / 10) * 10;
    const unit = n % 10;
    if (unit === 0) return TENS[tens];
    if (unit === 1) return `${TENS[tens]}-et-un`;
    return `${TENS[tens]}-${UNITS[unit]}`;
  }

  // 70–79 count on from soixante; 71 keeps the "et".
  if (n < 80) {
    if (n === 71) return "soixante-et-onze";
    return `soixante-${underHundred(n - 60)}`;
  }

  // 80 alone takes -s; anything after it drops the -s and the "et".
  if (n === 80) return "quatre-vingts";
  return `quatre-vingt-${underHundred(n - 80)}`;
}

/** 0–999. */
function underThousand(n: number): string {
  if (n < 100) return underHundred(n);

  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  // "cent", not "un cent". Plural -s only when nothing follows.
  const head =
    hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent${rest === 0 ? "s" : ""}`;
  return rest === 0 ? head : `${head} ${underHundred(rest)}`;
}

/** Spells a whole number, 0 to 999,999. */
export function spellNumber(n: number): string {
  if (n < 0) return `moins ${spellNumber(-n)}`;
  if (n < 1000) return underThousand(n);

  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  // "mille" is invariable and takes no "un".
  const head = thousands === 1 ? "mille" : `${underThousand(thousands)} mille`;
  return rest === 0 ? head : `${head} ${underThousand(rest)}`;
}

/** Ordinals: 1st is premier/première, the rest take -ième. */
export function spellOrdinal(n: number, feminine = false): string {
  if (n === 1) return feminine ? "première" : "premier";
  let base = spellNumber(n);
  if (base.endsWith("e")) base = base.slice(0, -1);   // quatre -> quatr-
  if (base.endsWith("q")) base += "u";                // cinq   -> cinqu-
  if (base.endsWith("f")) base = base.slice(0, -1) + "v"; // neuf -> neuv-
  return `${base}ième`;
}
