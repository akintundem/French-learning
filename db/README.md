# Storage

All SQL lives behind the `Store` interface in `lib/db/types.ts`. Nothing else in
the app touches the database, so switching backends means writing one new
implementation and changing one line in `lib/db/index.ts`.

## Locally: SQLite

`db/practice.db`, created automatically on first run from
`db/migrations/001_init.sql`. Seed sample history with `npm run db:seed`.

The migration is written in the intersection of SQLite and Postgres syntax —
TEXT ids, ISO-8601 TEXT timestamps — so the same statements run on both.

## Deploying to Supabase

1. Run `db/postgres.sql` in the Supabase SQL editor. It creates the same two
   tables with native types (`uuid`, `timestamptz`) **and enables Row Level
   Security** so each account only sees its own rows.
2. Add a `SupabaseStore implements Store` alongside `lib/db/sqlite.ts`. The
   queries port almost directly; the differences are:
   - `substr(asked_at, 1, 10)` → `to_char(asked_at, 'YYYY-MM-DD')`
   - `CAST(x AS REAL)` → `x::float`
   - ids and timestamps come from column defaults, not the application
   - `user_id` comes from `auth.uid()` rather than the `'local'` constant
3. Switch on an env var in `lib/db/index.ts`.

**Do not skip step 1's RLS policies.** Without them anyone holding the anon key
can read every user's practice history.

## What is tracked

`sessions` — one row per visit to a module or drill.
`attempts` — one row per question answered; append-only, and everything on the
dashboard is aggregated from it.

Each attempt records what was asked (`word_key`, `prompt`, `direction`), what
was typed (`given`), and the outcome (`status`, plus `error_kind`
distinguishing an accent slip from a wrong article from a word you don't know).
