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

const words = [
  { fr: "le père", en: "father" },
  { fr: "l'école", en: "school" },
  { fr: "la mère", en: "mother" },
];

const answerFor = (prompt: string) => words.find((w) => w.en === prompt)!.fr;

describe("Quiz", () => {
  it("accepts a correct answer and advances", async () => {
    const u = userEvent.setup();
    render(<Quiz title="Test" words={words} scope="test" />);

    const input = await screen.findByLabelText(/your answer/i);
    const prompt = screen.getByRole("heading", { level: 2 }).textContent!;

    await u.type(input, answerFor(prompt));
    await u.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByText(/1 in a row|2 \/ 3|1 \/ 3/)).toBeTruthy();

    await u.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();
  });

  it("rejects a missing accent and shows the expected spelling", async () => {
    const u = userEvent.setup();
    render(<Quiz title="Test" words={[{ fr: "l'école", en: "school" }]} scope="test" />);

    const input = await screen.findByLabelText(/your answer/i);
    await u.type(input, "l'ecole");
    await u.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByText("Accents")).toBeInTheDocument();
    expect(screen.getByText("l'école")).toBeInTheDocument();
  });

  it("rejects a missing article under strict grading", async () => {
    const u = userEvent.setup();
    render(<Quiz title="Test" words={[{ fr: "l'école", en: "school" }]} scope="test" />);

    const input = await screen.findByLabelText(/your answer/i);
    await u.type(input, "école");
    await u.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByText("Not quite")).toBeInTheDocument();
  });

  it("skipping reveals the answer and counts as wrong", async () => {
    const u = userEvent.setup();
    render(<Quiz title="Test" words={[{ fr: "le père", en: "father" }]} scope="test" />);

    await screen.findByLabelText(/your answer/i);
    await u.click(screen.getByRole("button", { name: /^skip/i }));

    expect(screen.getByText("Skipped")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("0 of 1")).toBeInTheDocument();
  });

  it("finishes and offers a redo of only the missed words", async () => {
    const u = userEvent.setup();
    render(<Quiz title="Test" words={words} scope="test" />);
    await screen.findByLabelText(/your answer/i);

    for (let i = 0; i < words.length; i++) {
      await u.click(screen.getByRole("button", { name: /^skip/i }));
      await u.click(screen.getByRole("button", { name: "Next" }));
    }

    expect(screen.getByText("0 of 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /redo the 3 you missed/i })
    ).toBeInTheDocument();
  });

  it("Esc skips the current word", async () => {
    const u = userEvent.setup();
    render(<Quiz title="Test" words={[{ fr: "le père", en: "father" }]} scope="test" />);

    const input = await screen.findByLabelText(/your answer/i);
    await u.click(input);
    await u.keyboard("{Escape}");

    expect(screen.getByText("Skipped")).toBeInTheDocument();
    expect(screen.getByText("le père")).toBeInTheDocument();
  });

  it("hides the skip button once an answer is showing", async () => {
    const u = userEvent.setup();
    render(<Quiz title="Test" words={[{ fr: "le père", en: "father" }]} scope="test" />);

    await screen.findByLabelText(/your answer/i);
    expect(screen.getByRole("button", { name: /^skip/i })).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /^skip/i }));
    expect(screen.queryByRole("button", { name: /^skip/i })).not.toBeInTheDocument();
  });

  it("Quick 20 draws exactly 20 words from the full set", async () => {
    const all = MODULES.flatMap((m) => m.words);
    render(<Quiz title="Quick 20" words={all} limit={20} scope="test" />);
    await screen.findByLabelText(/your answer/i);
    expect(screen.getByText("1 / 20")).toBeInTheDocument();
  });
});

describe("vocabulary data", () => {
  it("has no empty or malformed entries", () => {
    for (const m of MODULES)
      for (const w of m.words) {
        expect(w.fr.trim().length).toBeGreaterThan(0);
        expect(w.en.trim().length).toBeGreaterThan(0);
        expect(w.fr).not.toMatch(/\|/);
      }
  });

  it("numbers prompt with the digit and answer in French", () => {
    const a5 = MODULES.find((m) => m.id === "A5")!;
    const seven = a5.words.find((w) => w.en === "7");

    // The prompt is what you read; the answer is what you spell.
    expect(seven?.fr).toBe("sept");
    expect(a5.words.find((w) => w.en === "0")?.fr).toBe("zéro");
    expect(a5.words.find((w) => w.en === "80")?.fr).toBe("quatre-vingts");
    expect(a5.words).toHaveLength(34);
  });

  it("no module asks the French word and expects the English", () => {
    // Guards the direction of every entry, not just the numbers.
    const frArticle = /^(le |la |les |l'|un |une |des )/i;
    const reversed = MODULES.flatMap((m) =>
      m.words
        .filter((w) => frArticle.test(w.en) && !frArticle.test(w.fr))
        .map((w) => `${m.id}: "${w.en}" -> "${w.fr}"`)
    );
    expect(reversed).toEqual([]);
  });

  it("every entry is answerable with its own spelling", () => {
    for (const m of MODULES)
      for (const w of m.words)
        expect(grade(w.fr, w.fr).status).toBe("correct");
  });
});
