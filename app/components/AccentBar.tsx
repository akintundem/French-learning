"use client";

import { useRef } from "react";
import { ACCENT_KEYS } from "@/lib/accents";

/**
 * Tappable accent keys for keyboards that can't produce them. Sits directly
 * under the answer field.
 *
 * Insertion happens on pointer-down rather than click, with preventDefault, so
 * the input never loses focus — on mobile that would close the keyboard
 * between every character.
 *
 * The handler is `onPointerDown`, which fires exactly once for mouse, touch
 * and pen alike. Using onMouseDown and onTouchStart together inserted twice on
 * a touchscreen, because the browser follows a real touchstart with a
 * synthesised mousedown.
 */
export default function AccentBar({
  onInsert,
  disabled,
}: {
  onInsert: (ch: string) => void;
  disabled?: boolean;
}) {
  // A pointer id is unique per contact, so a second event for the same touch
  // — from a browser that still synthesises one — is ignored.
  const lastPointer = useRef<number | null>(null);

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
          onPointerDown={(e) => {
            e.preventDefault();
            if (lastPointer.current === e.pointerId) return;
            lastPointer.current = e.pointerId;
            onInsert(ch);
          }}
          onPointerUp={() => {
            lastPointer.current = null;
          }}
          onPointerCancel={() => {
            lastPointer.current = null;
          }}
          // preventDefault on pointerdown suppresses the click, so keyboard
          // users (Enter/Space, which emit a click with no pointer) need this.
          onClick={(e) => {
            if (e.detail === 0) onInsert(ch);
          }}
          className="answer-input h-11 min-w-11 rounded-md border border-rule bg-paper-raised px-3 text-[17px] text-ink transition-colors hover:border-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:opacity-40"
        >
          {ch}
        </button>
      ))}
    </div>
  );
}
