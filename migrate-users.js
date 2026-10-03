// One-time import of users.json into PostgreSQL.  Run: npm run migrate-users
// Accepts an array of users, or an object keyed by email. Existing emails are skipped.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool, connectDB, User } = require('./db');

(async () => {
  await connectDB();
  const file = path.join(__dirname, 'users.json');
  if (!fs.existsSync(file)) { console.log('No users.json found, nothing to import.'); return pool.end(); }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(raw) ? raw : Object.values(raw.users || raw);
  let added = 0, skipped = 0;
  for (const u of list) {
    const email = (u.email || '').toLowerCase();
    if (!email || (await User.findByEmail(email))) { skipped++; continue; }
    const pw = u.password || u.passwordHash || '';
    // keep existing bcrypt hashes, hash plain text; users with no password must use "Forgot password"
    const hashed = /^\$2[aby]\$/.test(pw) ? pw : await bcrypt.hash(pw || require('crypto').randomBytes(16).toString('hex'), 10);
    await User.create({ name: u.name || email.split('@')[0], email, password: hashed });
    added++;
  }
  console.log(`Imported ${added}, skipped ${skipped}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
