/**
 * Shown when the dashboard query fails. The point is to name the actual cause
 * rather than leave you guessing at a 500 — the failures here are all setup
 * steps with specific fixes.
 */
export default function SetupHelp({
  message,
  backend,
  detectedVars = [],
  usingVars = null,
}: {
  message: string;
  backend: "supabase" | "sqlite";
  /** Names only, never values. */
  detectedVars?: string[];
  usingVars?: { url: string; key: string } | null;
}) {
  const diagnosis = diagnose(message, backend);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <div className="rounded-md bg-clay-soft px-5 py-4">
        <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-clay">
          Progress can&rsquo;t load
        </p>
        <p className="mt-2 text-[17px] leading-relaxed text-ink">
          {diagnosis.summary}
        </p>
      </div>

      <h2 className="mt-8 font-serif text-xl tracking-[-0.01em]">
        {diagnosis.fixTitle}
      </h2>
      <ol className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-soft">
        {diagnosis.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="shrink-0 tabular-nums text-ink-faint">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      <details className="mt-8">
        <summary className="cursor-pointer text-[14px] text-ink-faint hover:text-ink">
          Technical detail
        </summary>
        <div className="mt-3 space-y-2 text-[13px] text-ink-soft">
          <p>
            Backend in use:{" "}
            <span className="font-mono text-ink">{backend}</span>
          </p>

          {usingVars && (
            <p>
              Reading credentials from{" "}
              <span className="font-mono text-ink">{usingVars.url}</span> and{" "}
              <span className="font-mono text-ink">{usingVars.key}</span>
            </p>
          )}

          {detectedVars.length > 0 && (
            <div>
              <p>Supabase-related variables present:</p>
              <ul className="mt-1 font-mono text-[12px] text-ink">
                {detectedVars.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          <pre className="overflow-x-auto rounded bg-paper-raised p-3 font-mono text-[12px] text-ink">
            {message}
          </pre>
        </div>
      </details>

      <p className="mt-8 text-[14px] text-ink-faint">
        Practice itself is unaffected — answers are still being recorded.
      </p>
    </main>
  );
}

type Diagnosis = { summary: string; fixTitle: string; steps: string[] };

function diagnose(message: string, backend: "supabase" | "sqlite"): Diagnosis {
  const m = message.toLowerCase();

  if (backend === "sqlite")
    return {
      summary:
        "The local SQLite database could not be read. This is a local-development problem, not a deployment one.",
      fixTitle: "Try this",
      steps: [
        "Check that db/practice.db exists and is writable.",
        "Delete it and reload — it is recreated from db/migrations/001_init.sql.",
        "Run npm run db:seed if you want sample data back.",
      ],
    };

  // The two most likely deployment states, in the order they happen.
  if (m.includes("does not exist") && m.includes("function"))
    return {
      summary:
        "Supabase is connected, but the dashboard's aggregation functions are missing.",
      fixTitle: "Run the second SQL file",
      steps: [
        "Open the Supabase dashboard → SQL Editor.",
        "Paste the contents of db/functions.sql and run it.",
        "Reload this page.",
      ],
    };

  if (m.includes("does not exist") || m.includes("relation"))
    return {
      summary: "Supabase is connected, but the tables have not been created.",
      fixTitle: "Run both SQL files, in order",
      steps: [
        "Open the Supabase dashboard → SQL Editor.",
        "Run db/postgres.sql — it creates the tables and enables row level security.",
        "Then run db/functions.sql — it creates the dashboard aggregations.",
        "Reload this page.",
      ],
    };

  if (m.includes("jwt") || m.includes("apikey") || m.includes("invalid") || m.includes("401"))
    return {
      summary: "Supabase rejected the API key.",
      fixTitle: "Check the environment variables",
      steps: [
        "In Supabase → Settings → API, copy the Project URL and the anon key.",
        "In Vercel → Settings → Environment Variables, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        "Redeploy — Vercel does not apply new variables to an existing build.",
      ],
    };

  if (m.includes("fetch failed") || m.includes("enotfound") || m.includes("network"))
    return {
      summary: "The Supabase project could not be reached.",
      fixTitle: "Check the project URL",
      steps: [
        "Confirm NEXT_PUBLIC_SUPABASE_URL matches the Project URL in Supabase → Settings → API.",
        "Check the project is not paused — free projects pause after a period of inactivity.",
        "Redeploy after changing any variable.",
      ],
    };

  return {
    summary: "The database query failed. The technical detail below says why.",
    fixTitle: "Most likely",
    steps: [
      "Run db/postgres.sql and then db/functions.sql in the Supabase SQL editor.",
      "Confirm the environment variables are set for the Production environment.",
      "Redeploy after any change — new variables need a fresh build.",
    ],
  };
}
