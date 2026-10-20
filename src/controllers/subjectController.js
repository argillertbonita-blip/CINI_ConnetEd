const db = require('../../db');
const { ensureSoftDeleteSchema } = require('../utils/softDeleteSchema');

function cleanText(value) {
  return String(value ?? '').trim();
}

async function subjectNameTaken(name, excludeId = null) {
  const params = [name];
  let sql = 'SELECT id FROM subjects WHERE LOWER(TRIM(NAME)) = LOWER(?)';
  if (excludeId != null) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';
  const [rows] = await db.query(sql, params);
  return rows.length > 0;
}

async function ensureSubjectNameUnique() {
  try {
    const [idx] = await db.query(
      "SHOW INDEX FROM subjects WHERE Key_name = 'uq_subjects_name'"
    );
    if (idx.length) return;
    await db.query('ALTER TABLE subjects ADD UNIQUE KEY uq_subjects_name (NAME)');
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME' || error.errno === 1061) return;
    console.error('[subjects] unique name index:', error.message);
  }
}

function duplicateSubjectMessage(error) {
  const msg = String(error.sqlMessage || error.message || '');
  if (/uq_subjects_name/i.test(msg)) return 'Subject name already exists';
  return 'Subject code already exists';
}

exports.getSubjects = async (req, res) => {
  try {
    await ensureSoftDeleteSchema();
    const [subjects] = await db.query(
      `SELECT id, CODE AS code, NAME AS name, description, applicable_grades
       FROM subjects
       WHERE deleted_at IS NULL
       ORDER BY CODE`
    );
    res.json(subjects);
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({error: 'Server error'});
  }
};

exports.createSubject = async (req, res) => {
  try {
    await ensureSubjectNameUnique();
    const code = cleanText(req.body.code).toUpperCase();
    const name = cleanText(req.body.name);
    const description = cleanText(req.body.description) || null;
    const applicable_grades = cleanText(req.body.applicable_grades) || null;
    if (!code || !name) return res.status(400).json({ error: 'Code and name are required' });

    const [codeRows] = await db.query('SELECT id FROM subjects WHERE CODE = ? LIMIT 1', [code]);
    if (codeRows.length) return res.status(409).json({ error: 'Subject code already exists' });
    if (await subjectNameTaken(name)) return res.status(409).json({ error: 'Subject name already exists' });

    await db.query(
      "INSERT INTO subjects (CODE, NAME, description, applicable_grades) VALUES (?, ?, ?, ?)",
      [code, name, description, applicable_grades]
    );
    res.status(201).json({ message: 'Subject added' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: duplicateSubjectMessage(error) });
    console.error('Create subject error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    await ensureSubjectNameUnique();
    const { id } = req.params;
    const name = cleanText(req.body.name);
    const description = cleanText(req.body.description) || null;
    const applicable_grades = cleanText(req.body.applicable_grades) || null;
    if (!name) return res.status(400).json({ error: 'Subject name is required' });
    if (await subjectNameTaken(name, id)) {
      return res.status(409).json({ error: 'Subject name already exists' });
    }

    await db.query(
      "UPDATE subjects SET NAME = ?, description = ?, applicable_grades = ? WHERE id = ?",
      [name, description, applicable_grades, id]
    );
    res.json({ message: 'Subject updated' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Subject name already exists' });
    console.error('Update subject error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    await ensureSoftDeleteSchema();
    const { id } = req.params;

    const [[used]] = await db.query(
      `SELECT COUNT(*) as count FROM teacher_assignments WHERE subject_id = ?`,
      [id]
    );
    if (used.count > 0) {
      return res.status(409).json({ error: 'Cannot delete: subject is assigned to teachers' });
    }

    const [result] = await db.query(
      `UPDATE subjects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (!result.affectedRows) {
      const [rows] = await db.query('SELECT id FROM subjects WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Subject not found' });
      return res.json({ message: 'Subject already removed' });
    }
    res.json({ message: 'Subject removed' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};