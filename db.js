require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});
pool.on('error', (err) => console.error('Unexpected PG pool error:', err.message));

const query = (text, params) => pool.query(text, params);

async function connectDB() {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const r = await pool.query('SELECT now()');
  console.log('PostgreSQL connected at', r.rows[0].now);
}

// Small user model so auth.js stays readable
const User = {
  findByEmail: async (email) =>
    (await query('SELECT * FROM users WHERE lower(email) = lower($1)', [email])).rows[0],
  findById: async (id) => (await query('SELECT * FROM users WHERE id = $1', [id])).rows[0],
  create: async ({ name, email, password }) =>
    (await query(
      'INSERT INTO users (name, email, password) VALUES ($1,$2,$3) RETURNING *',
      [name.trim(), email.trim().toLowerCase(), password])).rows[0],
  setResetToken: (id, hash, expires) =>
    query('UPDATE users SET reset_token_hash=$2, reset_token_expires=$3 WHERE id=$1', [id, hash, expires]),
  findByResetToken: async (hash) =>
    (await query('SELECT * FROM users WHERE reset_token_hash=$1 AND reset_token_expires > now()', [hash])).rows[0],
  setPassword: (id, password) =>
    query('UPDATE users SET password=$2, reset_token_hash=NULL, reset_token_expires=NULL WHERE id=$1', [id, password]),
};

module.exports = { pool, query, connectDB, User };

// `npm run db:init` -> create tables + test connection
if (require.main === module) {
  connectDB().then(() => pool.end()).catch((e) => { console.error('DB init failed:', e.message); process.exit(1); });
}
