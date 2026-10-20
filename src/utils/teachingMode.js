const db = require('../../db');

const MODE_VALUES = ['homeroom', 'subject', 'class_adviser', 'subject_teacher', 'both'];

let schemaPromise = null;
let slotSchemaPromise = null;

async function ensureTeachingModeEnum(conn = db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    try {
      await conn.query(
        `ALTER TABLE teacher_profiles
         MODIFY COLUMN teaching_mode
         ENUM('homeroom','subject','class_adviser','subject_teacher','both')
         DEFAULT 'homeroom'`
      );
    } catch (e) {
      console.error('[teachingMode] enum migrate:', e.message);
    }
    try {
      await conn.query(
        `UPDATE teacher_profiles
         SET teaching_mode = 'homeroom'
         WHERE teaching_mode IS NULL OR teaching_mode = ''`
      );
    } catch (e) {
      console.error('[teachingMode] backfill empty:', e.message);
    }
  })();
  return schemaPromise;
}

/** Adds teacher_assignments.slot and teacher_profiles.homeroom_role when missing. */
async function ensureAssignmentSlots(conn = db) {
  if (slotSchemaPromise) return slotSchemaPromise;
  slotSchemaPromise = (async () => {
    try {
      const [cols] = await conn.query(
        `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND (
             (TABLE_NAME = 'teacher_assignments' AND COLUMN_NAME = 'slot')
             OR (TABLE_NAME = 'teacher_profiles' AND COLUMN_NAME = 'homeroom_role')
           )`
      );
      const have = new Set(cols.map((c) => `${c.TABLE_NAME}.${c.COLUMN_NAME}`));
      if (!have.has('teacher_assignments.slot')) {
        await conn.query(
          `ALTER TABLE teacher_assignments
           ADD COLUMN slot ENUM('adviser','assistant','subject') NOT NULL DEFAULT 'subject'`
        );
        await conn.query(
          `UPDATE teacher_assignments SET slot = 'adviser' WHERE subject_id IS NULL`
        );
      }
      if (!have.has('teacher_profiles.homeroom_role')) {
        await conn.query(
          `ALTER TABLE teacher_profiles
           ADD COLUMN homeroom_role ENUM('adviser','assistant') NULL DEFAULT NULL`
        );
        await conn.query(
          `UPDATE teacher_profiles
           SET homeroom_role = 'adviser'
           WHERE homeroom_role IS NULL
             AND homeroom_grade IS NOT NULL
             AND homeroom_section IS NOT NULL
             AND TRIM(homeroom_section) <> ''`
        );
      }
    } catch (error) {
      slotSchemaPromise = null;
      throw error;
    }
  })();
  return slotSchemaPromise;
}

function homeSlotOf(rows) {
  return (rows || []).find((row) => row.subject_id == null) || null;
}

function isOutsideSubjectRow(row, home) {
  if (row.subject_id == null) return false;
  if (!home) return true;
  const sameClass = Number(row.grade_level) === Number(home.grade_level)
    && String(row.section || '').trim().toUpperCase() === String(home.section || '').trim().toUpperCase();
  return !sameClass;
}

async function syncTeachingModeFromAssignments(conn, teacherId) {
  await ensureTeachingModeEnum(conn);
  await ensureAssignmentSlots(conn);
  const { schoolYear } = require('../config');
  const [rows] = await conn.query(
    `SELECT subject_id, grade_level, section, slot
     FROM teacher_assignments
     WHERE teacher_id = ? AND school_year = ?`,
    [teacherId, schoolYear]
  );
  const home = homeSlotOf(rows);
  const outsideCount = rows.filter((row) => isOutsideSubjectRow(row, home)).length;
  const teaching_mode = resolveTeachingMode({
    hasClassAdviser: !!home,
    hasSubjectTeacher: outsideCount > 0,
    subjectCount: outsideCount
  });
  const homeroomRole = home
    ? (home.slot === 'assistant' ? 'assistant' : 'adviser')
    : null;
  await conn.query(
    `UPDATE teacher_profiles
     SET teaching_mode = ?,
         homeroom_grade = ?,
         homeroom_section = ?,
         homeroom_role = ?
     WHERE user_id = ?`,
    [
      teaching_mode,
      home?.grade_level || null,
      home?.section || null,
      homeroomRole,
      teacherId
    ]
  );
  return teaching_mode;
}

function resolveTeachingMode({ hasClassAdviser, hasSubjectTeacher, subjectCount }) {
  const hasSubjects = Number(subjectCount) > 0 || hasSubjectTeacher;
  if (hasClassAdviser && hasSubjects) return 'both';
  if (hasClassAdviser) return 'class_adviser';
  if (hasSubjects) return 'subject_teacher';
  return 'homeroom';
}

function teachingModeLabel(mode, homeroomRole) {
  const m = String(mode || '').toLowerCase();
  const home = String(homeroomRole || '').toLowerCase() === 'assistant'
    ? 'Assistant Teacher'
    : 'Class Adviser';
  if (m === 'both') return `${home} & Subject Teacher`;
  if (m === 'class_adviser' || m === 'homeroom') return home;
  if (m === 'subject_teacher' || m === 'subject') return 'Subject Teacher';
  return 'Not set';
}

module.exports = {
  MODE_VALUES,
  ensureTeachingModeEnum,
  ensureAssignmentSlots,
  resolveTeachingMode,
  teachingModeLabel,
  syncTeachingModeFromAssignments,
  homeSlotOf,
  isOutsideSubjectRow
};
