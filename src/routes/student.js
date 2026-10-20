const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const db = require('../../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { schoolYear } = require('../config');
const { ensureSoftDeleteSchema } = require('../utils/softDeleteSchema');
const { ensureStudentLoginSchema } = require('../utils/studentAccount');
const { ensurePortalClassworkSchema } = require('../utils/portalClasswork');
const { ensureQuizShareSchema } = require('../utils/quizShare');
const {
  getAssessmentQuestions,
  publicQuestionsForQuiz,
  shuffleQuestionsWithinSections,
  scoreSubmission,
  isActivityItemType,
  answersBagFromPayload
} = require('../utils/quizShare');
const { isPastManila, normalizeSqlDatetime } = require('../utils/quizAttendance');
const { notifyStudentScore } = require('../utils/sms');
const { normalizeQuarter } = require('../utils/schoolSettings');

const activitySubmitDir = path.join(__dirname, '../../public/uploads/activity-submissions');
if (!fs.existsSync(activitySubmitDir)) {
  fs.mkdirSync(activitySubmitDir, { recursive: true });
}

const activityFileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, activitySubmitDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `act_${Date.now()}_${Math.random().toString(16).slice(2, 10)}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const okExt = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'];
    const okMime = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];
    if (okExt.includes(ext) || okMime.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Upload a PDF, Word file, or image.'));
  }
});

function runActivityUpload(req, res) {
  return new Promise((resolve, reject) => {
    activityFileUpload.any()(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function mergeActivityUploads(answers, files) {
  const next = { ...answersBagFromPayload(answers) };
  (files || []).forEach((file) => {
    const match = String(file.fieldname || '').match(/^file_(\d+)$/);
    if (!match) return;
    const qid = match[1];
    const prev = next[qid] && typeof next[qid] === 'object' ? next[qid] : { text: String(next[qid] || '') };
    next[qid] = {
      ...prev,
      file: {
        url: `/uploads/activity-submissions/${file.filename}`,
        name: file.originalname || file.filename,
        mime: file.mimetype || ''
      }
    };
  });
  return next;
}

function classworkStatus(row) {
  if (row.submission_id) return 'finished';
  if (Number(row.portal_posted) !== 1) return null;
  if (isPastManila(row.portal_due_at)) return 'missing';
  return 'pending';
}

function mapClassworkItem(row) {
  const status = classworkStatus(row);
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    activity_mode: row.activity_mode || null,
    quarter: normalizeQuarter(row.quarter),
    subject_id: row.subject_id,
    subject_name: row.subject_name || 'No subject',
    max_score: Number(row.max_score) || 0,
    due_at: row.portal_due_at ? normalizeSqlDatetime(row.portal_due_at) : null,
    status,
    score: row.submission_id ? Number(row.score) : null,
    submitted_at: row.submitted_at || null
  };
}

function scoreFields(row) {
  const max = Number(row.max_score) || Number(row.submission_max) || 0;
  const recorded = row.recorded_score;
  if (recorded !== null && recorded !== undefined) {
    return { score: Number(recorded), max_score: max, pending_score: false };
  }
  const type = String(row.type || '').toLowerCase();
  if (row.submission_id && type === 'activity') {
    return { score: null, max_score: max, pending_score: true };
  }
  if (row.submission_id && row.submission_score != null) {
    return { score: Number(row.submission_score), max_score: max, pending_score: false };
  }
  return { score: null, max_score: max, pending_score: true };
}

function answerText(raw) {
  if (raw == null) return '';
  if (typeof raw === 'object') return String(raw.text ?? raw.answer ?? '').trim();
  return String(raw).trim();
}

async function loadEnrolledSubject(student, subjectId) {
  const [[subject]] = await db.query(
    `SELECT s.id, s.CODE AS code, s.NAME AS name
     FROM teacher_assignments ta
     JOIN subjects s ON s.id = ta.subject_id
     WHERE ta.grade_level = ?
       AND LOWER(ta.section) = LOWER(?)
       AND ta.school_year = ?
       AND ta.subject_id = ?
       AND s.deleted_at IS NULL
     LIMIT 1`,
    [student.grade_level, student.section, schoolYear, subjectId]
  );
  return subject || null;
}

async function loadPortalStudent(userId) {
  await ensureStudentLoginSchema();
  await ensureSoftDeleteSchema();
  const [[student]] = await db.query(
    `SELECT id, first_name, last_name, grade_level, section, STATUS
     FROM students
     WHERE user_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );
  if (!student) return null;
  if (String(student.STATUS || '').toLowerCase() !== 'active') return null;
  return student;
}

router.use(verifyToken, requireRole('student'));

router.get('/subjects', async (req, res) => {
  try {
    const student = await loadPortalStudent(req.user.id);
    if (!student) return res.status(403).json({ error: 'No active student record is linked to this login.' });

    const [subjects] = await db.query(
      `SELECT DISTINCT s.id, s.CODE AS code, s.NAME AS name
       FROM teacher_assignments ta
       JOIN subjects s ON s.id = ta.subject_id
       WHERE ta.grade_level = ?
         AND LOWER(ta.section) = LOWER(?)
         AND ta.school_year = ?
         AND ta.subject_id IS NOT NULL
         AND s.deleted_at IS NULL
       ORDER BY s.NAME`,
      [student.grade_level, student.section, schoolYear]
    );
    res.json({
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        grade_level: student.grade_level,
        section: student.section
      },
      subjects
    });
  } catch (error) {
    console.error('Student subjects error:', error);
    res.status(500).json({ error: 'Server error loading subjects' });
  }
});

router.get('/subjects/:id/classwork', async (req, res) => {
  try {
    await ensurePortalClassworkSchema();
    await ensureQuizShareSchema();
    const student = await loadPortalStudent(req.user.id);
    if (!student) return res.status(403).json({ error: 'No active student record is linked to this login.' });
    const subject = await loadEnrolledSubject(student, req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found.' });

    const [rows] = await db.query(
      `SELECT a.id, a.title, a.TYPE AS type, a.activity_mode, a.quarter, a.subject_id, a.max_score,
              a.portal_posted, a.portal_due_at, s.NAME AS subject_name,
              sub.id AS submission_id, sub.score, sub.submitted_at
       FROM assessments a
       LEFT JOIN subjects s ON s.id = a.subject_id
       LEFT JOIN quiz_submissions sub
         ON sub.assessment_id = a.id AND sub.student_id = ?
       WHERE a.subject_id = ?
         AND a.grade_level = ?
         AND LOWER(a.section) = LOWER(?)
         AND (a.portal_posted = 1 OR sub.id IS NOT NULL)
       ORDER BY a.portal_due_at IS NULL, a.portal_due_at ASC, a.id DESC`,
      [student.id, subject.id, student.grade_level, student.section]
    );
    const items = rows.map(mapClassworkItem).filter((item) => item.status);
    const counts = { pending: 0, finished: 0, missing: 0 };
    items.forEach((item) => {
      if (counts[item.status] != null) counts[item.status] += 1;
    });
    const statusFilter = String(req.query.status || '').toLowerCase();
    const typeFilter = String(req.query.type || 'all').toLowerCase();
    let list = ['pending', 'finished', 'missing'].includes(statusFilter)
      ? items.filter((item) => item.status === statusFilter)
      : items;
    if (['quiz', 'activity', 'exam'].includes(typeFilter)) {
      list = list.filter((item) => String(item.type || '').toLowerCase() === typeFilter);
    }
    res.json({ subject, counts, items: list });
  } catch (error) {
    console.error('Student subject classwork error:', error);
    res.status(500).json({ error: 'Server error loading classwork' });
  }
});

router.get('/subjects/:id/materials', async (req, res) => {
  try {
    await ensurePortalClassworkSchema();
    const student = await loadPortalStudent(req.user.id);
    if (!student) return res.status(403).json({ error: 'No active student record is linked to this login.' });
    const subject = await loadEnrolledSubject(student, req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found.' });

    const [rows] = await db.query(
      `SELECT DISTINCT lp.id, lp.title, lp.objectives, lp.file_path, lp.quarter, lp.created_at
       FROM lesson_plans lp
       JOIN teacher_assignments ta
         ON ta.teacher_id = lp.uploaded_by
        AND ta.subject_id = lp.subject_id
        AND ta.grade_level = lp.grade_level
        AND LOWER(ta.section) = LOWER(?)
        AND ta.school_year = ?
       WHERE lp.subject_id = ?
         AND lp.grade_level = ?
       ORDER BY lp.created_at DESC, lp.id DESC`,
      [student.section, schoolYear, subject.id, student.grade_level]
    );
    res.json({
      subject,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        objectives: row.objectives || '',
        file_path: row.file_path || '',
        quarter: normalizeQuarter(row.quarter),
        created_at: row.created_at
      }))
    });
  } catch (error) {
    console.error('Student materials error:', error);
    res.status(500).json({ error: 'Server error loading materials' });
  }
});

router.get('/subjects/:id/records', async (req, res) => {
  try {
    await ensurePortalClassworkSchema();
    await ensureQuizShareSchema();
    const student = await loadPortalStudent(req.user.id);
    if (!student) return res.status(403).json({ error: 'No active student record is linked to this login.' });
    const subject = await loadEnrolledSubject(student, req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found.' });

    const [rows] = await db.query(
      `SELECT a.id, a.title, a.TYPE AS type, a.quarter, a.max_score, a.activity_mode,
              sub.id AS submission_id, sub.score AS submission_score, sub.max_score AS submission_max,
              sc.score AS recorded_score
       FROM assessments a
       LEFT JOIN quiz_submissions sub
         ON sub.assessment_id = a.id AND sub.student_id = ?
       LEFT JOIN assessment_scores sc
         ON sc.assessment_id = a.id AND sc.student_id = ?
       WHERE a.subject_id = ?
         AND a.grade_level = ?
         AND LOWER(a.section) = LOWER(?)
         AND (sub.id IS NOT NULL OR sc.score IS NOT NULL)
       ORDER BY a.created_at DESC, a.id DESC`,
      [student.id, student.id, subject.id, student.grade_level, student.section]
    );
    const typeFilter = String(req.query.type || 'all').toLowerCase();
    const quarterFilter = String(req.query.quarter || 'all').toUpperCase();
    const items = rows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      activity_mode: row.activity_mode || null,
      quarter: normalizeQuarter(row.quarter),
      has_submission: !!row.submission_id,
      ...scoreFields(row)
    })).filter((item) => {
      if (['quiz', 'activity', 'exam'].includes(typeFilter) && String(item.type).toLowerCase() !== typeFilter) {
        return false;
      }
      if (['Q1', 'Q2', 'Q3', 'Q4'].includes(quarterFilter) && item.quarter !== quarterFilter) {
        return false;
      }
      return true;
    });
    res.json({ subject, items });
  } catch (error) {
    console.error('Student records error:', error);
    res.status(500).json({ error: 'Server error loading records' });
  }
});

router.get('/classwork', async (req, res) => {
  try {
    await ensurePortalClassworkSchema();
    await ensureQuizShareSchema();
    const student = await loadPortalStudent(req.user.id);
    if (!student) return res.status(403).json({ error: 'No active student record is linked to this login.' });

    const subjectId = req.query.subject_id != null && String(req.query.subject_id).trim() !== ''
      ? Number(req.query.subject_id)
      : null;
    const [rows] = await db.query(
      `SELECT a.id, a.title, a.TYPE AS type, a.activity_mode, a.quarter, a.subject_id, a.max_score,
              a.portal_posted, a.portal_due_at, s.NAME AS subject_name,
              sub.id AS submission_id, sub.score, sub.max_score AS submission_max, sub.submitted_at
       FROM assessments a
       LEFT JOIN subjects s ON s.id = a.subject_id
       LEFT JOIN quiz_submissions sub
         ON sub.assessment_id = a.id AND sub.student_id = ?
       WHERE a.grade_level = ?
         AND LOWER(a.section) = LOWER(?)
         AND (a.portal_posted = 1 OR sub.id IS NOT NULL)
       ORDER BY a.portal_due_at IS NULL, a.portal_due_at ASC, a.id DESC`,
      [student.id, student.grade_level, student.section]
    );

    const items = rows.map(mapClassworkItem).filter((item) => item.status);

    const scoped = subjectId
      ? items.filter((item) => Number(item.subject_id) === subjectId)
      : items;
    const counts = { pending: 0, finished: 0, missing: 0 };
    scoped.forEach((item) => {
      if (counts[item.status] != null) counts[item.status] += 1;
    });
    const statusFilter = String(req.query.status || '').toLowerCase();
    const list = ['pending', 'finished', 'missing'].includes(statusFilter)
      ? scoped.filter((item) => item.status === statusFilter)
      : scoped;

    res.json({ counts, items: list });
  } catch (error) {
    console.error('Student classwork error:', error);
    res.status(500).json({ error: 'Server error loading classwork' });
  }
});

router.get('/classwork/:id/work', async (req, res) => {
  try {
    await ensurePortalClassworkSchema();
    await ensureQuizShareSchema();
    const student = await loadPortalStudent(req.user.id);
    if (!student) return res.status(403).json({ error: 'No active student record is linked to this login.' });

    const [[row]] = await db.query(
      `SELECT a.id, a.title, a.TYPE AS type, a.quarter, a.max_score,
              sub.id AS submission_id, sub.answers, sub.score AS submission_score,
              sub.max_score AS submission_max, sc.score AS recorded_score
       FROM assessments a
       LEFT JOIN quiz_submissions sub
         ON sub.assessment_id = a.id AND sub.student_id = ?
       LEFT JOIN assessment_scores sc
         ON sc.assessment_id = a.id AND sc.student_id = ?
       WHERE a.id = ?
         AND a.grade_level = ?
         AND LOWER(a.section) = LOWER(?)`,
      [student.id, student.id, req.params.id, student.grade_level, student.section]
    );
    if (!row || !row.submission_id) {
      return res.status(404).json({ error: 'No submitted work was found.' });
    }

    const questions = await getAssessmentQuestions(row.id);
    const bag = answersBagFromPayload(row.answers);
    const items = questions.map((question, index) => {
      const raw = bag[String(question.id)] ?? bag[question.id];
      const file = raw && typeof raw === 'object' && raw.file && raw.file.url
        ? {
            url: String(raw.file.url),
            name: String(raw.file.name || 'Attachment')
          }
        : null;
      return {
        n: index + 1,
        question: question.question || '',
        given: answerText(raw),
        file
      };
    });
    const scored = scoreFields(row);
    res.json({
      id: row.id,
      title: row.title,
      type: row.type,
      quarter: normalizeQuarter(row.quarter),
      ...scored,
      items
    });
  } catch (error) {
    console.error('Student work view error:', error);
    res.status(500).json({ error: 'Server error loading submitted work' });
  }
});

router.get('/classwork/:id', async (req, res) => {
  try {
    await ensurePortalClassworkSchema();
    await ensureQuizShareSchema();
    const student = await loadPortalStudent(req.user.id);
    if (!student) return res.status(403).json({ error: 'No active student record is linked to this login.' });

    const [[row]] = await db.query(
      `SELECT a.id, a.title, a.TYPE AS type, a.subject_id, a.grade_level, a.section,
              a.max_score, a.portal_posted, a.portal_due_at, s.NAME AS subject_name,
              sub.id AS submission_id, sub.score, sub.submitted_at
       FROM assessments a
       LEFT JOIN subjects s ON s.id = a.subject_id
       LEFT JOIN quiz_submissions sub
         ON sub.assessment_id = a.id AND sub.student_id = ?
       WHERE a.id = ?
         AND a.grade_level = ?
         AND LOWER(a.section) = LOWER(?)`,
      [student.id, req.params.id, student.grade_level, student.section]
    );
    if (!row) return res.status(404).json({ error: 'Classwork not found.' });
    const status = classworkStatus(row);
    if (!status) return res.status(404).json({ error: 'This classwork is not posted.' });

    const payload = {
      id: row.id,
      title: row.title,
      type: row.type,
      subject_name: row.subject_name || 'No subject',
      max_score: Number(row.max_score) || 0,
      due_at: row.portal_due_at ? normalizeSqlDatetime(row.portal_due_at) : null,
      status,
      score: row.submission_id ? Number(row.score) : null,
      submitted_at: row.submitted_at || null,
      questions: []
    };
    if (status === 'pending') {
      const questions = shuffleQuestionsWithinSections(await getAssessmentQuestions(row.id));
      payload.questions = publicQuestionsForQuiz(questions);
    }
    res.json(payload);
  } catch (error) {
    console.error('Student classwork get error:', error);
    res.status(500).json({ error: 'Server error loading classwork' });
  }
});

router.post('/classwork/:id/submit', async (req, res) => {
  try {
    const contentType = String(req.headers['content-type'] || '');
    if (contentType.includes('multipart/form-data')) {
      await runActivityUpload(req, res);
    }
    await ensurePortalClassworkSchema();
    await ensureQuizShareSchema();
    const student = await loadPortalStudent(req.user.id);
    if (!student) return res.status(403).json({ error: 'No active student record is linked to this login.' });

    const [[assessment]] = await db.query(
      `SELECT id, title, TYPE AS type, grade_level, section, max_score, share_token,
              portal_posted, portal_due_at
       FROM assessments
       WHERE id = ? AND grade_level = ? AND LOWER(section) = LOWER(?)`,
      [req.params.id, student.grade_level, student.section]
    );
    if (!assessment || Number(assessment.portal_posted) !== 1) {
      return res.status(404).json({ error: 'This classwork is not posted.' });
    }
    if (isPastManila(assessment.portal_due_at)) {
      return res.status(403).json({ error: 'This classwork is past the due date.' });
    }

    const [existing] = await db.query(
      'SELECT id FROM quiz_submissions WHERE assessment_id = ? AND student_id = ?',
      [assessment.id, student.id]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'You already submitted this classwork.' });
    }

    const answers = mergeActivityUploads(req.body?.answers, req.files);
    const questions = await getAssessmentQuestions(assessment.id);
    if (!questions.length) {
      return res.status(400).json({ error: 'This classwork has no items yet.' });
    }
    for (const question of questions) {
      if (!isActivityItemType(question.item_type)) continue;
      const raw = answers[String(question.id)];
      const text = typeof raw === 'object' && raw ? String(raw.text || '').trim() : String(raw || '').trim();
      if (!text) {
        return res.status(400).json({ error: 'Write your answer for every activity item before submitting.' });
      }
    }

    const { earned, maxScore, detail } = scoreSubmission(questions, answers);
    const onlyActivity = questions.length > 0 && questions.every((q) => isActivityItemType(q.item_type));
    const recordMax = Math.max(1, Number(assessment.max_score) || maxScore || 1);
    let finalScore = earned;
    if (maxScore > 0 && Math.abs(recordMax - maxScore) > 0.01) {
      finalScore = Math.round((earned / maxScore) * recordMax * 100) / 100;
    }
    finalScore = Math.min(recordMax, Math.max(0, finalScore));

    await db.query(
      `INSERT INTO quiz_submissions
        (assessment_id, student_id, share_token, answers, score, max_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        assessment.id,
        student.id,
        assessment.share_token || 'portal',
        JSON.stringify({ student_id: student.id, answers, detail, scored_at: new Date().toISOString(), source: 'portal' }),
        onlyActivity ? 0 : finalScore,
        recordMax
      ]
    );

    if (!onlyActivity) {
      const [scoreRow] = await db.query(
        'SELECT id FROM assessment_scores WHERE assessment_id = ? AND student_id = ?',
        [assessment.id, student.id]
      );
      if (scoreRow.length) {
        await db.query('UPDATE assessment_scores SET score = ? WHERE id = ?', [finalScore, scoreRow[0].id]);
      } else {
        await db.query(
          'INSERT INTO assessment_scores (assessment_id, student_id, score) VALUES (?, ?, ?)',
          [assessment.id, student.id, finalScore]
        );
      }
      const kind = String(assessment.type || '').toLowerCase();
      if (kind === 'quiz' || kind === 'exam') {
        try {
          await notifyStudentScore({
            studentId: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            score: finalScore,
            maxScore: recordMax,
            title: assessment.title
          });
        } catch (smsError) {
          console.error('[sms] score notice:', smsError.message);
        }
      }
    }

    res.status(201).json({
      message: onlyActivity
        ? 'Submitted. Your teacher will score this in Records.'
        : 'Submitted.',
      score: onlyActivity ? null : finalScore,
      max_score: recordMax,
      pending_teacher_score: onlyActivity
    });
  } catch (error) {
    console.error('Student classwork submit error:', error);
    if (error && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large (max 10 MB).' });
    }
    if (error && /PDF, Word file, or image/i.test(String(error.message || ''))) {
      return res.status(400).json({ error: error.message });
    }
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You already submitted this classwork.' });
    }
    res.status(500).json({ error: 'Server error submitting classwork' });
  }
});

module.exports = router;
