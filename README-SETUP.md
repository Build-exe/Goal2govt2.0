# Goal2Govt backend (PostgreSQL)

1. Create a free database
   - Supabase: New project > Project Settings > Database > copy the **Session pooler** URI
   - or Neon: New project > copy the connection string
2. Copy everything in this folder into your repo root (overwrites package.json, db.js, auth.js, server.js; keeps your mailer.js)
3. `cp .env.example .env` and fill in DATABASE_URL, JWT_SECRET, SMTP_*, FRONTEND_URL
4. Append `.gitignore.additions` to your `.gitignore` (so `.env` and node_modules are never committed)
5. `npm install`
6. `npm run db:init`          creates the tables and tests the connection
7. `npm run migrate-users`    imports users.json (then delete users.json from the repo)
8. `npm start`  ->  http://localhost:3000/api/health  should show {"ok":true,"db":"connected"}

API (all under /api): POST signup, login, forgot-password, reset-password; GET me (Bearer token), health.

Deploy: GitHub Pages can't run Node. Use Render / Railway / Fly.io, add the same env vars there,
and point your frontend's API base URL to the deployed server.
