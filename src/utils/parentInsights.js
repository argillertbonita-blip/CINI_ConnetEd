const crypto = require('crypto');
const { scoreSubmission, isActivityItemType, ensureQuizShareSchema } = require('./quizShare');
const { parseChoicesColumn, bankItemTypeLabel, canonicalItemType, normalizeRubric } = require('./questionBank');
const { lessonName } = require('./lessonParts');
const {
  extractTextFromFile,
  callGroqChat,
  isAiDryRun,
  isAiConfigured
} = require('./aiRecommendations');

function itemKind(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'activity') return 'activity';
  if (t === 'exam') return 'exam';
  return 'quiz';
}

function plural(n, one, many) {
  return Number(n) === 1 ? one : many;
}

function joinList(items) {
  const arr = (items || []).filter(Boolean);
  if (arr.length <= 1) return arr[0] || '';
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
}

function typePhrase(types) {
  const bits = [];
  if (types.quiz) bits.push(`${types.quiz} ${plural(types.quiz, 'quiz', 'quizzes')}`);
  if (types.activity) bits.push(`${types.activity} ${plural(types.activity, 'activity', 'activities')}`);
  if (types.exam) bits.push(`${types.exam} ${plural(types.exam, 'exam', 'exams')}`);
  return joinList(bits);
}

const PASSING = 75;
const STRONG = 85;

function groupBySubject(records) {
  const map = new Map();
  for (const r of records) {
    const key = String(r.subject_name || '').trim() || 'Classwork';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      percent: Number(r.percent) || 0,
      type: itemKind(r.type)
    });
  }
  return [...map.entries()].map(([name, items]) => {
    const avg = Math.round(items.reduce((a, b) => a + b.percent, 0) / items.length);
    const types = { quiz: 0, activity: 0, exam: 0 };
    for (const it of items) types[it.type] += 1;
    return { name, count: items.length, avg, types };
  }).sort((a, b) => a.avg - b.avg);
}

function labeledSubjects(rows) {
  return rows.map((s) => `${s.name} (${s.avg}%)`);
}

function describeSessionMarks(morning, afternoon, singular, pluralWord) {
  const m = Number(morning) || 0;
  const a = Number(afternoon) || 0;
  const parts = [];
  if (m) parts.push(`${m} morning`);
  if (a) parts.push(`${a} afternoon`);
  if (!parts.length) return '';
  const n = m + a;
  return `${joinList(parts)} ${n === 1 ? singular : pluralWord}`;
}

/**
 * Template NLG from attendance + Records grouped by subject. No LLM call.
 */
function typePartPhrase(label, ends) {
  if (!ends?.strong_part) return '';
  const strong = ends.strong_part;
  if (!ends.weak_part) {
    return `In the ${label}, ${strong.name} is ${strong.avg_percent}%.`;
  }
  const weak = ends.weak_part;
  return `In the ${label}, ${strong.name} is the strongest part (${strong.avg_percent}%) and ${weak.name} is the weakest part (${weak.avg_percent}%).`;
}

function partPhrase(lesson) {
  const bits = [
    typePartPhrase('quiz', lesson.quiz_parts),
    typePartPhrase('activity', lesson.activity_parts)
  ].filter(Boolean);
  return bits.length ? ` ${bits.join(' ')}` : '';
}

function goingWell(topics) {
  const list = joinList(topics);
  const verb = topics.length === 1 && !/s$/i.test(topics[0]) ? 'is' : 'are';
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${verb} going well`;
}

function subjectParagraph(report, avg) {
  const label = avg == null ? report.subject : `${report.subject} (${avg}%)`;
  const weakTopics = report.weakTopics || [];
  const strongTopics = report.strongTopics || [];
  const sentences = [];
  if (!weakTopics.length && !strongTopics.length) {
    if (!report.weakType && !report.strongType) return '';
    const bits = [];
    if (report.weakType) bits.push(`${String(report.weakType).toLowerCase()} questions are the hardest part`);
    if (report.strongType) bits.push(`${String(report.strongType).toLowerCase()} questions are the strongest part`);
    sentences.push(`In ${label}, ${bits.join(', and ')}.`);
  } else {
    if (weakTopics.length) sentences.push(`${label} needs work on ${joinList(weakTopics)}.`);
    else sentences.push(`${label} is going well on ${joinList(strongTopics)}.`);
    if (report.weakType) sentences.push(`${report.weakType} questions are the hardest part.`);
    if (weakTopics.length && strongTopics.length) {
      const tail = report.strongType
        ? `${goingWell(strongTopics)}, and ${String(report.strongType).toLowerCase()} questions are the strongest part.`
        : `${goingWell(strongTopics)}.`;
      sentences.push(tail);
    } else if (report.strongType) {
      sentences.push(`${report.strongType} questions are the strongest part.`);
    }
  }
  return sentences.join(' ');
}

function buildParentInsight({ firstName, stats, records, average, lessons, topics }) {
  const name = String(firstName || 'Your child').trim() || 'Your child';
  const attDays = Number(stats?.totalDays) || 0;
  const rate = Number(stats?.attendanceRate) || 0;
  const present = Number(stats?.present) || 0;
  const abs = Number(stats?.absent) || 0;
  const late = Number(stats?.late) || 0;
  const totalMarks = present + abs + late;
  const recs = Array.isArray(records) ? records : [];
  const avg = Number(average) || 0;

  if (attDays < 1 && recs.length < 1) {
    return {
      ready: false,
      text: 'Insights will appear here once attendance or scores are recorded.',
      bullets: []
    };
  }

  const bullets = [];
  const subjects = groupBySubject(recs);
  const atRisk = subjects.filter((s) => s.count >= 2 && s.avg < PASSING);
  const strengths = subjects.filter((s) => s.avg >= STRONG);
  const study = subjects.filter((s) => s.avg < STRONG);
  const studyNames = [...new Set(study.map((s) => s.name))];

  if (recs.length) {
    bullets.push(
      `Classwork average across ${recs.length} recorded ${plural(recs.length, 'item', 'items')} is ${avg}%.`
    );
  } else if (attDays > 0) {
    bullets.push('No quiz, activity, or exam scores have been published yet.');
  }

  const lessonRows = Array.isArray(lessons) ? lessons : [];
  const reports = Array.isArray(topics?.subjects) ? topics.subjects : [];
  const coveredSubjects = new Set(
    reports.map((report) => String(report.subject || '').trim().toLowerCase()).filter(Boolean)
  );
  const atRiskLeft = atRisk.filter(
    (s) => !coveredSubjects.has(String(s.name || '').trim().toLowerCase())
  );

  if (atRiskLeft.length === 1) {
    const s = atRiskLeft[0];
    const mix = typePhrase(s.types);
    bullets.push(
      `${s.name} is at risk of failing (average ${s.avg}% across ${mix || `${s.count} ${plural(s.count, 'item', 'items')}`}).`
    );
  } else if (atRiskLeft.length > 1) {
    bullets.push(`${joinList(labeledSubjects(atRiskLeft))} are at risk of failing.`);
  }

  if (reports.length) {
    const avgBySubject = new Map(
      subjects.map((s) => [String(s.name || '').trim().toLowerCase(), s.avg])
    );
    reports.forEach((report) => {
      const key = String(report.subject || '').trim().toLowerCase();
      const paragraph = subjectParagraph(report, avgBySubject.has(key) ? avgBySubject.get(key) : null);
      if (paragraph) bullets.push(paragraph);
    });
  } else {
    const lessonNeeds = lessonRows.filter((l) => Number(l.avg_percent) < PASSING);
    const lessonStrengths = lessonRows.filter((l) => Number(l.avg_percent) >= STRONG);
    lessonNeeds.slice(0, 3).forEach((l) => {
      bullets.push(`${l.lesson} needs work (${l.avg_percent}%).${partPhrase(l)}`);
    });
    lessonStrengths.slice(0, 3).forEach((l) => {
      bullets.push(`${l.lesson} is a strength (${l.avg_percent}%).${partPhrase(l)}`);
    });
  }
  if (!lessonRows.length && studyNames.length) {
    bullets.push(`I recommend ${name} to study more in ${joinList(studyNames)}.`);
    if (study.some((s) => s.count < 2 && !atRisk.includes(s))) {
      bullets.push('Some of those subjects have only 1 recorded item so far.');
    }
  } else if (lessonRows.length && study.some((s) => s.count < 2 && !atRisk.includes(s))) {
    bullets.push('Some subjects have only 1 recorded item so far.');
  }

  const subjectStrengths = strengths.filter(
    (s) => !coveredSubjects.has(String(s.name || '').trim().toLowerCase())
  );
  if (subjectStrengths.length === 1) {
    const s = subjectStrengths[0];
    const soFar = s.count < 2 ? 'So far, ' : '';
    bullets.push(
      `${soFar}${s.name} is a strength (average ${s.avg}%${s.count < 2 ? ' on 1 item' : ''}).`
    );
  } else if (subjectStrengths.length > 1) {
    bullets.push(`${joinList(subjectStrengths.map((s) => s.name))} are strengths.`);
  }

  if (totalMarks > 0 && (abs > 0 || late > 0)) {
    let att = `Over the last 30 days, ${present} of ${totalMarks} sessions were present (${rate}%).`;
    const morning = stats?.bySession?.morning || {};
    const afternoon = stats?.bySession?.afternoon || {};
    const absP = describeSessionMarks(morning.Absent, afternoon.Absent, 'absent mark', 'absent marks');
    const lateP = describeSessionMarks(morning.Late, afternoon.Late, 'late mark', 'late marks');
    const extra = [absP, lateP].filter(Boolean);
    if (extra.length) {
      const n = abs + late;
      att += ` There ${plural(n, 'was', 'were')} ${joinList(extra)}.`;
    }
    bullets.push(att);
  }

  return { ready: true, text: bullets.join(' '), bullets };
}

const TOPIC_ITEM_CAP = 200;
const TOPIC_LESSON_CAP = 12;
const topicCache = new Map();
let aiTopicsPausedUntil = 0;

function trimStem(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function topicCacheKey(studentId, items, activities) {
  const body = [
    ...(items || []).map((item) => `${item.question_id}:${item.correct ? 1 : 0}`),
    ...(activities || []).map((note) => `${note.title}|${note.category}|${note.earned}|${note.max}|${note.level}`)
  ].sort().join('|');
  const hash = crypto.createHash('sha1').update(body).digest('hex');
  return `${studentId}:${hash}`;
}

function normalizeTopicRows(raw, items) {
  const byLesson = new Map();
  for (const item of items) {
    const key = String(item.lesson || '').trim().toLowerCase();
    if (key && !byLesson.has(key)) byLesson.set(key, item.subject || '');
  }
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];
  for (const row of list) {
    const lesson = String(row?.lesson || '').trim().slice(0, 120);
    const topic = String(row?.topic || '').trim().slice(0, 120);
    if (!lesson || !topic) continue;
    const key = `${lesson.toLowerCase()}|${topic.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      lesson,
      topic,
      subject: byLesson.get(lesson.toLowerCase()) || ''
    });
    if (out.length >= 3) break;
  }
  return out;
}

async function loadTopicEvidence(db, studentId) {
  await ensureQuizShareSchema();
  let subs = [];
  try {
    const [rows] = await db.query(
      `SELECT qs.assessment_id, qs.answers, qs.submitted_at, a.lesson_title, a.title,
              a.TYPE as type, a.lesson_plan_id, s.NAME as subject_name
       FROM quiz_submissions qs
       JOIN assessments a ON a.id = qs.assessment_id
       LEFT JOIN subjects s ON a.subject_id = s.id
       WHERE qs.student_id = ? AND LOWER(a.TYPE) IN ('quiz', 'exam')
       ORDER BY qs.submitted_at DESC, qs.id DESC`,
      [studentId]
    );
    subs = rows;
  } catch (err) {
    return { items: [], lessons: [] };
  }
  const ids = [...new Set(subs.map((row) => Number(row.assessment_id)).filter(Boolean))];
  if (!ids.length) return { items: [], lessons: [] };

  let questions = [];
  try {
    const [qrows] = await db.query(
      `SELECT id, assessment_id, item_type, question, choices, answer, points
       FROM assessment_questions
       WHERE assessment_id IN (${ids.map(() => '?').join(',')})
       ORDER BY assessment_id, sort_order, id`,
      ids
    );
    questions = qrows.map((row) => ({
      ...row,
      choices: parseChoicesColumn(row.choices),
      points: Number(row.points) || 1
    }));
  } catch (err) {
    return { items: [], lessons: [] };
  }

  const byAssessment = new Map();
  for (const question of questions) {
    const list = byAssessment.get(Number(question.assessment_id)) || [];
    list.push(question);
    byAssessment.set(Number(question.assessment_id), list);
  }

  const misses = [];
  const hits = [];
  for (const sub of subs) {
    const bank = (byAssessment.get(Number(sub.assessment_id)) || [])
      .filter((q) => !isActivityItemType(q.item_type));
    if (!bank.length) continue;
    const lesson = lessonName(sub.lesson_title, sub.title);
    const subject = String(sub.subject_name || '').trim();
    const kind = itemKind(sub.type) === 'exam' ? 'exam' : 'quiz';
    const { detail } = scoreSubmission(bank, sub.answers);
    const byId = new Map(detail.map((row) => [Number(row.question_id), row]));
    for (const question of bank) {
      const scored = byId.get(Number(question.id));
      if (!scored || (scored.correct !== true && scored.correct !== false)) continue;
      const stem = trimStem(question.question);
      if (!stem) continue;
      const bucket = scored.correct ? hits : misses;
      bucket.push({
        question_id: Number(question.id),
        correct: scored.correct === true,
        lesson,
        subject,
        kind,
        question: stem,
        item_type: canonicalItemType(question.item_type),
        lesson_plan_id: sub.lesson_plan_id ? Number(sub.lesson_plan_id) : null,
        submitted_at: sub.submitted_at
      });
    }
  }

  misses.splice(TOPIC_ITEM_CAP);
  hits.splice(TOPIC_ITEM_CAP);
  const items = misses.concat(hits);
  const lessonIds = [];
  const lessons = [];
  const seenLessons = new Set();
  for (const item of items) {
    const key = item.lesson.toLowerCase();
    if (seenLessons.has(key)) continue;
    seenLessons.add(key);
    if (lessons.length >= TOPIC_LESSON_CAP) continue;
    lessons.push({
      lesson: item.lesson,
      subject: item.subject,
      lesson_plan_id: item.lesson_plan_id,
      excerpt: ''
    });
    if (item.lesson_plan_id) lessonIds.push(item.lesson_plan_id);
  }

  if (lessonIds.length) {
    try {
      const uniqueIds = [...new Set(lessonIds)];
      const [plans] = await db.query(
        `SELECT id, file_path FROM lesson_plans WHERE id IN (${uniqueIds.map(() => '?').join(',')})`,
        uniqueIds
      );
      const files = new Map();
      for (const plan of plans) {
        let text = '';
        try {
          text = String(await extractTextFromFile(plan.file_path) || '').replace(/\s+/g, ' ').trim().slice(0, 4500);
        } catch (err) {
          text = '';
        }
        files.set(Number(plan.id), text);
      }
      for (const lesson of lessons) {
        if (lesson.lesson_plan_id) lesson.excerpt = files.get(lesson.lesson_plan_id) || '';
      }
    } catch (err) {
      // Topics can still be named from the question stems.
    }
  }

  return { items, misses, hits, lessons };
}

const TOPIC_SKIP = new Set([
  'what', 'which', 'where', 'when', 'who', 'whose', 'how', 'this', 'that', 'they',
  'these', 'there', 'those', 'some', 'many', 'others', 'page', 'lesson', 'you'
]);
const TOPIC_IRREGULAR = { leaf: 'leaves', person: 'people', child: 'children' };

function topicPhrase(topic) {
  const word = String(topic || '').trim().toLowerCase();
  if (!word) return '';
  if (word.includes(' ')) return word;
  if (TOPIC_IRREGULAR[word]) return TOPIC_IRREGULAR[word];
  if (/(s|x|z|ch|sh)$/.test(word)) return word;
  return `${word}s`;
}

function catalogFromExcerpt(excerpt) {
  const text = String(excerpt || '');
  const pairs = [];
  const pairRe = /\b([A-Z][a-z]{2,23})-([A-Za-z]{3,24})\b/g;
  let match;
  while ((match = pairRe.exec(text))) {
    pairs.push({ topic: match[1].toLowerCase(), example: match[2].toLowerCase() });
  }
  const topics = new Set(pairs.map((pair) => pair.topic).filter((topic) => !TOPIC_SKIP.has(topic)));
  const listRe = /\(([^)]{3,160})\)/g;
  while ((match = listRe.exec(text))) {
    const parts = match[1].split(',').map((part) => part.trim().toLowerCase());
    const words = parts.filter((part) => /^[a-z]{3,20}$/.test(part));
    if (words.length >= 3) {
      words.filter((word) => !TOPIC_SKIP.has(word)).forEach((word) => topics.add(word));
    }
  }
  const defRe = /\b([A-Z][a-z]{2,20}) are\b/g;
  while ((match = defRe.exec(text))) {
    const word = match[1].toLowerCase();
    if (TOPIC_SKIP.has(word)) continue;
    topics.add(word);
  }
  return { pairs, topics: [...topics] };
}

function topicInText(topic, text) {
  const word = String(topic || '').toLowerCase();
  if (!word) return false;
  const phrase = topicPhrase(word);
  return new RegExp(`\\b${word}s?\\b`, 'i').test(text) || new RegExp(`\\b${phrase}\\b`, 'i').test(text);
}

function topicOfQuestion(question, catalog) {
  const q = String(question || '').toLowerCase();
  for (const pair of catalog.pairs) {
    const example = pair.example.endsWith('s') ? pair.example.slice(0, -1) : pair.example;
    if (example.length >= 4 && !TOPIC_SKIP.has(pair.topic) && new RegExp(`\\b${example}s?\\b`, 'i').test(q)) return pair.topic;
  }
  const found = catalog.topics.filter((topic) => !TOPIC_SKIP.has(topic) && topicInText(topic, q));
  if (!found.length) return '';
  return found.sort((a, b) => b.length - a.length)[0];
}

function subjectNameOf(item) {
  return String(item.subject || item.lesson || 'Classwork').trim() || 'Classwork';
}

function countTopics(items, lessons) {
  const catalogs = new Map(
    (lessons || []).map((lesson) => [
      String(lesson.lesson || '').toLowerCase(),
      catalogFromExcerpt(lesson.excerpt)
    ])
  );
  const counts = new Map();
  for (const item of items || []) {
    const catalog = catalogs.get(String(item.lesson || '').toLowerCase()) || { pairs: [], topics: [] };
    const topic = topicPhrase(topicOfQuestion(item.question, catalog));
    if (!topic) continue;
    if (!counts.has(topic)) counts.set(topic, { topic, misses: 0, hits: 0 });
    const row = counts.get(topic);
    if (item.correct) row.hits += 1;
    else row.misses += 1;
  }
  return counts;
}

function typeEnds(items) {
  const map = new Map();
  for (const item of items || []) {
    const type = canonicalItemType(item.item_type);
    if (type === 'activity' || type === 'short_answer') continue;
    if (!map.has(type)) {
      map.set(type, { type, label: bankItemTypeLabel(type), correct: 0, total: 0 });
    }
    const row = map.get(type);
    row.total += 1;
    if (item.correct) row.correct += 1;
  }
  const eligible = [...map.values()].filter((row) => row.total >= 2).map((row) => ({
    ...row,
    percent: Math.round((row.correct / row.total) * 100)
  }));
  if (eligible.length < 2) return { weakType: '', strongType: '' };
  const weak = [...eligible].sort((a, b) => a.percent - b.percent || b.total - a.total)[0];
  const strong = [...eligible].sort((a, b) => b.percent - a.percent || b.total - a.total)[0];
  if (!weak || !strong || weak.type === strong.type || weak.percent === strong.percent) {
    return { weakType: '', strongType: '' };
  }
  return { weakType: weak.label, strongType: strong.label };
}

function subjectReportsFromEvidence(evidence) {
  const groups = new Map();
  for (const item of evidence.items || []) {
    const subject = subjectNameOf(item);
    const key = subject.toLowerCase();
    if (!groups.has(key)) groups.set(key, { subject, items: [] });
    groups.get(key).items.push(item);
  }
  const reports = [];
  for (const group of groups.values()) {
    const topicMap = countTopics(group.items, evidence.lessons);
    const weakTopics = [...topicMap.values()]
      .filter((row) => row.misses > 0 && row.misses >= row.hits)
      .sort((a, b) => b.misses - a.misses || b.hits - a.hits)
      .map((row) => row.topic);
    const weakSet = new Set(weakTopics);
    const strongTopics = [...topicMap.values()]
      .filter((row) => row.hits > row.misses && !weakSet.has(row.topic))
      .sort((a, b) => b.hits - a.hits || a.misses - b.misses)
      .map((row) => row.topic);
    const { weakType, strongType } = typeEnds(group.items);
    reports.push({
      subject: group.subject,
      weakTopics,
      strongTopics,
      weakType,
      strongType,
      misses: group.items.filter((item) => !item.correct).length
    });
  }
  return reports.sort((a, b) => b.misses - a.misses || a.subject.localeCompare(b.subject));
}

function reportSpeakable(report) {
  return Boolean(
    (report.weakTopics && report.weakTopics.length)
    || (report.strongTopics && report.strongTopics.length)
    || report.weakType
    || report.strongType
  );
}

function rankedLessonTopics(items, lessons) {
  const topicMap = countTopics(items, lessons);
  const weakTopics = [...topicMap.values()]
    .filter((row) => row.misses > 0 && row.misses >= row.hits)
    .sort((a, b) => b.misses - a.misses || b.hits - a.hits)
    .map((row) => row.topic);
  const weakSet = new Set(weakTopics);
  const strongTopics = [...topicMap.values()]
    .filter((row) => row.hits > row.misses && !weakSet.has(row.topic))
    .sort((a, b) => b.hits - a.hits || a.misses - b.misses)
    .map((row) => row.topic);
  return {
    weakTopics,
    strongTopics,
    topicCounts: [...topicMap.values()].map((row) => ({
      topic: row.topic,
      hits: row.hits,
      misses: row.misses
    }))
  };
}

function lessonTopicKey(subject, lesson) {
  return `${String(subject || '').trim().toLowerCase()}|${String(lesson || '').trim().toLowerCase()}`;
}

async function lessonTopicLookup(db, studentId) {
  const evidence = await loadTopicEvidence(db, studentId);
  const activities = await loadActivityNotes(db, studentId);
  const map = new Map();
  const ensure = (subject, lesson) => {
    const key = lessonTopicKey(subject, lesson);
    if (!map.has(key)) {
      map.set(key, { weakTopics: [], strongTopics: [], topicCounts: [], activityWeak: '', activityStrong: '' });
    }
    return map.get(key);
  };
  const itemGroups = new Map();
  for (const item of evidence.items || []) {
    const key = lessonTopicKey(item.subject, item.lesson);
    if (!itemGroups.has(key)) itemGroups.set(key, { subject: item.subject, lesson: item.lesson, items: [] });
    itemGroups.get(key).items.push(item);
  }
  for (const group of itemGroups.values()) {
    const slot = ensure(group.subject, group.lesson);
    const ranked = rankedLessonTopics(group.items, evidence.lessons);
    slot.weakTopics = ranked.weakTopics;
    slot.strongTopics = ranked.strongTopics;
    slot.topicCounts = ranked.topicCounts;
  }
  const activityGroups = new Map();
  for (const note of activities) {
    const key = lessonTopicKey(note.subject, note.lesson);
    if (!activityGroups.has(key)) activityGroups.set(key, []);
    activityGroups.get(key).push(note);
  }
  for (const [key, notes] of activityGroups) {
    const sample = notes[0];
    const slot = ensure(sample.subject, sample.lesson);
    const ends = pickActivityEnds(notes);
    slot.activityWeak = ends.activityWeak?.category || '';
    slot.activityStrong = ends.activityStrong?.category || '';
    if (!map.has(key)) map.set(key, slot);
  }
  return map;
}

function chartTopicLabel(info, status, kind) {
  if (!info) return '';
  const weak = joinList(info.weakTopics);
  const strong = joinList(info.strongTopics);
  const quizTopic = status === 'needs_improvement' ? (weak || strong) : (strong || weak);
  if (quizTopic) return quizTopic;
  if (kind === 'activity') {
    return status === 'needs_improvement'
      ? (info.activityWeak || info.activityStrong || '')
      : (info.activityStrong || info.activityWeak || '');
  }
  return '';
}

function topicsBySubject(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const subject = String(row.subject || '').trim();
    const topic = String(row.topic || '').trim();
    if (!subject || !topic) continue;
    const key = subject.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (!list.some((item) => item.toLowerCase() === topic.toLowerCase())) list.push(topic);
  }
  return map;
}

function applyGeminiTopics(reports, fromAi) {
  const weakBySubject = topicsBySubject(fromAi?.weaknesses);
  const strongBySubject = topicsBySubject(fromAi?.strengths);
  return reports.map((report) => {
    if (report.weakTopics.length || report.strongTopics.length) return report;
    const key = report.subject.toLowerCase();
    const weakTopics = weakBySubject.get(key) || [];
    const used = new Set(weakTopics.map((topic) => topic.toLowerCase()));
    const strongTopics = (strongBySubject.get(key) || [])
      .filter((topic) => !used.has(topic.toLowerCase()));
    if (!weakTopics.length && !strongTopics.length) return report;
    return { ...report, weakTopics, strongTopics };
  });
}

function levelForScore(levels, earned, max) {
  const list = (levels || []).filter((level) => level && level.label);
  if (!list.length) return { label: '', description: '' };
  const uniquePoints = new Set(list.map((level) => Number(level.points)));
  if (uniquePoints.size <= 1) {
    const ratio = max > 0 ? earned / max : 0;
    const index = ratio >= 0.9 ? 0 : ratio >= 0.75 ? 1 : ratio >= 0.5 ? 2 : Math.min(3, list.length - 1);
    const level = list[Math.min(index, list.length - 1)];
    return {
      label: String(level.label || '').trim(),
      description: String(level.description || '').trim()
    };
  }
  let best = list[0];
  let bestDist = Infinity;
  for (const level of list) {
    const dist = Math.abs(Number(level.points) - earned);
    const lowerTie = dist === bestDist && Number(level.points) < Number(best.points);
    if (dist < bestDist || lowerTie) {
      best = level;
      bestDist = dist;
    }
  }
  return {
    label: String(best.label || '').trim(),
    description: String(best.description || '').trim()
  };
}

function rubricCategoriesForScore(questions, assessmentRubric) {
  const activities = (questions || []).filter((question) => (
    isActivityItemType(question.item_type) && normalizeRubric(question.rubric, question.points)
  ));
  const cats = [];
  const pushCategories = (rubric, activityIndex) => {
    (rubric?.categories || []).forEach((category, index) => {
      cats.push({
        key: `a${activityIndex}_${index}`,
        name: category.name,
        max: Math.max(1, Number(category.max_points) || 1),
        levels: category.levels || []
      });
    });
  };
  activities.forEach((question, index) => {
    pushCategories(normalizeRubric(question.rubric, question.points), index);
  });
  if (!cats.length) pushCategories(normalizeRubric(assessmentRubric), 0);
  return cats;
}

function notesFromRubricRow(row, questions) {
  let scores = row.rubric_scores;
  if (typeof scores === 'string') {
    try {
      scores = JSON.parse(scores);
    } catch (err) {
      scores = null;
    }
  }
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) return [];
  const cats = rubricCategoriesForScore(questions, row.rubric);
  if (!cats.length) return [];
  const subject = String(row.subject_name || '').trim() || lessonName(row.lesson_title, row.title);
  const lesson = lessonName(row.lesson_title, row.title);
  const title = String(row.title || row.lesson_title || 'Activity').trim() || 'Activity';
  const used = new Set();
  const notes = [];
  const take = (key, val, byName) => {
    const earned = Number(val);
    if (!Number.isFinite(earned)) return;
    const cat = byName
      ? cats.find((item) => item.name.toLowerCase() === key && !used.has(item.key))
      : cats.find((item) => item.key === key);
    if (!cat || used.has(cat.key)) return;
    used.add(cat.key);
    const max = cat.max;
    const level = levelForScore(cat.levels, earned, max);
    notes.push({
      subject,
      lesson,
      title,
      category: cat.name,
      earned,
      max,
      percent: Math.round((Math.max(0, earned) / max) * 100),
      level: level.label,
      description: level.description
    });
  };
  for (const [key, val] of Object.entries(scores)) {
    if (/^a\d+_\d+$/.test(key)) take(key, val, false);
  }
  if (!notes.length) {
    for (const [key, val] of Object.entries(scores)) {
      if (/^a\d+_\d+$/.test(key)) continue;
      take(String(key).trim().toLowerCase(), val, true);
    }
  }
  return notes;
}

async function loadActivityNotes(db, studentId) {
  let rows = [];
  try {
    const [found] = await db.query(
      `SELECT sc.assessment_id, sc.rubric_scores, a.lesson_title, a.title, a.rubric, s.NAME as subject_name
       FROM assessment_scores sc
       JOIN assessments a ON a.id = sc.assessment_id
       LEFT JOIN subjects s ON a.subject_id = s.id
       WHERE sc.student_id = ? AND sc.rubric_scores IS NOT NULL AND LOWER(a.TYPE) = 'activity'`,
      [studentId]
    );
    rows = found;
  } catch (err) {
    return [];
  }
  const ids = [...new Set(rows.map((row) => Number(row.assessment_id)).filter(Boolean))];
  const byAssessment = new Map();
  if (ids.length) {
    try {
      const [questions] = await db.query(
        `SELECT id, assessment_id, item_type, points, rubric
         FROM assessment_questions
         WHERE assessment_id IN (${ids.map(() => '?').join(',')})
         ORDER BY assessment_id, sort_order, id`,
        ids
      );
      for (const question of questions) {
        const list = byAssessment.get(Number(question.assessment_id)) || [];
        list.push({ ...question, points: Number(question.points) || 1 });
        byAssessment.set(Number(question.assessment_id), list);
      }
    } catch (err) {
      // Manual activity rubrics are stored on the assessment itself.
    }
  }
  return rows.flatMap((row) => notesFromRubricRow(row, byAssessment.get(Number(row.assessment_id)) || []));
}

function pickActivityEnds(notes) {
  if (!notes.length) return { activityWeak: null, activityStrong: null };
  const sorted = [...notes].sort((a, b) => a.percent - b.percent || a.category.localeCompare(b.category));
  const weak = sorted[0];
  const strong = sorted[sorted.length - 1];
  if (weak.percent === strong.percent || (weak.category === strong.category && weak.title === strong.title)) {
    return { activityWeak: weak, activityStrong: null };
  }
  return { activityWeak: weak, activityStrong: strong };
}

function attachActivities(reports, notes) {
  const bySubject = new Map();
  for (const note of notes || []) {
    const key = String(note.subject || '').trim().toLowerCase();
    if (!key) continue;
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key).push(note);
  }
  const seen = new Set();
  const next = (reports || []).map((report) => {
    const key = String(report.subject || '').trim().toLowerCase();
    seen.add(key);
    return { ...report, ...pickActivityEnds(bySubject.get(key) || []) };
  });
  for (const [key, list] of bySubject) {
    if (seen.has(key)) continue;
    next.push({
      subject: list[0].subject,
      weakTopics: [],
      strongTopics: [],
      weakType: '',
      strongType: '',
      misses: 0,
      ...pickActivityEnds(list)
    });
  }
  return next.sort((a, b) => (b.misses || 0) - (a.misses || 0) || a.subject.localeCompare(b.subject));
}

async function topicInsightForStudent(db, studentId) {
  const evidence = await loadTopicEvidence(db, studentId);
  const activities = await loadActivityNotes(db, studentId);
  if (!evidence.items.length && !activities.length) return null;
  const key = topicCacheKey(studentId, evidence.items, activities);
  if (topicCache.has(key)) return topicCache.get(key);

  let reports = evidence.items.length ? subjectReportsFromEvidence(evidence) : [];
  const needsPhrase = reports.some((report) => !report.weakTopics.length && !report.strongTopics.length);
  if (needsPhrase && evidence.items.length && !isAiDryRun() && isAiConfigured() && Date.now() >= aiTopicsPausedUntil) {
    const system = `You name specific topics inside elementary lesson material for a parent progress summary.
Return JSON: {"weaknesses":[{"lesson":"","topic":""}],"strengths":[{"lesson":"","topic":""}]}
Rules:
- A weakness topic is a part of the lesson that the incorrect quiz or exam questions are about.
- A strength topic is a part of the lesson that the correct quiz or exam questions are about.
- Use the lesson name exactly as given.
- Prefer wording from the lesson material. If the material is empty, name the topic only from the question stems.
- Do not invent a topic that is not supported by the material or the questions.
- Do not mention answer keys or the student's written answers.
- At most 3 weaknesses and 3 strengths. topic is a short phrase a parent can understand.`;
    const user = JSON.stringify({
      lessons: evidence.lessons.slice(0, 8).map((lesson) => ({
        lesson: lesson.lesson,
        subject: lesson.subject,
        material: String(lesson.excerpt || '').slice(0, 2000)
      })),
      incorrect: evidence.misses.map((item) => ({
        lesson: item.lesson,
        kind: item.kind,
        question: item.question
      })),
      correct: evidence.hits.map((item) => ({
        lesson: item.lesson,
        kind: item.kind,
        question: item.question
      }))
    });
    try {
      const parsed = await callGroqChat({ system, user });
      const fromAi = {
        weaknesses: normalizeTopicRows(parsed?.weaknesses, evidence.items),
        strengths: normalizeTopicRows(parsed?.strengths, evidence.items)
      };
      reports = applyGeminiTopics(reports, fromAi);
    } catch (err) {
      console.warn('[insights] topic summary:', err.message);
      if (/quota|rate limit|resource exhausted/i.test(String(err.message || ''))) {
        aiTopicsPausedUntil = Date.now() + 60 * 60 * 1000;
      }
    }
  }

  reports = attachActivities(reports, activities);
  const subjects = reports.filter(reportSpeakable);
  if (!subjects.length) return null;
  const topics = { subjects };
  if (topicCache.size > 200) topicCache.clear();
  topicCache.set(key, topics);
  return topics;
}

module.exports = {
  buildParentInsight,
  topicInsightForStudent,
  lessonTopicLookup,
  chartTopicLabel,
  PASSING,
  STRONG
};
