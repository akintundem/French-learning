import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Quiz from "@/app/components/Quiz";
import { grade } from "@/lib/grade";
import { MODULES } from "@/lib/vocab";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const one = [{ fr: "l'école", en: "school" }];
const toggle = (name: RegExp) => screen.getByRole("radio", { name });

describe("direction toggle", () => {
  it("defaults to EN → FR and asks for the French spelling", async () => {
    render(<Quiz title="T" words={one} scope="test" />);
    await screen.findByLabelText(/answer in french/i);

    expect(toggle(/EN → FR/)).toHaveAttribute("aria-checked", "true");
    expect(toggle(/FR → EN/)).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Write in French")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("school");
  });

  it("switching to FR → EN flips the prompt and the expected answer", async () => {
    const u = userEvent.setup();
    render(<Quiz title="T" words={one} scope="test" />);
    await screen.findByLabelText(/answer in french/i);

    await u.click(toggle(/FR → EN/));

    expect(screen.getByText("Write in English")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("l'école");
    expect(screen.getByLabelText(/answer in english/i)).toBeInTheDocument();

    await u.type(screen.getByLabelText(/answer in english/i), "school");
    await u.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Correct.")).toBeInTheDocument();
  });

  it("marks the French word wrong when English was asked for", async () => {
    const u = userEvent.setup();
    render(<Quiz title="T" words={one} scope="test" />);
    await screen.findByLabelText(/answer in french/i);
    await u.click(toggle(/FR → EN/));

    await u.type(screen.getByLabelText(/answer in english/i), "l'école");
    await u.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Not quite")).toBeInTheDocument();
  });

  it("reveals the answer in the language being asked for", async () => {
    const u = userEvent.setup();
    render(<Quiz title="T" words={one} scope="test" />);
    await screen.findByLabelText(/answer in french/i);
    await u.click(toggle(/FR → EN/));
    await u.click(screen.getByRole("button", { name: /^skip/i }));

    // Skipping FR → EN must show "school", not "l'école".
    expect(screen.getByText("school")).toBeInTheDocument();
  });

  it("switching direction restarts the round rather than keeping the score", async () => {
    const u = userEvent.setup();
    render(<Quiz title="T" words={[...one, { fr: "le pain", en: "bread" }]} scope="test" />);
    await screen.findByLabelText(/answer in french/i);

    await u.click(screen.getByRole("button", { name: /^skip/i }));
    await u.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    await u.click(toggle(/FR → EN/));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();
  });

  it("keeps the accent category for French answers only", () => {
    // Accents are a French spelling concern; in reverse it is just wrong.
    expect(grade("l'ecole", "l'école", "en-fr").status).toBe("accent");
    expect(grade("cafe", "café", "fr-en").status).toBe("wrong");
  });
});

describe("reverse-mode grading", () => {
  it("requires every listed sense, per strict grading", () => {
    expect(grade("time, weather", "time, weather", "fr-en").status).toBe("correct");
    expect(grade("time", "time, weather", "fr-en").status).toBe("wrong");
  });

  it("accepts either side of a slash alternative", () => {
    expect(grade("to begin to", "to begin to", "fr-en").status).toBe("correct");
    expect(grade("la patate", "avoir la pêche / la patate", "en-fr").status).toBe(
      "correct"
    );
  });

  it("treats a parenthetical gloss as optional", () => {
    expect(grade("to know", "to know (a fact)", "fr-en").status).toBe("correct");
    expect(grade("to know (a fact)", "to know (a fact)", "fr-en").status).toBe(
      "correct"
    );
    expect(grade("French", "French (the language)", "fr-en").status).toBe("correct");
  });
});

describe("both directions across the whole dictionary", () => {
  const all = MODULES.flatMap((m) => m.words);

  it("every entry is answerable in both directions", () => {
    for (const w of all) {
      expect(grade(w.fr, w.fr, "en-fr").status).toBe("correct");
      expect(grade(w.en, w.en, "fr-en").status).toBe("correct");
    }
  });

  it("no module asks one French word with two different answers", () => {
    // Reverse mode prompts with the French word; a duplicate French side
    // inside one module would be an unanswerable coin flip.
    const clashes: string[] = [];
    for (const m of MODULES) {
      const byFr = new Map<string, Set<string>>();
      for (const w of m.words) {
        const k = w.fr.toLowerCase();
        if (!byFr.has(k)) byFr.set(k, new Set());
        byFr.get(k)!.add(w.en);
      }
      for (const [fr, ens] of byFr)
        if (ens.size > 1) clashes.push(`${m.id}: "${fr}" -> ${[...ens].join(" | ")}`);
    }
    expect(clashes).toEqual([]);
  });

  it("no entry has a prompt that is blank in either direction", () => {
    for (const w of all) {
      expect(w.fr.trim()).not.toBe("");
      expect(w.en.trim()).not.toBe("");
    }
  });
});
