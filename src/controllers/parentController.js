const db = require('../../db');
const { schoolYear } = require('../config');
const {
  attachReplies,
  attachConcernReadState,
  markConcernRead,
  addConcernReply
} = require('../utils/concernReplies');
const { audienceSql } = require('../utils/announcements');
const { ensureInboxTrash, trashExcludeSql } = require('../utils/inboxTrash');
const { logActivity } = require('../utils/activityLog');
const {
  ensureAttendanceSchema,
  manilaISODate,
  weekStartMonday,
  addDaysISO,
  sqlDateToISO
} = require('../utils/attendanceSchema');
const { buildParentInsight, topicInsightForStudent, lessonTopicLookup, PASSING, STRONG } = require('../utils/parentInsights');
const { lessonName, lessonLookupKey, partsByLesson, attachPartsToLessons } = require('../utils/lessonParts');
const { ensureAssignmentSlots } = require('../utils/teachingMode');
const { ensureQuizShareSchema, activityWorkFromSubmission, quizTakenFromSubmission, identificationReviewBank } = require('../utils/quizShare');
const { ensureQuestionBankSchema, formatBankRow } = require('../utils/questionBank');

function cappedPercent(score, maxScore) {
  const max = Number(maxScore) || 100;
  const n = Number(score);
  if (!Number.isFinite(n) || max <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((n / max) * 100)));
}

async function loadChildAttendanceWindow(studentId, monthAgo) {
  const [[totalDays]] = await db.query(
    `SELECT COUNT(DISTINCT \`DATE\`) as count FROM attendance WHERE student_id = ? AND \`DATE\` >= ?`,
    [studentId, monthAgo]
  );
  const [rows] = await db.query(
    `SELECT session, \`STATUS\` as status, COUNT(*) as count
     FROM attendance
     WHERE student_id = ? AND \`DATE\` >= ?
     GROUP BY session, \`STATUS\``,
    [studentId, monthAgo]
  );

  const by = {
    morning: { Present: 0, Absent: 0, Late: 0 },
    afternoon: { Present: 0, Absent: 0, Late: 0 }
  };
  let present = 0;
  let absent = 0;
  let late = 0;
  for (const r of rows) {
    const period = String(r.session || 'AM').toUpperCase() === 'PM' ? 'afternoon' : 'morning';
    const st = r.status;
    const n = Number(r.count) || 0;
    if (by[period] && (st === 'Present' || st === 'Absent' || st === 'Late')) {
      by[period][st] += n;
    }
    if (st === 'Present') present += n;
    else if (st === 'Absent') absent += n;
    else if (st === 'Late') late += n;
  }
  const totalMarks = present + absent + late;
  return {
    totalDays: Number(totalDays.count) || 0,
    present,
    absent,
    late,
    attendanceRate: totalMarks > 0 ? Math.round((present / totalMarks) * 100) : 0,
    bySession: by
  };
}

// GET /api/parent/children
exports.getChildren = async (req, res) => {
  try {
    const parentId = req.user.id;

    const [children] = await db.query(
      `SELECT s.id, s.lrn, s.first_name, s.last_name, s.grade_level, s.section, s.gender, s.dob
       FROM students s
       JOIN parent_student_links psl ON s.id = psl.student_id
       WHERE psl.parent_id = ? AND s.status = 'active'
       ORDER BY s.grade_level, s.section, s.last_name`,
      [parentId]
    );

    res.json(children);
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ error: 'Server error fetching children' });
  }
};

// GET /api/parent/child/:id/attendance
exports.getChildAttendance = async (req, res) => {
  try {
    await ensureAttendanceSchema();
    const parentId = req.user.id;
    const { id: studentId } = req.params;

    const [links] = await db.query(
      'SELECT id FROM parent_student_links WHERE parent_id = ? AND student_id = ?',
      [parentId, studentId]
    );

    if (links.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this student' });
    }

    const [records] = await db.query(
      `SELECT a.\`DATE\` as date, a.session, a.\`STATUS\` as status, a.created_at,
              a.subject_id, sub.NAME as subject_name
       FROM attendance a
       LEFT JOIN subjects sub ON sub.id = a.subject_id
       WHERE a.student_id = ?
       ORDER BY a.\`DATE\` DESC,
                CASE WHEN a.session = 'PM' THEN 0 WHEN a.session = 'AM' THEN 1 ELSE 2 END,
                sub.NAME ASC
       LIMIT 500`,
      [studentId]
    );

    res.json(records);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Server error fetching attendance' });
  }
};

// GET /api/parent/child/:id/stats
exports.getChildStats = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id: studentId } = req.params;

    const [links] = await db.query(
      'SELECT id FROM parent_student_links WHERE parent_id = ? AND student_id = ?',
      [parentId, studentId]
    );

    if (links.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await ensureAttendanceSchema();
    const today = manilaISODate();
    const monthAgo = manilaISODate(new Date(Date.now() - 30 * 86400000));
    const windowStats = await loadChildAttendanceWindow(studentId, monthAgo);

    const [todayRecords] = await db.query(
      `SELECT \`STATUS\` as status, session, subject_id FROM attendance WHERE student_id = ? AND \`DATE\` = ?`,
      [studentId, today]
    );

    let todayStatus = 'Not recorded';
    if (todayRecords.length === 1) {
      todayStatus = todayRecords[0].status;
    } else if (todayRecords.length > 1) {
      todayStatus = todayRecords.map((r) => `${r.session}: ${r.status}`).join(', ');
    }

    res.json({
      totalDays: windowStats.totalDays,
      present: windowStats.present,
      absent: windowStats.absent,
      late: windowStats.late,
      attendanceRate: windowStats.attendanceRate,
      todayStatus
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error fetching stats' });
  }
};

exports.getChildProgress = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id: studentId } = req.params;

    const [links] = await db.query(
      'SELECT id FROM parent_student_links WHERE parent_id = ? AND student_id = ?',
      [parentId, studentId]
    );
    if (links.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this student' });
    }

    await ensureQuizShareSchema();

    const [records] = await db.query(
      `SELECT a.id, a.title, a.TYPE as type, a.max_score, a.created_at,
              a.grade_level, a.section, s.NAME as subject_name, sc.score,
              CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
              EXISTS (
                SELECT 1 FROM quiz_submissions qs
                WHERE qs.assessment_id = a.id AND qs.student_id = sc.student_id
              ) AS has_submission
       FROM assessment_scores sc
       JOIN assessments a ON sc.assessment_id = a.id
       LEFT JOIN subjects s ON a.subject_id = s.id
       LEFT JOIN users u ON a.created_by = u.id
       WHERE sc.student_id = ?
       ORDER BY a.created_at DESC`,
      [studentId]
    );

    const withPct = records.map(r => {
      const max = Number(r.max_score) || 100;
      const score = Number(r.score);
      return {
        ...r,
        has_submission: Number(r.has_submission) === 1,
        percent: cappedPercent(score, max)
      };
    });

    const avg = withPct.length
      ? Math.round(withPct.reduce((sum, r) => sum + r.percent, 0) / withPct.length)
      : 0;

    res.json({ records: withPct, average: avg });
  } catch (error) {
    console.error('Get child progress error:', error);
    res.status(500).json({ error: 'Server error fetching progress', details: error.message });
  }
};

exports.getChildSubmission = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id: studentId, assessmentId } = req.params;
    if (!(await assertParentChild(parentId, studentId))) {
      return res.status(403).json({ error: 'You do not have access to this student' });
    }

    const [[assessment]] = await db.query(
      `SELECT a.id, a.title, a.TYPE as type, a.max_score
       FROM assessments a
       JOIN assessment_scores sc ON sc.assessment_id = a.id AND sc.student_id = ?
       WHERE a.id = ?`,
      [studentId, assessmentId]
    );
    if (!assessment) {
      return res.status(404).json({ error: 'This record is not available for your child' });
    }

    await ensureQuizShareSchema();
    await ensureQuestionBankSchema();
    const [[submission]] = await db.query(
      `SELECT answers FROM quiz_submissions WHERE assessment_id = ? AND student_id = ?`,
      [assessmentId, studentId]
    );
    if (!submission) {
      return res.status(404).json({ error: 'No submitted work for this record' });
    }

    const [qrows] = await db.query(
      `SELECT id, item_type, question, choices, answer, points, rubric
       FROM assessment_questions
       WHERE assessment_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [assessmentId]
    );
    const questions = qrows.map((row) => formatBankRow(row));
    const quizTaken = quizTakenFromSubmission(submission.answers, questions).map((item) => ({
      n: item.n,
      item_type: item.item_type,
      question: item.question,
      choices: item.choices,
      given: item.given,
      expected: item.expected,
      correct: item.correct,
      points: item.points
    }));
    const activityWork = activityWorkFromSubmission(submission.answers, questions).map((item) => ({
      question: item.question,
      text: item.text,
      file: item.file && String(item.file.url || '').startsWith('/uploads/')
        ? { url: item.file.url, name: item.file.name }
        : null
    }));

    res.json({
      title: assessment.title,
      type: assessment.type,
      max_score: assessment.max_score,
      quiz_taken: quizTaken,
      activity_work: activityWork,
      identification_bank: identificationReviewBank(questions)
    });
  } catch (error) {
    console.error('Get child submission error:', error);
    res.status(500).json({ error: 'Server error fetching submitted work', details: error.message });
  }
};

async function assertParentChild(parentId, studentId) {
  const [links] = await db.query(
    'SELECT id FROM parent_student_links WHERE parent_id = ? AND student_id = ?',
    [parentId, studentId]
  );
  return links.length > 0;
}

exports.getChildInsights = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id: studentId } = req.params;
    if (!(await assertParentChild(parentId, studentId))) {
      return res.status(403).json({ error: 'You do not have access to this student' });
    }

    const [[child]] = await db.query(
      'SELECT first_name FROM students WHERE id = ? AND STATUS = \'active\'',
      [studentId]
    );

    await ensureAttendanceSchema();
    const monthAgo = manilaISODate(new Date(Date.now() - 30 * 86400000));
    const stats = await loadChildAttendanceWindow(studentId, monthAgo);

    const [records] = await db.query(
      `SELECT a.title, a.lesson_title, a.TYPE as type, a.max_score, a.created_at, s.NAME as subject_name, sc.score
       FROM assessment_scores sc
       JOIN assessments a ON sc.assessment_id = a.id
       LEFT JOIN subjects s ON a.subject_id = s.id
       WHERE sc.student_id = ?
       ORDER BY a.created_at DESC`,
      [studentId]
    );

    const withPct = records.map((r) => {
      const max = Number(r.max_score) || 100;
      const score = Number(r.score);
      return {
        title: r.title,
        lesson_title: r.lesson_title,
        type: r.type,
        subject_name: r.subject_name,
        percent: cappedPercent(score, max)
      };
    });
    const average = withPct.length
      ? Math.round(withPct.reduce((sum, r) => sum + r.percent, 0) / withPct.length)
      : 0;

    const lessonGroups = new Map();
    for (const r of withPct) {
      const lesson = lessonName(r.lesson_title, r.title);
      const key = lesson.toLowerCase();
      if (!lessonGroups.has(key)) {
        lessonGroups.set(key, { lesson, percents: [] });
      }
      lessonGroups.get(key).percents.push(r.percent);
    }
    let lessons = [...lessonGroups.values()].map((g) => ({
      lesson: g.lesson,
      avg_percent: Math.round(g.percents.reduce((sum, n) => sum + n, 0) / g.percents.length)
    }));
    try {
      const partMap = await partsByLesson(db, studentId);
      lessons = attachPartsToLessons(lessons, partMap);
    } catch (partErr) {
      console.warn('[insights] lesson parts:', partErr.message);
    }

    let topics = null;
    try {
      topics = await topicInsightForStudent(db, studentId);
    } catch (topicErr) {
      console.warn('[insights] topics:', topicErr.message);
    }

    const insight = buildParentInsight({
      firstName: child?.first_name,
      stats,
      records: withPct,
      average,
      lessons,
      topics
    });

    res.json(insight);
  } catch (error) {
    console.error('Get child insights error:', error);
    res.status(500).json({ error: 'Server error fetching insights', details: error.message });
  }
};

// ---------- Dashboard analytics ----------

function lessonStatus(avg) {
  if (avg >= STRONG) return 'excels';
  if (avg >= PASSING) return 'on_track';
  return 'needs_improvement';
}

function uniqueTopicNames(list) {
  const out = [];
  const seen = new Set();
  for (const topic of list || []) {
    const text = String(topic || '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function subjectTopicStats(infos) {
  const map = new Map();
  for (const info of infos) {
    for (const row of info.topicCounts || []) {
      const name = String(row.topic || '').trim();
      const key = name.toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, { name, hits: 0, misses: 0 });
      const slot = map.get(key);
      slot.hits += Number(row.hits) || 0;
      slot.misses += Number(row.misses) || 0;
    }
  }
  return [...map.values()].map((row) => {
    const total = row.hits + row.misses;
    const percent = total ? Math.round((row.hits / total) * 100) : 0;
    return { name: row.name, percent, status: lessonStatus(percent) };
  }).sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
}

function subjectKindStats(counts) {
  const labels = { quiz: 'Quiz', activity: 'Activity', exam: 'Exam' };
  return ['quiz', 'activity', 'exam'].flatMap((kind) => {
    const list = counts?.[kind] || [];
    if (!list.length) return [];
    const percent = Math.round(list.reduce((sum, n) => sum + n, 0) / list.length);
    return [{
      kind,
      name: labels[kind],
      percent,
      status: lessonStatus(percent),
      items: list.length
    }];
  });
}

function subjectTopicLabel(infos, status) {
  const weak = [];
  const strong = [];
  for (const info of infos) {
    weak.push(...(info.weakTopics || []));
    strong.push(...(info.strongTopics || []));
  }
  const primary = status === 'needs_improvement' ? weak : strong;
  const secondary = status === 'needs_improvement' ? strong : weak;
  let names = uniqueTopicNames(primary);
  if (!names.length) names = uniqueTopicNames(secondary);
  return names.join(', ');
}

function mergePartLists(lists) {
  const map = new Map();
  for (const part of lists) {
    const name = String(part?.name || '').trim();
    if (!name) continue;
    if (!map.has(name)) map.set(name, { name, sum: 0, n: 0 });
    const slot = map.get(name);
    slot.sum += Number(part.avg_percent) || 0;
    slot.n += 1;
  }
  return [...map.values()].map((part) => ({
    name: part.name,
    avg_percent: Math.round(part.sum / part.n)
  }));
}

function rankedParts(parts) {
  return [...parts].sort(
    (a, b) => b.avg_percent - a.avg_percent || a.name.localeCompare(b.name)
  );
}

function isISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

/**
 * School year 'YYYY-YYYY' -> [June 1 of first year, May 31 of second year].
 * If the anchor date falls outside the configured SY (e.g. SCHOOL_YEAR not yet
 * updated), use the June–May school year that contains the anchor instead.
 */
function schoolYearBounds(sy, anchorISO) {
  const m = String(sy || '').match(/^(\d{4})\s*-\s*(\d{4})$/);
  let y1 = m ? Number(m[1]) : null;
  let y2 = m ? Number(m[2]) : null;
  if (y1 == null || y2 == null || (anchorISO && (anchorISO < `${y1}-06-01` || anchorISO > `${y2}-05-31`))) {
    const [ay, am] = String(anchorISO || manilaISODate()).split('-').map(Number);
    y1 = am >= 6 ? ay : ay - 1;
    y2 = y1 + 1;
  }
  return { from: `${y1}-06-01`, to: `${y2}-05-31`, label: `${y1}-${y2}` };
}

function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0)); // day 0 of next month
  return d.toISOString().slice(0, 10);
}

// GET /api/parent/child/:id/analytics/lessons
exports.getChildLessonAnalytics = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id: studentId } = req.params;
    if (!(await assertParentChild(parentId, studentId))) {
      return res.status(403).json({ error: 'You do not have access to this student' });
    }

    let rows;
    try {
      [rows] = await db.query(
        `SELECT a.id, a.title, a.TYPE as type, a.max_score, a.subject_id, a.lesson_title,
                s.NAME as subject_name, sc.score
         FROM assessment_scores sc
         JOIN assessments a ON sc.assessment_id = a.id
         LEFT JOIN subjects s ON a.subject_id = s.id
         WHERE sc.student_id = ?`,
        [studentId]
      );
    } catch (e) {
      // lesson_title column not migrated yet: fall back to titles only
      [rows] = await db.query(
        `SELECT a.id, a.title, a.TYPE as type, a.max_score, a.subject_id, NULL as lesson_title,
                s.NAME as subject_name, sc.score
         FROM assessment_scores sc
         JOIN assessments a ON sc.assessment_id = a.id
         LEFT JOIN subjects s ON a.subject_id = s.id
         WHERE sc.student_id = ?`,
        [studentId]
      );
    }

    const subjectsMap = new Map();
    const groups = new Map();
    for (const r of rows) {
      const subjectId = r.subject_id != null ? Number(r.subject_id) : 0;
      const subjectName = String(r.subject_name || '').trim() || 'General';
      if (!subjectsMap.has(subjectId)) subjectsMap.set(subjectId, { id: subjectId, name: subjectName });
      const lesson = lessonName(r.lesson_title, r.title);
      if (!groups.has(subjectId)) {
        groups.set(subjectId, {
          subject_id: subjectId,
          subject_name: subjectName,
          lessons: [],
          percents: [],
          kinds: { quiz: [], activity: [], exam: [] }
        });
      }
      const group = groups.get(subjectId);
      const percent = cappedPercent(r.score, r.max_score);
      group.percents.push(percent);
      const kind = String(r.type || '').trim().toLowerCase();
      if (group.kinds[kind]) group.kinds[kind].push(percent);
      if (!group.lessons.some((name) => name.toLowerCase() === lesson.toLowerCase())) {
        group.lessons.push(lesson);
      }
    }

    let topicMap = new Map();
    let partMap = new Map();
    try {
      topicMap = await lessonTopicLookup(db, studentId);
    } catch (topicErr) {
      console.warn('[lessons] topics:', topicErr.message);
    }
    try {
      partMap = await partsByLesson(db, studentId);
    } catch (partErr) {
      console.warn('[lessons] parts:', partErr.message);
    }

    const lessons = [...groups.values()].map((g) => {
      const avg = Math.round(g.percents.reduce((a, b) => a + b, 0) / g.percents.length);
      const status = lessonStatus(avg);
      const infos = g.lessons
        .map((lesson) => topicMap.get(`${g.subject_name.trim().toLowerCase()}|${lesson.trim().toLowerCase()}`))
        .filter(Boolean);
      const quizParts = [];
      const activityParts = [];
      const examParts = [];
      for (const lesson of g.lessons) {
        const parts = partMap.get(lessonLookupKey(lesson)) || { quiz: [], activity: [], exam: [] };
        quizParts.push(...(parts.quiz || []));
        activityParts.push(...(parts.activity || []));
        examParts.push(...(parts.exam || []));
      }
      return {
        subject_id: g.subject_id,
        subject_name: g.subject_name,
        lesson: g.subject_name,
        topic_label: subjectTopicLabel(infos, status),
        topics: subjectTopicStats(infos),
        kinds: subjectKindStats(g.kinds),
        items: g.percents.length,
        avg_percent: avg,
        status,
        quiz_parts: rankedParts(mergePartLists(quizParts)),
        activity_parts: rankedParts(mergePartLists(activityParts)),
        exam_parts: rankedParts(mergePartLists(examParts))
      };
    }).sort((a, b) => b.avg_percent - a.avg_percent || a.subject_name.localeCompare(b.subject_name));

    const subjects = [...subjectsMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    res.json({ subjects, lessons, thresholds: { passing: PASSING, strong: STRONG } });
  } catch (error) {
    console.error('Get child lesson analytics error:', error);
    res.status(500).json({ error: 'Server error fetching lesson analytics', details: error.message });
  }
};

// GET /api/parent/child/:id/analytics/classwork?week=YYYY-MM-DD
exports.getChildWeeklyClasswork = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id: studentId } = req.params;
    if (!(await assertParentChild(parentId, studentId))) {
      return res.status(403).json({ error: 'You do not have access to this student' });
    }

    const anchor = isISODate(req.query.week) ? String(req.query.week) : manilaISODate();
    const weekStart = weekStartMonday(anchor);
    const weekEnd = addDaysISO(weekStart, 6);

    const [rows] = await db.query(
      `SELECT a.id, a.title, a.TYPE as type, a.max_score, s.NAME as subject_name,
              sc.score, sc.recorded_at, a.created_at
       FROM assessment_scores sc
       JOIN assessments a ON sc.assessment_id = a.id
       LEFT JOIN subjects s ON a.subject_id = s.id
       WHERE sc.student_id = ?
         AND DATE(sc.recorded_at) BETWEEN ? AND ?
       ORDER BY sc.recorded_at ASC, a.id ASC`,
      [studentId, weekStart, weekEnd]
    );

    const items = rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      subject_name: r.subject_name || null,
      score: Number(r.score),
      max_score: Number(r.max_score) || 100,
      percent: cappedPercent(r.score, r.max_score),
      date: sqlDateToISO(r.recorded_at || r.created_at)
    }));
    const average = items.length
      ? Math.round(items.reduce((sum, it) => sum + it.percent, 0) / items.length)
      : 0;

    res.json({ weekStart, weekEnd, items, average });
  } catch (error) {
    console.error('Get child weekly classwork error:', error);
    res.status(500).json({ error: 'Server error fetching weekly classwork', details: error.message });
  }
};

// GET /api/parent/child/:id/analytics/attendance?range=day|week|month|year&date=YYYY-MM-DD
exports.getChildAttendanceSummary = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id: studentId } = req.params;
    if (!(await assertParentChild(parentId, studentId))) {
      return res.status(403).json({ error: 'You do not have access to this student' });
    }
    await ensureAttendanceSchema();

    const range = ['day', 'week', 'month', 'year'].includes(String(req.query.range))
      ? String(req.query.range)
      : 'month';
    const anchor = isISODate(req.query.date) ? String(req.query.date) : manilaISODate();

    let from;
    let to;
    let syLabel = schoolYear;
    if (range === 'day') {
      from = anchor;
      to = anchor;
    } else if (range === 'week') {
      from = weekStartMonday(anchor);
      to = addDaysISO(from, 6);
    } else if (range === 'month') {
      from = `${anchor.slice(0, 7)}-01`;
      to = lastDayOfMonth(anchor.slice(0, 7));
    } else {
      ({ from, to, label: syLabel } = schoolYearBounds(schoolYear, anchor));
    }

    const [[days]] = await db.query(
      `SELECT COUNT(DISTINCT \`DATE\`) as count
       FROM attendance WHERE student_id = ? AND \`DATE\` BETWEEN ? AND ?`,
      [studentId, from, to]
    );
    const [rows] = await db.query(
      `SELECT \`STATUS\` as status, COUNT(*) as count
       FROM attendance
       WHERE student_id = ? AND \`DATE\` BETWEEN ? AND ?
       GROUP BY \`STATUS\``,
      [studentId, from, to]
    );

    const counts = { present: 0, late: 0, absent: 0, excused: 0 };
    for (const r of rows) {
      const key = String(r.status || '').toLowerCase();
      if (key in counts) counts[key] += Number(r.count) || 0;
    }
    const totalMarks = counts.present + counts.late + counts.absent + counts.excused;

    res.json({
      range,
      from,
      to,
      schoolYear: syLabel,
      ...counts,
      totalMarks,
      totalSchoolDays: Number(days.count) || 0,
      attendanceRate: totalMarks > 0 ? Math.round(((counts.present + counts.late) / totalMarks) * 100) : 0
    });
  } catch (error) {
    console.error('Get child attendance summary error:', error);
    res.status(500).json({ error: 'Server error fetching attendance summary', details: error.message });
  }
};

// GET /api/parent/me
exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, first_name, last_name, email, phone, avatar_url FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/parent/inbox
exports.getParentInbox = async (req, res) => {
  try {
    const parentId = req.user.id;

    // Get linked children to determine relevant grades/sections
    const [children] = await db.query(
      `SELECT s.grade_level, s.section 
       FROM students s
       JOIN parent_student_links psl ON s.id = psl.student_id
       WHERE psl.parent_id = ? AND s.STATUS = 'active'`,
      [parentId]
    );

    await ensureInboxTrash();

    if (children.length === 0) {
      const [notices] = await db.query(
        `SELECT m.id, m.SUBJECT as subject, m.message, m.is_read, m.created_at, m.student_id,
                CONCAT(u.first_name, ' ', u.last_name) as sender_name,
                u.role as sender_role,
                CONCAT(s.first_name, ' ', s.last_name) as student_name
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         LEFT JOIN students s ON s.id = m.student_id
         WHERE m.receiver_id = ?
         ${trashExcludeSql('m', 'message')}
         ORDER BY m.created_at DESC`,
        [parentId, parentId]
      );
      return res.json({ announcements: [], messages: notices });
    }

    const grades = [...new Set(children.map(c => c.grade_level))];
    const classes = children.map(c => `${c.grade_level}-${c.section}`);

    let sql = `SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name,
                 u.role as sender_role,
                 ar.read_at IS NOT NULL as is_read
               FROM announcements a
               JOIN users u ON a.sender_id = u.id
               LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = ?
               WHERE (a.scope = 'school_wide'`;
    const params = [parentId];

    if (grades.length > 0) {
      sql += ` OR (a.scope = 'grade_wide' AND a.target_grade IN (${grades.map(() => '?').join(',')}))`;
      params.push(...grades);
    }

    if (classes.length > 0) {
      const conds = classes.map(() => '(a.target_grade = ? AND a.target_section = ?)');
      sql += ` OR (a.scope = 'class_specific' AND (${conds.join(' OR ')}))`;
      classes.forEach(cls => { const [g, sec] = cls.split('-'); params.push(g, sec); });
    }

    sql += `)${audienceSql('parent')}${trashExcludeSql('a', 'announcement')} ORDER BY a.created_at DESC`;
    params.push(parentId);

    const [announcements] = await db.query(sql, params);

    const [notices] = await db.query(
      `SELECT m.id, m.SUBJECT as subject, m.message, m.is_read, m.created_at, m.student_id,
              CONCAT(u.first_name, ' ', u.last_name) as sender_name,
              u.role as sender_role,
              CONCAT(s.first_name, ' ', s.last_name) as student_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN students s ON s.id = m.student_id
       WHERE m.receiver_id = ?
       ${trashExcludeSql('m', 'message')}
       ORDER BY m.created_at DESC`,
      [parentId, parentId]
    );

    res.json({ announcements, messages: notices });

  } catch (error) {
    console.error('Get parent inbox error:', error);
    res.status(500).json({ error: 'Server error fetching inbox' });
  }
};

exports.markAllMessagesRead = async (req, res) => {
  try {
    const parentId = req.user?.id || req.user?.userId;
    const ids = (Array.isArray(req.body?.message_ids) ? req.body.message_ids : [])
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!ids.length) return res.json({ message: 'Nothing to mark' });
    const placeholders = ids.map(() => '?').join(', ');
    await db.query(
      `UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND id IN (${placeholders})`,
      [parentId, ...ids]
    );
    res.json({ message: 'All marked as read' });
  } catch (error) {
    console.error('Mark all messages read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.markMessageRead = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id } = req.params;
    const unread = req.method === 'DELETE';
    const [result] = await db.query(
      'UPDATE messages SET is_read = ? WHERE id = ? AND receiver_id = ?',
      [unread ? 0 : 1, id, parentId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ message: unread ? 'Marked unread' : 'Marked read' });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ error: 'Server error updating message' });
  }
};

exports.getChildTeachers = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id: studentId } = req.params;

    const [students] = await db.query(
      `SELECT s.id, s.grade_level, s.section
       FROM students s
       JOIN parent_student_links psl ON s.id = psl.student_id
       WHERE psl.parent_id = ? AND s.id = ? AND s.STATUS = 'active'`,
      [parentId, studentId]
    );
    if (!students.length) {
      return res.status(403).json({ error: 'You do not have access to this student' });
    }

    const student = students[0];
    await ensureAssignmentSlots();
    const [teachers] = await db.query(
      `SELECT u.id, u.first_name, u.last_name,
              MAX(CASE WHEN ta.subject_id IS NULL AND ta.slot = 'assistant' THEN 1 ELSE 0 END) as is_assistant,
              MAX(CASE WHEN ta.subject_id IS NULL AND ta.slot <> 'assistant' THEN 1 ELSE 0 END) as is_adviser,
              GROUP_CONCAT(DISTINCT s.NAME ORDER BY s.NAME SEPARATOR ', ') as subjects
       FROM teacher_assignments ta
       JOIN users u ON u.id = ta.teacher_id
       LEFT JOIN subjects s ON s.id = ta.subject_id
       WHERE ta.grade_level = ?
         AND TRIM(UPPER(ta.section)) = TRIM(UPPER(?))
         AND ta.school_year = '${schoolYear}'
         AND u.role = 'teacher'
         AND COALESCE(u.STATUS, u.status, 'active') != 'inactive'
       GROUP BY u.id, u.first_name, u.last_name
       ORDER BY is_adviser DESC, is_assistant DESC, u.last_name, u.first_name`,
      [student.grade_level, student.section]
    );

    const labeled = teachers.map(t => {
      let role_label = 'Subject Teacher';
      if (t.is_adviser) {
        role_label = t.subjects ? `Class Adviser · ${t.subjects}` : 'Class Adviser';
      } else if (t.is_assistant) {
        role_label = t.subjects ? `Assistant Teacher · ${t.subjects}` : 'Assistant Teacher';
      } else if (t.subjects) {
        role_label = `Subject Teacher · ${t.subjects}`;
      }
      return {
        id: t.id,
        first_name: t.first_name,
        last_name: t.last_name,
        role_label,
        subjects: t.subjects || null,
        is_adviser: !!t.is_adviser,
        is_assistant: !!t.is_assistant
      };
    });

    res.json(labeled);
  } catch (error) {
    console.error('Get child teachers error:', error);
    res.status(500).json({ error: 'Server error fetching teachers', details: error.message });
  }
};

exports.createConcern = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { teacher_id, student_id, subject, message } = req.body;

    if (!teacher_id || !student_id || !message || !String(message).trim()) {
      return res.status(400).json({ error: 'Teacher, student, and message are required' });
    }

    const [links] = await db.query(
      'SELECT id FROM parent_student_links WHERE parent_id = ? AND student_id = ?',
      [parentId, student_id]
    );
    if (!links.length) {
      return res.status(403).json({ error: 'You can only send concerns for your linked children' });
    }

    const [teachers] = await db.query(
      "SELECT id FROM users WHERE id = ? AND role = 'teacher'",
      [teacher_id]
    );
    if (!teachers.length) {
      return res.status(400).json({ error: 'Selected teacher was not found' });
    }

    const [result] = await db.query(
      `INSERT INTO concerns (parent_id, teacher_id, student_id, SUBJECT, message, STATUS, priority)
       VALUES (?, ?, ?, ?, ?, 'open', 'normal')`,
      [parentId, teacher_id, student_id, subject || 'General', String(message).trim()]
    );

    await logActivity(db, parentId, 'Sent concern', 'concern', null, null);

    res.status(201).json({ id: result.insertId, message: 'Concern sent to the teacher' });
  } catch (error) {
    console.error('Create concern error:', error);
    res.status(500).json({ error: 'Server error sending concern', details: error.message });
  }
};

exports.getMyConcerns = async (req, res) => {
  try {
    const parentId = req.user.id;
    await ensureInboxTrash();
    const studentId = req.query.student_id ? parseInt(req.query.student_id, 10) : null;

    if (studentId) {
      const [owned] = await db.query(
        'SELECT id FROM parent_student_links WHERE parent_id = ? AND student_id = ?',
        [parentId, studentId]
      );
      if (!owned.length) {
        return res.status(403).json({ error: 'You can only view concerns for your linked children' });
      }
    }

    const params = [parentId];
    let sql = `SELECT c.id, c.student_id, c.SUBJECT as subject, c.message, c.STATUS as status, c.priority,
              c.created_at, c.updated_at, c.teacher_reply, c.replied_at,
              CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
              CONCAT(s.first_name, ' ', s.last_name) as student_name
       FROM concerns c
       LEFT JOIN users t ON c.teacher_id = t.id
       LEFT JOIN students s ON c.student_id = s.id
       WHERE c.parent_id = ?${trashExcludeSql('c', 'concern')}`;
    params.push(parentId);
    if (studentId) {
      sql += ' AND c.student_id = ?';
      params.push(studentId);
    }
    sql += ' ORDER BY c.created_at DESC';

    const [rows] = await db.query(sql, params);
    res.json(await attachConcernReadState(await attachReplies(rows), parentId));
  } catch (error) {
    console.error('Get parent concerns error:', error);
    res.status(500).json({ error: 'Server error fetching concerns', details: error.message });
  }
};

exports.markConcernRead = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id } = req.params;
    const [owned] = await db.query(
      'SELECT id FROM concerns WHERE id = ? AND parent_id = ?',
      [id, parentId]
    );
    if (!owned.length) return res.status(404).json({ error: 'Concern not found' });
    await markConcernRead(id, parentId);
    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Parent mark concern read error:', error);
    res.status(500).json({ error: 'Server error marking concern read', details: error.message });
  }
};

exports.replyToConcern = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { id } = req.params;
    const { message } = req.body;

    const [owned] = await db.query(
      'SELECT id FROM concerns WHERE id = ? AND parent_id = ?',
      [id, parentId]
    );
    if (!owned.length) {
      return res.status(404).json({ error: 'Concern not found' });
    }

    const result = await addConcernReply({
      concernId: id,
      senderId: parentId,
      senderRole: 'parent',
      message
    });

    await logActivity(
      db,
      parentId,
      'Replied to concern',
      'concern',
      null,
      null
    );

    res.status(201).json({ id: result.id, message: 'Reply sent to the teacher' });
  } catch (error) {
    console.error('Parent reply concern error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.status ? error.message : 'Server error sending reply',
      details: error.message
    });
  }
};