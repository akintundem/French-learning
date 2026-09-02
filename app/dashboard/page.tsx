import Link from "next/link";
import { getStore, storeKind } from "@/lib/db";
import { findSupabaseCredentials, supabaseVarNames } from "@/lib/db/env";
import { project } from "@/lib/db/goal";
import { MODULES, TOTAL_WORDS } from "@/lib/vocab";
import type { Dashboard } from "@/lib/db/types";
import Charts from "./Charts";
import SetupHelp from "./SetupHelp";

// Statistics change on every answer, so this page is always read fresh.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // A statistics page must never take the app down. If the database is
  // unreachable or not set up, say so and explain the fix rather than
  // handing back a blank server error.
  let data: Dashboard | null = null;
  let failure: string | null = null;

  try {
    data = await getStore().dashboard({ days: 30 });
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
    console.error("[dashboard] query failed:", failure);
  }

  if (!data) {
    return (
      <Shell>
        <SetupHelp
          message={failure ?? "Unknown error"}
          backend={storeKind()}
          // Names only — never the values.
          detectedVars={supabaseVarNames()}
          usingVars={
            findSupabaseCredentials()
              ? {
                  url: findSupabaseCredentials()!.urlVar,
                  key: findSupabaseCredentials()!.keyVar,
                }
              : null
          }
        />
      </Shell>
    );
  }

  const goal = project(data, TOTAL_WORDS);
  const titles = Object.fromEntries(MODULES.map((m) => [m.id, m.title]));

  return (
    <Shell subtitle={
      data.totals.attempts
        ? `${data.totals.attempts.toLocaleString()} answers across ${data.totals.sessions} sessions.`
        : "Nothing recorded yet — answer a few questions and this fills in."
    }>
      <Charts
        data={data}
        goal={goal}
        totalWords={TOTAL_WORDS}
        moduleTitles={titles}
      />
    </Shell>
  );
}

function Shell({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto max-w-3xl px-5 pt-10 pb-8 sm:px-8 sm:pt-14">
          <Link
            href="/"
            className="-ml-2 inline-flex h-9 items-center rounded-md px-2 text-[14px] text-ink-faint transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          >
            ← Practice
          </Link>
          <h1 className="mt-3 font-serif text-4xl leading-[1.1] tracking-[-0.015em]">
            Progress
          </h1>
          {subtitle && (
            <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
              {subtitle}
            </p>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
