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

### If you used the Vercel–Supabase integration instead

You don't need to set anything by hand — the integration creates its own
variables and the app finds them. It matches on the *shape* of the values (a
`*.supabase.co` URL, a JWT-shaped key) rather than one exact name, so the
integration's naming works whatever it chooses.

That includes the doubled names the integration produces when its **prefix**
field is filled in with something that already appears in the variable name —
`NEXT_PUBLIC_SUPABASE_` as a prefix yields
`NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_SUPABASE_URL`. The app reads those fine, but
they are worth tidying: **leave the integration's prefix field empty**, or set
the two canonical variables by hand and remove the integration's.

If both are present, the canonical `NEXT_PUBLIC_SUPABASE_URL` wins.

The Progress page's *Technical detail* section lists which variables it can see
and which two it is reading from — names only, never values.

### The service-role key is required

`SUPABASE_SERVICE_ROLE_KEY` is **not optional for this app.** There is no
sign-in, so there is no `auth.uid()` to scope rows by. The schema keeps Row
Level Security on with no anon policy — meaning the public key in the browser
can read nothing — and the server writes with the service-role key, which
bypasses RLS by design.

Without it, writes are rejected and the dashboard stays empty forever.

Copy it from Supabase → Settings → API → `service_role`, and add it in Vercel
as `SUPABASE_SERVICE_ROLE_KEY`. **Never give it a `NEXT_PUBLIC_` prefix** —
that would ship it to the browser and hand anyone full access to the database.

## 3. Deploy

Vercel picks up `main` automatically. The build needs no special settings —
`better-sqlite3` is marked external in `next.config.ts` so its native binary is
never bundled into a serverless function.

## 4. Check it worked

Open **`/api/health`** on the deployed site. It writes a row, reads it back,
and names whatever fails:

```json
{ "ok": true, "backend": "supabase", "checks": [ ... ] }
```

Every check must pass. `"backend": "sqlite"` in production means the
credentials were not found — on Vercel that is an empty database on every
request.

| What `/api/health` says | Fix |
|---|---|
| `no Supabase URL + key pair found` | Variables missing or not applied — add them and **redeploy** |
| `relation "attempts" does not exist` | Step 1 not run — run `db/postgres.sql` |
| `function dashboard_totals does not exist` | `db/functions.sql` not run |
| `wrote 0 of 1 rows` | Using the anon key — set `SUPABASE_SERVICE_ROLE_KEY` |
| `"backend": "sqlite"` in production | Same as the first row |

> **A dashboard that says "Answer some questions…" is ambiguous:** it looks the
> same whether you have not practised yet or every write is being rejected.
> `/api/health` is what tells the two apart.

## What changes between local and production

Nothing in the app. `lib/db/index.ts` picks the store; every query lives behind
the `Store` interface, and `tests/parity.test.ts` asserts that both
implementations expose the same methods, that both schemas declare the same
columns, and that no file outside `lib/db/` touches the database.
