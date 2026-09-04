const express = require('express');
const db = require('../db');

const router = express.Router();

function jobRowToApi(r) {
  return {
    id: r.slug,
    code: r.code,
    tier: r.tier,
    name: r.name,
    overview: r.overview,
    age: r.age,
    edu: r.edu,
    salary: r.salary,
    roadmapType: r.roadmap_type,
    examQ: r.exam_q,
    examMin: r.exam_min,
    examLabel: r.exam_label,
    body: r.recruiting_body,
    resources: r.resource_url ? [[r.recruiting_body, r.resource_url]] : []
  };
}

async function getContentBlock(key) {
  const result = await db.query('SELECT data FROM content_blocks WHERE key = $1', [key]);
  return result.rows[0] ? result.rows[0].data : null;
}

router.get('/tiers', async (_req, res) => {
  res.json(await getContentBlock('tierMeta'));
});

router.get('/roadmaps', async (_req, res) => {
  res.json(await getContentBlock('roadmaps'));
});

router.get('/stages', async (_req, res) => {
  res.json(await getContentBlock('stagesByType'));
});

router.get('/exam-patterns', async (_req, res) => {
  res.json(await getContentBlock('examPatterns'));
});

router.get('/jobs', async (req, res) => {
  const { tier } = req.query;
  const result = tier
    ? await db.query('SELECT * FROM jobs WHERE tier = $1 ORDER BY code', [tier])
    : await db.query('SELECT * FROM jobs ORDER BY tier, code');
  res.json(result.rows.map(jobRowToApi));
});

router.get('/jobs/:slug', async (req, res) => {
  const result = await db.query('SELECT * FROM jobs WHERE slug = $1', [req.params.slug]);
  if (!result.rows.length) return res.status(404).json({ error: 'Job not found.' });
  res.json(jobRowToApi(result.rows[0]));
});

// One call to fetch everything the frontend needs to render without
// re-hardcoding data in script.js — jobs + all static reference content.
router.get('/bootstrap', async (_req, res) => {
  const [jobsResult, tierMeta, roadmaps, stagesByType, examPatterns, orgLookup] = await Promise.all([
    db.query('SELECT * FROM jobs ORDER BY tier, code'),
    getContentBlock('tierMeta'),
    getContentBlock('roadmaps'),
    getContentBlock('stagesByType'),
    getContentBlock('examPatterns'),
    getContentBlock('orgLookup')
  ]);
  res.json({
    jobs: jobsResult.rows.map(jobRowToApi),
    tierMeta,
    roadmaps,
    stagesByType,
    examPatterns,
    orgLookup
  });
});

// Practice quiz pool for a tier (public — the free casual quiz, not the timed mock exam)
router.get('/quiz/:tier', async (req, res) => {
  const { poolKeyForTier } = require('../utils/seededRandom');
  const poolKey = poolKeyForTier(req.params.tier);
  const result = await db.query(
    'SELECT text, choices, correct FROM quiz_questions WHERE pool_key = $1 ORDER BY ord',
    [poolKey]
  );
  res.json(result.rows);
});

module.exports = router;
