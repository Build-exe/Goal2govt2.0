CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT        NOT NULL,
  email                TEXT        NOT NULL,
  password             TEXT        NOT NULL,          -- bcrypt hash
  reset_token_hash     TEXT,
  reset_token_expires  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
