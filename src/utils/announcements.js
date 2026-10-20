const db = require('../../db');

let schemaPromise = null;

async function ensureAnnouncementAudience() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    try {
      await db.query(
        "ALTER TABLE announcements ADD COLUMN audience ENUM('teachers','parents','everyone') NOT NULL DEFAULT 'everyone'"
      );
    } catch (e) { /* exists */ }
    try {
      await db.query(
        "ALTER TABLE announcements MODIFY COLUMN audience ENUM('teachers','parents','everyone') NOT NULL DEFAULT 'everyone'"
      );
    } catch (e) {
      console.error('[announcements] audience enum:', e.message);
    }
  })();
  try {
    await schemaPromise;
  } catch (e) {
    schemaPromise = null;
    throw e;
  }
}

function normalizeAudience(value) {
  const v = String(value || 'everyone').toLowerCase();
  if (v === 'teachers' || v === 'teacher') return 'teachers';
  if (v === 'parents' || v === 'parent') return 'parents';
  return 'everyone';
}

function normalizeScope(value) {
  const s = String(value || 'school_wide');
  if (s === 'grade_wide' || s === 'class_specific') return s;
  return 'school_wide';
}

function announcementTargets({ scope, target_grade, target_section }) {
  const normalized = normalizeScope(scope);
  if (normalized === 'school_wide') {
    return { scope: normalized, target_grade: null, target_section: null };
  }
  const grade = target_grade === '' || target_grade == null ? null : parseInt(target_grade, 10);
  if (!grade) {
    const err = new Error('Target grade is required for this scope');
    err.status = 400;
    throw err;
  }
  if (normalized === 'grade_wide') {
    return { scope: normalized, target_grade: grade, target_section: null };
  }
  const section = String(target_section || '').trim().toUpperCase();
  if (!section) {
    const err = new Error('Target section is required for class-specific announcements');
    err.status = 400;
    throw err;
  }
  return { scope: normalized, target_grade: grade, target_section: section };
}

function audienceSql(role, alias = 'a') {
  if (role === 'parent') {
    return ` AND COALESCE(${alias}.audience, 'everyone') IN ('everyone', 'parents')`;
  }
  if (role === 'teacher') {
    return ` AND COALESCE(${alias}.audience, 'everyone') IN ('everyone', 'teachers')`;
  }
  return '';
}

function audienceLabel(audience) {
  const v = normalizeAudience(audience);
  if (v === 'teachers') return 'Teachers only';
  if (v === 'parents') return 'Parents only';
  return 'Parents & teachers';
}

ensureAnnouncementAudience().catch((e) => {
  console.error('[announcements] schema:', e.message);
});

module.exports = {
  ensureAnnouncementAudience,
  normalizeAudience,
  announcementTargets,
  audienceSql,
  audienceLabel
};
