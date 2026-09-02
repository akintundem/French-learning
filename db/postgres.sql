-- Supabase / Postgres schema. Run this FIRST, then db/functions.sql.
-- Safe to re-run: every statement is idempotent.
--
-- No sign-in, and no service-role key. Instead the anon role — the public key
-- in the browser — is granted exactly what the app needs and nothing more:
--
--   INSERT/UPDATE on sessions, INSERT on attempts   (recording practice)
--   DELETE on both                                  (the Reset button)
--   no SELECT on either table
--
-- Reading raw rows is therefore impossible with the public key. Every figure
-- on the dashboard comes from the aggregate functions in db/functions.sql,
-- which return counts and rates and never individual rows.
--
-- What this does and does not protect:
--   • Nobody can read your practice history, even with the public key.
--   • Someone who finds the key could add junk rows or reset your stats.
--     There is no login, so the database cannot tell them from you.
--   • Nothing here is sensitive — it is French vocabulary practice.
-- If that trade is not acceptable, add Supabase auth; see the end of this file.

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  kind        text not null,
  scope       text not null,
  direction   text not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create table if not exists attempts (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  user_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  asked_at    timestamptz not null default now(),

  kind        text not null,
  scope       text not null,
  word_key    text not null,
  direction   text not null,
  prompt      text not null,
  expected    text not null,

  given       text not null,
  status      text not null check (status in ('correct', 'accent', 'wrong')),
  error_kind  text,
  ms          integer
);

-- Migrate a database created by an earlier version of this file, where
-- user_id defaulted to auth.uid() and so could not be filled without a
-- signed-in user. Harmless on a fresh database.
alter table sessions alter column user_id
  set default '00000000-0000-0000-0000-000000000001';
alter table attempts alter column user_id
  set default '00000000-0000-0000-0000-000000000001';

create index if not exists attempts_user_time on attempts (user_id, asked_at);
create index if not exists attempts_word      on attempts (user_id, word_key, asked_at);
create index if not exists attempts_scope     on attempts (user_id, kind, scope);
create index if not exists sessions_user_time on sessions (user_id, started_at);

alter table sessions enable row level security;
alter table attempts enable row level security;

-- Remove policies from earlier versions of this file so it can be re-run.
drop policy if exists "own sessions"     on sessions;
drop policy if exists "own attempts"     on attempts;
drop policy if exists "write sessions"   on sessions;
drop policy if exists "write attempts"   on attempts;
drop policy if exists "update sessions"  on sessions;
drop policy if exists "clear sessions"   on sessions;
drop policy if exists "clear attempts"   on attempts;

-- Writes: allowed. Note there is deliberately no SELECT policy on either
-- table, so raw rows cannot be read with the public key.
create policy "write sessions"  on sessions for insert with check (true);
create policy "update sessions" on sessions for update using (true) with check (true);
create policy "write attempts"  on attempts for insert with check (true);

-- Deletes: needed by the Reset button on the dashboard.
create policy "clear sessions" on sessions for delete using (true);
create policy "clear attempts" on attempts for delete using (true);

-- ---------------------------------------------------------------------------
-- If you add Supabase auth later, replace the five policies above with these
-- and set the user_id defaults back to auth.uid():
--
--   create policy "own sessions" on sessions
--     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
--   create policy "own attempts" on attempts
--     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
