-- Schema for practice tracking.
--
-- Written in the intersection of SQLite and Postgres syntax so the same
-- statements run on both: TEXT ids rather than uuid, ISO-8601 TEXT timestamps
-- rather than timestamptz, and INTEGER 0/1 rather than boolean.
-- db/postgres.sql holds the Supabase-native version of the same shape.

-- One row per practice session (a visit to a module or drill).
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL DEFAULT 'local',
  kind          TEXT NOT NULL,              -- 'vocab' | 'numbers'
  scope         TEXT NOT NULL,              -- module id, topic id, 'all', 'random'
  direction     TEXT NOT NULL,              -- 'en-fr' | 'fr-en' | 'n-a'
  started_at    TEXT NOT NULL,
  ended_at      TEXT
);

-- One row per question answered. This is the fact table everything else
-- aggregates from; it is deliberately append-only.
CREATE TABLE IF NOT EXISTS attempts (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL DEFAULT 'local',
  asked_at      TEXT NOT NULL,

  -- What was asked. word_key is stable across sessions ("A3|le père") so
  -- history survives; generated drills use their topic and prompt instead.
  kind          TEXT NOT NULL,              -- 'vocab' | 'numbers'
  scope         TEXT NOT NULL,              -- module id or topic id
  word_key      TEXT NOT NULL,
  direction     TEXT NOT NULL,
  prompt        TEXT NOT NULL,
  expected      TEXT NOT NULL,

  -- What happened.
  given         TEXT NOT NULL,
  status        TEXT NOT NULL,              -- 'correct' | 'accent' | 'wrong'
  error_kind    TEXT,                       -- 'accent' | 'article' | 'unknown' | 'skipped'
  ms            INTEGER,                    -- time to answer

  CHECK (status IN ('correct', 'accent', 'wrong'))
);

CREATE INDEX IF NOT EXISTS attempts_user_time  ON attempts (user_id, asked_at);
CREATE INDEX IF NOT EXISTS attempts_word       ON attempts (user_id, word_key, asked_at);
CREATE INDEX IF NOT EXISTS attempts_scope      ON attempts (user_id, kind, scope);
CREATE INDEX IF NOT EXISTS sessions_user_time  ON sessions (user_id, started_at);
