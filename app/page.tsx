import Link from "next/link";
import { MODULES, PARTS, TOTAL_WORDS } from "@/lib/vocab";
import { TOPICS } from "@/lib/practical";
import { GRAMMAR_TOPICS } from "@/lib/grammar";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto max-w-3xl px-5 pt-14 pb-10 sm:px-8 sm:pt-20 sm:pb-14">
          <h1 className="font-serif text-4xl leading-[1.1] tracking-[-0.015em] sm:text-5xl">
            Moses&rsquo;s Space
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-soft">
            Two directions, switchable inside any module.{" "}
            <span className="text-ink">EN&nbsp;→&nbsp;FR</span> gives you the
            English and you spell the French — accents and articles both count,{" "}
            <span className="text-ink">l’école</span>, not{" "}
            <span className="text-ink">ecole</span>.{" "}
            <span className="text-ink">FR&nbsp;→&nbsp;EN</span> runs it the other
            way, for recall.
          </p>
          <p className="mt-6 text-sm text-ink-faint">
            {TOTAL_WORDS.toLocaleString()} words · {MODULES.length} modules · A2 to B1
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/practice/all"
              className="inline-flex h-11 items-center rounded-md bg-ink px-5 text-[15px] font-medium text-paper transition-colors hover:bg-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            >
              Practise everything
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-md border border-rule-strong px-5 text-[15px] font-medium text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            >
              Progress
            </Link>
            <Link
              href="/practice/random"
              className="inline-flex h-11 items-center rounded-md border border-rule-strong px-5 text-[15px] font-medium text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            >
              Quick 20
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
        <section className="pt-12">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
            <h2 className="font-serif text-xl tracking-[-0.01em]">
              Numbers &amp; dates
            </h2>
            <span className="text-sm text-ink-faint">Written out in full</span>
          </div>

          <p className="pt-4 text-[15px] leading-relaxed text-ink-soft">
            Not vocabulary — these are generated fresh every time, so you never
            learn the list instead of the rule. You get the figures, you write
            the French: <span className="text-ink">3:45 pm</span> →{" "}
            <span className="answer-input text-ink">
              quinze heures quarante-cinq
            </span>
            .
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/numbers/all"
              className="inline-flex h-11 items-center rounded-md bg-ink px-5 text-[15px] font-medium text-paper transition-colors hover:bg-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            >
              Mixed practice
            </Link>
            {TOPICS.map((t) => (
              <Link
                key={t.id}
                href={`/numbers/${t.id}`}
                title={t.blurb}
                className="inline-flex h-11 items-center rounded-md border border-rule-strong px-4 text-[15px] text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              >
                {t.title}
              </Link>
            ))}
          </div>
        </section>

        <section className="pt-12">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
            <h2 className="font-serif text-xl tracking-[-0.01em]">Grammar</h2>
            <span className="text-sm text-ink-faint">A1 · generated</span>
          </div>

          <p className="pt-4 text-[15px] leading-relaxed text-ink-soft">
            Endings, questions and word order — generated the same way, so the
            verb and the pronoun change every time:{" "}
            <span className="text-ink">we + finir</span> →{" "}
            <span className="answer-input text-ink">nous finissons</span>.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/grammar/all"
              className="inline-flex h-11 items-center rounded-md bg-ink px-5 text-[15px] font-medium text-paper transition-colors hover:bg-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            >
              Mixed practice
            </Link>
            {GRAMMAR_TOPICS.map((t) => (
              <Link
                key={t.id}
                href={`/grammar/${t.id}`}
                title={t.blurb}
                className="inline-flex h-11 items-center rounded-md border border-rule-strong px-4 text-[15px] text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              >
                {t.title}
              </Link>
            ))}
          </div>
        </section>

        {PARTS.map((part) => {
          const mods = MODULES.filter((m) => m.part === part.id);
          if (!mods.length) return null;

          return (
            <section key={part.id} className="pt-12">
              <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
                <h2 className="font-serif text-xl tracking-[-0.01em]">
                  {part.title}
                </h2>
                <span className="text-sm text-ink-faint">{part.blurb}</span>
              </div>

              <ul>
                {mods.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/practice/${m.id}`}
                      className="group flex items-baseline gap-4 border-b border-rule py-4 transition-colors hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-clay"
                    >
                      <span className="w-9 shrink-0 font-mono text-[13px] text-ink-faint">
                        {m.id}
                      </span>
                      <span className="flex-1 text-[16px] leading-snug text-ink group-hover:text-clay">
                        {m.title}
                      </span>
                      <span className="shrink-0 text-[13px] tabular-nums text-ink-faint">
                        {m.words.length}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
