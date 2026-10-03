const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('./db');
const { sendResetEmail } = require('./mailer');

const router = express.Router();
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

// Middleware: protects routes that need a logged-in user
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !emailOk(email) || !password || password.length < 6)
      return res.status(400).json({ error: 'Name, valid email and a password of 6+ characters are required' });

    if (await User.findByEmail(email))
      return res.status(409).json({ error: 'An account with this email already exists' });

    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    console.error('signup:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = emailOk(email) && (await User.findByEmail(email));
    if (!user || !(await bcrypt.compare(password || '', user.password)))
      return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('login:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('me:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const generic = { message: 'If that email is registered, a reset link has been sent.' };
  try {
    const email = req.body?.email;
    const user = emailOk(email) && (await User.findByEmail(email));
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await User.setResetToken(user.id, sha256(token), new Date(Date.now() + 60 * 60 * 1000));
      const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
      await sendResetEmail(user.email, user.name, `${base}/reset-password.html?token=${token}`);
    }
    res.json(generic); // same response either way, so emails can't be enumerated
  } catch (err) {
    console.error('forgot-password:', err);
    res.status(500).json({ error: 'Could not send reset email' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password || password.length < 6)
      return res.status(400).json({ error: 'Token and a password of 6+ characters are required' });

    const user = await User.findByResetToken(sha256(token));
    if (!user) return res.status(400).json({ error: 'Reset link is invalid or has expired' });

    await User.setPassword(user.id, await bcrypt.hash(password, 10));
    res.json({ message: 'Password updated. You can now log in.' });
  } catch (err) {
    console.error('reset-password:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, requireAuth };
