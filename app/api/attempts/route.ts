import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import type { NewAttempt, Status } from "@/lib/db/types";

const STATUSES: Status[] = ["correct", "accent", "wrong"];

/**
 * The client batches roughly one answer per 1.5s, so a legitimate batch is
 * tiny. Capping it stops a single request inserting an unbounded number of
 * rows, and bounds the text fields — nothing here is sensitive, but the
 * endpoint is unauthenticated and should not be a free write amplifier.
 */
const MAX_BATCH = 200;
const MAX_TEXT = 500;

const text = (v: unknown) => String(v ?? "").slice(0, MAX_TEXT);

/** Attempts arrive in batches from the client to keep the quiz responsive. */
export async function POST(req: Request) {
  const body = await req.json();
  const rows: unknown[] = Array.isArray(body?.attempts)
    ? body.attempts.slice(0, MAX_BATCH)
    : [];

  const clean: NewAttempt[] = [];
  for (const r of rows) {
    const a = r as Record<string, unknown>;
    if (typeof a.sessionId !== "string") continue;
    if (!STATUSES.includes(a.status as Status)) continue;
    clean.push({
      sessionId: a.sessionId,
      kind: a.kind === "numbers" ? "numbers" : "vocab",
      scope: text(a.scope ?? "unknown"),
      wordKey: text(a.wordKey),
      direction: text(a.direction ?? "n-a"),
      prompt: text(a.prompt),
      expected: text(a.expected),
      given: text(a.given),
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
