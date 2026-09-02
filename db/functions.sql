-- Dashboard aggregations, run in Postgres rather than pulled into the app.
--
-- Run db/postgres.sql FIRST — these functions reference the tables it creates,
-- and running this file on its own fails with
-- `relation "attempts" does not exist`.
--
-- Each is SECURITY DEFINER so it can read past Row Level Security. That is
-- safe here because every function only ever returns aggregates — counts and
-- rates — never raw rows, and none takes a parameter that reaches a WHERE
-- clause. search_path is pinned so the function body cannot be redirected at
-- another schema.

-- Totals, including the mastery rule: a word counts once it has 3+ correct
-- answers and the most recent two attempts were both correct.
create or replace function dashboard_totals()
returns table (
  attempts bigint, correct bigint, words_seen bigint,
  words_mastered bigint, sessions bigint
)
language sql stable security definer set search_path = public as $$
  with per_word as (
    select
      word_key,
      count(*) filter (where status = 'correct') as n_correct,
      (array_agg(status order by asked_at desc, id desc))[1:2] as last_two
    from attempts
    where kind = 'vocab'
    group by word_key
  )
  select
    (select count(*) from attempts),
    (select count(*) from attempts where status = 'correct'),
    (select count(distinct word_key) from attempts),
    (select count(*) from per_word
      where n_correct >= 3
        and array_length(last_two, 1) = 2
        and last_two[1] = 'correct' and last_two[2] = 'correct'),
    (select count(*) from sessions);
$$;

create or replace function dashboard_by_scope()
returns table (
  scope text, attempts bigint, correct bigint,
  words_seen bigint, words_mastered bigint
)
language sql stable security definer set search_path = public as $$
  with per_word as (
    select
      scope, word_key,
      count(*) filter (where status = 'correct') as n_correct,
      (array_agg(status order by asked_at desc, id desc))[1:2] as last_two
    from attempts
    where kind = 'vocab'
    group by scope, word_key
  ),
  mastered as (
    select scope, count(*) as n from per_word
    where n_correct >= 3
      and array_length(last_two, 1) = 2
      and last_two[1] = 'correct' and last_two[2] = 'correct'
    group by scope
  )
  select
    a.scope,
    count(*),
    count(*) filter (where a.status = 'correct'),
    count(distinct a.word_key),
    coalesce(m.n, 0)
  from attempts a
  left join mastered m on m.scope = a.scope
  where a.kind = 'vocab'
  group by a.scope, m.n
  order by a.scope;
$$;

create or replace function dashboard_weakest_words(lim int default 20)
returns table (
  word_key text, prompt text, expected text,
  attempts bigint, correct bigint, last_status text, last_seen timestamptz
)
language sql stable security definer set search_path = public as $$
  with agg as (
    select
      word_key,
      count(*) as n,
      count(*) filter (where status = 'correct') as n_correct,
      max(asked_at) as last_seen
    from attempts
    where kind = 'vocab'
    group by word_key
    having count(*) >= 2 and count(*) filter (where status = 'correct') < count(*)
  )
  select
    g.word_key,
    l.prompt, l.expected,
    g.n, g.n_correct, l.status, g.last_seen
  from agg g
  cross join lateral (
    select prompt, expected, status from attempts
    where word_key = g.word_key
    order by asked_at desc, id desc
    limit 1
  ) l
  order by (g.n_correct::float / g.n) asc, g.n desc
  limit lim;
$$;

create or replace function dashboard_errors()
returns table (error_kind text, n bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(error_kind, 'unknown'), count(*)
  from attempts
  where status <> 'correct'
  group by 1;
$$;

create or replace function dashboard_activity(days int default 30)
returns table (day text, attempts bigint, correct bigint)
language sql stable security definer set search_path = public as $$
  select
    to_char(asked_at, 'YYYY-MM-DD'),
    count(*),
    count(*) filter (where status = 'correct')
  from attempts
  group by 1
  order by 1 desc
  limit days;
$$;
