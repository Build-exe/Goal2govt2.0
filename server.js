require('.env').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { attachUser } = require('./src/middleware/auth');
const authRoutes = require('./src/routes/auth');
const contentRoutes = require('./src/routes/content');
const examRoutes = require('./src/routes/exam');

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // CSP off by default so the existing static site's inline handlers keep working
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api', contentRoutes);
app.use('/api/exam', examRoutes);

// Serve the existing frontend (index.html, style.css, script.js, logo.png)
app.use(express.static(path.join(__dirname, 'public')));

// 404 for unmatched API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Goal2Govt backend running on http://localhost:${PORT}`);
});
