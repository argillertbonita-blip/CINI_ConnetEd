const { scoreSubmission, isActivityItemType, ensureQuizShareSchema } = require('./quizShare');
const {
  ensureQuestionBankSchema,
  parseChoicesColumn,
  normalizeRubric,
  bankItemTypeLabel
} = require('./questionBank');

function lessonName(lessonTitle, title) {
  const lesson = String(lessonTitle || '').trim();
  if (lesson) return lesson;
  const titleText = String(title || '').trim();
  return titleText || 'Untitled';
}

function lessonLookupKey(lesson) {
  return String(lesson || '').trim().toLowerCase() || 'untitled';
}

function parseJson(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickPartEnds(parts) {
  if (!parts.length) return { strong_part: null, weak_part: null };
  const sorted = [...parts].sort(
    (a, b) => b.avg_percent - a.avg_percent || a.name.localeCompare(b.name)
  );
  const strong = sorted[0];
  const weak = sorted[sorted.length - 1];
  return {
    strong_part: { name: strong.name, avg_percent: strong.avg_percent },
    weak_part: strong.name === weak.name
      ? null
      : { name: weak.name, avg_percent: weak.avg_percent }
  };
}

function attachPartsToLessons(lessons, partMap) {
  return (lessons || []).map((lesson) => {
    const grouped = partMap.get(lessonLookupKey(lesson.lesson)) || { quiz: [], activity: [] };
    return {
      ...lesson,
      quiz_parts: pickPartEnds(grouped.quiz || []),
      activity_parts: pickPartEnds(grouped.activity || [])
    };
  });
}

/**
 * Part percents for one student, keyed by lesson name.
 * A part is a quiz section (Multiple choice, Identification, …) from a saved
 * submission, or a rubric category from an activity score.
 */
async function partsByLesson(db, studentId) {
  const buckets = new Map();

  function add(lesson, kind, part, earned, max) {
    const maxN = Number(max) || 0;
    const earnedN = Number(earned);
    if (maxN <= 0 || !Number.isFinite(earnedN)) return;
    const key = lessonLookupKey(lesson);
    if (!buckets.has(key)) buckets.set(key, { quiz: new Map(), activity: new Map(), exam: new Map() });
    const bucket = buckets.get(key);
    const parts = bucket[kind === 'activity' ? 'activity' : kind === 'exam' ? 'exam' : 'quiz'];
    const name = String(part || '').trim() || 'Part';
    if (!parts.has(name)) parts.set(name, { earned: 0, max: 0 });
    const slot = parts.get(name);
    slot.earned += Math.max(0, earnedN);
    slot.max += maxN;
  }

  let submissions = [];
  let rubricRows = [];
  try {
    await ensureQuizShareSchema();
    [submissions] = await db.query(
      `SELECT qs.assessment_id, qs.answers, a.lesson_title, a.title, a.TYPE as type
       FROM quiz_submissions qs
       JOIN assessments a ON a.id = qs.assessment_id
       WHERE qs.student_id = ?`,
      [studentId]
    );
  } catch (err) {
    submissions = [];
  }

  try {
    try {
      await db.query(`ALTER TABLE assessments ADD COLUMN rubric JSON NULL`);
    } catch (e) { /* column may already exist */ }
    [rubricRows] = await db.query(
      `SELECT sc.assessment_id, sc.rubric_scores, a.lesson_title, a.title, a.rubric
       FROM assessment_scores sc
       JOIN assessments a ON a.id = sc.assessment_id
       WHERE sc.student_id = ? AND sc.rubric_scores IS NOT NULL`,
      [studentId]
    );
  } catch (err) {
    rubricRows = [];
  }

  const ids = [...new Set(
    [...submissions, ...rubricRows].map((row) => Number(row.assessment_id)).filter(Boolean)
  )];

  const byAssessment = new Map();
  if (ids.length) {
    try {
      await ensureQuestionBankSchema();
      const [qrows] = await db.query(
        `SELECT id, assessment_id, item_type, choices, answer, points, rubric
         FROM assessment_questions
         WHERE assessment_id IN (${ids.map(() => '?').join(',')})
         ORDER BY assessment_id, sort_order, id`,
        ids
      );
      for (const q of qrows) {
        const list = byAssessment.get(q.assessment_id) || [];
        list.push({
          ...q,
          choices: parseChoicesColumn(q.choices),
          points: Number(q.points) || 1
        });
        byAssessment.set(q.assessment_id, list);
      }
    } catch (err) {
      // Parts stay empty if question rows are unavailable.
    }
  }

  for (const sub of submissions) {
    const questions = byAssessment.get(sub.assessment_id) || [];
    if (!questions.length) continue;
    const lesson = lessonName(sub.lesson_title, sub.title);
    const { detail } = scoreSubmission(questions, sub.answers);
    const byId = new Map(detail.map((d) => [Number(d.question_id), d]));
    for (const q of questions) {
      if (isActivityItemType(q.item_type)) continue;
      const scored = byId.get(Number(q.id));
      if (!scored || scored.correct == null) continue;
      const pts = Number(q.points) || 1;
      const kind = String(sub.type || '').trim().toLowerCase() === 'exam' ? 'exam' : 'quiz';
      add(lesson, kind, bankItemTypeLabel(q.item_type), scored.correct ? pts : 0, pts);
    }
  }

  for (const row of rubricRows) {
    const scores = parseJson(row.rubric_scores);
    if (!scores || typeof scores !== 'object' || Array.isArray(scores)) continue;
    const lesson = lessonName(row.lesson_title, row.title);
    const activities = (byAssessment.get(row.assessment_id) || [])
      .filter((q) => isActivityItemType(q.item_type));
    const cats = [];
    activities.forEach((q, ai) => {
      const rubric = normalizeRubric(q.rubric, q.points);
      (rubric?.categories || []).forEach((c, ci) => {
        cats.push({
          key: `a${ai}_${ci}`,
          name: String(c.name || '').trim() || 'Category',
          max: Math.max(1, Number(c.max_points) || 1)
        });
      });
    });
    if (!cats.length) {
      const rubric = normalizeRubric(row.rubric);
      (rubric?.categories || []).forEach((c, ci) => {
        cats.push({
          key: `a0_${ci}`,
          name: String(c.name || '').trim() || 'Category',
          max: Math.max(1, Number(c.max_points) || 1)
        });
      });
    }
    const used = new Set();
    for (const [key, val] of Object.entries(scores)) {
      if (!/^a\d+_\d+$/.test(key)) continue;
      const cat = cats.find((c) => c.key === key);
      if (!cat || used.has(cat.key)) continue;
      const n = Number(val);
      if (!Number.isFinite(n)) continue;
      used.add(cat.key);
      add(lesson, 'activity', cat.name, n, cat.max);
    }
    if (!used.size) {
      for (const [key, val] of Object.entries(scores)) {
        if (/^a\d+_\d+$/.test(key)) continue;
        const n = Number(val);
        if (!Number.isFinite(n)) continue;
        const want = String(key).trim().toLowerCase();
        const cat = cats.find((c) => c.name.toLowerCase() === want && !used.has(c.key));
        if (!cat) continue;
        used.add(cat.key);
        add(lesson, 'activity', cat.name, n, cat.max);
      }
    }
  }

  function toParts(map) {
    return [...map.entries()].map(([name, slot]) => ({
      name,
      avg_percent: Math.min(100, Math.max(0, Math.round((slot.earned / slot.max) * 100)))
    }));
  }

  const out = new Map();
  for (const [lesson, grouped] of buckets) {
    out.set(lesson, {
      quiz: toParts(grouped.quiz),
      activity: toParts(grouped.activity),
      exam: toParts(grouped.exam)
    });
  }
  return out;
}

module.exports = {
  lessonName,
  lessonLookupKey,
  partsByLesson,
  attachPartsToLessons
};
