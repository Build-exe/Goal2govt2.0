/* Creates the schema (if needed) and populates the database from
   seed-data.json — the jobs, quiz pools and reference content that used
   to live as hardcoded consts in the frontend script.js. Safe to re-run:
   it upserts everything. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(schema);
  console.log('Schema ensured.');

  const dataPath = path.join(__dirname, '..', 'seed-data.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Missing ${dataPath}. This file holds the extracted job/quiz/content data — see README.`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  // ---- jobs ----
  let jobCount = 0;
  for (const j of data.jobs) {
    await db.query(
      `INSERT INTO jobs (slug, code, tier, name, overview, age, edu, salary, roadmap_type, exam_q, exam_min, exam_label, recruiting_body, resource_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (slug) DO UPDATE SET
         code=EXCLUDED.code, tier=EXCLUDED.tier, name=EXCLUDED.name, overview=EXCLUDED.overview,
         age=EXCLUDED.age, edu=EXCLUDED.edu, salary=EXCLUDED.salary, roadmap_type=EXCLUDED.roadmap_type,
         exam_q=EXCLUDED.exam_q, exam_min=EXCLUDED.exam_min, exam_label=EXCLUDED.exam_label,
         recruiting_body=EXCLUDED.recruiting_body, resource_url=EXCLUDED.resource_url`,
      [
        j.id, j.code, j.tier, j.name, j.overview, j.age, j.edu, j.salary, j.roadmapType,
        j.examQ ?? null, j.examMin ?? null, j.examLabel ?? null,
        j.body ?? null, (j.resources && j.resources[0] && j.resources[0][1]) || null
      ]
    );
    jobCount++;
  }
  console.log(`Seeded ${jobCount} jobs.`);

  // ---- quiz questions ----
  let qCount = 0;
  await db.query('DELETE FROM quiz_questions'); // full replace keeps ord/pool_key consistent
  for (const poolKey of Object.keys(data.quizPools)) {
    const pool = data.quizPools[poolKey];
    for (let i = 0; i < pool.length; i++) {
      const [text, ...opts] = pool[i];
      const correct = opts[opts.length - 1];
      const choices = opts.slice(0, 4);
      await db.query(
        `INSERT INTO quiz_questions (pool_key, text, choices, correct, ord) VALUES ($1,$2,$3,$4,$5)`,
        [poolKey, text, JSON.stringify(choices), correct, i]
      );
      qCount++;
    }
  }
  console.log(`Seeded ${qCount} quiz questions across ${Object.keys(data.quizPools).length} pools.`);

  // ---- reference content blocks ----
  const blocks = {
    tierMeta: data.tierMeta,
    roadmaps: data.roadmaps,
    stagesByType: data.stagesByType,
    examPatterns: data.examPatterns,
    orgLookup: data.orgLookup
  };
  for (const key of Object.keys(blocks)) {
    await db.query(
      `INSERT INTO content_blocks (key, data) VALUES ($1,$2)
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`,
      [key, JSON.stringify(blocks[key])]
    );
  }
  console.log(`Seeded ${Object.keys(blocks).length} content blocks.`);

  console.log('Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
