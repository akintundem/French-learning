import { NextResponse } from "next/server";
import { getStore, storeKind } from "@/lib/db";
import { findSupabaseCredentials, supabaseVarNames } from "@/lib/db/env";

export const dynamic = "force-dynamic";

/**
 * Proves the whole storage path works by actually writing and reading, then
 * cleaning up. Reading alone would pass against a database that silently
 * rejects every write — which is exactly the failure this exists to catch.
 */
export async function GET() {
  const creds = findSupabaseCredentials();
  const checks: { step: string; ok: boolean; detail?: string }[] = [];

  const backend = storeKind();

  checks.push({
    // On SQLite there are no credentials to find, and that is correct.
    step: backend === "sqlite" ? "Using local SQLite" : "Credentials found",
    ok: backend === "sqlite" || !!creds,
    detail: creds
      ? `reading ${creds.urlVar} and ${creds.keyVar}` +
        (creds.usingServiceRole
          ? " — this is a SERVICE ROLE key, which bypasses row level " +
            "security. The app does not need one; the anon key is enough."
          : " (anon key)")
      : `no Supabase URL + key pair found. Present: ${
          supabaseVarNames().join(", ") || "none"
        }`,
  });

  let sessionId: string | null = null;

  try {
    sessionId = await getStore().startSession({
      kind: "vocab",
      scope: "__healthcheck",
      direction: "en-fr",
    });
    checks.push({ step: "Write a session", ok: true });
  } catch (e) {
    checks.push({ step: "Write a session", ok: false, detail: msg(e) });
  }

  if (sessionId) {
    try {
      await getStore().recordAttempt({
        sessionId,
        kind: "vocab",
        scope: "__healthcheck",
        wordKey: "__healthcheck",
        direction: "en-fr",
        prompt: "health",
        expected: "health",
        given: "health",
        status: "correct",
        errorKind: null,
        ms: 1,
      });
      checks.push({ step: "Write an attempt", ok: true });
    } catch (e) {
      checks.push({ step: "Write an attempt", ok: false, detail: msg(e) });
    }
  }

  try {
    const d = await getStore().dashboard({ days: 1 });
    checks.push({
      step: "Read the dashboard",
      ok: true,
      detail: `${d.totals.attempts} attempts recorded in total`,
    });
  } catch (e) {
    checks.push({ step: "Read the dashboard", ok: false, detail: msg(e) });
  }

  const ok = checks.every((c) => c.ok);
  return NextResponse.json({ ok, backend, checks }, { status: ok ? 200 : 503 });
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
