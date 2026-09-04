/* Deterministic seeded shuffle — identical algorithm to the original
   client-side code, moved server-side so "Mock Test 2" always draws the
   same fixed set of questions for a given job+set, without ever exposing
   the answer key to the browser before submission. */

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, seedStr) {
  const seedFn = xmur3(seedStr);
  const rand = mulberry32(seedFn());
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// tier -> quiz pool key (same mapping as the original tierPool() function)
function poolKeyForTier(tier) {
  if (tier === '10th') return 'p10';
  if (tier === '12th') return 'p12';
  if (tier === 'iti' || tier === 'diploma') return 'technical';
  if (tier === 'degree') return 'grad';
  return 'engineering'; // btech
}

/**
 * Build a deterministic set of exam questions from a question pool.
 * pool: array of {text, choices:[opt1,opt2,opt3,opt4], correct}
 */
function buildExamQuestions(pool, count, seedStr) {
  const rounds = [];
  let remaining = count;
  let pass = 0;
  while (remaining > 0) {
    const shuffled = seededShuffle(pool, seedStr + '-pass' + pass);
    const take = Math.min(remaining, shuffled.length);
    rounds.push(...shuffled.slice(0, take));
    remaining -= take;
    pass++;
  }
  return rounds.map((q, idx) => {
    const choices = seededShuffle(q.choices, seedStr + '-opts' + idx);
    return { text: q.text, choices, correct: q.correct };
  });
}

module.exports = { xmur3, mulberry32, seededShuffle, poolKeyForTier, buildExamQuestions };
