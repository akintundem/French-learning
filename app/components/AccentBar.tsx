"use client";

import { ACCENT_KEYS } from "@/lib/accents";

/**
 * Tappable accent keys for keyboards that can't produce them. Sits directly
 * under the answer field. Buttons use onMouseDown/onTouchStart with
 * preventDefault so the input never loses focus — on mobile that would close
 * the keyboard between every character.
 */
export default function AccentBar({
  onInsert,
  disabled,
}: {
  onInsert: (ch: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="mt-4 flex flex-wrap gap-1.5"
      role="group"
      aria-label="Insert an accented character"
    >
      {ACCENT_KEYS.map((ch, i) => (
        <button
          key={ch}
          type="button"
          disabled={disabled}
          aria-label={`Insert ${ch}`}
          title={i < 9 ? `${ch}  (Alt+${i + 1})` : ch}
          onMouseDown={(e) => {
            e.preventDefault();
            onInsert(ch);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onInsert(ch);
          }}
          className="answer-input h-11 min-w-11 rounded-md border border-rule bg-paper-raised px-3 text-[17px] text-ink transition-colors hover:border-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:opacity-40"
        >
          {ch}
        </button>
      ))}
    </div>
  );
}
