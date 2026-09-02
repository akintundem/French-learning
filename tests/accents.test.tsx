import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Quiz from "@/app/components/Quiz";
import { applyShortcut, insertAt, ACCENT_KEYS } from "@/lib/accents";
import { MODULES } from "@/lib/vocab";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

/** Types a string one character at a time, converting as a real field would. */
const typeWith = (input: string) => {
  let text = "";
  let caret = 0;
  for (const ch of input) {
    text = text.slice(0, caret) + ch + text.slice(caret);
    caret++;
    const hit = applyShortcut(text, caret);
    if (hit) ({ text, caret } = hit);
  }
  return text;
};

describe("accent shortcuts", () => {
  it("converts the common French accents", () => {
    expect(typeWith("l'e'cole")).toBe("l'école");
    expect(typeWith("tre`s")).toBe("très");
    expect(typeWith("la pe^che")).toBe("la pêche");
    expect(typeWith("c,a marche")).toBe("ça marche");
    expect(typeWith("gou^ter")).toBe("goûter");
    expect(typeWith("Noe\"l")).toBe("Noël");
  });

  it("preserves the case of the base letter", () => {
    expect(typeWith("E'")).toBe("É");
    expect(typeWith("A`")).toBe("À");
  });

  it("leaves ordinary words alone", () => {
    // These must not be mangled by an over-eager rule.
    expect(typeWith("moelle")).toBe("moelle");
    expect(typeWith("aerien")).toBe("aerien");
    expect(typeWith("hopital")).toBe("hopital");
    expect(typeWith("the cat")).toBe("the cat");
  });

  it("converts ligatures only with an explicit marker", () => {
    expect(typeWith("oe/uf")).toBe("œuf");
    expect(typeWith("ae/")).toBe("æ");
  });

  it("inserts at the caret, replacing a selection", () => {
    expect(insertAt("ecole", 0, 0, "é")).toEqual({ text: "éecole", caret: 1 });
    expect(insertAt("ecole", 0, 1, "é")).toEqual({ text: "école", caret: 1 });
    expect(insertAt("cafe", 4, 4, "é")).toEqual({ text: "cafeé", caret: 5 });
  });
});

describe("accent bar", () => {
  const one = [{ fr: "l'école", en: "school" }];

  it("offers every accent the dictionary uses", () => {
    const used = new Set<string>();
    for (const m of MODULES)
      for (const w of m.words)
        for (const ch of w.fr.toLowerCase())
          if (ch.charCodeAt(0) > 127 && /\p{L}/u.test(ch)) used.add(ch);

    const offered = new Set<string>(ACCENT_KEYS);
    expect([...used].filter((c) => !offered.has(c))).toEqual([]);
  });

  it("typing a bare answer then tapping an accent completes it", async () => {
    const u = userEvent.setup();
    render(<Quiz title="T" words={one} scope="test" />);
    const input = (await screen.findByLabelText(
      /answer in french/i
    )) as HTMLInputElement;

    await u.type(input, "l'ecole");
    // Put the caret after the bare "e" and swap it for "é".
    input.setSelectionRange(2, 3);
    await u.click(screen.getByRole("button", { name: "Insert é" }));

    expect(input.value).toBe("l'école");
    await u.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Correct.")).toBeInTheDocument();
  });

  it("is hidden in FR → EN, where answers have no accents", async () => {
    const u = userEvent.setup();
    render(<Quiz title="T" words={one} scope="test" />);
    await screen.findByLabelText(/answer in french/i);
    expect(screen.getByRole("button", { name: "Insert é" })).toBeInTheDocument();

    await u.click(screen.getByRole("radio", { name: /FR → EN/ }));
    expect(screen.queryByRole("button", { name: "Insert é" })).not.toBeInTheDocument();
  });

  it("hides once an answer is showing", async () => {
    const u = userEvent.setup();
    render(<Quiz title="T" words={one} scope="test" />);
    await screen.findByLabelText(/answer in french/i);

    await u.click(screen.getByRole("button", { name: /^skip/i }));
    expect(screen.queryByRole("button", { name: "Insert é" })).not.toBeInTheDocument();
  });
});
