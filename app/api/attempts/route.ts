import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import type { NewAttempt, Status } from "@/lib/db/types";

const STATUSES: Status[] = ["correct", "accent", "wrong"];

/** Attempts arrive in batches from the client to keep the quiz responsive. */
export async function POST(req: Request) {
  const body = await req.json();
  const rows: unknown[] = Array.isArray(body?.attempts) ? body.attempts : [];

  const clean: NewAttempt[] = [];
  for (const r of rows) {
    const a = r as Record<string, unknown>;
    if (typeof a.sessionId !== "string") continue;
    if (!STATUSES.includes(a.status as Status)) continue;
    clean.push({
      sessionId: a.sessionId,
      kind: a.kind === "numbers" ? "numbers" : "vocab",
      scope: String(a.scope ?? "unknown"),
      wordKey: String(a.wordKey ?? ""),
      direction: String(a.direction ?? "n-a"),
      prompt: String(a.prompt ?? ""),
      expected: String(a.expected ?? ""),
      given: String(a.given ?? ""),
      status: a.status as Status,
      errorKind: (a.errorKind ?? null) as NewAttempt["errorKind"],
      ms: typeof a.ms === "number" ? a.ms : null,
    });
  }

  try {
    if (clean.length) await getStore().recordAttempts(clean);
    return NextResponse.json({ recorded: clean.length });
  } catch (e) {
    // Losing a few rows of statistics is acceptable; breaking the quiz is not.
    console.error("[api/attempts] write failed:", e);
    return NextResponse.json({ recorded: 0, error: "unavailable" }, { status: 503 });
  }
}
