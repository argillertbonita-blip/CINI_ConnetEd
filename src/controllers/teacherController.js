const db = require('../../db');
const { schoolYear } = require('../config');

// Helper: try to get teacher info from either table naming convention
async function getTeacherInfo(teacherId) {
  // Try teacher_profiles first (admin side naming)
  let [profiles] = await db.query(
    'SELECT homeroom_grade, homeroom_section FROM teacher_profiles WHERE user_id = ?',
    [teacherId]
  );
  if (profiles.length > 0) {
    return {
      isHomeroom: !!profiles[0].homeroom_grade,
      homeroom_grade: profiles[0].homeroom_grade,
      homeroom_section: profiles[0].homeroom_section,
      source: 'teacher_profiles'
    };
  }

  // Fallback to teachers table (original naming)
  let [teachers] = await db.query(
    'SELECT teaching_mode FROM teachers WHERE user_id = ?',
    [teacherId]
  );
  if (teachers.length > 0) {
    return {
      isHomeroom: teachers[0].teaching_mode === 'homeroom',
      teaching_mode: teachers[0].teaching_mode,
      source: 'teachers'
    };
  }

  return null;
}

// Helper: get subject assignments from either table
async function getSubjectAssignments(teacherId) {
  // Try teacher_assignments first (admin side)
  try {
    const [rows] = await db.query(
      `SELECT grade_level, section, subject_id FROM teacher_assignments WHERE teacher_id = ?`,
      [teacherId]
    );
    if (rows.length > 0) return rows;
  } catch (e) { /* table might not exist */ }

  // Fallback to subject_assignments (original)
  try {
    const [rows] = await db.query(
      `SELECT grade_level, section, subject_id FROM subject_assignments WHERE teacher_id = ?`,
      [teacherId]
    );
    if (rows.length > 0) return rows;
  } catch (e) { /* table might not exist */ }

  return [];
}

// GET /api/teacher/classes
exports.getClasses = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const info = await getTeacherInfo(teacherId);

    if (!info) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    let classes = [];

    if (info.isHomeroom) {
      const [rows] = await db.query(
        `SELECT DISTINCT s.grade_level, s.section,
          NULL as subject_id, NULL as subject_name
         FROM students s
         WHERE s.homeroom_teacher_id = ? AND s.status = 'active'
         ORDER BY s.grade_level, s.section`,
        [teacherId]
      );
      classes = rows.map(r => ({ ...r, display_name: `Grade ${r.grade_level}-${r.section} (Homeroom)` }));
    } else {
      // Subject teacher
      let sql = `SELECT DISTINCT sa.grade_level, sa.section, sa.subject_id, sub.name as subject_name
         FROM `;
      // Try both table names
      let rows = [];
      try {
        [rows] = await db.query(
          `SELECT DISTINCT ta.grade_level, ta.section, ta.subject_id, sub.name as subject_name
           FROM teacher_assignments ta
           JOIN subjects sub ON ta.subject_id = sub.id
           WHERE ta.teacher_id = ?
           ORDER BY ta.grade_level, ta.section`,
          [teacherId]
        );
      } catch (e) {
        [rows] = await db.query(
          `SELECT DISTINCT sa.grade_level, sa.section, sa.subject_id, sub.name as subject_name
           FROM subject_assignments sa
           JOIN subjects sub ON sa.subject_id = sub.id
           WHERE sa.teacher_id = ?
           ORDER BY sa.grade_level, sa.section`,
          [teacherId]
        );
      }
      classes = rows.map(r => ({
        ...r,
        display_name: `Grade ${r.grade_level}-${r.section} (${r.subject_name})`
      }));
    }

    res.json(classes);
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Server error fetching classes', details: error.message });
  }
};

// GET /api/teacher/roster/:grade/:section
exports.getRoster = async (req, res) => {
  try {
    const { grade, section } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const [students] = await db.query(
      `SELECT s.id, s.lrn, s.first_name, s.last_name, s.gender,
        pr.attendance as attendance_status
       FROM students s
       LEFT JOIN progress_records pr ON s.id = pr.student_id AND pr.record_date = ?
       WHERE s.grade_level = ? AND s.section = ? AND s.status = 'active'
       ORDER BY s.last_name, s.first_name`,
      [today, grade, section]
    );
    res.json(students);
  } catch (error) {
    console.error('Get roster error:', error);
    res.status(500).json({ error: 'Server error fetching roster', details: error.message });
  }
};

// POST /api/teacher/attendance
exports.saveAttendance = async (req, res) => {
  try {
    const { student_id, status } = req.body;
    const teacherId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const normalizedStatus = status.toLowerCase();
    if (!['present', 'absent', 'late', 'excused'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Status must be Present, Absent, Late, or Excused' });
    }

    const [existing] = await db.query(
      'SELECT id FROM progress_records WHERE student_id = ? AND record_date = ?',
      [student_id, today]
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE progress_records
         SET attendance = ?, teacher_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [normalizedStatus, teacherId, existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO progress_records
         (student_id, teacher_id, record_date, attendance, quarter, school_year)
         VALUES (?, ?, ?, ?, 'Q1', '${schoolYear}')`,
        [student_id, teacherId, today, normalizedStatus]
      );
    }

    res.json({ message: 'Attendance recorded' });
  } catch (error) {
    console.error('Save attendance error:', error);
    res.status(500).json({ error: 'Server error saving attendance', details: error.message });
  }
};

// GET /api/teacher/stats/:grade/:section
exports.getClassStats = async (req, res) => {
  try {
    const { grade, section } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const [[total]] = await db.query(
      `SELECT COUNT(*) as count FROM students WHERE grade_level = ? AND section = ? AND status = 'active'`,
      [grade, section]
    );

    const [[present]] = await db.query(
      `SELECT COUNT(*) as count FROM progress_records pr
       JOIN students s ON pr.student_id = s.id
       WHERE s.grade_level = ? AND s.section = ? AND pr.record_date = ? AND pr.attendance = 'present'`,
      [grade, section, today]
    );

    const [[absent]] = await db.query(
      `SELECT COUNT(*) as count FROM progress_records pr
       JOIN students s ON pr.student_id = s.id
       WHERE s.grade_level = ? AND s.section = ? AND pr.record_date = ? AND pr.attendance = 'absent'`,
      [grade, section, today]
    );

    const [[late]] = await db.query(
      `SELECT COUNT(*) as count FROM progress_records pr
       JOIN students s ON pr.student_id = s.id
       WHERE s.grade_level = ? AND s.section = ? AND pr.record_date = ? AND pr.attendance = 'late'`,
      [grade, section, today]
    );

    res.json({
      total: total.count,
      present: present.count,
      absent: absent.count,
      late: late.count,
      date: today
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error fetching stats', details: error.message });
  }
};

// GET /api/teacher/inbox
exports.getTeacherInbox = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Get teacher's assignments (try both table conventions)
    let profileRows = [];
    let assignmentRows = [];

    try {
      [profileRows] = await db.query(
        `SELECT homeroom_grade, homeroom_section FROM teacher_profiles WHERE user_id = ?`,
        [teacherId]
      );
    } catch (e) { /* table might not exist */ }

    if (profileRows.length === 0) {
      try {
        const [teachers] = await db.query(
          `SELECT teaching_mode FROM teachers WHERE user_id = ?`,
          [teacherId]
        );
        if (teachers.length > 0 && teachers[0].teaching_mode === 'homeroom') {
          // Try to infer homeroom from students
          const [homeroom] = await db.query(
            `SELECT DISTINCT grade_level, section FROM students WHERE homeroom_teacher_id = ? AND status = 'active' LIMIT 1`,
            [teacherId]
          );
          if (homeroom.length > 0) {
            profileRows = [{ homeroom_grade: homeroom[0].grade_level, homeroom_section: homeroom[0].section }];
          }
        }
      } catch (e) { /* */ }
    }

    try {
      [assignmentRows] = await db.query(
        `SELECT grade_level, section FROM teacher_assignments WHERE teacher_id = ?`,
        [teacherId]
      );
    } catch (e) {
      try {
        [assignmentRows] = await db.query(
          `SELECT grade_level, section FROM subject_assignments WHERE teacher_id = ?`,
          [teacherId]
        );
      } catch (e2) { /* */ }
    }

    // Build sets of grades and grade-section combos this teacher handles
    const teacherGrades = new Set();
    const teacherClasses = new Set();

    if (profileRows.length > 0) {
      if (profileRows[0].homeroom_grade) teacherGrades.add(String(profileRows[0].homeroom_grade));
      if (profileRows[0].homeroom_grade && profileRows[0].homeroom_section) {
        teacherClasses.add(`${profileRows[0].homeroom_grade}-${profileRows[0].homeroom_section}`);
      }
    }

    assignmentRows.forEach(a => {
      if (a.grade_level) teacherGrades.add(String(a.grade_level));
      if (a.grade_level && a.section) teacherClasses.add(`${a.grade_level}-${a.section}`);
    });

    const gradeList = Array.from(teacherGrades);
    const classList = Array.from(teacherClasses);

    // --- FETCH RELEVANT ANNOUNCEMENTS ---
    let announcementSql = `
      SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name
      FROM announcements a
      JOIN users u ON a.sender_id = u.id
      WHERE a.scope = 'school_wide'
    `;
    const annParams = [];

    if (gradeList.length > 0) {
      announcementSql += ` OR (a.scope = 'grade_wide' AND a.target_grade IN (${gradeList.map(() => '?').join(',')}))`;
      annParams.push(...gradeList);
    }

    if (classList.length > 0) {
      const classConditions = classList.map(() => '(a.target_grade = ? AND a.target_section = ?)');
      announcementSql += ` OR (a.scope = 'class_specific' AND (${classConditions.join(' OR ')}))`;
      classList.forEach(cls => {
        const [g, sec] = cls.split('-');
        annParams.push(g, sec);
      });
    }

    announcementSql += ` ORDER BY a.created_at DESC`;
    const [announcements] = await db.query(announcementSql, annParams);

    // --- FETCH RELEVANT CONCERNS ---
    let concernSql = `
      SELECT c.*,
        CONCAT(p.first_name, ' ', p.last_name) as parent_name,
        CONCAT(s.first_name, ' ', s.last_name) as student_name,
        s.grade_level, s.section
      FROM concerns c
      JOIN users p ON c.parent_id = p.id
      JOIN students s ON c.student_id = s.id
      WHERE c.status != 'closed'
        AND (
          s.homeroom_teacher_id = ?
    `;
    const concernParams = [teacherId];

    if (assignmentRows.length > 0) {
      const conds = assignmentRows.map(() => '(s.grade_level = ? AND s.section = ?)');
      concernSql += ` OR ${conds.join(' OR ')}`;
      assignmentRows.forEach(a => {
        concernParams.push(a.grade_level, a.section);
      });
    }

    concernSql += `) ORDER BY c.created_at DESC`;
    const [concerns] = await db.query(concernSql, concernParams);

    res.json({ announcements, concerns });

  } catch (error) {
    console.error('Get teacher inbox error:', error);
    res.status(500).json({ error: 'Server error fetching inbox', details: error.message });
  }
};