# Orthographe

French spelling practice, built from a personal A2–B1 dictionary of ~1,450
words. You get the English, you write the French — and it checks the spelling
strictly, because accents and articles *are* the French.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 75 tests
```

---

## What it does

**Two directions**, switchable inside any module.

- **EN → FR** — you read the English and spell the French. The main mode.
- **FR → EN** — the reverse, for recall.

Switching restarts the round, since every prompt flips.

**Three features**, each with its own section on the home page:

| | |
|---|---|
| **Vocabulary** | 46 modules parsed from the dictionary — A1–A20 core, B1–B15, occupations, supplement |
| **Numbers & dates** | Generated practice: prices, clock times, dates, years, percentages, fractions, ordinals |
| **Progress** | A dashboard over everything you've answered |

---

## Grading

Strict in both directions.

**EN → FR — accents and articles both count.**

| You type | Expected | Result |
|----------|----------|--------|
| `l'école` | `l'école` | correct |
| `L'ÉCOLE` | `l'école` | correct — case is ignored |
| `l’école` | `l'école` | correct — curly quotes are fine |
| `l'ecole` | `l'école` | wrong, flagged as an accent slip |
| `école` | `l'école` | wrong — the article is missing |

**FR → EN — the full phrase is required.** `le temps` is glossed
`time, weather`, and both senses are needed.

Applying to both: trailing punctuation and the space before `?`/`!` are
forgiven; a slash means genuine alternatives (`avoir la pêche / la patate`) and
either is accepted; a parenthetical gloss is optional, so `to know (a fact)`
accepts `to know`.

---

## Typing accents on an English keyboard

No French layout needed. Three ways, all optional:

- **The accent bar** under the answer field inserts at the cursor. Ordered by
  frequency in the dictionary, so `é à è ç` come first.
- **Type shortcuts** — a base letter then a marker:

  | Type | Get | Type | Get | Type | Get |
  |------|-----|------|-----|------|-----|
  | `e'` | é | `` e` `` | è | `e^` | ê |
  | ``a` `` | à | `c,` | ç | `u^` | û |
  | `o^` | ô | `i^` | î | `e"` | ë |

  Case carries over (`E'` → É). Ligatures need an explicit slash (`oe/` → œ)
  so ordinary words like *moelle* are left alone.
- **Alt+1…9** on desktop for the nine commonest.

The bar only appears in EN → FR — English answers don't need it.

---

## Numbers & dates

Every question is **generated**, so there's no list to memorise instead of the
rule:

| Topic | Prompt | Answer |
|-------|--------|--------|
| Numbers | `78` | soixante-dix-huit |
| Prices | `€15.99` | quinze euros quatre-vingt-dix-neuf |
| Telling time | `10:45 pm` | vingt-deux heures quarante-cinq |
| Dates | `1 February` | le premier février |
| Years | `1938` | mille neuf cent trente-huit |
| Percentages | `20%` | vingt pour cent |
| Fractions | `3/4` | trois quarts |
| Ordinals | `5th` | cinquième |

Where several forms are correct they're all accepted, and the alternatives are
shown after each answer — `10:45 pm` also takes *onze heures moins le quart*.

Number ranges are weighted toward **70–99**, where French counting is at its
most awkward: `soixante-et-onze`, `quatre-vingts` with an -s but
`quatre-vingt-un` without.

---

## Progress dashboard

At `/dashboard`. Every answer is recorded, and the dashboard aggregates:

- **Mastery toward 70%** — a meter with the target marked. A word counts as
  mastered after 3+ correct answers with the last two right, so one lucky guess
  doesn't count.
- **A projected finish date**, rated over days actually practised rather than
  calendar days — a week off shouldn't make the habit look worse than it is.
- **Why answers miss** — accent slip, wrong article, or genuinely unknown.
  These need different fixes, so they're counted separately.
- **Per-module accuracy**, weakest first, and the **specific words** you keep
  missing.
- **Daily activity** and current streak.

Chart colours were checked with a CVD/contrast validator rather than by eye,
and every colour is paired with a text label so nothing depends on colour alone.

---

## Vocabulary data

`lib/vocab.ts` is **generated** — don't edit it by hand:

```bash
npm run build:vocab    # re-parses data/French-Dictionary-A2-B1.md
```

The parser handles the dictionary's several table shapes, splits paired entries
(`le père / la mère` → two questions), and skips tables that aren't
French→English vocabulary — the `-eur`/`-euse` ending chart, the
number-formatting table, and the tu/vous register grid.

**Known gap:** days of the week and months are absent from module A4. The
dictionary lists them as grouped rows (`lundi, mardi, mercredi`) which the
parser's comma-list guard drops. The dates drill covers months in context, but
`Monday → lundi` isn't in the vocabulary modules.

---

## Storage

SQLite locally (`db/practice.db`, created on first run). All SQL sits behind the
`Store` interface in `lib/db/types.ts`, so nothing outside `lib/db/sqlite.ts`
touches the database.

**In production it uses Supabase.** The backend is chosen from the environment —
Supabase when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are
set, SQLite otherwise — so no code changes are needed to deploy. You do have to
run `db/postgres.sql` and `db/functions.sql` in the Supabase SQL editor first;
env vars alone won't work without the tables.

See **[DEPLOY.md](DEPLOY.md)** for the full walkthrough.

Writes are batched and fire-and-forget: a failed write costs you statistics,
never a blocked answer.

```bash
npm run db:seed    # sample history, to see the dashboard populated
```

---

## Layout

```
app/
  page.tsx                     module picker
  practice/[module]/page.tsx   /practice/A3, /practice/all, /practice/random
  numbers/[topic]/page.tsx     /numbers/times, /numbers/all
  dashboard/                   progress
  api/                         sessions, attempts, dashboard
  components/
    Quiz.tsx                   vocabulary
    PracticalDrill.tsx         numbers & dates
    AccentBar.tsx              tappable accents
lib/
  grade.ts                     answer checking, both directions
  session.ts                   queue, scoring, streaks
  accents.ts                   accent keys and type shortcuts
  numbers.ts                   spelling French numbers
  practical.ts                 the eight generators
  tracker.ts                   batched, best-effort recording
  db/                          store interface + SQLite implementation
  vocab.ts                     generated
data/
  French-Dictionary-A2-B1.md   the source
```

## Tests

```bash
npm test
```

75 tests. Beyond the UI flows, the ones worth knowing about:

- Every one of the 1,453 entries is answerable in **both** directions.
- No module asks one French word with two different answers (reverse mode would
  make that an unanswerable coin flip).
- The number speller is checked across 0–2100 for malformed output, plus the
  cases people get wrong: 17, 21, 71, 80/81, 200/201, 1999.
- Every generated question is accepted by its own grader — the drill would be
  unwinnable otherwise.
- Practice still works when the tracking API is unreachable.
