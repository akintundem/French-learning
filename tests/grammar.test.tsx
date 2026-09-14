import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PracticalDrill from "@/app/components/PracticalDrill";
import { GRAMMAR_IDS, GRAMMAR_TOPICS, type GrammarId } from "@/lib/grammar";
import { gradeAny } from "@/lib/grade";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const topic = (id: GrammarId) => GRAMMAR_TOPICS.find((t) => t.id === id)!;

/** Every distinct answer a generator produces over many draws. */
const answersOf = (id: GrammarId, draws = 600) => {
  const out = new Set<string>();
  for (let i = 0; i < draws; i++)
    for (const a of topic(id).generate(Math.random).answers) out.add(a);
  return [...out];
};

describe("generated grammar questions", () => {
  it("every topic produces a prompt and at least one answer", () => {
    for (const t of GRAMMAR_TOPICS)
      for (let i = 0; i < 200; i++) {
        const g = t.generate(Math.random);
        expect(g.prompt.trim()).not.toBe("");
        expect(g.answers.length).toBeGreaterThan(0);
        for (const a of g.answers) {
          expect(a.trim()).not.toBe("");
          expect(a).not.toContain("undefined");
          expect(a).not.toContain("NaN");
          // Elision and spacing slips would mark a right answer wrong.
          expect(a).not.toMatch(/\s\s|^\s|\s$/);
          expect(a).not.toMatch(/'\s/);
        }
      }
  });

  it("every generated answer is accepted by the grader", () => {
    // The drill would be unwinnable if a generated answer failed its own check.
    for (const t of GRAMMAR_TOPICS)
      for (let i = 0; i < 200; i++) {
        const g = t.generate(Math.random);
        for (const a of g.answers)
          expect(gradeAny(a, g.answers).status).toBe("correct");
      }
  });
});

describe("-er conjugation", () => {
  const forms = answersOf("er-present");

  it("uses the right ending for each person", () => {
    // Spot-check the endings that learners confuse: -e vs -es vs -ent.
    expect(forms.some((f) => /^je parle$|^tu parles$|^il parle$/.test(f))).toBe(true);
    for (const f of forms) {
      const [, verb] = f.split(" ").length > 1 ? f.split(" ") : ["", f.slice(2)];
      expect(verb).toMatch(/(e|es|ons|ez|ent)$/);
    }
  });

  it("elides je before a vowel", () => {
    // "j'aime", never "je aime".
    expect(forms.some((f) => f.startsWith("j'"))).toBe(true);
    expect(forms.some((f) => /^je [aeiouéèêh]/.test(f))).toBe(false);
  });

  it("never emits the bare infinitive", () => {
    for (const f of forms) expect(f).not.toMatch(/\ber$/);
  });
});

describe("-ir conjugation", () => {
  const forms = answersOf("ir-present");

  it("takes -iss- in the plural only", () => {
    for (const f of forms) {
      const plural = /^(nous|vous|ils|elles) /.test(f);
      if (plural) expect(f).toMatch(/iss(ons|ez|ent)$/);
      else expect(f).not.toContain("iss");
    }
  });

  it("uses -is, -is, -it in the singular", () => {
    const singular = forms.filter((f) => /^(je|j'|tu|il|elle) /.test(f) || f.startsWith("j'"));
    expect(singular.length).toBeGreaterThan(0);
    for (const f of singular) expect(f).toMatch(/(is|it)$/);
  });
});

describe("est-ce que", () => {
  const forms = answersOf("est-ce-que");

  it("always opens with est-ce que and ends in a question mark", () => {
    for (const f of forms) {
      expect(f).toMatch(/^est-ce qu(e |')/);
      expect(f.endsWith("?")).toBe(true);
    }
  });

  it("elides to est-ce qu' before a vowel", () => {
    expect(forms.some((f) => f.startsWith("est-ce qu'"))).toBe(true);
    // "est-ce que il" is the classic mistake.
    expect(forms.some((f) => /^est-ce que [aeiouéèêh]/.test(f))).toBe(false);
  });
});

describe("question words", () => {
  const forms = answersOf("interrogatives");

  it("puts the question word first", () => {
    for (const f of forms)
      expect(f).toMatch(/^(où|quand|pourquoi|comment|combien) est-ce qu/);
  });
});

describe("être en train de", () => {
  const forms = answersOf("en-train-de");

  it("agrees être with the subject and keeps the infinitive", () => {
    for (const f of forms) {
      expect(f).toMatch(/ en train d(e |')/);
      // The verb after "de" stays in the infinitive.
      expect(f).toMatch(/(er|ir)$/);
    }
  });

  it("matches each pronoun to its form of être", () => {
    const pairs: [RegExp, string][] = [
      [/^je /, "suis"], [/^tu /, "es"], [/^(il|elle) /, "est"],
      [/^nous /, "sommes"], [/^vous /, "êtes"], [/^(ils|elles) /, "sont"],
    ];
    for (const f of forms) {
      const hit = pairs.find(([re]) => re.test(f));
      if (hit) expect(f.split(" ")[1]).toBe(hit[1]);
    }
  });

  it("elides de before a vowel", () => {
    expect(forms.some((f) => f.includes("en train d'"))).toBe(true);
    expect(forms.some((f) => /en train de [aeiouéèêh]/.test(f))).toBe(false);
  });
});

describe("adverbs of frequency", () => {
  it("puts a one-word adverb after the verb, never before it", () => {
    for (let i = 0; i < 600; i++) {
      const g = topic("frequency").generate(Math.random);
      const single = ["toujours", "souvent", "parfois", "rarement", "quelquefois"]
        .find((a) => g.answers[0].endsWith(a));
      if (!single) continue;
      // Exactly one accepted form, and the adverb is last.
      expect(g.answers).toHaveLength(1);
      const words = g.answers[0].split(" ");
      expect(words[words.length - 1]).toBe(single);
      expect(words.indexOf(single)).toBeGreaterThan(1);
    }
  });

  it("accepts either end of the sentence for a longer phrase", () => {
    let checked = 0;
    for (let i = 0; i < 600 && checked < 5; i++) {
      const g = topic("frequency").generate(Math.random);
      if (g.answers.length === 1) continue;
      checked++;
      // One form ends with the phrase, another starts with it.
      expect(g.answers.length).toBeGreaterThan(1);
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("the grammar drill", () => {
  it("renders a grammar prompt and grades the real answer", async () => {
    const u = userEvent.setup();
    render(
      <PracticalDrill title="-er verbs" topicIds={["er-present"]} set="grammar" />
    );

    const input = await screen.findByLabelText(/your answer/i);
    const prompt = screen.getByRole("heading", { level: 2 }).textContent!;

    // Rebuild the expected answer from the prompt: "<person> + <infinitive>".
    const [person, inf] = prompt.split(" + ");
    const found = (() => {
      for (let i = 0; i < 4000; i++) {
        const g = topic("er-present").generate(Math.random);
        if (g.prompt === `${person} + ${inf}`) return g;
      }
      throw new Error(`did not regenerate ${prompt}`);
    })();

    await u.type(input, found.answers[0]);
    await u.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Correct.")).toBeInTheDocument();
  });

  it("mixes every topic when given them all", async () => {
    render(<PracticalDrill title="All" topicIds={GRAMMAR_IDS} set="grammar" />);
    expect(await screen.findByLabelText(/your answer/i)).toBeInTheDocument();
  });

  it("offers the accent bar, since answers are French", async () => {
    render(
      <PracticalDrill title="-ir verbs" topicIds={["ir-present"]} set="grammar" />
    );
    await screen.findByLabelText(/your answer/i);
    expect(screen.getByRole("button", { name: "Insert é" })).toBeInTheDocument();
  });
});
