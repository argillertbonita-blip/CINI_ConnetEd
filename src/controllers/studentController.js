const db = require('../../db');
const { schoolYear } = require('../config');
const { plainText } = require('../utils/plainText');
const { ensureSoftDeleteSchema } = require('../utils/softDeleteSchema');
const { ensureAssignmentSlots } = require('../utils/teachingMode');
const { sendStudentCredentials } = require('../utils/mail');
const {
  ensureStudentLoginSchema,
  createStudentLogin,
  setStudentLoginStatus
} = require('../utils/studentAccount');

function studentError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeGender(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'm' || s === 'male') return 'M';
  if (s === 'f' || s === 'female') return 'F';
  throw studentError(400, 'Gender must be M or F');
}

async function enrollStudentRecord(body, { linkHomeroom = true } = {}) {
  const {
    lrn, first_name, middle_name, last_name, grade_level, section,
    dob, date_of_birth, gender, parent_id, homeroom_teacher_id
  } = body || {};
  const dobValue = dob || date_of_birth || null;

  const firstName = plainText(first_name);
  const middleName = plainText(middle_name);
  const lastName = plainText(last_name);
  if (!firstName || !lastName || !grade_level || !section) {
    throw studentError(400, 'First name, last name, grade, and section are required');
  }

  const lrnText = lrn != null && String(lrn).trim() !== '' ? String(lrn).trim() : '';
  if (lrnText && !/^\d{12}$/.test(lrnText)) {
    throw studentError(400, 'LRN must be exactly 12 digits');
  }
  if (lrnText) {
    const [existing] = await db.query('SELECT id FROM students WHERE lrn = ?', [lrnText]);
    if (existing.length > 0) throw studentError(409, 'LRN already exists');
  }

  if (!parent_id) {
    throw studentError(400, 'Select a parent so the login can be emailed.');
  }

  await ensureStudentLoginSchema();
  const genderValue = normalizeGender(gender);
  const conn = await db.getConnection();
  let studentId;
  let username;
  let temporaryPassword;
  let parentRow;
  try {
    await conn.beginTransaction();
    const [[parent]] = await conn.query(
      `SELECT id, first_name, last_name, email
       FROM users
       WHERE id = ? AND role = 'parent' AND STATUS = 'active'
       LIMIT 1`,
      [parent_id]
    );
    if (!parent || !String(parent.email || '').trim()) {
      throw studentError(400, 'Select a parent who has an email address.');
    }
    parentRow = parent;

    if (lrnText) {
      const [existing] = await conn.query('SELECT id FROM students WHERE lrn = ?', [lrnText]);
      if (existing.length > 0) throw studentError(409, 'LRN already exists');
    }

    const [result] = await conn.query(
      `INSERT INTO students (lrn, first_name, middle_name, last_name, grade_level, section, dob, gender, STATUS)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [lrnText || null, firstName, middleName || null, lastName, grade_level, section, dobValue || null, genderValue]
    );
    studentId = result.insertId;
    await conn.query(
      'INSERT INTO parent_student_links (parent_id, student_id) VALUES (?, ?)',
      [parent_id, studentId]
    );
    const login = await createStudentLogin(conn, { firstName, lastName, studentId });
    username = login.username;
    temporaryPassword = login.password;
    await conn.commit();
  } catch (error) {
    try { await conn.rollback(); } catch (_) { /* already closed */ }
    throw error;
  } finally {
    conn.release();
  }

  if (linkHomeroom && homeroom_teacher_id) {
    try {
      await ensureAdviserSlot(homeroom_teacher_id, grade_level, section);
    } catch (error) {
      console.error('Enroll homeroom link:', error.message);
    }
  }

  const parentName = `${parentRow.first_name || ''} ${parentRow.last_name || ''}`.trim();
  const studentName = `${firstName} ${lastName}`.trim();
  const mail = await sendStudentCredentials({
    parentEmail: parentRow.email,
    parentName,
    studentName,
    username,
    password: temporaryPassword
  });

  return {
    studentId,
    username,
    mailSent: !!mail.sent,
    mailError: mail.sent ? null : (mail.error || 'The sign-in email was not sent.'),
    temporaryPassword: mail.sent ? null : temporaryPassword
  };
}

// POST /api/admin/students
exports.createStudent = async (req, res) => {
  try {
    const enrolled = await enrollStudentRecord(req.body);
    const message = enrolled.mailSent
      ? 'Student enrolled. Sign-in details were emailed to the parent.'
      : 'Student enrolled, but the email was not sent. Give the parent this temporary password.';
    res.status(201).json({
      message,
      studentId: enrolled.studentId,
      username: enrolled.username,
      mailSent: enrolled.mailSent,
      mailError: enrolled.mailError,
      temporaryPassword: enrolled.temporaryPassword || undefined
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Create student error:', error);
    res.status(status).json({ error: error.message || 'Server error enrolling student' });
  }
};

exports.bulkEnrollStudents = async (req, res) => {
  try {
    const { parseUpload } = require('../utils/tabularUpload');
    const rows = await parseUpload(req.file);
    if (!rows.length) return res.status(400).json({ error: 'The file has no data rows' });

    const failed = [];
    const mailFailed = [];
    let created = 0;
    let emailed = 0;
    for (const row of rows) {
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ');
      try {
        const parentEmail = String(row.parent_email || '').trim();
        if (!parentEmail) {
          throw studentError(400, 'parent_email is required so the login can be emailed.');
        }
        const [parents] = await db.query(
          `SELECT id FROM users WHERE email = ? AND role = 'parent' AND STATUS = 'active' LIMIT 1`,
          [parentEmail]
        );
        if (!parents.length) throw studentError(400, `No active parent account for ${parentEmail}`);
        const enrolled = await enrollStudentRecord({
          lrn: row.lrn,
          first_name: row.first_name,
          middle_name: row.middle_name,
          last_name: row.last_name,
          grade_level: row.grade_level,
          section: row.section,
          dob: row.dob,
          gender: row.gender,
          parent_id: parents[0].id
        }, { linkHomeroom: false });
        created += 1;
        if (enrolled.mailSent) emailed += 1;
        else {
          mailFailed.push({
            row: row.__row,
            name,
            username: enrolled.username,
            temporaryPassword: enrolled.temporaryPassword,
            error: enrolled.mailError || 'The sign-in email was not sent.'
          });
        }
      } catch (error) {
        failed.push({
          row: row.__row,
          name,
          error: error.status ? error.message : 'Server error enrolling student'
        });
      }
    }
    res.json({ created, failed, emailed, mail_failed: mailFailed });
  } catch (error) {
    console.error('Bulk enroll students error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Server error importing students' });
  }
};

async function ensureAdviserSlot(teacherId, gradeLevel, section) {
  await ensureAssignmentSlots();
  const [existing] = await db.query(
    `SELECT id FROM teacher_assignments
     WHERE teacher_id = ? AND grade_level = ?
       AND TRIM(UPPER(section)) = TRIM(UPPER(?))
       AND subject_id IS NULL AND slot = 'adviser' AND school_year = ?
     LIMIT 1`,
    [teacherId, gradeLevel, section, schoolYear]
  );
  if (existing.length) return;
  await db.query(
    `INSERT INTO teacher_assignments (teacher_id, grade_level, section, school_year, slot)
     VALUES (?, ?, ?, ?, 'adviser')`,
    [teacherId, gradeLevel, section, schoolYear]
  );
}

exports.getStudents = async (req, res) => {
  try {
    await ensureSoftDeleteSchema();
    await ensureAssignmentSlots();
    const [students] = await db.query(
      `SELECT s.id, s.lrn, s.first_name, s.middle_name, s.last_name, s.grade_level, s.section, s.gender, s.dob, s.STATUS as status,
        MAX(psl.parent_id) as parent_id,
        MAX(p.first_name) as parent_first, MAX(p.last_name) as parent_last,
        MAX(t.first_name) as teacher_first, MAX(t.last_name) as teacher_last
       FROM students s
       LEFT JOIN parent_student_links psl ON s.id = psl.student_id
       LEFT JOIN users p ON psl.parent_id = p.id
       LEFT JOIN (
         SELECT teacher_id, grade_level, section
         FROM teacher_assignments
         WHERE subject_id IS NULL AND slot = 'adviser' AND school_year = '${schoolYear}'
       ) ta ON s.grade_level = ta.grade_level AND s.section = ta.section
       LEFT JOIN users t ON ta.teacher_id = t.id
       WHERE s.deleted_at IS NULL
       GROUP BY s.id, s.lrn, s.first_name, s.middle_name, s.last_name, s.grade_level, s.section, s.gender, s.dob, s.STATUS
       ORDER BY s.grade_level, s.section, s.last_name`
    );
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Server error fetching students' });
  }
};

// PUT /api/admin/students/:id
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      lrn,
      first_name,
      middle_name,
      last_name,
      status,
      grade_level,
      section,
      gender,
      dob,
      date_of_birth,
      parent_id,
      homeroom_teacher_id
    } = req.body;

    const dobValue = dob || date_of_birth || null;
    const sectionNorm = section != null ? String(section).trim() : null;
    const isReenroll = grade_level != null && sectionNorm;

    const firstName = plainText(first_name);
    const middleName = plainText(middle_name);
    const lastName = plainText(last_name);
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    if (isReenroll && (!grade_level || !sectionNorm)) {
      return res.status(400).json({ error: 'Grade level and section are required for re-enrollment' });
    }

    await ensureSoftDeleteSchema();
    const [existingStudent] = await db.query(
      'SELECT id, deleted_at FROM students WHERE id = ?',
      [id]
    );
    if (!existingStudent.length || existingStudent[0].deleted_at) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Validate LRN if provided
    if (lrn && !/^\d{12}$/.test(lrn)) {
      return res.status(400).json({ error: 'LRN must be exactly 12 digits' });
    }

    // Check duplicate LRN (exclude self)
    if (lrn) {
      const [existing] = await db.query('SELECT id FROM students WHERE lrn = ? AND id != ?', [lrn, id]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'LRN already exists' });
      }
    }

    if (isReenroll) {
      await db.query(
        `UPDATE students SET lrn = ?, first_name = ?, middle_name = ?, last_name = ?,
         grade_level = ?, section = ?, dob = ?, gender = ?, STATUS = ?
         WHERE id = ?`,
        [
          lrn || null,
          firstName,
          middleName || null,
          lastName,
          grade_level,
          sectionNorm,
          dobValue || null,
          gender || null,
          status || 'active',
          id
        ]
      );

      await db.query('DELETE FROM parent_student_links WHERE student_id = ?', [id]);
      if (parent_id) {
        await db.query(
          'INSERT INTO parent_student_links (parent_id, student_id) VALUES (?, ?)',
          [parent_id, id]
        );
      }

      if (homeroom_teacher_id) {
        await ensureAdviserSlot(homeroom_teacher_id, grade_level, sectionNorm);
      }
    } else {
      if (parent_id) {
        const [links] = await db.query(
          'SELECT parent_id FROM parent_student_links WHERE student_id = ?',
          [id]
        );
        if (links.length) {
          const already = links.some((row) => Number(row.parent_id) === Number(parent_id));
          if (!already) {
            return res.status(409).json({ error: 'Student is already linked to a parent' });
          }
        } else {
          const [parents] = await db.query(
            `SELECT id FROM users WHERE id = ? AND role = 'parent' AND STATUS = 'active'`,
            [parent_id]
          );
          if (!parents.length) {
            return res.status(400).json({ error: 'Select a registered parent account' });
          }
        }
      }

      await db.query(
        `UPDATE students SET lrn = ?, first_name = ?, middle_name = ?, last_name = ?
         WHERE id = ?`,
        [lrn || null, firstName, middleName || null, lastName, id]
      );

      if (parent_id) {
        const [links] = await db.query(
          'SELECT id FROM parent_student_links WHERE student_id = ? AND parent_id = ?',
          [id, parent_id]
        );
        if (!links.length) {
          await db.query(
            'INSERT INTO parent_student_links (parent_id, student_id) VALUES (?, ?)',
            [parent_id, id]
          );
        }
      }
    }

    res.json({ message: isReenroll ? 'Student re-enrolled successfully' : 'Student updated successfully' });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Server error updating student' });
  }
};

// PATCH /api/admin/students/:id/status
exports.updateStudentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or inactive' });
    }

    await ensureSoftDeleteSchema();
    const [result] = await db.query(
      'UPDATE students SET STATUS = ? WHERE id = ? AND deleted_at IS NULL',
      [status, id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Student not found' });
    }
    await setStudentLoginStatus(id, status);
    res.json({ message: `Student ${status === 'active' ? 're-enrolled' : 'unenrolled'} successfully` });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Server error updating status' });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    await ensureSoftDeleteSchema();
    const { id } = req.params;
    const [result] = await db.query(
      `UPDATE students
       SET deleted_at = CURRENT_TIMESTAMP, \`STATUS\` = 'inactive'
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (!result.affectedRows) {
      const [rows] = await db.query('SELECT id FROM students WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Student not found' });
      return res.json({ message: 'Student already removed' });
    }
    await setStudentLoginStatus(id, 'inactive');
    res.json({ message: 'Student removed. Attendance and scores were kept.' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Server error deleting student' });
  }
};

exports.getSectionsByGrade = async (req, res) => {
  try {
    const { grade } = req.params;
    const [rows] = await db.query(
      `SELECT DISTINCT section FROM teacher_assignments 
       WHERE grade_level = ? AND school_year = '${schoolYear}'
       ORDER BY section`,
      [grade]
    );
    res.json(rows.map(r => r.section));
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ error: 'Server error fetching sections' });
  }
};

exports.getParents = async (req, res) => {
  try {
    const [parents] = await db.query(
      `SELECT id, first_name, last_name, email, phone FROM users WHERE role = 'parent' AND STATUS = 'active' ORDER BY last_name`
    );
    res.json(parents);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching parents' });
  }
};

exports.getTeachers = async (req, res) => {
  try {
    const [teachers] = await db.query(
      `SELECT id, first_name, last_name, email FROM users WHERE role = 'teacher' AND STATUS = 'active' ORDER BY last_name`
    );
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching teachers' });
  }
};