import type { ErrorKind } from "./types";

const ARTICLES = ["le", "la", "les", "l'", "un", "une", "des", "du", "de la"];

const strip = (s: string) =>
  s.trim().toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ");

const withoutArticle = (s: string) => {
  const t = strip(s);
  for (const a of ARTICLES) {
    if (a.endsWith("'") ? t.startsWith(a) : t.startsWith(a + " "))
      return t.slice(a.length).trim();
  }
  return t;
};

const bare = (s: string) =>
  strip(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Why an answer was wrong. These need different fixes, so they are worth
 * separating: an accent slip means you know the word, a wrong article means
 * you know the word but not its gender, and unknown means you don't know it.
 */
export function classifyError(
  given: string,
  expected: string,
  status: "correct" | "accent" | "wrong"
): ErrorKind | null {
  if (status === "correct") return null;
  if (!given.trim()) return "skipped";
  if (status === "accent") return "accent";

  // Right word, wrong (or missing) article.
  const g = withoutArticle(given);
  const e = withoutArticle(expected);
  if (g && g === e) return "article";
  if (bare(g) === bare(e)) return "article"; // article wrong AND accent off

  return "unknown";
}
