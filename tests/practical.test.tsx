import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PracticalDrill from "@/app/components/PracticalDrill";
import { spellNumber, spellOrdinal } from "@/lib/numbers";
import { TOPICS, TOPIC_IDS, type TopicId } from "@/lib/practical";
import { gradeAny } from "@/lib/grade";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("spelling French numbers", () => {
  it("handles the ordinary ranges", () => {
    const cases: [number, string][] = [
      [0, "zéro"], [7, "sept"], [16, "seize"], [20, "vingt"],
      [35, "trente-cinq"], [100, "cent"], [101, "cent un"],
      [1000, "mille"], [2026, "deux mille vingt-six"],
    ];
    for (const [n, want] of cases) expect(spellNumber(n)).toBe(want);
  });

  it("handles the cases French learners get wrong", () => {
    // 17–19 are compounds; 21/31 take "et"; 71 keeps it, 81 does not.
    expect(spellNumber(17)).toBe("dix-sept");
    expect(spellNumber(21)).toBe("vingt-et-un");
    expect(spellNumber(31)).toBe("trente-et-un");
    expect(spellNumber(70)).toBe("soixante-dix");
    expect(spellNumber(71)).toBe("soixante-et-onze");
    expect(spellNumber(77)).toBe("soixante-dix-sept");
    // 80 takes -s alone, loses it once anything follows. Same for cent.
    expect(spellNumber(80)).toBe("quatre-vingts");
    expect(spellNumber(81)).toBe("quatre-vingt-un");
    expect(spellNumber(90)).toBe("quatre-vingt-dix");
    expect(spellNumber(99)).toBe("quatre-vingt-dix-neuf");
    expect(spellNumber(200)).toBe("deux cents");
    expect(spellNumber(201)).toBe("deux cent un");
    expect(spellNumber(1999)).toBe("mille neuf cent quatre-vingt-dix-neuf");
  });

  it("spells ordinals", () => {
    expect(spellOrdinal(1)).toBe("premier");
    expect(spellOrdinal(1, true)).toBe("première");
    expect(spellOrdinal(2)).toBe("deuxième");
    expect(spellOrdinal(4)).toBe("quatrième");   // quatre loses its -e
    expect(spellOrdinal(5)).toBe("cinquième");   // cinq gains a -u
    expect(spellOrdinal(9)).toBe("neuvième");    // neuf -> neuv-
    expect(spellOrdinal(20)).toBe("vingtième");
  });

  it("never produces a malformed spelling across the whole range", () => {
    for (let n = 0; n <= 2100; n++) {
      const s = spellNumber(n);
      expect(s).toMatch(/^[a-zàâçéèêëîïôùûüœ -]+$/);
      expect(s).not.toMatch(/--|\s\s|^-|-$/);
      expect(s).not.toContain("undefined");
    }
  });
});

describe("generated questions", () => {
  const rng = () => Math.random();

  it("every topic produces a prompt and at least one answer", () => {
    for (const t of TOPICS)
      for (let i = 0; i < 200; i++) {
        const g = t.generate(rng);
        expect(g.prompt.trim()).not.toBe("");
        expect(g.answers.length).toBeGreaterThan(0);
        for (const a of g.answers) {
          expect(a.trim()).not.toBe("");
          expect(a).not.toContain("undefined");
          expect(a).not.toContain("NaN");
        }
      }
  });

  it("every generated answer is accepted by the grader", () => {
    // The drill would be unwinnable if a generated answer failed its own check.
    for (const t of TOPICS)
      for (let i = 0; i < 200; i++) {
        const g = t.generate(rng);
        for (const a of g.answers)
          expect(gradeAny(a, g.answers).status).toBe("correct");
      }
  });

  it("accepts both the 24-hour and the conversational time", () => {
    const at = (h: number, m: number) => {
      // Find the generated item for a specific time by seeding deterministically.
      const times = TOPICS.find((t) => t.id === "times")!;
      for (let i = 0; i < 4000; i++) {
        const g = times.generate(Math.random);
        if (g.id === `time-${h}-${m}`) return g;
      }
      throw new Error(`did not generate ${h}:${m}`);
    };

    const quarterTo = at(22, 45);
    expect(gradeAny("vingt-deux heures quarante-cinq", quarterTo.answers).status)
      .toBe("correct");
    expect(gradeAny("onze heures moins le quart", quarterTo.answers).status)
      .toBe("correct");
  });

  it("uses 'premier' for the first of the month only", () => {
    const dates = TOPICS.find((t) => t.id === "dates")!;
    for (let i = 0; i < 500; i++) {
      const g = dates.generate(Math.random);
      const day = Number(g.prompt.split(" ")[0]);
      if (day === 1) expect(g.answers[0]).toContain("le premier");
      else expect(g.answers[0]).not.toContain("premier");
    }
  });
});

describe("the drill", () => {
  const only = (id: TopicId): TopicId[] => [id];

  it("accepts a correct answer and moves on", async () => {
    const u = userEvent.setup();
    render(<PracticalDrill title="Numbers" topicIds={only("cardinals")} />);

    const input = await screen.findByLabelText(/your answer/i);
    const shown = Number(screen.getByRole("heading", { level: 2 }).textContent);

    await u.type(input, spellNumber(shown));
    await u.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Correct.")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();
  });

  it("rejects a wrong answer and shows the spelling", async () => {
    const u = userEvent.setup();
    render(<PracticalDrill title="Numbers" topicIds={only("cardinals")} />);

    const input = await screen.findByLabelText(/your answer/i);
    const shown = Number(screen.getByRole("heading", { level: 2 }).textContent);

    await u.type(input, "quelque chose");
    await u.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByText("Not quite")).toBeInTheDocument();
    expect(screen.getByText(spellNumber(shown))).toBeInTheDocument();
  });

  it("offers the accent bar, since answers are French", async () => {
    render(<PracticalDrill title="Numbers" topicIds={only("cardinals")} />);
    await screen.findByLabelText(/your answer/i);
    expect(screen.getByRole("button", { name: "Insert é" })).toBeInTheDocument();
  });

  it("keeps a running score rather than ending", async () => {
    const u = userEvent.setup();
    render(<PracticalDrill title="Numbers" topicIds={only("cardinals")} />);
    await screen.findByLabelText(/your answer/i);

    for (let i = 0; i < 3; i++) {
      await u.click(screen.getByRole("button", { name: /^skip/i }));
      await u.click(screen.getByRole("button", { name: "Next" }));
    }

    // Three asked, none right, and still going.
    expect(screen.getByText("0 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();
  });

  it("does not change the question while you type", async () => {
    const u = userEvent.setup();
    render(<PracticalDrill title="Mixed" topicIds={TOPIC_IDS} />);
    const input = await screen.findByLabelText(/your answer/i);
    const before = screen.getByRole("heading", { level: 2 }).textContent;

    await u.type(input, "quarante");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(before!);
  });
});
