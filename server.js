require('dotenv').config();
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { connectDB, query } = require('./db');
const { router: authRouter } = require('./auth');

if (!process.env.JWT_SECRET) { console.error('JWT_SECRET is missing in .env'); process.exit(1); }

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

// CORS: only needed if the frontend is hosted elsewhere (e.g. GitHub Pages).
// Set CORS_ORIGINS=https://build-exe.github.io in .env (comma separated for several)
const allowed = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', async (req, res) => {
  try { await query('SELECT 1'); res.json({ ok: true, db: 'connected' }); }
  catch { res.status(500).json({ ok: false, db: 'down' }); }
});

// Brute-force protection on auth routes
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/api', authRouter);

// Static site. Server code, users.json and env files are never served.
const blocked = /^\/(server|db|auth|mailer|migrate-users)\.js$|^\/(users\.json|package(-lock)?\.json|schema\.sql|README-SETUP\.md|\.env.*|\.git.*)$/i;
app.use((req, res, next) => (blocked.test(req.path) ? res.sendStatus(404) : next()));
app.use(express.static(__dirname, { dotfiles: 'ignore' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
connectDB()
  .then(() => app.listen(PORT, () => console.log(`Goal2Govt running on http://localhost:${PORT}`)))
  .catch((e) => { console.error('Could not connect to database:', e.message); process.exit(1); });
