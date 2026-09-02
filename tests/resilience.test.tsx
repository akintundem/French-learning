import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SetupHelp from "@/app/dashboard/SetupHelp";

const broken = {
  startSession: vi.fn().mockRejectedValue(new Error("relation \"attempts\" does not exist")),
  endSession: vi.fn().mockRejectedValue(new Error("down")),
  recordAttempt: vi.fn().mockRejectedValue(new Error("down")),
  recordAttempts: vi.fn().mockRejectedValue(new Error("down")),
  dashboard: vi.fn().mockRejectedValue(new Error("down")),
  reset: vi.fn().mockRejectedValue(new Error("down")),
};

vi.mock("@/lib/db", () => ({
  getStore: () => broken,
  storeKind: () => "supabase",
}));

beforeEach(() => vi.clearAllMocks());

const post = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("API routes survive a broken database", () => {
  it("POST /api/sessions returns 503 instead of throwing", async () => {
    const { POST } = await import("@/app/api/sessions/route");
    const res = await POST(post("http://t/api/sessions", { kind: "vocab", scope: "A3" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ id: null });
  });

  it("POST /api/attempts returns 503 instead of throwing", async () => {
    const { POST } = await import("@/app/api/attempts/route");
    const res = await POST(
      post("http://t/api/attempts", {
        attempts: [{ sessionId: "s1", status: "correct", wordKey: "x",
          kind: "vocab", scope: "A3", direction: "en-fr",
          prompt: "p", expected: "e", given: "g" }],
      })
    );
    expect(res.status).toBe(503);
  });

  it("GET /api/dashboard reports why rather than crashing", async () => {
    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET(new Request("http://t/api/dashboard"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("down");
  });
});

describe("the setup help names the actual cause", () => {
  it("missing tables", () => {
    render(<SetupHelp message='relation "attempts" does not exist' backend="supabase" />);
    expect(screen.getByText(/tables have not been created/i)).toBeInTheDocument();
    expect(screen.getByText(/db\/postgres\.sql/)).toBeInTheDocument();
  });

  it("missing RPC functions", () => {
    render(
      <SetupHelp
        message="dashboard_totals: function dashboard_totals does not exist"
        backend="supabase"
      />
    );
    expect(screen.getByText(/aggregation functions are missing/i)).toBeInTheDocument();
    expect(screen.getByText(/db\/functions\.sql/)).toBeInTheDocument();
  });

  it("a bad key", () => {
    render(<SetupHelp message="Invalid API key" backend="supabase" />);
    expect(screen.getByText(/rejected the API key/i)).toBeInTheDocument();
    expect(screen.getByText(/Redeploy/)).toBeInTheDocument();
  });

  it("an unreachable project", () => {
    render(<SetupHelp message="TypeError: fetch failed" backend="supabase" />);
    expect(screen.getByText(/could not be reached/i)).toBeInTheDocument();
    expect(screen.getByText(/paused/i)).toBeInTheDocument();
  });

  it("shows the raw error for anything unrecognised", () => {
    render(<SetupHelp message="something strange happened" backend="supabase" />);
    expect(screen.getByText("something strange happened")).toBeInTheDocument();
  });

  it("says practice still works", () => {
    render(<SetupHelp message="down" backend="supabase" />);
    expect(screen.getByText(/Practice itself is unaffected/i)).toBeInTheDocument();
  });
});
