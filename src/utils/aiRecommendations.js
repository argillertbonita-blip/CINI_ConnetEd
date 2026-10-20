const fs = require('fs');
const path = require('path');
const db = require('../../db');

let schemaPromise = null;

async function ensureAiRecommendationsSchema(conn = db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ai_recommendations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lesson_plan_id INT NOT NULL,
        teacher_id INT NOT NULL,
        subject_id INT NULL,
        grade_level INT NOT NULL,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        provider VARCHAR(32) NOT NULL DEFAULT 'mock',
        source_excerpt TEXT NULL,
        content JSON NOT NULL,
        assessment_id INT NULL,
        approved_type VARCHAR(20) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_ai_rec_teacher (teacher_id, status),
        KEY idx_ai_rec_lesson (lesson_plan_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  })().catch((e) => {
    schemaPromise = null;
    throw e;
  });
  return schemaPromise;
}

function isAiDryRun() {
  const v = String(process.env.AI_DRY_RUN || '').toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  return !isAiConfigured();
}

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getGroqApiKey() {
  return String(process.env.GROQ_API_KEY || '').trim();
}

function isAiConfigured() {
  return !!getGroqApiKey();
}

function getGroqModel() {
  return String(process.env.GROQ_MODEL || 'openai/gpt-oss-120b').trim() || 'openai/gpt-oss-120b';
}

function chatErrorMessage(data, status) {
  const err = Array.isArray(data) ? data[0]?.error : data?.error;
  return err?.message || `AI HTTP ${status}`;
}

function getAiProviderMode() {
  if (isAiDryRun() || !isAiConfigured()) return 'mock';
  return 'groq';
}

function getActiveAiModel() {
  return getAiProviderMode() === 'groq' ? getGroqModel() : null;
}

async function callGroqChat({ system, user }) {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');
  const model = getGroqModel();

  const payload = JSON.stringify({
    model,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    max_tokens: 8192,
    ...(/gpt-oss/i.test(model) ? { reasoning_effort: 'low' } : {}),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });

  let res;
  let data = {};
  for (let attempt = 0; attempt < 3; attempt += 1) {
    res = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: payload
    });
    data = await res.json().catch(() => ({}));
    if (res.ok || (res.status !== 503 && res.status !== 429)) break;
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }

  if (!res.ok) {
    throw new Error(chatErrorMessage(data, res.status));
  }

  let text = data?.choices?.[0]?.message?.content || '{}';
  const fence = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('AI returned invalid JSON');
  }
}

function publicFileToDisk(filePath) {
  if (!filePath) return null;
  const rel = String(filePath).replace(/^\//, '');
  return path.join(__dirname, '../../public', rel);
}

async function extractTextFromFile(filePath) {
  const disk = publicFileToDisk(filePath);
  if (!disk || !fs.existsSync(disk)) return '';

  const ext = path.extname(disk).toLowerCase();
  try {
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(fs.readFileSync(disk), {
        pagerender: async (pageData) => {
          const textContent = await pageData.getTextContent({
            normalizeWhitespace: false,
            disableCombineTextItems: false
          });
          let lastY;
          let text = '';
          for (const item of textContent.items || []) {
            if (lastY == item.transform?.[5] || lastY == null) text += item.str;
            else text += `\n${item.str}`;
            lastY = item.transform?.[5];
          }
          const pageNum = Number(pageData.pageNumber || (Number(pageData.pageIndex) + 1) || 1);
          return `\nPage ${pageNum}\n${text}\n`;
        }
      });
      return String(data?.text || '').trim();
    }
    if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: disk });
      return String(result?.value || '').trim();
    }
    if (ext === '.doc') {
      // Legacy .doc is binary; skip binary noise
      return '';
    }
  } catch (e) {
    console.warn('[ai] file extract failed:', e.message);
  }
  return '';
}

function focusPageNumbers(focus) {
  const pages = [];
  const re = /\bpages?\s+(\d+)(?:\s*[-–]\s*(\d+))?/gi;
  let match;
  while ((match = re.exec(String(focus || '')))) {
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    const lo = Math.min(start, end);
    const hi = Math.min(Math.max(start, end), lo + 20);
    for (let n = lo; n <= hi; n += 1) pages.push(n);
  }
  return [...new Set(pages)];
}

function excerptForFocus(fileText, teacherFocus, maxChars = 6000) {
  const raw = String(fileText || '').trim();
  if (!raw) return '';
  const wanted = focusPageNumbers(teacherFocus);
  const pageRe = /Page (\d+)\n([\s\S]*?)(?=\nPage \d+\n|$)/g;
  const byPage = new Map();
  let match;
  while ((match = pageRe.exec(raw))) byPage.set(Number(match[1]), match[2].trim());
  let body = raw;
  if (wanted.length && byPage.size) {
    const chosen = wanted
      .filter((n) => byPage.has(n))
      .map((n) => `Page ${n}\n${byPage.get(n)}`);
    if (chosen.length) body = chosen.join('\n\n');
  }
  return body.replace(/[ \t]+/g, ' ').trim().slice(0, maxChars);
}

function buildSourceText({ title, objectives, fileText, teacherFocus = '' }) {
  const parts = [];
  if (title) parts.push(`Lesson title: ${title}`);
  if (objectives) parts.push(`Learning objectives:\n${objectives}`);
  const clipped = excerptForFocus(fileText, teacherFocus);
  if (clipped) parts.push(`Lesson plan excerpt:\n${clipped}`);
  return parts.join('\n\n').trim();
}

function teacherFocusInstruction(teacherFocus) {
  const text = String(teacherFocus || '').trim().slice(0, 500);
  if (!text) return '';
  return `\nTeacher focus: Use this part of the lesson when it appears in the source: ${text}\nStay inside the source. Do not invent a topic that is not in the lesson. Keep the requested item types and counts.`;
}

function defaultQuizItemCount(_gradeLevel) {
  return 10;
}

const QUIZ_DRAFT_TYPE_ORDER = [
  'mcq',
  'true_false',
  'fill_blank',
  'matching',
  'sequencing',
  'identification',
  'enumeration',
  'short_answer'
];

const QUIZ_TYPE_SPECS = {
  mcq: {
    label: 'multiple choice',
    schema: '{ type: "mcq", question, choices: [exactly 4 short strings], answer (must match one choice), points }',
    rule: 'Multiple choice: one correct answer taken from the lesson; three plausible wrong choices.'
  },
  true_false: {
    label: 'true or false',
    schema: '{ type: "true_false", question, choices: ["True","False"], answer: "True" or "False", points }',
    rule: 'True or False: one statement that is clearly true or false in the lesson material.'
  },
  fill_blank: {
    label: 'fill in the blank',
    schema: '{ type: "fill_blank", question (use _____ for each blank), choices: [word bank: correct words plus distractors, at least 2], answer (correct word or words in blank order, comma-separated), points }',
    rule: 'Fill in the blank: the missing word or words must come from the lesson. Keep each bank word short.'
  },
  matching: {
    label: 'matching',
    schema: '{ type: "matching", question, choices: [3 to 5 strings "left | right"], answer (same pairs joined by "; "), points }',
    rule: 'Matching: 3 to 5 short pairs from the lesson. Each side is a few words. Put the correct pair in choices as "left | right". Every right side must be a different word or phrase.'
  },
  sequencing: {
    label: 'sequencing',
    schema: '{ type: "sequencing", question, choices: [3 to 5 short steps in the correct order], answer (those steps joined by " | "), points }',
    rule: 'Sequencing: 3 to 5 short steps from the lesson, already in the correct order.'
  },
  identification: {
    label: 'identification',
    schema: '{ type: "identification", question, choices: [1 or 2 extra words that are not a correct answer], answer (one short word or phrase, different from every other identification answer), points }',
    rule: 'Identification: one short factual answer from the lesson. Each identification answer in the quiz must be different. choices are one or two extra words for a shared answer box; do not repeat any correct answer there.'
  },
  enumeration: {
    label: 'enumeration',
    schema: '{ type: "enumeration", question, answer (brief expected list tip for the teacher), points }',
    rule: 'Enumeration: ask for a short list (2–4 items) from the lesson; put a scoring tip in answer.'
  },
  short_answer: {
    label: 'short answer',
    schema: '{ type: "short_answer", question, answer (model answer for the teacher, a few sentences), points }',
    rule: 'Short answer: a question the student writes in a few sentences. answer is a model answer, not a single word.'
  }
};

/** Allowed quiz item types for AI drafts. */
function normalizeQuizItemTypes(raw) {
  const list = Array.isArray(raw)
    ? [...new Set(raw.map((t) => canonicalQuizItemType(t)).filter((t) => QUIZ_DRAFT_TYPE_ORDER.includes(t)))]
    : [];
  const picked = list.length ? list : ['mcq', 'identification', 'enumeration'];
  return QUIZ_DRAFT_TYPE_ORDER.filter((t) => picked.includes(t));
}

/**
 * Split total quiz items across selected types.
 * @param {number} gradeLevel
 * @param {number|null} totalItems
 * @param {string[]|null} quizItemTypes e.g. ['mcq','identification']
 */
function resolveQuizItemMix(gradeLevel, totalItems, quizItemTypes = null, quizItemCounts = null, maxTotal = 30) {
  const grade = Number(gradeLevel) || 1;
  const cap = maxTotal === 50 ? 50 : 30;
  const types = normalizeQuizItemTypes(quizItemTypes);
  const counts = {};
  QUIZ_DRAFT_TYPE_ORDER.forEach((t) => { counts[t] = 0; });

  const raw = quizItemCounts && typeof quizItemCounts === 'object' ? quizItemCounts : null;
  const hasCounts = raw && types.some((t) => Number(raw[t]) > 0);
  if (hasCounts) {
    types.forEach((t) => {
      let n = Number(raw[t]);
      if (!Number.isFinite(n) || n < 1) n = 0;
      else n = Math.min(20, Math.round(n));
      counts[t] = n;
    });
    let total = types.reduce((sum, t) => sum + counts[t], 0);
    if (total > cap) {
      let over = total - cap;
      for (let i = types.length - 1; i >= 0 && over > 0; i -= 1) {
        const cut = Math.min(counts[types[i]], over);
        counts[types[i]] -= cut;
        over -= cut;
      }
      total = cap;
    }
    const used = types.filter((t) => counts[t] > 0);
    return {
      total,
      counts,
      mcqCount: counts.mcq,
      idCount: counts.identification,
      enumCount: counts.enumeration,
      types: used
    };
  }

  let total = Number(totalItems);
  if (!Number.isFinite(total) || total < 5) total = defaultQuizItemCount(grade);
  total = Math.min(50, Math.max(5, Math.round(total)));

  if (types.length === 1) {
    counts[types[0]] = total;
  } else {
    const base = Math.floor(total / types.length);
    let rem = total - base * types.length;
    for (const t of types) {
      counts[t] = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
    }
  }

  return {
    total,
    counts,
    mcqCount: counts.mcq,
    idCount: counts.identification,
    enumCount: counts.enumeration,
    types: types.filter((t) => counts[t] > 0)
  };
}

function mockGenerate({ title, gradeLevel, subjectName, sourceText, quizItemCount, quizItemTypes, quizItemCounts, quizItemMax = 30, draftKind, teacherFocus = '' }) {
  const topic = title || 'this lesson';
  const subject = subjectName || 'the subject';
  const grade = Number(gradeLevel) || 1;
  const mix = resolveQuizItemMix(grade, quizItemCount, quizItemTypes, quizItemCounts, quizItemMax);
  const { counts, total: quizMax } = mix;
  const items = [];

  for (let i = 1; i <= counts.mcq; i++) {
    items.push({
      type: 'mcq',
      question: i === 1
        ? `What is the main idea of "${topic}" for Grade ${grade} ${subject}?`
        : `Which statement best shows understanding of ${topic}?`,
      choices: [
        'A key concept from the lesson',
        'An unrelated topic',
        'A homework rule',
        'A recess activity'
      ],
      answer: 'A key concept from the lesson',
      points: 1
    });
  }
  for (let i = 1; i <= counts.true_false; i++) {
    items.push({
      type: 'true_false',
      question: `"${topic}" is a Grade ${grade} ${subject} lesson.`,
      choices: ['True', 'False'],
      answer: 'True',
      points: 1
    });
  }
  for (let i = 1; i <= counts.fill_blank; i++) {
    items.push({
      type: 'fill_blank',
      question: `The lesson "${topic}" is for Grade _____.`,
      choices: [String(grade), 'recess', 'homework'],
      answer: String(grade),
      points: 1
    });
  }
  for (let i = 1; i <= counts.matching; i++) {
    const pairs = [
      `${topic} | main lesson idea`,
      `${subject} | subject`,
      `Grade ${grade} | grade level`
    ];
    items.push({
      type: 'matching',
      question: `Match each term from "${topic}" with its meaning.`,
      choices: pairs,
      answer: pairs.join('; '),
      points: 1
    });
  }
  for (let i = 1; i <= counts.sequencing; i++) {
    const steps = ['Read the lesson idea', 'Try one example', 'Share with a partner'];
    items.push({
      type: 'sequencing',
      question: `Put these steps for "${topic}" in order.`,
      choices: steps,
      answer: steps.join(' | '),
      points: 1
    });
  }
  for (let i = 1; i <= counts.identification; i++) {
    items.push({
      type: 'identification',
      question: `Identify term ${i} from the lesson "${topic}".`,
      choices: [`extra word ${i}`],
      answer: `Term ${i} from ${topic}`,
      points: 1
    });
  }
  for (let i = 1; i <= counts.enumeration; i++) {
    items.push({
      type: 'enumeration',
      question: `List 2–3 things you learned about "${topic}".`,
      choices: null,
      answer: 'Possible answers: concepts or steps from the lesson objectives',
      points: 2
    });
  }
  for (let i = 1; i <= counts.short_answer; i++) {
    items.push({
      type: 'short_answer',
      question: `In a few sentences, explain what you learned about "${topic}".`,
      choices: null,
      answer: `A strong answer names the main idea of ${topic} and one example from the lesson.`,
      points: 2
    });
  }

  const content = {
    quiz: {
      title: `Quiz: ${topic}`,
      max_score: quizMax,
      items,
      notes:
        `Mock draft (${quizMax} items). Save to Classwork, then pick items for Progress.`
    },
    activity: {
      title: `Activity: Explore ${topic}`,
      max_score: grade <= 2 ? 10 : 20,
      description:
        `Students work in pairs on a short Grade ${grade} task about "${topic}" (${subject}). ` +
        `They write or draw examples, share with a partner, then present one idea.`,
      notes: sourceText
        ? `Generated from lesson title/objectives (and file text if available).${teacherFocus ? ` Focus: ${String(teacherFocus).trim().slice(0, 500)}` : ''}`
        : `Generated from lesson title/objectives only.${teacherFocus ? ` Focus: ${String(teacherFocus).trim().slice(0, 500)}` : ''}`,
      rubric: {
        categories: [
          {
            name: 'Participation',
            max_points: grade <= 2 ? 4 : 7,
            levels: [
              { label: 'Excellent', points: grade <= 2 ? 4 : 7, description: 'Fully engaged; helps partner; stays on task.' },
              { label: 'Good', points: grade <= 2 ? 3 : 5, description: 'Mostly engaged with little prompting.' },
              { label: 'Fair', points: grade <= 2 ? 2 : 3, description: 'Needs reminders to stay on task.' },
              { label: 'Needs Improvement', points: 1, description: 'Rarely participates or off-task.' }
            ]
          },
          {
            name: 'Correctness',
            max_points: grade <= 2 ? 3 : 7,
            levels: [
              { label: 'Excellent', points: grade <= 2 ? 3 : 7, description: 'Ideas clearly match the lesson.' },
              { label: 'Good', points: grade <= 2 ? 2 : 5, description: 'Mostly accurate with small gaps.' },
              { label: 'Fair', points: grade <= 2 ? 2 : 3, description: 'Partial understanding shown.' },
              { label: 'Needs Improvement', points: 1, description: 'Little connection to the lesson.' }
            ]
          },
          {
            name: 'Effort',
            max_points: grade <= 2 ? 3 : 6,
            levels: [
              { label: 'Excellent', points: grade <= 2 ? 3 : 6, description: 'Complete, neat, thoughtful work.' },
              { label: 'Good', points: grade <= 2 ? 2 : 4, description: 'Complete with adequate care.' },
              { label: 'Fair', points: grade <= 2 ? 2 : 3, description: 'Incomplete or rushed.' },
              { label: 'Needs Improvement', points: 1, description: 'Minimal effort.' }
            ]
          }
        ]
      }
    },
    exam: null
  };
  if (draftKind === 'activity') content.quiz = null;
  else if (draftKind !== 'both') content.activity = null;
  return content;
}

function safeParseJsonContent(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function canonicalQuizItemType(raw) {
  const t = String(raw || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (['mcq', 'multiple_choice', 'multiplechoice', 'choice'].includes(t)) return 'mcq';
  if (['true_false', 'true_or_false', 'tf', 'truefalse'].includes(t)) return 'true_false';
  if (['fill_blank', 'fill_in_the_blank', 'fill_in_blank', 'cloze', 'word_bank'].includes(t)) return 'fill_blank';
  if (['matching', 'match', 'matching_type'].includes(t)) return 'matching';
  if (['sequencing', 'sequence', 'ordering', 'order'].includes(t)) return 'sequencing';
  if (['identification', 'identify', 'id'].includes(t)) return 'identification';
  if (['enumeration', 'enumerate', 'enum'].includes(t)) return 'enumeration';
  if (['short_answer', 'shortanswer', 'essay', 'essay_question'].includes(t)) return 'short_answer';
  return '';
}

function uniqueMatchingPairs(choices) {
  const seen = new Set();
  const out = [];
  for (const raw of choices || []) {
    const text = String(raw || '').trim();
    if (!text.includes('|')) continue;
    const bits = text.split('|');
    const left = (bits[0] || '').trim();
    const right = bits.slice(1).join('|').trim();
    if (!left || !right) continue;
    const key = right.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`${left} | ${right}`);
    if (out.length >= 5) break;
  }
  return out;
}

function sanitizeGeneratedItem(item, type) {
  let question = String(item.question || '').trim();
  if (!question) return null;
  let choices = Array.isArray(item.choices)
    ? item.choices.map((c) => String(c || '').trim()).filter(Boolean)
    : [];
  let answer = item.answer != null ? String(item.answer).trim() : '';
  const points = Math.max(0.5, Number(item.points) || (type === 'enumeration' || type === 'short_answer' ? 2 : 1));

  if (type === 'true_false') {
    choices = ['True', 'False'];
    const a = answer.toLowerCase();
    answer = (a === 'false' || a === 'f' || a === 'no') ? 'False' : 'True';
  } else if (type === 'fill_blank') {
    if (!/_{3,}/.test(question)) question = `${question} _____`;
    if (choices.length < 2 || !answer) return null;
  } else if (type === 'matching') {
    choices = uniqueMatchingPairs(choices);
    if (choices.length < 3) return null;
    answer = choices.join('; ');
  } else if (type === 'sequencing') {
    choices = choices.slice(0, 5);
    if (choices.length < 3) return null;
    answer = choices.join(' | ');
  } else if (type === 'mcq') {
    if (choices.length < 2 || !answer) return null;
  } else if (type === 'identification') {
    if (!answer) return null;
    const key = answer.toLowerCase();
    choices = choices.filter((c) => c.toLowerCase() !== key).slice(0, 2);
  } else if (!answer) {
    return null;
  } else {
    choices = [];
  }

  return {
    type,
    question,
    choices: choices.length ? choices : null,
    answer: answer.slice(0, 500),
    points
  };
}

function sortQuizItems(items) {
  const rank = (type) => {
    const i = QUIZ_DRAFT_TYPE_ORDER.indexOf(type);
    return i < 0 ? 99 : i;
  };
  return (items || []).slice().sort((a, b) => rank(a.type) - rank(b.type));
}

/** Keep only ticked types, and no more of each type than was requested. */
function restrictQuizItems(items, mix) {
  const limits = mix.counts || {};
  const kept = {};
  const seenId = new Set();
  const out = [];
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    const type = canonicalQuizItemType(item.type || item.item_type);
    if (!type || !limits[type] || (kept[type] || 0) >= limits[type]) continue;
    const clean = sanitizeGeneratedItem(item, type);
    if (!clean) continue;
    if (type === 'identification') {
      const key = String(clean.answer || '').trim().toLowerCase();
      if (!key || seenId.has(key)) continue;
      seenId.add(key);
    }
    kept[type] = (kept[type] || 0) + 1;
    out.push(clean);
  }
  for (const item of out) {
    if (item.type !== 'identification' || !Array.isArray(item.choices)) continue;
    const extras = item.choices.filter((c) => !seenId.has(String(c).trim().toLowerCase()));
    item.choices = extras.length ? extras : null;
  }
  return sortQuizItems(out);
}

function normalizeGeneratedContent(parsed, fallbackMeta) {
  const kind = fallbackMeta?.draftKind === 'activity' ? 'activity' : 'quiz';
  const base = mockGenerate({ ...fallbackMeta, draftKind: 'both' });
  if (kind === 'activity') {
    return {
      quiz: null,
      activity: {
        ...(base.activity || {}),
        ...((parsed && parsed.activity) || {})
      },
      exam: null
    };
  }
  const mix = resolveQuizItemMix(
    fallbackMeta?.gradeLevel,
    fallbackMeta?.quizItemCount,
    fallbackMeta?.quizItemTypes,
    fallbackMeta?.quizItemCounts,
    fallbackMeta?.quizItemMax
  );
  if (!parsed || typeof parsed !== 'object') {
    return { quiz: base.quiz, activity: null, exam: null };
  }

  const restricted = restrictQuizItems(parsed.quiz?.items, mix);
  const items = sortQuizItems(restricted.length ? restricted : base.quiz.items);

  return {
    quiz: {
      ...base.quiz,
      ...(parsed.quiz || {}),
      items
    },
    activity: null,
    exam: null
  };
}

async function callOpenAiGenerate({ title, gradeLevel, subjectName, sourceText, quizItemCount, quizItemTypes, quizItemCounts, quizItemMax = 30, draftKind = 'quiz', teacherFocus = '' }) {
  if (!isAiConfigured()) throw new Error('GROQ_API_KEY is not set');

  const kind = draftKind === 'activity' ? 'activity' : 'quiz';
  const grade = Number(gradeLevel) || 1;
  const fallback = {
    title,
    gradeLevel,
    subjectName,
    sourceText,
    quizItemCount,
    quizItemTypes,
    quizItemCounts,
    quizItemMax,
    draftKind: kind,
    teacherFocus
  };

  if (kind === 'activity') {
    const system = `You are an education assistant for a Philippine Montessori elementary school (Grades 1–6).
Generate one age-appropriate classroom ACTIVITY from ONE lesson plan only.
Do NOT generate a quiz or an exam.

Return ONLY valid JSON:
{
  "activity": {
    title,
    max_score (number),
    description (classroom-friendly steps a teacher can run),
    notes (short tip),
    rubric: {
      categories: [
        {
          name,
          max_points (number),
          levels: [
            { label: "Excellent", points, description },
            { label: "Good", points, description },
            { label: "Fair", points, description },
            { label: "Needs Improvement", points, description }
          ]
        }
      ]
    }
  }
}

Rules:
- Grade ${grade}: use vocabulary and sentence length suitable for that grade.
- Use 3 rubric categories. The sum of max_points must equal max_score.
- Activity: short (10–25 min), concrete, Montessori-friendly (hands-on or collaborative when possible).
- Use facts and steps from the source material. Do not invent a different topic.
- No student names, LRNs, or private data.`;
    const user = `Grade: ${gradeLevel}
Subject: ${subjectName || 'General'}
Lesson: ${title}

Source material (no student PII):
${sourceText || '(title/objectives only)'}${teacherFocusInstruction(teacherFocus)}`;
    const parsed = await callGroqChat({ system, user });
    return normalizeGeneratedContent(parsed, fallback);
  }

  const mix = resolveQuizItemMix(grade, quizItemCount, quizItemTypes, quizItemCounts, quizItemMax);
  const typeParts = [];
  const itemSchemas = [];
  const typeRules = [];
  const omitted = [];
  QUIZ_DRAFT_TYPE_ORDER.forEach((type) => {
    const spec = QUIZ_TYPE_SPECS[type];
    const n = mix.counts[type] || 0;
    if (n > 0) {
      typeParts.push(`${n} ${spec.label}`);
      itemSchemas.push(spec.schema);
      typeRules.push(spec.rule);
    } else {
      omitted.push(spec.label);
    }
  });
  const mixLine = typeParts.join(', ');
  const omitLine = omitted.length
    ? `Do NOT include these item types: ${omitted.join(', ')}.`
    : '';

  const system = `You are an education assistant for a Philippine Montessori elementary school (Grades 1–6).
Generate an age-appropriate QUIZ from ONE lesson plan only.
Do NOT generate an activity or a full exam.

Return ONLY valid JSON with key: quiz.
- quiz: {
    title,
    max_score (number),
    items: [
      ${itemSchemas.join('\n      ')}
    ],
    notes (short teacher tip)
  }

Rules by grade level:
- Grade ${grade}: use vocabulary and sentence length suitable for that grade.
- Quiz MUST have exactly ${mix.total} items total: ${mixLine} — drawn from the uploaded lesson material below.
- Every quiz item type must be one of: ${mix.types.join(', ')}. ${omitLine}
- ${typeRules.join('\n- ')}
- Use facts, terms, and steps that appear in the source material. Do not invent a different topic.
- List items grouped in this order: ${QUIZ_DRAFT_TYPE_ORDER.filter((t) => (mix.counts[t] || 0) > 0).join(', ')}.
- No student names, LRNs, or private data.
- Language clear for elementary teachers and learners.
- Content must fit THIS single lesson only.`;

  const user = `Grade: ${gradeLevel}
Subject: ${subjectName || 'General'}
Lesson: ${title}
Quiz item count required: ${mix.total}

Source material (no student PII):
${sourceText || '(title/objectives only)'}${teacherFocusInstruction(teacherFocus)}`;

  const parsed = await callGroqChat({ system, user });

  return normalizeGeneratedContent(parsed, {
    ...fallback,
    quizItemCount: mix.total,
    quizItemTypes: mix.types
  });
}

async function generateActivityRubric({
  description,
  totalPoints = 20,
  gradeLevel = 1,
  subjectName = null
}) {
  const { normalizeRubric, redistributeRubricToTotal, emptyRubricTemplate } = require('./questionBank');
  const desc = String(description || '').trim();
  const total = Math.max(3, Math.round(Number(totalPoints) || 20));
  const grade = Number(gradeLevel) || 1;

  if (!desc) {
    throw new Error('Enter an activity description before generating a rubric.');
  }

  const applyTotal = (rubric) => {
    const normalized = normalizeRubric(rubric, total) || emptyRubricTemplate(total);
    return redistributeRubricToTotal(normalized, total) || emptyRubricTemplate(total);
  };

  if (isAiDryRun() || !isAiConfigured()) {
    const tip = desc.slice(0, 120);
    const base = emptyRubricTemplate(total);
    base.categories[0].levels[0].description = `Fully engaged in: ${tip}${desc.length > 120 ? '…' : ''}`;
    base.categories[1].levels[0].description = 'Work clearly matches the activity goals.';
    base.categories[2].levels[0].description = 'Complete, careful effort throughout.';
    base.categories.forEach((c) => {
      c.levels[1].description = c.levels[1].description || 'Mostly meets expectations with small gaps.';
      c.levels[2].description = c.levels[2].description || 'Partial; needs support or reminders.';
      c.levels[3].description = c.levels[3].description || 'Minimal evidence for this category.';
    });
    return { provider: 'mock', rubric: applyTotal(base) };
  }

  if (!isAiConfigured()) throw new Error('GROQ_API_KEY is not set');

  const system = `You write short grading rubrics for Philippine Montessori elementary (Grades 1–6).
Return ONLY valid JSON:
{ "categories": [ { "name", "max_points", "levels": [
  { "label": "Excellent", "points", "description" },
  { "label": "Good", "points", "description" },
  { "label": "Fair", "points", "description" },
  { "label": "Needs Improvement", "points", "description" }
] } ] }
Use 3 categories. Sum of max_points MUST equal ${total}.
Descriptions must be short, grade ${grade} appropriate, and based on the activity.`;

  const user = `Total points: ${total}
Grade: ${grade}
Subject: ${subjectName || 'General'}
Activity description:
${desc.slice(0, 2500)}`;

  const parsed = await callGroqChat({ system, user });
  return {
    provider: getAiProviderMode(),
    rubric: applyTotal(parsed)
  };
}

async function generateRecommendationsForLesson({
  lessonPlan,
  subjectName = null,
  quizItemCount = null,
  quizItemTypes = null,
  quizItemCounts = null,
  draftKind = 'quiz',
  teacherFocus = '',
  onProgress = null
}) {
  const fileText = await extractTextFromFile(lessonPlan.file_path);
  const sourceText = buildSourceText({
    title: lessonPlan.title,
    objectives: lessonPlan.objectives,
    fileText,
    teacherFocus
  });

  if (!sourceText) {
    throw Object.assign(new Error('Lesson plan needs a title, objectives, or readable file'), {
      status: 400
    });
  }

  const meta = {
    title: lessonPlan.title,
    gradeLevel: lessonPlan.grade_level,
    subjectName,
    sourceText,
    quizItemCount,
    quizItemTypes,
    quizItemCounts,
    draftKind,
    teacherFocus
  };

  let provider = 'mock';
  let content;

  if (typeof onProgress === 'function') {
    onProgress({ step: 2, total: 3, label: 'Writing the quiz and activity' });
  }

  if (!isAiDryRun() && isAiConfigured()) {
    content = await callOpenAiGenerate(meta);
    provider = getAiProviderMode();
  } else {
    content = mockGenerate(meta);
    provider = 'mock';
  }

  return {
    provider,
    sourceExcerpt: sourceText.slice(0, 2000),
    content
  };
}

function buildCombinedSourceText(lessons, maxChars = 12000, teacherFocus = '') {
  const list = (lessons || []).filter(Boolean);
  if (!list.length) return '';
  const per = Math.max(500, Math.floor(maxChars / list.length));
  const blocks = [];
  for (const lesson of list) {
    let block = buildSourceText({
      title: lesson.title,
      objectives: lesson.objectives,
      fileText: lesson.fileText,
      teacherFocus
    });
    if (block.length > per) block = block.slice(0, per).trim();
    if (block) blocks.push(block);
  }
  return blocks.join('\n\n---\n\n').slice(0, maxChars).trim();
}

async function generateRecommendationsForLessons({
  lessons,
  subjectName = null,
  quizItemCount = null,
  quizItemTypes = null,
  quizItemCounts = null,
  quizItemMax = 30,
  draftKind = 'quiz',
  teacherFocus = '',
  onProgress = null
}) {
  const prepared = [];
  for (const lesson of lessons || []) {
    prepared.push({
      title: lesson.title,
      objectives: lesson.objectives,
      fileText: await extractTextFromFile(lesson.file_path),
      grade_level: lesson.grade_level
    });
  }
  const sourceText = buildCombinedSourceText(prepared, 12000, teacherFocus);
  if (!sourceText) {
    throw Object.assign(new Error('Add a lesson with a title, objectives, or readable file'), {
      status: 400
    });
  }
  const titles = prepared.map((lesson) => String(lesson.title || '').trim()).filter(Boolean);
  const title = titles.length > 1
    ? `Exam — ${titles.join(', ')}`.slice(0, 240)
    : (titles[0] || 'Exam');
  const meta = {
    title,
    gradeLevel: prepared[0]?.grade_level,
    subjectName,
    sourceText,
    quizItemCount,
    quizItemTypes,
    quizItemCounts,
    quizItemMax,
    draftKind,
    teacherFocus
  };

  let provider = 'mock';
  let content;
  if (typeof onProgress === 'function') {
    onProgress({ step: 2, total: 3, label: 'Writing the exam' });
  }
  if (!isAiDryRun() && isAiConfigured()) {
    content = await callOpenAiGenerate(meta);
    provider = getAiProviderMode();
  } else {
    content = mockGenerate(meta);
    provider = 'mock';
  }
  return {
    provider,
    sourceExcerpt: sourceText.slice(0, 2000),
    content,
    title
  };
}

function pickDraftPart(content, type) {
  const c = safeParseJsonContent(content) || {};
  if (type === 'quiz') return c.quiz || null;
  if (type === 'activity') return c.activity || null;
  if (type === 'exam') return c.exam || null;
  return null;
}

module.exports = {
  ensureAiRecommendationsSchema,
  isAiDryRun,
  isAiConfigured,
  getAiProviderMode,
  getActiveAiModel,
  generateRecommendationsForLesson,
  generateRecommendationsForLessons,
  generateActivityRubric,
  safeParseJsonContent,
  pickDraftPart,
  extractTextFromFile,
  buildSourceText,
  callGroqChat
};
