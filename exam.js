const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { poolKeyForTier, buildExamQuestions } = require('../utils/seededRandom');

const router = express.Router();

async function loadJobBySlug(slug) {
  const result = await db.query('SELECT * FROM jobs WHERE slug = $1', [slug]);
  return result.rows[0] || null;
}

async function getExamPatternsBlock() {
  const result = await db.query("SELECT data FROM content_blocks WHERE key = 'examPatterns'");
  return result.rows[0] ? result.rows[0].data : {};
}

function patternForJob(job, examPatterns) {
  if (job.exam_q && job.exam_min) {
    return { questionCount: job.exam_q, durationMinutes: job.exam_min, label: job.exam_label || 'Exam Pattern' };
  }
  return examPatterns[job.roadmap_type];
}

async function loadPoolForTier(tier) {
  const poolKey = poolKeyForTier(tier);
  const result = await db.query(
    'SELECT text, choices, correct FROM quiz_questions WHERE pool_key = $1 ORDER BY ord',
    [poolKey]
  );
  return result.rows.map((r) => ({ text: r.text, choices: r.choices, correct: r.correct }));
}

// GET /api/exam/pattern/:slug — public, just describes the exam (no questions)
router.get('/pattern/:slug', async (req, res) => {
  const job = await loadJobBySlug(req.params.slug);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  const examPatterns = await getExamPatternsBlock();
  res.json(patternForJob(job, examPatterns));
});

// POST /api/exam/start { slug, setNum } — auth required
// Generates the question set server-side (deterministic per job+set, same
// algorithm the old client used) and stores the answer key in the DB.
// The response withholds `correct` so the browser never sees answers.
router.post('/start', requireAuth, async (req, res) => {
  try {
    const { slug, setNum } = req.body || {};
    if (!slug || ![1, 2, 3].includes(Number(setNum))) {
      return res.status(400).json({ error: 'A job and a set number (1-3) are required.' });
    }
    const job = await loadJobBySlug(slug);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const examPatterns = await getExamPatternsBlock();
    const pattern = patternForJob(job, examPatterns);
    const pool = await loadPoolForTier(job.tier);
    const seedStr = job.slug + '-set' + setNum;
    const questions = buildExamQuestions(pool, pattern.questionCount, seedStr);

    const insert = await db.query(
      `INSERT INTO mock_attempts (user_id, job_id, set_num, pattern_label, question_count, duration_minutes, questions)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [req.user.sub, job.id, setNum, pattern.label, pattern.questionCount, pattern.durationMinutes, JSON.stringify(questions)]
    );

    res.status(201).json({
      attemptId: insert.rows[0].id,
      job: { id: job.slug, name: job.name, tier: job.tier },
      pattern,
      questions: questions.map((q) => ({ text: q.text, choices: q.choices })) // no `correct`
    });
  } catch (err) {
    console.error('exam start error', err);
    res.status(500).json({ error: 'Could not start the exam. Please try again.' });
  }
});

// POST /api/exam/submit { attemptId, answers, timeUsedSeconds }
router.post('/submit', requireAuth, async (req, res) => {
  try {
    const { attemptId, answers, timeUsedSeconds } = req.body || {};
    if (!attemptId || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'attemptId and answers are required.' });
    }
    const result = await db.query('SELECT * FROM mock_attempts WHERE id = $1 AND user_id = $2', [attemptId, req.user.sub]);
    const attempt = result.rows[0];
    if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });
    if (attempt.status === 'submitted') {
      return res.status(409).json({ error: 'This attempt has already been submitted.' });
    }

    const questions = attempt.questions;
    let score = 0;
    const review = questions.map((q, i) => {
      const yourAnswer = answers[i] ?? null;
      const isCorrect = yourAnswer === q.correct;
      if (isCorrect) score++;
      return { text: q.text, choices: q.choices, correct: q.correct, yourAnswer, isCorrect };
    });

    const safeTimeUsed = Number.isFinite(timeUsedSeconds)
      ? Math.max(0, Math.min(timeUsedSeconds, attempt.duration_minutes * 60))
      : attempt.duration_minutes * 60;

    await db.query(
      `UPDATE mock_attempts
       SET answers = $1, score = $2, time_used_seconds = $3, status = 'submitted', submitted_at = now()
       WHERE id = $4`,
      [JSON.stringify(answers), score, safeTimeUsed, attemptId]
    );

    res.json({
      score,
      total: questions.length,
      patternLabel: attempt.pattern_label,
      durationMinutes: attempt.duration_minutes,
      timeUsedSeconds: safeTimeUsed,
      review
    });
  } catch (err) {
    console.error('exam submit error', err);
    res.status(500).json({ error: 'Could not submit the exam. Please try again.' });
  }
});

// GET /api/exam/history — this user's past mock exam attempts
router.get('/history', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT a.id, a.set_num, a.pattern_label, a.question_count, a.duration_minutes,
            a.score, a.time_used_seconds, a.status, a.started_at, a.submitted_at,
            j.slug AS job_slug, j.name AS job_name, j.tier AS job_tier
     FROM mock_attempts a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.user_id = $1
     ORDER BY a.started_at DESC
     LIMIT 100`,
    [req.user.sub]
  );
  res.json(result.rows.map((r) => ({
    attemptId: r.id,
    job: { id: r.job_slug, name: r.job_name, tier: r.job_tier },
    setNum: r.set_num,
    patternLabel: r.pattern_label,
    questionCount: r.question_count,
    durationMinutes: r.duration_minutes,
    score: r.score,
    timeUsedSeconds: r.time_used_seconds,
    status: r.status,
    startedAt: r.started_at,
    submittedAt: r.submitted_at
  })));
});

module.exports = router;
