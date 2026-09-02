-- Supabase / Postgres schema. Run this FIRST, then db/functions.sql.
-- Safe to re-run: every statement is idempotent.
--
-- This is a single-user app with no sign-in, so there is no auth.uid() to
-- scope rows by. Rows carry a fixed owner id, Row Level Security is on with
-- no policy for the anon role — so the public key in the browser can read
-- nothing — and the server writes with the service-role key, which bypasses
-- RLS by design. That key must never be exposed to the browser.

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

-- Migrate a database created by the earlier version of this file, where
-- user_id defaulted to auth.uid() and was therefore unfillable without a
-- signed-in user. Harmless on a fresh database.
alter table sessions alter column user_id
  set default '00000000-0000-0000-0000-000000000001';
alter table attempts alter column user_id
  set default '00000000-0000-0000-0000-000000000001';

create index if not exists attempts_user_time on attempts (user_id, asked_at);
create index if not exists attempts_word      on attempts (user_id, word_key, asked_at);
create index if not exists attempts_scope     on attempts (user_id, kind, scope);
create index if not exists sessions_user_time on sessions (user_id, started_at);

-- Row Level Security on, with no policy granting the anon role access.
-- The effect is that the anon key — the one shipped to the browser — can
-- neither read nor write these tables. The server's service-role key
-- bypasses RLS, which is how the app gets in.
alter table sessions enable row level security;
alter table attempts enable row level security;

-- Drop the policies from the earlier auth.uid() version, which blocked
-- everything in an app with no sign-in. `drop ... if exists` also makes this
-- file safe to run twice; plain `create policy` is not idempotent.
drop policy if exists "own sessions" on sessions;
drop policy if exists "own attempts" on attempts;

-- If you later add Supabase auth, delete the two statements above and
-- uncomment these, then change the user_id defaults back to auth.uid().
-- create policy "own sessions" on sessions
--   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "own attempts" on attempts
--   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
