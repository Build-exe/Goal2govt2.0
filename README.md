# Goal2Govt Backend

Express + PostgreSQL backend for the Goal2Govt site: real user accounts,
a database-backed jobs/roadmap content API, and server-scored timed mock
exams with saved history. This was tested end-to-end against a real
PostgreSQL database before being handed to you (signup, login, exam
start/submit/history, duplicate-submit rejection, etc. all verified).

## What changed from the original static site

- **Auth** used to be `localStorage` in the browser (anyone could read or
  forge it in devtools). It's now real: bcrypt-hashed passwords in
  Postgres, a JWT in an httpOnly cookie, signup/login/logout/me endpoints.
- **Timed mock exams** used to hold the full question bank *and the
  correct answers* in `script.js`, visible to anyone who opened devtools.
  Question generation and scoring now happen server-side — the browser
  only receives the answer key after it submits.
- **Mock exam history** is new: every attempt is saved per user
  (`GET /api/exam/history`), with a "View My Results" link added to the
  mock exam panel in the UI.
- **Jobs, tiers, roadmaps, exam-stage summaries, and the org-lookup
  table** were extracted out of `script.js` and seeded into Postgres,
  exposed via a content API (`/api/jobs`, `/api/bootstrap`, etc.) for
  future use.

**Scope note:** the job-listing / roadmap / practice-quiz *rendering*
code in `public/script.js` (~2000 lines) still reads from the original
hardcoded `jobs`/`roadmaps`/`quizPools` consts at the top of the file —
I didn't rewire every render function to fetch async, since that's a
large, separate frontend refactor with real risk of breaking something
I can't test in a live browser here. The data now lives in the database
and is already served by the API (`/api/bootstrap` returns everything
in the same shape); pointing the rendering code at it is a
follow-up if you want it. Auth and the mock exam — the two places that
actually needed a server for correctness/security — are fully wired up.

## Project layout

```
server.js               Express app entry point
src/
  db.js                  PostgreSQL connection pool
  schema.sql             Table definitions (run automatically by seed.js)
  seed.js                Loads schema + populates DB from seed-data.json
  middleware/auth.js     JWT cookie helpers + requireAuth guard
  routes/auth.js         signup / login / logout / me
  routes/content.js      jobs / tiers / roadmaps / bootstrap / practice quiz
  routes/exam.js         exam pattern / start / submit / history
  utils/seededRandom.js  Same deterministic shuffle algorithm the old
                         client used, so "Mock Test 2" is still the same
                         fixed question set every time
seed-data.json           Extracted jobs/quiz/roadmap data (source for seed.js)
public/                  The frontend (index.html, style.css, script.js,
                         logo.png) — script.js's auth + mock-exam sections
                         were rewritten to call the API instead of
                         localStorage / generating questions client-side
```

## Setup

1. **Install PostgreSQL** if you don't have it (locally, or use a hosted
   one — Render, Railway, Supabase, Neon, RDS all work fine).

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   - `DATABASE_URL` — your Postgres connection string
   - `DATABASE_SSL=true` if your host requires SSL (most managed hosts do)
   - `JWT_SECRET` — generate one with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```

4. **Create the schema and load the data:**
   ```bash
   npm run seed
   ```
   Safe to re-run any time — it upserts jobs/content and replaces the
   quiz question bank, without touching users or exam history.

5. **Run it:**
   ```bash
   npm start          # production
   npm run dev        # auto-restarts on file changes (Node's --watch)
   ```
   The site (frontend + API) is served from `http://localhost:4000` (or
   whatever `PORT` you set) — `public/` is served as static files, and
   `/api/*` is the backend.

## API reference

All endpoints are under `/api`. Auth endpoints set/read an httpOnly
`g2g_token` cookie — the frontend calls `fetch(..., { credentials:
'include' })`, so if you call the API from a different origin than the
one serving the frontend, set `CORS_ORIGIN` in `.env` to that origin.

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | `{ name, email, password }` | password ≥ 6 chars; sets session cookie |
| POST | `/api/auth/login` | `{ email, password }` | sets session cookie |
| POST | `/api/auth/logout` | – | clears session cookie |
| GET | `/api/auth/me` | – | 401 if not signed in, else `{ user }` |

### Content (public)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/tiers` | tier metadata (10th/12th/ITI/diploma/degree/btech) |
| GET | `/api/jobs?tier=10th` | list jobs, optional tier filter |
| GET | `/api/jobs/:slug` | single job |
| GET | `/api/roadmaps` | 5-step roadmap templates by roadmap type |
| GET | `/api/stages` | 3-item exam-stage summaries by roadmap type |
| GET | `/api/exam-patterns` | fallback exam patterns by roadmap type |
| GET | `/api/quiz/:tier` | practice quiz pool for a tier |
| GET | `/api/bootstrap` | everything above in one call |

### Timed mock exam
| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/api/exam/pattern/:slug` | no | – | question count / duration / label for a job |
| POST | `/api/exam/start` | yes | `{ slug, setNum }` (1-3) | generates & stores the question set server-side; response has **no answers** |
| POST | `/api/exam/submit` | yes | `{ attemptId, answers, timeUsedSeconds }` | scores it, returns score + full review with correct answers; an attempt can only be submitted once |
| GET | `/api/exam/history` | yes | – | this user's past attempts (score, job, date, status) |

## Deploying

- Any Node host works (Render, Railway, Fly.io, a VPS, etc.) — just set
  the same env vars and run `npm run seed` once against the production
  database, then `npm start`.
- Set `NODE_ENV=production` so auth cookies are marked `secure` (requires
  HTTPS in front of the app).
- Point `CORS_ORIGIN` at your real domain if the frontend is ever served
  from somewhere other than this same Express app.
