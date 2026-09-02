# Deploying to Vercel + Supabase

The app picks its backend from the environment: **Supabase when the variables
below are set, SQLite otherwise.** No code changes are needed to deploy — but
the database setup in step 1 is not optional, and env vars alone won't work
without it.

## 1. Set up the database

In the Supabase dashboard → **SQL Editor**, run these two files in order:

1. **`db/postgres.sql`** — creates the `sessions` and `attempts` tables and
   **enables Row Level Security**.
2. **`db/functions.sql`** — creates the five dashboard aggregation functions.

Both are idempotent, so re-running them is safe.

> **Do not skip the RLS policies in step 1.** They are what stops one person's
> anon key from reading everyone else's practice history. The app does not
> filter by user — the database does.

## 2. Set the Vercel environment variables

Project → **Settings → Environment Variables**:

| Name | Value | Where to find it |
|------|-------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon/public key | Supabase → Settings → API → Project API keys |

Set them for **Production, Preview and Development**. Redeploy after adding
them — Vercel does not apply new variables to an existing build.

### About the service-role key

The code also reads `SUPABASE_SERVICE_ROLE_KEY` and prefers it if present.
**Only set it if you understand what it does:** it bypasses Row Level Security
entirely. It is useful for a single-user deployment with no sign-in, where
there is no `auth.uid()` to scope rows by — but it must never be exposed to the
browser, so keep the `NEXT_PUBLIC_` prefix off it.

If you add authentication later, drop the service-role key and let the anon key
plus RLS do the work.

## 3. Deploy

Vercel picks up `main` automatically. The build needs no special settings —
`better-sqlite3` is marked external in `next.config.ts` so its native binary is
never bundled into a serverless function.

## 4. Check it worked

Answer a couple of questions on the deployed site, then open `/dashboard`. If
numbers appear, the whole path is working.

If it stays empty, the usual causes are:

| Symptom | Cause |
|---------|-------|
| Dashboard empty, no errors | Env vars not applied — redeploy after adding them |
| `relation "attempts" does not exist` | Step 1 not run |
| `function dashboard_totals does not exist` | `db/functions.sql` not run |
| Rows written but dashboard empty | RLS on with no `auth.uid()` — see the service-role note above |

## What changes between local and production

Nothing in the app. `lib/db/index.ts` picks the store; every query lives behind
the `Store` interface, and `tests/parity.test.ts` asserts that both
implementations expose the same methods, that both schemas declare the same
columns, and that no file outside `lib/db/` touches the database.
