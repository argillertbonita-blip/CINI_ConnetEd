const crypto = require('crypto');
const db = require('../../db');
const { ensureQuestionBankSchema, parseChoicesColumn } = require('./questionBank');

let schemaPromise = null;

async function ensureQuizShareSchema(conn = db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await ensureQuestionBankSchema(conn);
    try {
      await conn.query(`ALTER TABLE assessments ADD COLUMN share_token VARCHAR(32) NULL`);
    } catch (e) { /* exists */ }
    try {
      await conn.query(`ALTER TABLE assessments ADD COLUMN share_enabled TINYINT(1) NOT NULL DEFAULT 0`);
    } catch (e) { /* exists */ }
    try {
      await conn.query(`ALTER TABLE assessments ADD UNIQUE KEY uq_assessments_share_token (share_token)`);
    } catch (e) { /* exists */ }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS quiz_submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_id INT NOT NULL,
        student_id INT NOT NULL,
        share_token VARCHAR(32) NOT NULL,
        answers JSON NOT NULL,
        score DECIMAL(8,2) NOT NULL DEFAULT 0,
        max_score DECIMAL(8,2) NOT NULL DEFAULT 0,
        submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_quiz_sub_assessment_student (assessment_id, student_id),
        KEY idx_quiz_sub_token (share_token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  })().catch((e) => {
    schemaPromise = null;
    throw e;
  });
  return schemaPromise;
}

function generateShareToken() {
  return crypto.randomBytes(8).toString('hex');
}

function publicQuestion(row) {
  return {
    id: row.id,
    sort_order: row.sort_order,
    item_type: row.item_type,
    question: row.question,
    choices: parseChoicesColumn(row.choices),
    points: Number(row.points) || 1
  };
}

function identificationReviewBank(questions) {
  const ids = (questions || []).filter((q) => String(q.item_type || '').toLowerCase() === 'identification');
  const seen = new Set();
  const answers = [];
  const add = (raw, list) => {
    const text = String(raw || '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(text);
  };
  ids.forEach((q) => add(q.answer != null ? q.answer : q.expected, answers));
  if (!answers.length) return [];
  const words = answers.slice();
  ids.forEach((q) => {
    const extras = Array.isArray(q.choices) ? q.choices : parseChoicesColumn(q.choices) || [];
    extras.forEach((word) => add(word, words));
  });
  return words;
}

function identificationAnswerBank(questions) {
  const words = identificationReviewBank(questions).slice();
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = words[i];
    words[i] = words[j];
    words[j] = tmp;
  }
  return words;
}

function publicQuestionsForQuiz(questions) {
  const bank = identificationAnswerBank(questions);
  return (questions || []).map((q) => {
    const pub = publicQuestion(q);
    if (String(q.item_type || '').toLowerCase() === 'identification') {
      pub.choices = bank.length ? bank.slice() : [];
    }
    return pub;
  });
}

function shuffleQuestionsWithinSections(questions) {
  const groups = [];
  const map = new Map();
  for (const q of questions || []) {
    const key = String(q.item_type || 'mcq');
    if (!map.has(key)) {
      const bucket = [];
      map.set(key, bucket);
      groups.push(bucket);
    }
    map.get(key).push(q);
  }
  const shuffled = [];
  for (const bucket of groups) {
    const copy = bucket.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    shuffled.push(...copy);
  }
  return shuffled;
}

async function getAssessmentQuestions(assessmentId) {
  await ensureQuestionBankSchema();
  const [rows] = await db.query(
    `SELECT id, question_bank_id, sort_order, item_type, question, choices, answer, points
     FROM assessment_questions
     WHERE assessment_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [assessmentId]
  );
  return rows.map((r) => ({
    ...r,
    choices: parseChoicesColumn(r.choices),
    points: Number(r.points) || 1
  }));
}

function isActivityItemType(type) {
  const t = String(type || '').toLowerCase();
  return t === 'activity' || t === 'activity_prompt';
}

function extractAnswerText(raw) {
  if (raw == null) return '';
  if (typeof raw === 'object') return String(raw.text ?? raw.answer ?? '').trim();
  return String(raw).trim();
}

function parseJsonMaybe(raw) {
  if (raw == null || raw === '') return null;
  let v = raw;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) v = v.toString('utf8');
  for (let i = 0; i < 4; i++) {
    if (v && typeof v === 'object') return v;
    if (typeof v !== 'string') break;
    const t = v.trim();
    if (!t) return null;
    try {
      v = JSON.parse(t);
    } catch {
      return null;
    }
  }
  return v && typeof v === 'object' ? v : null;
}

function answersBagFromPayload(payload) {
  const parsed = parseJsonMaybe(payload) || payload;
  if (!parsed || typeof parsed !== 'object') return {};
  if (Array.isArray(parsed)) {
    const map = {};
    parsed.forEach((a) => {
      if (a == null || a.question_id == null) return;
      map[String(a.question_id)] = a.answer;
    });
    return map;
  }
  if (parsed.answers && typeof parsed.answers === 'object') {
    if (Array.isArray(parsed.answers)) {
      const map = {};
      parsed.answers.forEach((a) => {
        if (a == null || a.question_id == null) return;
        map[String(a.question_id)] = a.answer;
      });
      return map;
    }
    return parsed.answers;
  }
  return parsed;
}

function activityWorkFromSubmission(answersPayload, questions) {
  const bag = answersBagFromPayload(answersPayload);
  return (questions || [])
    .filter((q) => isActivityItemType(q.item_type))
    .map((q) => {
      const raw = bag[String(q.id)] ?? bag[q.id];
      const text = extractAnswerText(raw);
      const file = raw && typeof raw === 'object' && raw.file && raw.file.url
        ? {
            url: String(raw.file.url),
            name: String(raw.file.name || 'Attachment'),
            mime: String(raw.file.mime || '')
          }
        : null;
      return {
        question_id: q.id,
        question: q.question || '',
        text,
        file
      };
    })
    .filter((w) => w.text || w.file);
}

function normalizeTypedAnswer(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,;:!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitAnswerParts(raw, pattern) {
  return String(raw || '')
    .split(pattern)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

function fillBlankAnswersMatch(given, expected) {
  const left = splitAnswerParts(given, /\s*(?:,|;|\n)\s*/);
  const right = splitAnswerParts(expected, /\s*(?:,|;|\n)\s*/);
  if (!left.length || left.length !== right.length) return false;
  return left.every((p, i) => p === right[i]);
}

function matchingAnswersMatch(given, expected) {
  const parse = (raw) => splitAnswerParts(raw, /\s*;\s*/).map((pair) => {
    const bits = pair.split('|').map((p) => p.trim());
    return `${bits[0] || ''}|${bits[1] || ''}`;
  });
  const left = parse(given);
  const right = parse(expected);
  if (!left.length || left.length !== right.length) return false;
  return left.every((p, i) => p === right[i]);
}

function sequencingAnswersMatch(given, expected) {
  const left = splitAnswerParts(given, /\s*\|\s*/);
  const right = splitAnswerParts(expected, /\s*\|\s*/);
  if (!left.length || left.length !== right.length) return false;
  return left.every((p, i) => p === right[i]);
}

function typedAnswersMatch(given, expected) {
  const a = normalizeTypedAnswer(given);
  const b = normalizeTypedAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  const parts = (s) => s.split(/\s*(?:,|;|\/|\band\b)\s*/).map((p) => p.trim()).filter(Boolean).sort();
  const left = parts(a);
  const right = parts(b);
  if (right.length < 2 || left.length !== right.length) return false;
  return left.every((p, i) => p === right[i]);
}

function scoreSubmission(questions, answersInput) {
  const answerMap = new Map();
  const bag = answersBagFromPayload(answersInput);
  Object.entries(bag).forEach(([qid, val]) => {
    const n = Number(qid);
    if (!Number.isFinite(n)) return;
    answerMap.set(n, extractAnswerText(val));
  });

  let earned = 0;
  let maxScore = 0;
  const detail = [];

  for (const q of questions) {
    const pts = Number(q.points) || 1;
    maxScore += pts;
    const given = answerMap.has(Number(q.id)) ? answerMap.get(Number(q.id)) : '';
    let correct = false;
    let autoScored = false;
    const type = String(q.item_type || '').toLowerCase();
    const isMcq = type === 'mcq' || type === 'multiple_choice';
    const isTyped = type === 'identification' || type === 'enumeration';
    if (type === 'short_answer' || isActivityItemType(type)) {
      autoScored = false;
    } else if (type === 'fill_blank') {
      autoScored = true;
      correct = fillBlankAnswersMatch(given, q.answer);
    } else if (type === 'matching') {
      autoScored = true;
      correct = matchingAnswersMatch(given, q.answer);
    } else if (type === 'sequencing') {
      autoScored = true;
      correct = sequencingAnswersMatch(given, q.answer);
    } else if (type === 'true_false') {
      autoScored = true;
      correct = mcqAnswersMatch(given, q.answer, ['True', 'False']);
    } else if (isTyped) {
      autoScored = true;
      correct = typedAnswersMatch(given, q.answer);
    } else if (isMcq || (Array.isArray(q.choices) && q.choices.length && !isActivityItemType(type))) {
      autoScored = true;
      correct = mcqAnswersMatch(given, q.answer, q.choices);
    }
    if (autoScored && correct) earned += pts;
    detail.push({
      question_id: q.id,
      given,
      correct: autoScored ? correct : null,
      points: pts
    });
  }

  return { earned, maxScore, detail };
}

function quizTakenFromSubmission(answersPayload, questions) {
  const quizQs = (questions || []).filter((q) => !isActivityItemType(q.item_type));
  if (!quizQs.length) return [];
  const { detail } = scoreSubmission(quizQs, answersPayload);
  const byId = new Map(detail.map((d) => [Number(d.question_id), d]));
  return quizQs.map((q, i) => {
    const d = byId.get(Number(q.id)) || {};
    return {
      question_id: q.id,
      n: i + 1,
      item_type: q.item_type || 'mcq',
      question: q.question || '',
      choices: Array.isArray(q.choices) ? q.choices : [],
      expected: q.answer != null ? String(q.answer) : '',
      given: d.given || '',
      correct: d.correct === true ? true : d.correct === false ? false : null,
      points: Number(q.points) || 1
    };
  });
}

function mcqLetterAt(index) {
  let n = Number(index);
  if (!Number.isFinite(n) || n < 0) n = 0;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function mcqIndexFromToken(token) {
  const t = String(token || '').trim();
  if (!t) return -1;
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (n >= 1) return n - 1;
    if (n === 0) return 0;
    return -1;
  }
  if (!/^[A-Za-z]+$/.test(t)) return -1;
  const u = t.toUpperCase();
  let n = 0;
  for (let i = 0; i < u.length; i++) n = n * 26 + (u.charCodeAt(i) - 64);
  return n - 1;
}

function stripMcqChoicePrefix(text) {
  return String(text || '').replace(/^\s*(?:[A-Za-z]+|\d+)\s*[.)]\s+/, '').trimEnd();
}

function mcqCanonicalKey(answer, choices) {
  const raw = String(answer || '').trim();
  if (!raw) return '';
  const list = Array.isArray(choices) ? choices : [];
  const idxFromToken = mcqIndexFromToken(raw);
  if (idxFromToken >= 0 && (list.length === 0 || idxFromToken < list.length || idxFromToken < 26)) {
    return mcqLetterAt(idxFromToken);
  }
  const idxFromText = list.findIndex((c) => {
    const plain = stripMcqChoicePrefix(c).trim().toLowerCase();
    const full = String(c).trim().toLowerCase();
    const want = raw.toLowerCase();
    return plain === want || full === want;
  });
  if (idxFromText >= 0) return mcqLetterAt(idxFromText);
  return raw.toUpperCase();
}

function mcqAnswersMatch(given, expected, choices) {
  const a = mcqCanonicalKey(given, choices);
  const b = mcqCanonicalKey(expected, choices);
  return a !== '' && a === b;
}

module.exports = {
  ensureQuizShareSchema,
  generateShareToken,
  publicQuestion,
  publicQuestionsForQuiz,
  identificationReviewBank,
  shuffleQuestionsWithinSections,
  getAssessmentQuestions,
  scoreSubmission,
  isActivityItemType,
  activityWorkFromSubmission,
  quizTakenFromSubmission,
  answersBagFromPayload
};
