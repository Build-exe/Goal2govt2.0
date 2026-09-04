-- Goal2Govt schema
-- Run automatically by src/seed.js, or manually with:
--   psql "$DATABASE_URL" -f src/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per government job / exam entry (the "flow chart" dataset).
-- slug is the human-readable id used in URLs and as the seed for
-- deterministic mock-test question sets (mirrors the old client-side job.id).
CREATE TABLE IF NOT EXISTS jobs (
  id             SERIAL PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  code           TEXT NOT NULL UNIQUE,
  tier           TEXT NOT NULL,           -- 10th | 12th | iti | diploma | degree | btech
  name           TEXT NOT NULL,
  overview       TEXT,
  age            TEXT,
  edu            TEXT,
  salary         TEXT,
  roadmap_type   TEXT NOT NULL,           -- physical | clerical | exam | trade | technical | elite
  exam_q         INTEGER,
  exam_min       INTEGER,
  exam_label     TEXT,
  recruiting_body TEXT,
  resource_url   TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_tier ON jobs(tier);

-- One row per quiz question, grouped by pool key (p10, p12, technical, grad, engineering).
-- Used both for the free practice quiz and as the bank the timed mock exam draws from.
CREATE TABLE IF NOT EXISTS quiz_questions (
  id        SERIAL PRIMARY KEY,
  pool_key  TEXT NOT NULL,
  text      TEXT NOT NULL,
  choices   JSONB NOT NULL,   -- array of 4 option strings
  correct   TEXT NOT NULL,
  ord       INTEGER NOT NULL  -- original order within the pool (kept for deterministic seeding)
);
CREATE INDEX IF NOT EXISTS idx_quiz_pool ON quiz_questions(pool_key);

-- Static reference/config content that doesn't need its own relational shape:
-- tierMeta, roadmaps (5-step journeys), stagesByType, examPatterns, orgLookup.
-- Stored as JSONB blobs keyed by name so the API can serve them as-is.
CREATE TABLE IF NOT EXISTS content_blocks (
  key   TEXT PRIMARY KEY,
  data  JSONB NOT NULL
);

-- A timed mock-exam attempt. `questions` holds the server-generated question
-- set INCLUDING correct answers — never sent to the client until submission.
CREATE TABLE IF NOT EXISTS mock_attempts (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id            INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  set_num           INTEGER NOT NULL,
  pattern_label     TEXT NOT NULL,
  question_count    INTEGER NOT NULL,
  duration_minutes  INTEGER NOT NULL,
  questions         JSONB NOT NULL,      -- [{text, choices:[...4], correct}]
  answers           JSONB,               -- submitted answers, same length/order as questions
  score             INTEGER,
  time_used_seconds INTEGER,
  status            TEXT NOT NULL DEFAULT 'in_progress', -- in_progress | submitted
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON mock_attempts(user_id);
