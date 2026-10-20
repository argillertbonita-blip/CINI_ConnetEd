const db = require('../../db');

let schemaPromise = null;

async function ensureQuestionBankSchema(conn = db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS quiz_sets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        subject_id INT NULL,
        grade_level INT NOT NULL,
        lesson_plan_id INT NULL,
        lesson_title VARCHAR(255) NULL,
        ai_recommendation_id INT NULL,
        source ENUM('ai','manual') NOT NULL DEFAULT 'manual',
        status ENUM('active','archived') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_qs_teacher (teacher_id, status),
        KEY idx_qs_grade (teacher_id, grade_level),
        KEY idx_qs_ai (ai_recommendation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS question_bank (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        quiz_set_id INT NULL,
        subject_id INT NULL,
        grade_level INT NOT NULL,
        lesson_plan_id INT NULL,
        lesson_title VARCHAR(255) NULL,
        item_type VARCHAR(32) NOT NULL DEFAULT 'mcq',
        question TEXT NOT NULL,
        choices JSON NULL,
        answer VARCHAR(500) NULL,
        points DECIMAL(8,2) NOT NULL DEFAULT 1,
        source ENUM('ai','manual') NOT NULL DEFAULT 'manual',
        ai_recommendation_id INT NULL,
        status ENUM('active','archived') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_qb_teacher (teacher_id, status),
        KEY idx_qb_set (quiz_set_id),
        KEY idx_qb_grade_subject (teacher_id, grade_level, subject_id),
        KEY idx_qb_lesson (lesson_plan_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    try {
      await conn.query(`ALTER TABLE quiz_sets ADD COLUMN kind VARCHAR(20) NULL`);
    } catch (e) { /* exists */ }
    try {
      await conn.query(`ALTER TABLE question_bank ADD COLUMN quiz_set_id INT NULL`);
    } catch (e) { /* exists */ }
    try {
      await conn.query(
        `ALTER TABLE question_bank MODIFY item_type VARCHAR(32) NOT NULL DEFAULT 'mcq'`
      );
    } catch (e) { /* ignore */ }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS assessment_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_id INT NOT NULL,
        question_bank_id INT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        item_type VARCHAR(32) NOT NULL DEFAULT 'mcq',
        question TEXT NOT NULL,
        choices JSON NULL,
        answer VARCHAR(500) NULL,
        points DECIMAL(8,2) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_aq_assessment (assessment_id),
        KEY idx_aq_bank (question_bank_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    try {
      await conn.query(
        `ALTER TABLE assessment_questions MODIFY item_type VARCHAR(32) NOT NULL DEFAULT 'mcq'`
      );
    } catch (e) { /* ignore */ }

    try {
      await conn.query(`ALTER TABLE question_bank ADD COLUMN rubric JSON NULL`);
    } catch (e) { /* exists */ }
    try {
      await conn.query(
        `ALTER TABLE question_bank ADD COLUMN folder VARCHAR(20) NOT NULL DEFAULT 'quiz'`
      );
    } catch (e) { /* exists */ }
    try {
      await conn.query(
        `UPDATE question_bank qb
         INNER JOIN assessment_questions aq ON aq.question_bank_id = qb.id
         INNER JOIN assessments a ON a.id = aq.assessment_id AND a.\`TYPE\` = 'exam'
         SET qb.folder = 'exam'
         WHERE NOT EXISTS (
           SELECT 1 FROM assessment_questions aq2
           INNER JOIN assessments a2 ON a2.id = aq2.assessment_id AND a2.\`TYPE\` <> 'exam'
           WHERE aq2.question_bank_id = qb.id
         )`
      );
    } catch (e) { /* assessments link may be unavailable during first boot */ }
    try {
      await conn.query(`ALTER TABLE assessment_questions ADD COLUMN rubric JSON NULL`);
    } catch (e) { /* exists */ }

    // Legacy item_type: activity_prompt → activity
    try {
      await conn.query(
        `UPDATE question_bank SET item_type = 'activity' WHERE item_type = 'activity_prompt'`
      );
    } catch (e) { /* ignore */ }
    try {
      await conn.query(
        `UPDATE assessment_questions SET item_type = 'activity' WHERE item_type = 'activity_prompt'`
      );
    } catch (e) { /* ignore */ }
  })().catch((e) => {
    schemaPromise = null;
    throw e;
  });
  return schemaPromise;
}

/** Canonical classwork item types (quiz + activity). */
const ITEM_TYPES = [
  'mcq', 'true_false', 'fill_blank', 'matching', 'sequencing',
  'identification', 'enumeration', 'short_answer', 'activity'
];

function storesChoiceList(type) {
  const t = String(type || '').toLowerCase();
  return ['mcq', 'true_false', 'fill_blank', 'matching', 'sequencing', 'identification'].includes(t);
}

function normalizeTrueFalseAnswer(raw) {
  const a = String(raw || '').trim().toLowerCase();
  return (a === 'false' || a === 'f' || a === 'no') ? 'False' : 'True';
}

function isActivityType(type) {
  const t = String(type || '').toLowerCase();
  return t === 'activity' || t === 'activity_prompt';
}

/** Normalize stored/API item_type; legacy activity_prompt → activity. */
function canonicalItemType(type) {
  const t = String(type || '').toLowerCase().trim();
  if (isActivityType(t)) return 'activity';
  if (ITEM_TYPES.includes(t)) return t;
  return t || 'mcq';
}

function isAllowedItemType(type) {
  const t = String(type || '').toLowerCase();
  return ITEM_TYPES.includes(t) || t === 'activity_prompt';
}

function normalizeChoices(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const list = raw.map((c) => String(c ?? '').trim()).filter(Boolean).slice(0, 8);
    return list.length ? list : null;
  }
  if (typeof raw === 'string') {
    try {
      return normalizeChoices(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return null;
}

function parseChoicesColumn(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

const DEFAULT_RUBRIC_LEVEL_LABELS = ['Excellent', 'Good', 'Fair', 'Needs Improvement'];

function defaultLevelPoints(maxPoints) {
  const max = Math.max(1, Number(maxPoints) || 5);
  return [
    max,
    Math.max(1, Math.ceil(max * 0.75)),
    Math.max(1, Math.ceil(max * 0.5)),
    Math.max(1, Math.ceil(max * 0.25))
  ];
}

/** Split total into n positive integers that sum exactly to total. */
function splitTotalPoints(total, n) {
  const count = Math.max(1, Number(n) || 1);
  const t = Math.max(count, Math.round(Number(total) || count));
  const base = Math.floor(t / count);
  const rem = t - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}

/**
 * Reassign category max_points so they sum to totalPoints; refresh level points.
 * Keeps names/descriptions.
 */
function redistributeRubricToTotal(rubric, totalPoints) {
  const normalized = normalizeRubric(rubric, totalPoints);
  if (!normalized?.categories?.length) return null;
  const shares = splitTotalPoints(totalPoints, normalized.categories.length);
  return {
    categories: normalized.categories.map((c, i) => {
      const max_points = shares[i] || 1;
      const pts = defaultLevelPoints(max_points);
      const levels = (c.levels || []).map((lv, li) => ({
        ...lv,
        points: pts[Math.min(li, pts.length - 1)]
      }));
      while (levels.length < 4) {
        const li = levels.length;
        levels.push({
          label: DEFAULT_RUBRIC_LEVEL_LABELS[li] || `Level ${li + 1}`,
          points: pts[li],
          description: ''
        });
      }
      return { name: c.name, max_points, levels: levels.slice(0, 4) };
    })
  };
}

/** Rubric list from new `categories` or legacy `criteria`. */
function rubricCategoryList(parsed) {
  if (!parsed || typeof parsed !== 'object') return [];
  if (Array.isArray(parsed.categories) && parsed.categories.length) return parsed.categories;
  if (Array.isArray(parsed.criteria) && parsed.criteria.length) return parsed.criteria;
  return [];
}

function normalizeRubric(raw, fallbackMax = 20) {
  if (raw == null || raw === '') return null;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const list = rubricCategoryList(parsed);
  const categories = list
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const name = String(c.name || c.title || '').trim().slice(0, 120);
      if (!name) return null;
      const max_points = Math.max(1, Number(c.max_points ?? c.points) || Math.max(1, Math.round(Number(fallbackMax) / 3) || 5));
      let levels = Array.isArray(c.levels) ? c.levels : null;
      if (!levels || !levels.length) {
        const pts = defaultLevelPoints(max_points);
        levels = DEFAULT_RUBRIC_LEVEL_LABELS.map((label, i) => ({
          label,
          points: pts[i],
          description: String(
            c[label.toLowerCase().replace(/\s+/g, '_')]
              || c[['excellent', 'good', 'fair', 'needs_improvement'][i]]
              || ''
          ).trim().slice(0, 400)
        }));
      } else {
        levels = levels.slice(0, 6).map((lv, i) => {
          const label = String(lv?.label || DEFAULT_RUBRIC_LEVEL_LABELS[i] || `Level ${i + 1}`).trim().slice(0, 40);
          const points = Math.max(0, Number(lv?.points) || defaultLevelPoints(max_points)[Math.min(i, 3)] || 1);
          const description = String(lv?.description || '').trim().slice(0, 400);
          return { label, points, description };
        });
      }
      return { name, max_points, levels };
    })
    .filter(Boolean)
    .slice(0, 8);
  if (!categories.length) return null;
  return { categories };
}

function rubricPointsTotal(raw, fallbackMax = 20) {
  const n = normalizeRubric(raw, fallbackMax);
  if (!n?.categories?.length) return 0;
  return n.categories.reduce((s, c) => s + Math.max(0, Number(c.max_points) || 0), 0);
}

function emptyRubricTemplate(totalPoints = 20) {
  const total = Math.max(3, Number(totalPoints) || 20);
  const shares = splitTotalPoints(total, 3);
  const names = ['Participation', 'Correctness', 'Effort'];
  return {
    categories: names.map((name, i) => {
      const max_points = shares[i];
      const pts = defaultLevelPoints(max_points);
      return {
        name,
        max_points,
        levels: DEFAULT_RUBRIC_LEVEL_LABELS.map((label, li) => ({
          label,
          points: pts[li],
          description: ''
        }))
      };
    })
  };
}

function rubricFromActivityDraft(part) {
  if (!part || typeof part !== 'object') return null;
  const fromStructured = normalizeRubric(part.rubric, part.max_score);
  if (fromStructured) return fromStructured;
  // Soft fallback: turn notes into one category description under Excellent tip
  const tip = String(part.notes || '').trim();
  if (!tip) return emptyRubricTemplate(part.max_score);
  const base = emptyRubricTemplate(part.max_score);
  if (base.categories[0]) {
    base.categories[0].levels[0].description = tip.slice(0, 400);
  }
  return base;
}

function quizItemsFromDraft(part) {
  if (!part || typeof part !== 'object') return [];
  const items = Array.isArray(part.items) ? part.items : [];
  const rows = items
    .map((it) => {
      let question = String(it?.question || '').trim();
      if (!question) return null;
      const choices = normalizeChoices(it.choices);
      const answer = it.answer != null ? String(it.answer).trim().slice(0, 500) : null;
      const points = Math.max(0.5, Number(it.points) || 1);
      let item_type = canonicalItemType(it.type || it.item_type || '');
      if (!ITEM_TYPES.includes(item_type) || isActivityType(item_type)) {
        item_type = choices && choices.length ? 'mcq' : 'short_answer';
      }
      let nextChoices = storesChoiceList(item_type) ? choices : null;
      let nextAnswer = answer;
      if (item_type === 'true_false') {
        nextChoices = ['True', 'False'];
        nextAnswer = normalizeTrueFalseAnswer(answer);
      } else if (item_type === 'fill_blank' && question && !/_{3,}/.test(question)) {
        question = `${question} _____`;
      } else if (item_type === 'matching' && nextChoices && nextChoices.length) {
        nextAnswer = nextChoices.join('; ').slice(0, 500);
      } else if (item_type === 'sequencing' && nextChoices && nextChoices.length) {
        nextAnswer = nextChoices.join(' | ').slice(0, 500);
      }
      return {
        item_type,
        question,
        choices: nextChoices,
        answer: nextAnswer,
        points,
        rubric: null
      };
    })
    .filter(Boolean);
  const idKeys = new Set(
    rows
      .filter((row) => row.item_type === 'identification')
      .map((row) => String(row.answer || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const seenId = new Set();
  return rows.filter((row) => {
    if (row.item_type !== 'identification') return true;
    const key = String(row.answer || '').trim().toLowerCase();
    if (!key || seenId.has(key)) return false;
    seenId.add(key);
    if (Array.isArray(row.choices)) {
      const extras = row.choices.filter((c) => !idKeys.has(String(c).trim().toLowerCase()));
      row.choices = extras.length ? extras : null;
    }
    return true;
  });
}

function activityFromDraft(part) {
  if (!part || typeof part !== 'object') return null;
  const question = String(part.description || part.title || '').trim();
  if (!question) return null;
  const points = Math.max(1, Number(part.max_score) || 20);
  return {
    item_type: 'activity',
    question,
    choices: null,
    answer: null,
    points,
    rubric: rubricFromActivityDraft(part)
  };
}

/** @deprecated Use activityFromDraft */
const activityPromptFromDraft = activityFromDraft;

async function insertBankItem(teacherId, setId, meta, item) {
  const rubricJson = item.rubric ? JSON.stringify(normalizeRubric(item.rubric, item.points) || item.rubric) : null;
  const folder = String(meta.folder || '').toLowerCase() === 'exam' ? 'exam' : 'quiz';
  const [result] = await db.query(
    `INSERT INTO question_bank
      (teacher_id, quiz_set_id, subject_id, grade_level, lesson_plan_id, lesson_title,
       item_type, question, choices, answer, points, rubric, source, ai_recommendation_id, folder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      teacherId,
      setId,
      meta.subjectId || null,
      Number(meta.gradeLevel),
      meta.lessonPlanId || null,
      meta.lessonTitle ? String(meta.lessonTitle).slice(0, 255) : null,
      item.item_type,
      item.question,
      item.choices ? JSON.stringify(item.choices) : null,
      item.answer,
      item.points,
      rubricJson,
      meta.source || 'ai',
      meta.aiRecommendationId || null,
      folder
    ]
  );
  return result.insertId;
}

/**
 * Save each present part of an AI draft as its own Classwork set.
 */
async function saveDraftPartsToBank({
  teacherId,
  subjectId,
  gradeLevel,
  lessonPlanId,
  lessonTitle,
  aiRecommendationId,
  content,
  types = ['quiz', 'activity'],
  folder = 'quiz',
  title = ''
}) {
  await ensureQuestionBankSchema();

  const examFolder = String(folder || '').toLowerCase() === 'exam';
  const parts = [];
  if (!examFolder && types.includes('activity') && content?.activity) {
    parts.push({
      kind: 'activity',
      folder: 'quiz',
      title: String(title || '').trim() ||
        content.activity.title ||
        (lessonTitle ? `Activity — ${lessonTitle}` : 'Activity')
    });
  }
  if ((examFolder || types.includes('quiz')) && content?.quiz) {
    parts.push({
      kind: examFolder ? 'exam' : 'quizzes',
      folder: examFolder ? 'exam' : 'quiz',
      title: String(title || '').trim() ||
        content.quiz.title ||
        (lessonTitle ? `Quiz — ${lessonTitle}` : 'Quiz')
    });
  }
  if (!parts.length) {
    const fallbackTitle = String(title || lessonTitle || 'Classwork').trim().slice(0, 255) || 'Classwork';
    return { created: 0, skipped: 0, ids: [], quiz_set_id: null, kind: null, title: fallbackTitle, sets: [] };
  }

  const saved = [];
  for (const part of parts) {
    const setTitle = String(part.title).trim().slice(0, 255) || 'Classwork';
    if (aiRecommendationId) {
      const [[existingSet]] = await db.query(
        `SELECT id, title, kind FROM quiz_sets
         WHERE teacher_id = ? AND ai_recommendation_id = ? AND status = 'active'
           AND (kind = ? OR (kind IS NULL AND ? = 'quizzes'))
         LIMIT 1`,
        [teacherId, aiRecommendationId, part.kind, part.kind]
      );
      if (existingSet) {
        const [items] = await db.query(
          `SELECT id FROM question_bank WHERE quiz_set_id = ? AND status = 'active'`,
          [existingSet.id]
        );
        saved.push({
          created: 0,
          ids: items.map((r) => r.id),
          quiz_set_id: existingSet.id,
          kind: part.kind,
          title: existingSet.title,
          already_exists: true
        });
        continue;
      }
    }

    const [setResult] = await db.query(
      `INSERT INTO quiz_sets
        (teacher_id, title, subject_id, grade_level, lesson_plan_id, lesson_title,
         ai_recommendation_id, source, kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ai', ?)`,
      [
        teacherId,
        setTitle,
        subjectId || null,
        Number(gradeLevel),
        lessonPlanId || null,
        lessonTitle ? String(lessonTitle).slice(0, 255) : null,
        aiRecommendationId || null,
        part.kind
      ]
    );
    const setId = setResult.insertId;
    const meta = {
      subjectId,
      gradeLevel,
      lessonPlanId,
      lessonTitle,
      aiRecommendationId,
      source: 'ai',
      folder: part.folder
    };
    const inserted = [];
    if (part.kind === 'activity') {
      const prompt = activityPromptFromDraft(content.activity);
      if (prompt) {
        const id = await insertBankItem(teacherId, setId, meta, prompt);
        inserted.push(id);
      }
    } else {
      for (const item of quizItemsFromDraft(content.quiz)) {
        const id = await insertBankItem(teacherId, setId, meta, item);
        inserted.push(id);
      }
    }
    if (!inserted.length) {
      await db.query(`UPDATE quiz_sets SET status = 'archived' WHERE id = ?`, [setId]);
      continue;
    }
    saved.push({
      created: inserted.length,
      ids: inserted,
      quiz_set_id: setId,
      kind: part.kind,
      title: setTitle,
      already_exists: false
    });
  }

  const primary = saved[0] || null;
  return {
    created: saved.reduce((sum, row) => sum + row.created, 0),
    skipped: saved.filter((row) => row.already_exists).reduce((sum, row) => sum + row.ids.length, 0),
    ids: saved.flatMap((row) => row.ids),
    quiz_set_id: primary ? primary.quiz_set_id : null,
    kind: primary ? primary.kind : null,
    title: primary ? primary.title : parts[0].title,
    already_exists: saved.length > 0 && saved.every((row) => row.already_exists),
    sets: saved
  };
}

function formatBankRow(row) {
  if (!row) return row;
  return {
    ...row,
    item_type: canonicalItemType(row.item_type),
    choices: parseChoicesColumn(row.choices),
    rubric: normalizeRubric(row.rubric, row.points),
    points: Number(row.points) || 1
  };
}

/**
 * Group legacy flat bank items (no quiz_set_id) into quiz_sets once.
 */
async function migrateOrphanBankItems(teacherId) {
  await ensureQuestionBankSchema();
  const [orphans] = await db.query(
    `SELECT * FROM question_bank
     WHERE teacher_id = ? AND status = 'active' AND quiz_set_id IS NULL
     ORDER BY id ASC`,
    [teacherId]
  );
  if (!orphans.length) return 0;

  const groups = new Map();
  for (const row of orphans) {
    const key = [
      row.ai_recommendation_id || 'x',
      row.lesson_plan_id || 'x',
      row.grade_level,
      row.subject_id || 'x',
      row.lesson_title || ''
    ].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let setsCreated = 0;
  for (const items of groups.values()) {
    const first = items[0];
    const title = first.lesson_title
      ? `Quiz — ${String(first.lesson_title).slice(0, 220)}`
      : `Saved items (${items.length})`;
    const [setResult] = await db.query(
      `INSERT INTO quiz_sets
        (teacher_id, title, subject_id, grade_level, lesson_plan_id, lesson_title,
         ai_recommendation_id, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        teacherId,
        title.slice(0, 255),
        first.subject_id || null,
        Number(first.grade_level),
        first.lesson_plan_id || null,
        first.lesson_title || null,
        first.ai_recommendation_id || null,
        first.source === 'ai' ? 'ai' : 'manual'
      ]
    );
    const setId = setResult.insertId;
    setsCreated += 1;
    const ids = items.map((i) => i.id);
    const placeholders = ids.map(() => '?').join(',');
    await db.query(
      `UPDATE question_bank SET quiz_set_id = ? WHERE id IN (${placeholders})`,
      [setId, ...ids]
    );
  }
  return setsCreated;
}

function bankItemTypeLabel(type) {
  const t = canonicalItemType(type);
  if (t === 'mcq') return 'Multiple choice';
  if (t === 'true_false') return 'True or False';
  if (t === 'fill_blank') return 'Fill in the blank';
  if (t === 'matching') return 'Matching';
  if (t === 'sequencing') return 'Sequencing';
  if (t === 'identification') return 'Identification';
  if (t === 'enumeration') return 'Enumeration';
  if (t === 'short_answer') return 'Short answer';
  if (t === 'activity') return 'Activity';
  return type ? String(type) : 'Multiple choice';
}

const TYPE_ORDER = [
  'mcq', 'true_false', 'fill_blank', 'matching', 'sequencing',
  'identification', 'enumeration', 'short_answer', 'activity'
];

function groupItemsByType(items) {
  const map = new Map();
  for (const item of items) {
    const key = canonicalItemType(item.item_type || 'mcq');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ ...item, item_type: key });
  }
  const ordered = [];
  for (const key of TYPE_ORDER) {
    if (map.has(key)) {
      ordered.push({ item_type: key, label: bankItemTypeLabel(key), items: map.get(key) });
      map.delete(key);
    }
  }
  for (const [key, list] of map.entries()) {
    ordered.push({ item_type: key, label: bankItemTypeLabel(key), items: list });
  }
  return ordered;
}

/**
 * Top-level folders inside a set: Quizzes vs Activity.
 */
function groupItemsByCategory(items) {
  const quizItems = [];
  const activityItems = [];
  const examItems = [];
  for (const item of items || []) {
    if (isActivityType(item.item_type)) {
      activityItems.push({ ...item, item_type: 'activity' });
    } else if (String(item.folder || '').toLowerCase() === 'exam') {
      examItems.push(item);
    } else {
      quizItems.push(item);
    }
  }
  const categories = [];
  if (quizItems.length) {
    categories.push({
      category: 'quizzes',
      label: 'Quizzes',
      item_count: quizItems.length,
      groups: groupItemsByType(quizItems)
    });
  }
  if (activityItems.length) {
    categories.push({
      category: 'activity',
      label: 'Activity',
      item_count: activityItems.length,
      groups: groupItemsByType(activityItems)
    });
  }
  if (examItems.length) {
    categories.push({
      category: 'exam',
      label: 'Exam',
      item_count: examItems.length,
      groups: groupItemsByType(examItems)
    });
  }
  return categories;
}

module.exports = {
  ensureQuestionBankSchema,
  normalizeChoices,
  parseChoicesColumn,
  normalizeRubric,
  rubricPointsTotal,
  emptyRubricTemplate,
  redistributeRubricToTotal,
  splitTotalPoints,
  rubricCategoryList,
  rubricFromActivityDraft,
  quizItemsFromDraft,
  activityFromDraft,
  activityPromptFromDraft,
  saveDraftPartsToBank,
  formatBankRow,
  bankItemTypeLabel,
  groupItemsByType,
  groupItemsByCategory,
  migrateOrphanBankItems,
  isActivityType,
  canonicalItemType,
  isAllowedItemType,
  storesChoiceList,
  normalizeTrueFalseAnswer,
  ITEM_TYPES,
  TYPE_ORDER,
  DEFAULT_RUBRIC_LEVEL_LABELS
};
