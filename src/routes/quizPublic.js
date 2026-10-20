const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const db = require('../../db');
const {
  ensureQuizShareSchema,
  publicQuestionsForQuiz,
  getAssessmentQuestions,
  shuffleQuestionsWithinSections,
  scoreSubmission,
  isActivityItemType,
  activityWorkFromSubmission,
  answersBagFromPayload
} = require('../utils/quizShare');
const {
  ensureQuizAttendanceSchema,
  parseMakeupIds,
  attendanceSlotForAssessment,
  loadAttendanceRoster,
  isStudentEligibleForQuiz,
  quizBlockReason,
  getSubmittedStudentIds,
  isAtOrBeforeManila
} = require('../utils/quizAttendance');
const { notifyStudentScore } = require('../utils/sms');

function normalizeLrn(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 12 ? digits : null;
}

async function loadAssessmentByToken(token) {
  const [[assessment]] = await db.query(
    `SELECT a.id, a.title, a.TYPE as type, a.grade_level, a.section, a.max_score,
            a.subject_id, a.share_token, a.share_enabled, a.created_by,
            a.quiz_attendance_date, a.quiz_attendance_session, a.quiz_subject_id,
            a.quiz_makeup_student_ids, a.quiz_closes_at, a.quiz_makeup_closes_at,
            s.NAME as subject_name
     FROM assessments a
     LEFT JOIN subjects s ON s.id = a.subject_id
     WHERE a.share_token = ?`,
    [token]
  );
  return assessment;
}

async function findStudentByLrnInClass(assessment, lrnProvided) {
  const slot = attendanceSlotForAssessment(assessment);
  const roster = await loadAttendanceRoster(assessment.grade_level, assessment.section, slot);
  return roster.find((s) => normalizeLrn(s.lrn) === lrnProvided) || null;
}

router.get('/:token', async (req, res) => {
  try {
    await ensureQuizShareSchema();
    await ensureQuizAttendanceSchema();
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Invalid link' });

    const assessment = await loadAssessmentByToken(token);
    if (!assessment || !assessment.share_enabled) {
      return res.status(404).json({ error: 'This link is inactive or not found.' });
    }

    const questions = shuffleQuestionsWithinSections(await getAssessmentQuestions(assessment.id));
    if (!questions.length) {
      return res.status(400).json({ error: 'This link has no items yet.' });
    }

    const makeupIds = parseMakeupIds(assessment.quiz_makeup_student_ids);
    const liveOpen = isAtOrBeforeManila(assessment.quiz_closes_at);

    res.json({
      title: assessment.title,
      type: assessment.type,
      subject_name: assessment.subject_name,
      grade_level: assessment.grade_level,
      section: assessment.section,
      max_score: Number(assessment.max_score) || 100,
      questions: publicQuestionsForQuiz(questions),
      quiz_mode: makeupIds.length ? 'live_and_makeup' : 'live_only',
      identity_verification: 'lrn_first',
      live_statuses: ['Present', 'Late'],
      quiz_closes_at: assessment.quiz_closes_at || null,
      quiz_makeup_closes_at: assessment.quiz_makeup_closes_at || null,
      live_open: liveOpen
    });
  } catch (error) {
    console.error('Public quiz get error:', error);
    res.status(500).json({ error: 'Server error loading link', details: error.message });
  }
});

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
    if (okExt.includes(ext) || okMime.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Upload a PDF, Word file, or image (JPG, PNG, or WebP).'));
  }
});

router.post('/:token/identify', async (req, res) => {
  try {
    await ensureQuizShareSchema();
    await ensureQuizAttendanceSchema();
    const token = String(req.params.token || '').trim();
    const lrnProvided = normalizeLrn(req.body?.lrn);

    if (!token) return res.status(400).json({ error: 'Invalid link' });
    if (!lrnProvided) {
      return res.status(400).json({ error: 'Enter your 12-digit LRN.' });
    }

    const assessment = await loadAssessmentByToken(token);
    if (!assessment || !assessment.share_enabled) {
      return res.status(404).json({ error: 'This link is inactive or not found.' });
    }

    const row = await findStudentByLrnInClass(assessment, lrnProvided);
    if (!row) {
      return res.status(404).json({
        error: 'No student in this class matched that LRN. Check the number and try again.'
      });
    }

    const submittedSet = await getSubmittedStudentIds(assessment.id);
    const submitted = submittedSet.has(Number(row.id));
    const makeupIds = parseMakeupIds(assessment.quiz_makeup_student_ids);
    const eligible = isStudentEligibleForQuiz({
      attendanceStatus: row.attendance_status,
      submitted,
      makeupStudentIds: makeupIds,
      studentId: row.id,
      assessment
    });
    const block_reason = quizBlockReason({
      attendanceStatus: row.attendance_status,
      eligible,
      submitted,
      assessment,
      makeupStudentIds: makeupIds,
      studentId: row.id
    });

    res.json({
      student_id: row.id,
      student_name: `${row.last_name}, ${row.first_name}`,
      first_name: row.first_name,
      last_name: row.last_name,
      attendance_status: row.attendance_status || null,
      submitted,
      eligible: !!eligible,
      block_reason,
      makeup: makeupIds.includes(Number(row.id)),
      quiz_closes_at: assessment.quiz_closes_at || null,
      quiz_makeup_closes_at: assessment.quiz_makeup_closes_at || null
    });
  } catch (error) {
    console.error('Public quiz identify error:', error);
    res.status(500).json({ error: 'Server error verifying LRN', details: error.message });
  }
});

function mergeActivityUploads(answers, files) {
  const next = { ...answersBagFromPayload(answers) };
  (files || []).forEach((file) => {
    const m = String(file.fieldname || '').match(/^file_(\d+)$/);
    if (!m) return;
    const qid = m[1];
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

function runActivityUpload(req, res) {
  return new Promise((resolve, reject) => {
    activityFileUpload.any()(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

router.post('/:token/submit', async (req, res) => {
  try {
    const contentType = String(req.headers['content-type'] || '');
    if (contentType.includes('multipart/form-data')) {
      await runActivityUpload(req, res);
    }
    await ensureQuizShareSchema();
    await ensureQuizAttendanceSchema();
    const token = String(req.params.token || '').trim();
    const { student_id, answers: answersRaw, lrn: lrnBody } = req.body || {};
    const answers = mergeActivityUploads(answersRaw, req.files);

    if (!token) return res.status(400).json({ error: 'Invalid link' });
    if (!student_id) return res.status(400).json({ error: 'Confirm your LRN before submitting.' });

    const assessment = await loadAssessmentByToken(token);
    if (!assessment || !assessment.share_enabled) {
      return res.status(404).json({ error: 'This link is inactive or not found.' });
    }

    const [[student]] = await db.query(
      `SELECT id, first_name, last_name, lrn FROM students
       WHERE id = ? AND grade_level = ? AND section = ? AND STATUS = 'active'`,
      [student_id, assessment.grade_level, assessment.section]
    );
    if (!student) {
      return res.status(400).json({ error: 'Student is not in this class roster.' });
    }

    const lrnOnFile = normalizeLrn(student.lrn);
    const lrnProvided = normalizeLrn(lrnBody);
    if (!lrnOnFile) {
      return res.status(403).json({
        error: 'No LRN on file for this student. Ask your teacher to add your LRN before opening this link.'
      });
    }
    if (!lrnProvided) {
      return res.status(400).json({
        error: 'Enter your 12-digit LRN to confirm your identity.'
      });
    }
    if (lrnProvided !== lrnOnFile) {
      return res.status(403).json({
        error: 'No LRN matched to your input. Please try again.'
      });
    }

    const [existing] = await db.query(
      `SELECT id FROM quiz_submissions WHERE assessment_id = ? AND student_id = ?`,
      [assessment.id, student_id]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'You already submitted this link.' });
    }

    const slot = attendanceSlotForAssessment(assessment);
    const roster = await loadAttendanceRoster(assessment.grade_level, assessment.section, slot);
    const row = roster.find((s) => Number(s.id) === Number(student_id));
    const makeupIds = parseMakeupIds(assessment.quiz_makeup_student_ids);
    const eligible = isStudentEligibleForQuiz({
      attendanceStatus: row?.attendance_status,
      submitted: false,
      makeupStudentIds: makeupIds,
      studentId: student_id,
      assessment
    });

    if (!row?.attendance_status) {
      return res.status(403).json({
        error: 'Attendance has not been recorded for you today. Ask your teacher to mark attendance first.'
      });
    }
    if (!eligible) {
      return res.status(403).json({
        error: quizBlockReason({
          attendanceStatus: row.attendance_status,
          eligible: false,
          submitted: false,
          assessment,
          makeupStudentIds: makeupIds,
          studentId: student_id
        }) || 'You are not allowed to open this link with your current attendance status.'
      });
    }

    const questions = await getAssessmentQuestions(assessment.id);
    if (!questions.length) {
      return res.status(400).json({ error: 'This link has no items yet.' });
    }

    for (const q of questions) {
      if (!isActivityItemType(q.item_type)) continue;
      const raw = answers[String(q.id)];
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
        student_id,
        token,
        JSON.stringify({ student_id, answers, detail, scored_at: new Date().toISOString() }),
        onlyActivity ? 0 : finalScore,
        recordMax
      ]
    );

    if (!onlyActivity) {
      const [scoreRow] = await db.query(
        `SELECT id FROM assessment_scores WHERE assessment_id = ? AND student_id = ?`,
        [assessment.id, student_id]
      );
      if (scoreRow.length) {
        await db.query(`UPDATE assessment_scores SET score = ? WHERE id = ?`, [
          finalScore,
          scoreRow[0].id
        ]);
      } else {
        await db.query(
          `INSERT INTO assessment_scores (assessment_id, student_id, score) VALUES (?, ?, ?)`,
          [assessment.id, student_id, finalScore]
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
        : 'Submitted. Your teacher can see your score in Progress.',
      score: onlyActivity ? null : finalScore,
      max_score: recordMax,
      pending_teacher_score: onlyActivity,
      student_name: `${student.last_name}, ${student.first_name}`
    });
  } catch (error) {
    console.error('Public quiz submit error:', error);
    if (error && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large (max 10 MB).' });
    }
    if (error && /PDF, Word file, or image/i.test(String(error.message || ''))) {
      return res.status(400).json({ error: error.message });
    }
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You already submitted this link.' });
    }
    res.status(500).json({ error: 'Server error submitting answers', details: error.message });
  }
});

module.exports = router;
