// Accent input for a plain English keyboard.
//
// Two routes, both optional — a French keyboard layout still works as before:
//   1. The accent bar under the field inserts a character at the cursor.
//   2. Typing a base letter then a marker converts it: e' -> é, c, -> ç.

/** Ordered by how often each appears in the dictionary, commonest first. */
export const ACCENT_KEYS = [
  "é", "à", "è", "ç", "ê", "ô", "â", "î", "û", "ù", "ï", "ë", "œ", "æ",
] as const;

/**
 * Trailing-marker shortcuts. The marker follows the letter, so typing stays
 * left-to-right: "e" then "'" becomes "é".
 */
const SHORTCUTS: Record<string, string> = {
  "e'": "é", "e`": "è", "e^": "ê", 'e"': "ë",
  "a`": "à", "a^": "â",
  "u`": "ù", "u^": "û", 'u"': "ü",
  "i^": "î", 'i"': "ï",
  "o^": "ô", 'o"': "ö",
  "c,": "ç",
};

// "oe"/"ae" occur naturally ("moelle", "aérien"), so a bare pair must never
// convert. These need the explicit trailing marker.
const LIGATURES: Record<string, string> = { "oe/": "œ", "ae/": "æ" };

/**
 * Applies a shortcut if the text now ends in one. Returns null when nothing
 * matched, so the caller can leave the input untouched.
 */
export function applyShortcut(
  text: string,
  caret: number
): { text: string; caret: number } | null {
  for (const [pattern, replacement] of Object.entries(LIGATURES)) {
    if (caret >= pattern.length) {
      const slice = text.slice(caret - pattern.length, caret).toLowerCase();
      if (slice === pattern) {
        return {
          text: text.slice(0, caret - pattern.length) + replacement + text.slice(caret),
          caret: caret - pattern.length + replacement.length,
        };
      }
    }
  }

  if (caret < 2) return null;
  const pair = text.slice(caret - 2, caret);
  const hit = SHORTCUTS[pair.toLowerCase()];
  if (!hit) return null;

  // Preserve the case the letter was typed in.
  const cased = pair[0] === pair[0].toUpperCase() ? hit.toUpperCase() : hit;
  return {
    text: text.slice(0, caret - 2) + cased + text.slice(caret),
    caret: caret - 2 + cased.length,
  };
}

/** Inserts a character at the caret, replacing any selection. */
export function insertAt(
  text: string,
  start: number,
  end: number,
  ch: string
): { text: string; caret: number } {
  return {
    text: text.slice(0, start) + ch + text.slice(end),
    caret: start + ch.length,
  };
}
