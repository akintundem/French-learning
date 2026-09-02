-- Supabase / Postgres version of db/migrations/001_init.sql.
-- Same shape, native types. Run this in the Supabase SQL editor.

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  kind        text not null,
  scope       text not null,
  direction   text not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create table if not exists attempts (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
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

create index if not exists attempts_user_time on attempts (user_id, asked_at);
create index if not exists attempts_word      on attempts (user_id, word_key, asked_at);
create index if not exists attempts_scope     on attempts (user_id, kind, scope);
create index if not exists sessions_user_time on sessions (user_id, started_at);

-- Row Level Security: each person sees only their own rows. Without this,
-- anyone with the anon key could read everyone's practice history.
alter table sessions enable row level security;
alter table attempts enable row level security;

create policy "own sessions" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own attempts" on attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
