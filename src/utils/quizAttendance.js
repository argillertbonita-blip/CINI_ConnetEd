const db = require('../../db');
const {
  ensureAttendanceSchema,
  manilaISODate,
  sqlDateToISO,
  isSubjectGrade,
  normalizeSession,
  currentManilaSession
} = require('./attendanceSchema');

const VALID_STATUSES = ['Present', 'Absent', 'Late', 'Excused'];
const LIVE_QUIZ_STATUSES = ['Present', 'Late'];
const MAKEUP_STATUSES = ['Absent', 'Excused'];

let schemaPromise = null;

async function ensureExcusedStatus(conn = db) {
  await ensureAttendanceSchema(conn);
  try {
    await conn.query(
      `ALTER TABLE attendance
       MODIFY COLUMN \`STATUS\` ENUM('Present','Absent','Late','Excused') NOT NULL`
    );
  } catch (e) {
    /* already migrated or unsupported — individual saves may still work if enum includes Excused */
  }
}

async function ensureQuizAttendanceSchema(conn = db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await ensureExcusedStatus(conn);
    const alters = [
      `ALTER TABLE assessments ADD COLUMN quiz_attendance_date DATE NULL`,
      `ALTER TABLE assessments ADD COLUMN quiz_attendance_session VARCHAR(2) NULL DEFAULT 'AM'`,
      `ALTER TABLE assessments ADD COLUMN quiz_subject_id INT NULL`,
      `ALTER TABLE assessments ADD COLUMN quiz_makeup_student_ids JSON NULL`,
      `ALTER TABLE assessments ADD COLUMN quiz_closes_at DATETIME NULL`,
      `ALTER TABLE assessments ADD COLUMN quiz_makeup_closes_at DATETIME NULL`,
      `ALTER TABLE assessments ADD COLUMN activity_mode VARCHAR(20) NULL`,
      `ALTER TABLE assessments ADD COLUMN activity_target_at DATETIME NULL`
    ];
    for (const sql of alters) {
      try {
        await conn.query(sql);
      } catch (e) { /* exists */ }
    }
  })().catch((e) => {
    schemaPromise = null;
    throw e;
  });
  return schemaPromise;
}

function parseMakeupIds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  } catch (_) { /* ignore */ }
  return [];
}

/** Coerce MySQL DATE / string to YYYY-MM-DD in Asia/Manila (no UTC day-shift). */
function coerceAttendanceDate(value) {
  if (value == null || value === '') return manilaISODate();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return manilaISODate(value);
  }
  const fromSql = sqlDateToISO(value);
  return fromSql || manilaISODate();
}

function attendanceSlotForAssessment(assessment, overrides = {}) {
  const grade = Number(assessment.grade_level);
  const subjectMode = isSubjectGrade(grade);
  const rawDate = overrides.date != null && overrides.date !== ''
    ? overrides.date
    : (assessment.quiz_attendance_date || manilaISODate());
  const date = coerceAttendanceDate(rawDate);
  const session = subjectMode
    ? 'AM'
    : currentManilaSession();
  const subjectId = subjectMode
    ? (overrides.subject_id != null ? Number(overrides.subject_id) : Number(assessment.quiz_subject_id || assessment.subject_id))
    : null;
  const subjectKey = subjectMode && subjectId ? subjectId : 0;
  return { date, session, subjectId, subjectKey, subjectMode };
}

async function loadAttendanceRoster(grade, section, slot) {
  const sectionNorm = String(section || '').trim();
  const [students] = await db.query(
    `SELECT s.id, s.lrn, s.first_name, s.last_name, s.gender,
            a.\`STATUS\` as attendance_status
     FROM students s
     LEFT JOIN attendance a
       ON s.id = a.student_id
      AND a.\`DATE\` = ?
      AND a.session = ?
      AND a.subject_key = ?
     WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'
     ORDER BY s.last_name, s.first_name`,
    [slot.date, slot.session, slot.subjectKey, grade, sectionNorm]
  );
  return students;
}

async function getAttendanceCompletion(grade, section, slot) {
  const students = await loadAttendanceRoster(grade, section, slot);
  const unmarked = students.filter((s) => !s.attendance_status);
  return {
    complete: students.length > 0 && unmarked.length === 0,
    total: students.length,
    unmarked: unmarked.map((s) => ({
      id: s.id,
      name: `${s.last_name}, ${s.first_name}`
    })),
    students
  };
}

function normalizeStatus(status) {
  const s = String(status || '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  return VALID_STATUSES.find((v) => v.toLowerCase() === lower) || s;
}

function isLiveQuizStatus(status) {
  const st = normalizeStatus(status);
  return LIVE_QUIZ_STATUSES.includes(st);
}

function isMakeupStatus(status) {
  const st = normalizeStatus(status);
  return MAKEUP_STATUSES.includes(st);
}

/** Asia/Manila wall-clock as `YYYY-MM-DD HH:mm:ss` for DATETIME compares. */
function formatManilaSqlDatetime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/** Normalize MySQL DATETIME / ISO / datetime-local → comparable Manila SQL string. */
function normalizeSqlDatetime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatManilaSqlDatetime(value);
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s) || /T\d{2}:\d{2}:\d{2}\.\d+Z$/.test(s)) {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) return formatManilaSqlDatetime(parsed);
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) {
    const cleaned = s.replace('T', ' ').replace(/\.\d+Z?$/, '').slice(0, 19);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(cleaned)) return `${cleaned}:00`;
    return cleaned;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 23:59:59`;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return formatManilaSqlDatetime(parsed);
  return null;
}

function isAtOrBeforeManila(deadline, now = new Date()) {
  const closeStr = normalizeSqlDatetime(deadline);
  if (!closeStr) return true; // no deadline = still open
  return formatManilaSqlDatetime(now) <= closeStr;
}

function isPastManila(deadline, now = new Date()) {
  return !isAtOrBeforeManila(deadline, now);
}

/**
 * Resolve live / make-up close times from assign-link body.
 * Accepts absolute closes_at or duration_minutes from "now".
 */
function resolveQuizWindowsFromBody(body = {}, now = new Date()) {
  const liveDuration = Number(body.live_duration_minutes);
  const makeupDuration = Number(body.makeup_duration_minutes);
  let quiz_closes_at = null;
  let quiz_makeup_closes_at = null;

  if (body.live_closes_at) {
    quiz_closes_at = normalizeSqlDatetime(body.live_closes_at);
  } else if (Number.isFinite(liveDuration) && liveDuration > 0) {
    quiz_closes_at = formatManilaSqlDatetime(new Date(now.getTime() + liveDuration * 60 * 1000));
  }

  if (body.makeup_closes_at) {
    quiz_makeup_closes_at = normalizeSqlDatetime(body.makeup_closes_at);
  } else if (Number.isFinite(makeupDuration) && makeupDuration > 0) {
    const base = quiz_closes_at
      ? new Date(`${String(quiz_closes_at).replace(' ', 'T')}+08:00`)
      : now;
    const baseMs = Number.isNaN(base.getTime()) ? now.getTime() : base.getTime();
    quiz_makeup_closes_at = formatManilaSqlDatetime(new Date(baseMs + makeupDuration * 60 * 1000));
  }

  return { quiz_closes_at, quiz_makeup_closes_at };
}

function getQuizAccessPhase(assessment, { attendanceStatus, makeupStudentIds, studentId, now = new Date() } = {}) {
  const makeupSet = new Set(parseMakeupIds(makeupStudentIds ?? assessment?.quiz_makeup_student_ids));
  const onMakeupList = makeupSet.has(Number(studentId));
  const liveOpen = isAtOrBeforeManila(assessment?.quiz_closes_at, now);
  const makeupOpen = isAtOrBeforeManila(assessment?.quiz_makeup_closes_at, now);

  if (onMakeupList && isMakeupStatus(attendanceStatus)) {
    if (assessment?.quiz_makeup_closes_at && !makeupOpen) return 'makeup_ended';
    return 'makeup';
  }
  if (isLiveQuizStatus(attendanceStatus)) {
    if (assessment?.quiz_closes_at && !liveOpen) return 'live_ended';
    return 'live';
  }
  if (isMakeupStatus(attendanceStatus)) return 'needs_makeup';
  return 'blocked';
}

function isStudentEligibleForQuiz({
  attendanceStatus,
  submitted,
  makeupStudentIds,
  studentId,
  assessment = null,
  now = new Date()
}) {
  if (submitted) return false;
  const phase = getQuizAccessPhase(assessment || {
    quiz_closes_at: null,
    quiz_makeup_closes_at: null,
    quiz_makeup_student_ids: makeupStudentIds
  }, { attendanceStatus, makeupStudentIds, studentId, now });
  return phase === 'live' || phase === 'makeup';
}

function quizBlockReason({
  attendanceStatus,
  eligible,
  submitted,
  assessment = null,
  makeupStudentIds,
  studentId,
  now = new Date()
}) {
  if (submitted) return 'You already submitted this link.';
  if (!attendanceStatus) {
    return 'Attendance has not been recorded for you yet. Ask your teacher to mark attendance first.';
  }
  if (eligible) return null;

  const phase = getQuizAccessPhase(assessment || {
    quiz_closes_at: null,
    quiz_makeup_closes_at: null,
    quiz_makeup_student_ids: makeupStudentIds
  }, { attendanceStatus, makeupStudentIds, studentId, now });

  if (phase === 'live_ended') {
    return 'The submission period for this link has ended.';
  }
  if (phase === 'makeup_ended') {
    return 'This link is no longer available. Please ask your teacher if you still need access.';
  }
  if (phase === 'needs_makeup' || ['Absent', 'Excused'].includes(String(attendanceStatus || ''))) {
    return 'This link is temporarily unavailable. Kindly request for access.';
  }
  return 'You are not allowed to open this link with your current attendance status.';
}

async function getSubmittedStudentIds(assessmentId) {
  const [rows] = await db.query(
    `SELECT student_id FROM quiz_submissions WHERE assessment_id = ?`,
    [assessmentId]
  );
  return new Set(rows.map((r) => Number(r.student_id)));
}

async function getMakeupCandidates(assessment) {
  const slot = attendanceSlotForAssessment(assessment);
  const students = await loadAttendanceRoster(assessment.grade_level, assessment.section, slot);
  const submittedSet = await getSubmittedStudentIds(assessment.id);
  return students
    .filter((s) => isMakeupStatus(s.attendance_status) && !submittedSet.has(s.id))
    .map((s) => ({
      id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      attendance_status: s.attendance_status
    }));
}

module.exports = {
  VALID_STATUSES,
  LIVE_QUIZ_STATUSES,
  MAKEUP_STATUSES,
  ensureQuizAttendanceSchema,
  ensureExcusedStatus,
  parseMakeupIds,
  attendanceSlotForAssessment,
  currentManilaSession,
  loadAttendanceRoster,
  getAttendanceCompletion,
  normalizeStatus,
  isLiveQuizStatus,
  isMakeupStatus,
  formatManilaSqlDatetime,
  normalizeSqlDatetime,
  isAtOrBeforeManila,
  isPastManila,
  resolveQuizWindowsFromBody,
  getQuizAccessPhase,
  isStudentEligibleForQuiz,
  quizBlockReason,
  getSubmittedStudentIds,
  getMakeupCandidates
};
