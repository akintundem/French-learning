import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Quiz from "@/app/components/Quiz";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const words = [{ fr: "l'école", en: "school" }];

afterEach(() => vi.unstubAllGlobals());

describe("tracking is best-effort", () => {
  it("practice still works when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const u = userEvent.setup();
    render(<Quiz title="T" words={words} scope="A8" />);

    const input = await screen.findByLabelText(/answer in french/i);
    await u.type(input, "l'école");
    await u.click(screen.getByRole("button", { name: "Check" }));

    // A failed write must never block grading.
    expect(screen.getByText("Correct.")).toBeInTheDocument();
  });

  it("posts attempts with the fields the dashboard needs", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
        return new Response(JSON.stringify({ id: "session-1", recorded: 1 }), {
          headers: { "content-type": "application/json" },
        });
      })
    );

    const u = userEvent.setup();
    render(<Quiz title="T" words={words} scope="A8" />);
    const input = await screen.findByLabelText(/answer in french/i);

    await u.type(input, "l'ecole");   // an accent slip
    await u.click(screen.getByRole("button", { name: "Check" }));

    await vi.waitFor(() => {
      const post = calls.find((c) => c.url === "/api/attempts");
      expect(post).toBeDefined();
    }, { timeout: 3000 });

    const body = calls.find((c) => c.url === "/api/attempts")!.body as {
      attempts: Record<string, unknown>[];
    };
    const a = body.attempts[0];

    expect(a.scope).toBe("A8");
    expect(a.wordKey).toBe("A8|l'école");
    expect(a.status).toBe("accent");
    expect(a.errorKind).toBe("accent");
    expect(a.direction).toBe("en-fr");
    expect(a.prompt).toBe("school");
    expect(a.expected).toBe("l'école");
    expect(typeof a.ms).toBe("number");
  });
});
