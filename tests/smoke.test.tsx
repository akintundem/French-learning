import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Quiz from "@/app/components/Quiz";
import { MODULES } from "@/lib/vocab";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("live smoke", () => {
  it("A3 renders a real prompt and grades the real answer", async () => {
    const u = userEvent.setup();
    const a3 = MODULES.find((m) => m.id === "A3")!;
    render(<Quiz title={`A3 · ${a3.title}`} words={a3.words} scope="A3" />);

    await screen.findByLabelText(/your answer/i);

    const prompt = screen.getByRole("heading", { level: 2 }).textContent!;
    const expected = a3.words.find((w) => w.en === prompt)!.fr;
    console.log(`  header:  ${screen.getByText(/A3 ·/).textContent}`);
    console.log(`  prompt:  "${prompt}"  ->  expected "${expected}"`);

    await u.type(screen.getByLabelText(/your answer/i), expected);
    await u.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    console.log("  graded:  Correct.");
  });
});
