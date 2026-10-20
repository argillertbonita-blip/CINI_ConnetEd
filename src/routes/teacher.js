const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { schoolYear } = require('../config');
const db = require('../../db');
const {
  attachReplies,
  attachConcernReadState,
  markConcernRead,
  markConcernReadForParticipants,
  addConcernReply
} = require('../utils/concernReplies');
const { announcementTargets, ensureAnnouncementAudience, audienceSql } = require('../utils/announcements');
const { ensureInboxTrash, trashExcludeSql, teacherHandlesConcern } = require('../utils/inboxTrash');
const { isQuarterUnlocked, getCurrentQuarter, normalizeQuarter } = require('../utils/schoolSettings');
const { ensurePortalClassworkSchema } = require('../utils/portalClasswork');
const { logActivity, logActivityThrottled } = require('../utils/activityLog');
const { ensureSoftDeleteSchema } = require('../utils/softDeleteSchema');
const { ensureAssignmentSlots } = require('../utils/teachingMode');
const {
  ensureAttendanceSchema,
  manilaISODate,
  sqlDateToISO,
  weekStartMonday,
  weekdaysMonFri,
  attendanceRangeBounds,
  isSubjectGrade,
  normalizeSession,
  currentManilaSession,
  statusLetter
} = require('../utils/attendanceSchema');
const { enqueueSms, pickParentPhone, processSmsQueue, notifyStudentScore, notifyClassAnnouncement, notifyTakeHomeLink } = require('../utils/sms');
const {
  ensureAiRecommendationsSchema,
  generateRecommendationsForLesson,
  generateRecommendationsForLessons,
  generateActivityRubric,
  safeParseJsonContent,
  pickDraftPart,
  isAiDryRun,
  isAiConfigured,
  getAiProviderMode,
  getActiveAiModel
} = require('../utils/aiRecommendations');
const { createJob, getJobForTeacher, finishJob, setJobProgress, publicJob, runExclusive } = require('../utils/aiJobs');
const {
  ensureQuestionBankSchema,
  saveDraftPartsToBank,
  formatBankRow,
  normalizeChoices,
  parseChoicesColumn,
  normalizeRubric,
  rubricPointsTotal,
  groupItemsByType,
  groupItemsByCategory,
  migrateOrphanBankItems,
  isActivityType,
  canonicalItemType,
  isAllowedItemType,
  storesChoiceList,
  normalizeTrueFalseAnswer,
  ITEM_TYPES
} = require('../utils/questionBank');
const { topicInsightForStudent, PASSING } = require('../utils/parentInsights');
const {
  ensureQuizAttendanceSchema,
  parseMakeupIds,
  attendanceSlotForAssessment,
  getAttendanceCompletion,
  getMakeupCandidates,
  getSubmittedStudentIds,
  loadAttendanceRoster,
  isMakeupStatus,
  isPastManila,
  resolveQuizWindowsFromBody,
  normalizeSqlDatetime,
  VALID_STATUSES
} = require('../utils/quizAttendance');

/** Returns assigned class rows for the teacher (current school year). */
async function getTeacherAssignmentRows(teacherId) {
  const [rows] = await db.query(
    `SELECT grade_level, section, subject_id
     FROM teacher_assignments
     WHERE teacher_id = ? AND school_year = ?`,
    [teacherId, schoolYear]
  );
  return rows;
}

function matchingRightsRepeat(choices) {
  const seen = new Set();
  for (const raw of choices || []) {
    const text = String(raw || '');
    if (!text.includes('|')) continue;
    const right = text.split('|').slice(1).join('|').trim().toLowerCase();
    if (!right) continue;
    if (seen.has(right)) return true;
    seen.add(right);
  }
  return false;
}

function normalizeSectionKey(section) {
  return String(section || '').trim().toUpperCase();
}

/** Unique grade+section pairs the teacher is assigned to. */
function assignmentClassPairs(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const grade = Number(row.grade_level);
    const section = String(row.section || '').trim();
    if (!grade || !section) continue;
    const key = `${grade}|${normalizeSectionKey(section)}`;
    if (!map.has(key)) map.set(key, { grade_level: grade, section });
  }
  return [...map.values()];
}

function teacherHasClassAssignment(rows, gradeLevel, section) {
  const grade = Number(gradeLevel);
  const want = normalizeSectionKey(section);
  if (!grade || !want) return false;
  return (rows || []).some(
    (r) => Number(r.grade_level) === grade && normalizeSectionKey(r.section) === want
  );
}

async function assertTeacherClassAssignment(teacherId, gradeLevel, section) {
  const rows = await getTeacherAssignmentRows(teacherId);
  if (!teacherHasClassAssignment(rows, gradeLevel, section)) {
    const err = new Error(
      `You are not assigned to Grade ${gradeLevel}-${String(section || '').trim()}. Choose one of your classes.`
    );
    err.status = 403;
    throw err;
  }
  return rows;
}

// ========== CLASSES ==========
router.get('/classes', verifyToken, async (req, res) => {
  try {
    await ensureAssignmentSlots();
    const teacherId = req.user?.id || req.user?.userId;
    const [rows] = await db.query(
      `SELECT ta.grade_level, ta.section, ta.subject_id, ta.slot,
        s.NAME as subject_name
       FROM teacher_assignments ta
       LEFT JOIN subjects s ON ta.subject_id = s.id
       WHERE ta.teacher_id = ? AND ta.school_year = '${schoolYear}'
       ORDER BY ta.grade_level, ta.section, s.NAME`,
      [teacherId]
    );

    const byClass = new Map();
    for (const row of rows) {
      const key = `${row.grade_level}|${String(row.section).trim().toUpperCase()}`;
      if (!byClass.has(key)) {
        byClass.set(key, {
          grade_level: row.grade_level,
          section: row.section,
          is_class_adviser: false,
          is_assistant: false,
          subjects: []
        });
      }
      const entry = byClass.get(key);
      if (row.subject_id == null) {
        if (row.slot === 'assistant') entry.is_assistant = true;
        else entry.is_class_adviser = true;
      } else if (row.subject_name) {
        const already = entry.subjects.some(s => Number(s.id) === Number(row.subject_id));
        if (!already) {
          entry.subjects.push({
            id: row.subject_id,
            name: row.subject_name
          });
        }
      }
    }

    res.json([...byClass.values()]);
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Server error fetching classes', details: error.message });
  }
});

// ========== ROSTER ==========
router.get('/roster/:grade/:section', verifyToken, async (req, res) => {
  try {
    await ensureAttendanceSchema();
    const { grade, section } = req.params;
    const today = manilaISODate();
    const subjectMode = isSubjectGrade(grade);
    const subjectIdRaw = req.query.subject_id;
    const subjectId = subjectIdRaw != null && String(subjectIdRaw).trim() !== ''
      ? Number(subjectIdRaw)
      : null;
    const session = normalizeSession(req.query.session, { subjectMode: subjectMode && !!subjectId });

    if (subjectMode && subjectId) {
      const [students] = await db.query(
        `SELECT s.id, s.lrn, s.first_name, s.last_name, s.gender,
          a.\`STATUS\` as attendance_status
         FROM students s
         LEFT JOIN attendance a
           ON s.id = a.student_id AND a.\`DATE\` = ? AND a.session = 'AM'
           AND a.subject_key = ?
         WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'
         ORDER BY s.gender DESC, s.last_name, s.first_name`,
        [today, subjectId, grade, String(section).trim()]
      );
      return res.json(students);
    }

    const [students] = await db.query(
      `SELECT s.id, s.lrn, s.first_name, s.last_name, s.gender,
        a.\`STATUS\` as attendance_status
       FROM students s
       LEFT JOIN attendance a
         ON s.id = a.student_id AND a.\`DATE\` = ? AND a.session = ?
         AND a.subject_key = 0
       WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'
       ORDER BY s.gender DESC, s.last_name, s.first_name`,
      [today, session, grade, String(section).trim()]
    );
    res.json(students);
  } catch (error) {
    console.error('Get roster error:', error);
    res.status(500).json({ error: 'Server error fetching roster', details: error.message });
  }
});

// ========== ATTENDANCE ==========

async function loadWeeklySheet({ grade, section, weekStart, subjectId, range, anchor }) {
  await ensureAttendanceSchema();
  const sectionNorm = String(section || '').trim();
  const bounds = attendanceRangeBounds(range || 'week', anchor || weekStart, schoolYear);
  const dates = bounds.dates;
  const start = bounds.from;
  const weekEnd = bounds.to;
  const subjectMode = isSubjectGrade(grade) && subjectId;

  let subjectName = null;
  if (subjectMode) {
    const [[subj]] = await db.query('SELECT NAME as name FROM subjects WHERE id = ?', [subjectId]);
    subjectName = subj?.name || null;
  }

  const [students] = await db.query(
    `SELECT s.id, s.lrn, s.first_name, s.last_name, s.gender
     FROM students s
     WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'
     ORDER BY CASE WHEN s.gender = 'M' THEN 0 WHEN s.gender = 'F' THEN 1 ELSE 2 END,
              s.last_name, s.first_name`,
    [grade, sectionNorm]
  );

  let records;
  if (subjectMode) {
    [records] = await db.query(
      `SELECT a.student_id, a.\`DATE\` as att_date, a.session, a.\`STATUS\` as status
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'
         AND a.\`DATE\` BETWEEN ? AND ?
         AND a.subject_key = ?`,
      [grade, sectionNorm, start, weekEnd, subjectId]
    );
  } else {
    [records] = await db.query(
      `SELECT a.student_id, a.\`DATE\` as att_date, a.session, a.\`STATUS\` as status
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'
         AND a.\`DATE\` BETWEEN ? AND ?
         AND a.subject_key = 0`,
      [grade, sectionNorm, start, weekEnd]
    );
  }

  const byStudent = new Map();
  for (const s of students) {
    const marks = {};
    for (const d of dates) {
      marks[d] = subjectMode ? { status: null } : { AM: null, PM: null };
    }
    byStudent.set(s.id, {
      id: s.id,
      lrn: s.lrn,
      first_name: s.first_name,
      last_name: s.last_name,
      gender: s.gender,
      marks
    });
  }

  for (const r of records) {
    const row = byStudent.get(r.student_id);
    if (!row) continue;
    const d = sqlDateToISO(r.att_date);
    if (!row.marks[d]) continue;
    if (subjectMode) {
      row.marks[d].status = r.status;
    } else if (r.session === 'PM') {
      row.marks[d].PM = r.status;
    } else {
      row.marks[d].AM = r.status;
    }
  }

  return {
    range: bounds.range,
    schoolYear: bounds.schoolYear || null,
    weekStart: start,
    weekEnd,
    dates,
    mode: subjectMode ? 'subject' : 'class',
    subject_id: subjectMode ? subjectId : null,
    subject_name: subjectName,
    grade: Number(grade),
    section: sectionNorm,
    students: [...byStudent.values()]
  };
}

function formatAttendanceShortDate(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y || !m || !d) return String(isoDate || '');
  const yy = String(y).slice(-2);
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${yy}`;
}

async function weeklySheetToXlsx(sheet) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Connected';
  const ws = workbook.addWorksheet('Attendance', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: sheet.mode === 'subject' ? 1 : 2 }]
  });

  const subjectMode = sheet.mode === 'subject';
  const markCols = subjectMode ? sheet.dates.length : sheet.dates.length * 2;
  const totalCols = 2 + markCols;
  const thin = { style: 'thin', color: { argb: 'FF666666' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5C1A1A' } };
  const headerFill2 = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6E2A2A' } };
  const groupFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0E6E6' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  const center = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const left = { vertical: 'middle', horizontal: 'left' };

  const title = subjectMode
    ? `Attendance Sheet — Grade ${sheet.grade}-${sheet.section} · ${sheet.subject_name || 'Subject'}`
    : `Attendance Sheet — Grade ${sheet.grade}-${sheet.section}`;

  ws.mergeCells(1, 1, 1, totalCols);
  ws.getCell(1, 1).value = title;
  ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: 'FF5C1A1A' } };
  ws.getCell(1, 1).alignment = left;

  ws.mergeCells(2, 1, 2, totalCols);
  ws.getCell(2, 1).value = `Students ${sheet.students.length}  ·  ${sheetRangeCaption(sheet)}`;
  ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF555555' } };

  ws.mergeCells(3, 1, 3, totalCols);
  ws.getCell(3, 1).value = 'P – Present    A – Absent    L – Late    E – Excused';
  ws.getCell(3, 1).font = { size: 10, color: { argb: 'FF555555' } };

  const headerRow = 5;
  const sessionRow = subjectMode ? null : 6;
  const dataStart = subjectMode ? 6 : 7;

  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 28;
  for (let c = 3; c <= totalCols; c += 1) {
    ws.getColumn(c).width = subjectMode ? 12 : 8;
  }

  // Header row: LRN, Name, dates
  const r1 = ws.getRow(headerRow);
  r1.getCell(1).value = 'LRN';
  r1.getCell(2).value = 'Student Name';
  if (subjectMode) {
    sheet.dates.forEach((d, i) => {
      r1.getCell(3 + i).value = formatAttendanceShortDate(d);
    });
  } else {
    sheet.dates.forEach((d, i) => {
      const start = 3 + i * 2;
      ws.mergeCells(headerRow, start, headerRow, start + 1);
      r1.getCell(start).value = formatAttendanceShortDate(d);
    });
  }

  for (let c = 1; c <= totalCols; c += 1) {
    const cell = r1.getCell(c);
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = border;
    cell.alignment = c <= 2 ? left : center;
  }

  if (!subjectMode) {
    ws.mergeCells(headerRow, 1, sessionRow, 1);
    ws.mergeCells(headerRow, 2, sessionRow, 2);
    const r2 = ws.getRow(sessionRow);
    sheet.dates.forEach((_, i) => {
      r2.getCell(3 + i * 2).value = 'AM';
      r2.getCell(4 + i * 2).value = 'PM';
    });
    for (let c = 1; c <= totalCols; c += 1) {
      const cell = r2.getCell(c);
      cell.fill = c <= 2 ? headerFill : headerFill2;
      cell.font = headerFont;
      cell.border = border;
      cell.alignment = c <= 2 ? left : center;
    }
    // Re-apply LRN/Name after merge
    r1.getCell(1).value = 'LRN';
    r1.getCell(2).value = 'Student Name';
  }

  const letterColor = (letter) => {
    if (letter === 'P') return { argb: 'FF1B5E20' };
    if (letter === 'A') return { argb: 'FFB71C1C' };
    if (letter === 'L') return { argb: 'FFE67E22' };
    return { argb: 'FF222222' };
  };

  let rowIdx = dataStart;
  const groups = [
    { label: 'Boys', list: sheet.students.filter((s) => s.gender === 'M') },
    { label: 'Girls', list: sheet.students.filter((s) => s.gender === 'F') },
    { label: 'Other', list: sheet.students.filter((s) => s.gender !== 'M' && s.gender !== 'F') }
  ];

  for (const group of groups) {
    if (!group.list.length) continue;
    const gRow = ws.getRow(rowIdx);
    ws.mergeCells(rowIdx, 1, rowIdx, totalCols);
    gRow.getCell(1).value = group.label;
    for (let c = 1; c <= totalCols; c += 1) {
      const cell = gRow.getCell(c);
      cell.fill = groupFill;
      cell.font = { bold: true, color: { argb: 'FF5C1A1A' } };
      cell.border = border;
      cell.alignment = left;
    }
    rowIdx += 1;

    for (const s of group.list) {
      const row = ws.getRow(rowIdx);
      row.getCell(1).value = s.lrn || '';
      row.getCell(2).value = `${s.last_name}, ${s.first_name}`;
      row.getCell(1).alignment = left;
      row.getCell(2).alignment = left;
      row.getCell(1).border = border;
      row.getCell(2).border = border;

      sheet.dates.forEach((d, i) => {
        if (subjectMode) {
          const letter = statusLetter(s.marks[d]?.status);
          const cell = row.getCell(3 + i);
          cell.value = letter || '';
          cell.alignment = center;
          cell.border = border;
          cell.font = { bold: true, color: letterColor(letter) };
        } else {
          const am = statusLetter(s.marks[d]?.AM);
          const pm = statusLetter(s.marks[d]?.PM);
          const cAm = row.getCell(3 + i * 2);
          const cPm = row.getCell(4 + i * 2);
          cAm.value = am || '';
          cPm.value = pm || '';
          cAm.alignment = center;
          cPm.alignment = center;
          cAm.border = border;
          cPm.border = border;
          cAm.font = { bold: true, color: letterColor(am) };
          cPm.font = { bold: true, color: letterColor(pm) };
        }
      });
      rowIdx += 1;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function sheetRangeCaption(sheet) {
  const span = `${formatAttendanceShortDate(sheet.weekStart)} – ${formatAttendanceShortDate(sheet.weekEnd)}`;
  if (sheet.range === 'day') return formatAttendanceShortDate(sheet.weekStart);
  if (sheet.range === 'month') return span;
  if (sheet.range === 'year') return `School Year ${sheet.schoolYear || ''}`.trim();
  return span;
}

function weeklySheetToPrintHtml(sheet) {
  const title = sheet.mode === 'subject'
    ? `Attendance Sheet — Grade ${sheet.grade}-${sheet.section} · ${sheet.subject_name || 'Subject'}`
    : `Attendance Sheet — Grade ${sheet.grade}-${sheet.section}`;
  const markCols = sheet.mode === 'subject' ? sheet.dates.length : sheet.dates.length * 2;
  const colgroup =
    '<colgroup><col style="width:9rem"><col style="width:14rem">' +
    Array.from({ length: markCols }, () => '<col>').join('') +
    '</colgroup>';

  const dateHeadsTop = sheet.dates.map((d) => {
    const label = formatAttendanceShortDate(d);
    if (sheet.mode === 'subject') return `<th rowspan="2">${label}</th>`;
    return `<th colspan="2">${label}</th>`;
  }).join('');

  const dateHeadsSub = sheet.mode === 'subject'
    ? ''
    : `<tr>${sheet.dates.map(() => '<th>AM</th><th>PM</th>').join('')}</tr>`;

  const renderGroup = (list, label) => {
    if (!list.length) return '';
    const colSpan = 2 + markCols;
    const rows = list.map((s) => {
      const cells = sheet.dates.map((d) => {
        if (sheet.mode === 'subject') {
          return `<td class="mark">${statusLetter(s.marks[d]?.status) || ''}</td>`;
        }
        return `<td class="mark">${statusLetter(s.marks[d]?.AM) || ''}</td><td class="mark">${statusLetter(s.marks[d]?.PM) || ''}</td>`;
      }).join('');
      return `<tr><td>${s.lrn || '-'}</td><td>${s.last_name}, ${s.first_name}</td>${cells}</tr>`;
    }).join('');
    return `<tr class="group"><td colspan="${colSpan}">${label}</td></tr>${rows}`;
  };

  const boys = sheet.students.filter((s) => s.gender === 'M');
  const girls = sheet.students.filter((s) => s.gender === 'F');
  const other = sheet.students.filter((s) => s.gender !== 'M' && s.gender !== 'F');
  const headerRows = sheet.mode === 'subject' ? 1 : 2;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:24px}
  h1{font-size:16px;margin:0 0 4px}
  .meta{color:#555;margin:0 0 4px}
  .legend{color:#555;margin:0 0 14px;display:flex;gap:18px}
  table{border-collapse:collapse;width:100%;table-layout:fixed;border:1px solid #666}
  th,td{border:1px solid #666;padding:4px 6px;text-align:center;overflow:hidden;text-overflow:ellipsis}
  th{background:#5c1a1a;color:#fff}
  td:nth-child(1),td:nth-child(2),th:nth-child(1),th:nth-child(2){text-align:left}
  tr.group td{background:#f0e6e6;font-weight:700;text-align:left}
  .mark{font-weight:700}
  @media print{body{margin:12px} button{display:none}}
</style></head><body>
<button onclick="window.print()">Print / Save as PDF</button>
<h1>${title}</h1>
<p class="meta">Students ${sheet.students.length} · ${sheetRangeCaption(sheet)}</p>
<p class="legend"><span><strong>P</strong> – Present</span><span><strong>A</strong> – Absent</span><span><strong>L</strong> – Late</span><span><strong>E</strong> – Excused</span></p>
<table>
${colgroup}
<thead>
  <tr>
    <th rowspan="${headerRows}">LRN</th>
    <th rowspan="${headerRows}">Student Name</th>
    ${dateHeadsTop}
  </tr>
  ${dateHeadsSub}
</thead>
<tbody>
${renderGroup(boys, 'Boys')}
${renderGroup(girls, 'Girls')}
${renderGroup(other, 'Other')}
</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`;
}

// Weekly matrix (Mon–Fri). More specific routes first.
router.get('/attendance/:grade/:section/week/export', verifyToken, async (req, res) => {
  try {
    const { grade, section } = req.params;
    const weekParam = String(req.query.date || req.query.week || req.query.weekStart || '').trim();
    const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : manilaISODate();
    const range = String(req.query.range || 'week');
    const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
    const format = String(req.query.format || 'xlsx').toLowerCase();

    if (isSubjectGrade(grade) && !subjectId) {
      return res.status(400).json({ error: 'subject_id is required for Grades 4–6' });
    }

    const sheet = await loadWeeklySheet({ grade, section, weekStart, subjectId, range, anchor: weekStart });
    const base = `attendance_G${sheet.grade}-${sheet.section}_${sheet.weekStart}`;

    if (format === 'pdf' || format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(weeklySheetToPrintHtml(sheet));
    }

    const buffer = await weeklySheetToXlsx(sheet);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export weekly attendance error:', error);
    res.status(500).json({ error: 'Server error exporting attendance', details: error.message });
  }
});

router.get('/attendance/:grade/:section/week', verifyToken, async (req, res) => {
  try {
    const { grade, section } = req.params;
    const weekParam = String(req.query.date || req.query.week || req.query.weekStart || '').trim();
    const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : manilaISODate();
    const range = String(req.query.range || 'week');
    const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;

    if (isSubjectGrade(grade) && !subjectId) {
      return res.status(400).json({
        error: 'Select a subject to view Grades 4–6 attendance (taken per subject before class).'
      });
    }

    const sheet = await loadWeeklySheet({ grade, section, weekStart, subjectId, range, anchor: weekStart });
    res.json(sheet);
  } catch (error) {
    console.error('Get weekly attendance error:', error);
    res.status(500).json({ error: 'Server error fetching weekly attendance', details: error.message });
  }
});

// Single-day register (legacy / summary helpers)
router.get('/attendance/:grade/:section', verifyToken, async (req, res) => {
  try {
    await ensureAttendanceSchema();
    const { grade, section } = req.params;
    const dateParam = String(req.query.date || '').trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : manilaISODate();
    const sectionNorm = String(section || '').trim();
    const subjectMode = isSubjectGrade(grade);
    const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
    const session = normalizeSession(req.query.session, { subjectMode: subjectMode && !!subjectId });

    let students;
    if (subjectMode && subjectId) {
      [students] = await db.query(
        `SELECT s.id, s.lrn, s.first_name, s.last_name, s.gender,
          a.\`STATUS\` as attendance_status
         FROM students s
         LEFT JOIN attendance a
           ON s.id = a.student_id AND a.\`DATE\` = ? AND a.session = 'AM' AND a.subject_key = ?
         WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'
         ORDER BY s.last_name, s.first_name`,
        [date, subjectId, grade, sectionNorm]
      );
    } else {
      [students] = await db.query(
        `SELECT s.id, s.lrn, s.first_name, s.last_name, s.gender,
          a.\`STATUS\` as attendance_status
         FROM students s
         LEFT JOIN attendance a
           ON s.id = a.student_id AND a.\`DATE\` = ? AND a.session = ? AND a.subject_key = 0
         WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'
         ORDER BY s.last_name, s.first_name`,
        [date, session, grade, sectionNorm]
      );
    }

    let present = 0;
    let absent = 0;
    let late = 0;
    let unrecorded = 0;
    for (const s of students) {
      const st = String(s.attendance_status || '').toLowerCase();
      if (st === 'present') present += 1;
      else if (st === 'absent') absent += 1;
      else if (st === 'late') late += 1;
      else unrecorded += 1;
    }

    res.json({
      date,
      session: subjectMode && subjectId ? 'AM' : session,
      subject_id: subjectId,
      summary: { total: students.length, present, absent, late, unrecorded },
      students
    });
  } catch (error) {
    console.error('Get attendance sheet error:', error);
    res.status(500).json({ error: 'Server error fetching attendance sheet', details: error.message });
  }
});

router.post('/attendance', verifyToken, async (req, res) => {
  try {
    await ensureAttendanceSchema();
    await ensureQuizAttendanceSchema();
    const { student_id, status, date: dateBody, session: sessionBody, subject_id: subjectBody } = req.body;
    const teacherId = req.user?.id || req.user?.userId;
    const dateParam = String(dateBody || '').trim();
    const today = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : manilaISODate();

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status must be Present, Absent, Late, or Excused' });
    }

    const [[student]] = await db.query(
      'SELECT first_name, last_name, grade_level, section FROM students WHERE id = ?',
      [student_id]
    );
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const subjectMode = isSubjectGrade(student.grade_level);
    let subjectId = subjectBody != null && String(subjectBody).trim() !== ''
      ? Number(subjectBody)
      : null;

    if (subjectMode) {
      if (!subjectId) {
        return res.status(400).json({
          error: 'subject_id is required for Grades 4–6 (attendance is taken per subject).'
        });
      }
    } else {
      subjectId = null;
    }

    const session = normalizeSession(sessionBody, { subjectMode });
    if (!subjectMode && session !== currentManilaSession()) {
      const now = currentManilaSession();
      return res.status(400).json({
        error: now === 'AM'
          ? 'Morning attendance is open. Afternoon attendance starts at 12:00.'
          : 'Afternoon attendance is open. Morning attendance is closed after 12:00.'
      });
    }

    await db.query(
      `INSERT INTO attendance (student_id, \`DATE\`, session, subject_id, \`STATUS\`, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`STATUS\` = VALUES(\`STATUS\`), recorded_by = VALUES(recorded_by)`,
      [student_id, today, session, subjectId, status, teacherId]
    );

    const sessionLabel = subjectMode ? '' : ` (${session})`;
    const classLabel = `Grade ${student.grade_level}-${student.section}`;
    await logActivityThrottled(
      db,
      teacherId,
      'Marked attendance',
      'class',
      classLabel,
      `${student.first_name} ${student.last_name}: ${status}${sessionLabel}`
    );

    res.json({ message: 'Attendance recorded', date: today, session, subject_id: subjectId });
  } catch (error) {
    console.error('Save attendance error:', error);
    res.status(500).json({ error: 'Server error saving attendance', details: error.message });
  }
});

router.get('/attendance/:grade/:section/completion', verifyToken, async (req, res) => {
  try {
    await ensureQuizAttendanceSchema();
    const { grade, section } = req.params;
    const today = manilaISODate();
    const subjectMode = isSubjectGrade(grade);
    const subjectIdRaw = req.query.subject_id;
    const subjectId = subjectIdRaw != null && String(subjectIdRaw).trim() !== ''
      ? Number(subjectIdRaw)
      : null;
    const session = normalizeSession(req.query.session, { subjectMode: subjectMode && !!subjectId });
    const slot = {
      date: today,
      session: subjectMode ? 'AM' : session,
      subjectKey: subjectMode && subjectId ? subjectId : 0,
      subjectMode,
      subjectId
    };
    const completion = await getAttendanceCompletion(grade, section, slot);
    res.json({
      date: today,
      session: slot.session,
      subject_id: subjectId,
      complete: completion.complete,
      total: completion.total,
      unmarked: completion.unmarked
    });
  } catch (error) {
    console.error('Attendance completion error:', error);
    res.status(500).json({ error: 'Server error checking attendance', details: error.message });
  }
});

async function notifyAttendance(req, res) {
  try {
    await ensureAttendanceSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { grade, section, statuses, session: sessionBody, subject_id: subjectBody } = req.body;
    if (!grade || !section) {
      return res.status(400).json({ error: 'grade and section are required' });
    }

    const allowed = ['Present', 'Late', 'Absent'];
    let wanted = Array.isArray(statuses) && statuses.length
      ? statuses.filter((s) => allowed.includes(s))
      : ['Absent'];
    if (!wanted.length) wanted = ['Absent'];

    const today = manilaISODate();
    const subjectMode = isSubjectGrade(grade);
    const subjectId = subjectBody ? Number(subjectBody) : null;
    const session = normalizeSession(sessionBody, { subjectMode: subjectMode && !!subjectId });

    let rows;
    if (subjectMode && subjectId) {
      [rows] = await db.query(
        `SELECT s.id, s.first_name, s.last_name, a.\`STATUS\` as attendance_status, a.session
         FROM students s
         JOIN attendance a ON a.student_id = s.id AND a.\`DATE\` = ?
           AND a.session = 'AM' AND a.subject_key = ?
         WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'
           AND a.\`STATUS\` IN (${wanted.map(() => '?').join(',')})`,
        [today, subjectId, grade, String(section).trim(), ...wanted]
      );
    } else {
      [rows] = await db.query(
        `SELECT s.id, s.first_name, s.last_name, a.\`STATUS\` as attendance_status, a.session
         FROM students s
         JOIN attendance a ON a.student_id = s.id AND a.\`DATE\` = ?
           AND a.session = ? AND a.subject_key = 0
         WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'
           AND a.\`STATUS\` IN (${wanted.map(() => '?').join(',')})`,
        [today, session, grade, String(section).trim(), ...wanted]
      );
    }

    if (!rows.length) {
      return res.json({ sent: 0, skipped: 0, message: 'No matching attendance records to notify today' });
    }

    let subjectName = '';
    if (subjectId) {
      const [[subj]] = await db.query('SELECT NAME as name FROM subjects WHERE id = ?', [subjectId]);
      subjectName = subj?.name || '';
    }

    let sent = 0;
    let skipped = 0;
    let smsQueued = 0;
    let smsSkippedNoPhone = 0;

    for (const student of rows) {
      const status = student.attendance_status;
      const [parents] = await db.query(
        `SELECT psl.parent_id, u.phone, pp.emergency_contact
         FROM parent_student_links psl
         JOIN users u ON u.id = psl.parent_id
         LEFT JOIN parent_profiles pp ON pp.user_id = u.id
         WHERE psl.student_id = ? AND u.role = 'parent' AND COALESCE(u.STATUS, u.status, 'active') != 'inactive'`,
        [student.id]
      );
      if (!parents.length) {
        skipped += 1;
        continue;
      }

      const subject = `Attendance update for ${student.first_name} ${student.last_name}`;
      const when = subjectMode && subjectId
        ? `${subjectName || 'subject'} class`
        : `${student.session || session} session`;
      const body = `${student.first_name} ${student.last_name} was marked ${status} (${when}) in Grade ${grade}-${section} on ${today}.`;
      const smsBody = `ConnectED: ${student.first_name} ${student.last_name} — ${status} (${when}), Grade ${grade}-${section}, ${today}.`;

      for (const parent of parents) {
        const [existing] = await db.query(
          `SELECT id FROM messages
           WHERE receiver_id = ? AND student_id = ? AND DATE(created_at) = ?
             AND category = 'announcement' AND SUBJECT = ? AND message = ?`,
          [parent.parent_id, student.id, today, subject, body]
        );
        if (existing.length) {
          skipped += 1;
          continue;
        }

        await db.query(
          `INSERT INTO messages (sender_id, receiver_id, student_id, SUBJECT, message, category, is_read)
           VALUES (?, ?, ?, ?, ?, 'announcement', 0)`,
          [teacherId, parent.parent_id, student.id, subject, body]
        );
        sent += 1;

        const phone = pickParentPhone(parent.phone, parent.emergency_contact);
        if (!phone) {
          smsSkippedNoPhone += 1;
          continue;
        }
        const smsResult = await enqueueSms({
          parentId: parent.parent_id,
          studentId: student.id,
          phone,
          body: smsBody
        });
        if (smsResult.queued) smsQueued += 1;
      }
    }

    if (sent > 0) {
      await logActivity(
        db,
        teacherId,
        'Sent attendance update',
        'class',
        `Grade ${grade}-${section}`,
        `${sent} parent notice${sent === 1 ? '' : 's'} · SMS queued ${smsQueued} · ${wanted.join('/')}`
      );
    }

    // Try to flush a few SMS immediately (non-blocking for failures)
    let smsSentNow = 0;
    try {
      const flush = await processSmsQueue({ limit: Math.max(smsQueued, 5) });
      smsSentNow = flush.sent || 0;
    } catch (e) {
      console.error('[notify] sms flush:', e.message);
    }

    const parts = [];
    if (sent) parts.push(`${sent} in-app notice${sent === 1 ? '' : 's'}`);
    if (smsQueued) parts.push(`${smsQueued} SMS queued`);
    if (smsSentNow) parts.push(`${smsSentNow} SMS sent/processed`);
    if (smsSkippedNoPhone) parts.push(`${smsSkippedNoPhone} parent${smsSkippedNoPhone === 1 ? '' : 's'} missing phone`);

    res.json({
      sent,
      skipped,
      smsQueued,
      smsSentNow,
      smsSkippedNoPhone,
      message: parts.length
        ? `Notified parents: ${parts.join(' · ')}.`
        : 'No new notices sent (already notified today, or no linked parents).'
    });
  } catch (error) {
    console.error('Notify attendance error:', error);
    res.status(500).json({ error: 'Server error notifying parents', details: error.message });
  }
}

router.post('/notify-attendance', verifyToken, notifyAttendance);
router.post('/notify-absent', verifyToken, (req, res) => {
  req.body = { ...(req.body || {}), statuses: ['Absent'] };
  return notifyAttendance(req, res);
});

router.post('/announcements', verifyToken, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.user?.userId;
    const { title, body, grade, section } = req.body;
    if (!title || !body || !grade || !section) {
      return res.status(400).json({ error: 'Title, message, grade, and section are required' });
    }

    const [owned] = await db.query(
      `SELECT id FROM teacher_assignments
       WHERE teacher_id = ? AND grade_level = ? AND section = ? AND school_year = '${schoolYear}'
       LIMIT 1`,
      [teacherId, grade, section]
    );
    const [homeroom] = owned.length ? [[]] : await db.query(
      `SELECT id FROM teacher_profiles
       WHERE user_id = ? AND homeroom_grade = ? AND homeroom_section = ?`,
      [teacherId, grade, section]
    );
    if (!owned.length && !homeroom.length) {
      return res.status(403).json({ error: 'You can only announce to classes you handle' });
    }

    await ensureAnnouncementAudience();
    const targets = announcementTargets({
      scope: 'class_specific',
      target_grade: grade,
      target_section: section
    });

    const [result] = await db.query(
      `INSERT INTO announcements (sender_id, title, body, scope, target_grade, target_section, priority, audience)
       VALUES (?, ?, ?, 'class_specific', ?, ?, 'normal', 'parents')`,
      [teacherId, String(title).trim(), String(body).trim(), targets.target_grade, targets.target_section]
    );
    await logActivity(
      db,
      teacherId,
      'Sent class notice',
      'announcement',
      String(title).trim(),
      `Grade ${grade}-${section}`
    );
    try {
      await notifyClassAnnouncement({ grade, section });
    } catch (smsError) {
      console.error('[sms] announcement notice:', smsError.message);
    }
    res.status(201).json({ id: result.insertId, message: 'Announcement sent to parents of this class' });
  } catch (error) {
    console.error('Teacher announcement error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.status ? error.message : 'Server error sending announcement',
      details: error.message
    });
  }
});

// ========== STATS ==========
router.get('/stats/:grade/:section', verifyToken, async (req, res) => {
  try {
    await ensureAttendanceSchema();
    const { grade, section } = req.params;
    const today = manilaISODate();
    const sectionNorm = String(section || '').trim();
    const subjectMode = isSubjectGrade(grade);
    const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
    const session = normalizeSession(req.query.session, { subjectMode: subjectMode && !!subjectId });

    const [[total]] = await db.query(
      `SELECT COUNT(*) as count FROM students WHERE grade_level = ? AND TRIM(section) = ? AND \`STATUS\` = 'active'`,
      [grade, sectionNorm]
    );

    const subjectKey = subjectMode && subjectId ? subjectId : 0;
    const useSession = subjectMode && subjectId ? 'AM' : session;

    const [[present]] = await db.query(
      `SELECT COUNT(*) as count FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE s.grade_level = ? AND TRIM(s.section) = ? AND a.\`DATE\` = ?
         AND a.session = ? AND a.subject_key = ? AND a.\`STATUS\` = 'Present'`,
      [grade, sectionNorm, today, useSession, subjectKey]
    );
    const [[absent]] = await db.query(
      `SELECT COUNT(*) as count FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE s.grade_level = ? AND TRIM(s.section) = ? AND a.\`DATE\` = ?
         AND a.session = ? AND a.subject_key = ? AND a.\`STATUS\` = 'Absent'`,
      [grade, sectionNorm, today, useSession, subjectKey]
    );
    const [[late]] = await db.query(
      `SELECT COUNT(*) as count FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE s.grade_level = ? AND TRIM(s.section) = ? AND a.\`DATE\` = ?
         AND a.session = ? AND a.subject_key = ? AND a.\`STATUS\` = 'Late'`,
      [grade, sectionNorm, today, useSession, subjectKey]
    );

    res.json({
      total: total.count,
      present: present.count,
      absent: absent.count,
      late: late.count,
      date: today,
      session: useSession,
      subject_id: subjectId
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error fetching stats', details: error.message });
  }
});

async function viewerHomeSlot(viewerId, grade, sectionNorm) {
  const [homeRows] = await db.query(
    `SELECT slot FROM teacher_assignments
     WHERE teacher_id = ? AND grade_level = ? AND TRIM(UPPER(section)) = TRIM(UPPER(?))
       AND subject_id IS NULL AND school_year = ? AND slot IN ('adviser', 'assistant')
     LIMIT 1`,
    [viewerId, grade, sectionNorm, schoolYear]
  );
  return homeRows[0] || null;
}

function teacherDisplayName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Teacher';
}

async function loadSubjectTeacherReports(viewerId, grade, sectionNorm) {
  const home = await viewerHomeSlot(viewerId, grade, sectionNorm);
  if (!home) return { is_home_teacher: false, subject_teachers: [] };

  const [assigned] = await db.query(
    `SELECT s.id AS subject_id, s.NAME AS subject_name,
            u.id AS teacher_id, u.first_name, u.last_name
     FROM teacher_assignments ta
     JOIN users u ON u.id = ta.teacher_id
     JOIN subjects s ON s.id = ta.subject_id AND s.deleted_at IS NULL
     WHERE ta.grade_level = ?
       AND TRIM(UPPER(ta.section)) = TRIM(UPPER(?))
       AND ta.school_year = ?
       AND ta.subject_id IS NOT NULL
       AND ta.teacher_id <> ?
       AND COALESCE(u.STATUS, 'active') != 'inactive'
     ORDER BY s.NAME, u.last_name, u.first_name`,
    [grade, sectionNorm, schoolYear, viewerId]
  );

  const unique = new Map();
  for (const row of assigned) {
    const key = `${row.subject_id}|${row.teacher_id}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  const subject_teachers = [...unique.values()].map((row) => ({
    subject_id: row.subject_id,
    subject_name: row.subject_name,
    teacher_id: row.teacher_id,
    teacher_name: teacherDisplayName(row)
  }));

  return { is_home_teacher: true, subject_teachers };
}

router.get('/class-progress/:grade/:section/subject-record', verifyToken, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.user?.userId;
    const grade = req.params.grade;
    const sectionNorm = String(req.params.section || '').trim();
    const subjectId = Number(req.query.subject_id);
    const recordTeacherId = Number(req.query.teacher_id);
    if (!subjectId || !recordTeacherId) {
      return res.status(400).json({ error: 'Choose a subject.' });
    }
    if (recordTeacherId === Number(teacherId)) {
      return res.status(403).json({ error: 'This subject is assigned to you.' });
    }

    await assertTeacherClassAssignment(teacherId, grade, sectionNorm);
    const home = await viewerHomeSlot(teacherId, grade, sectionNorm);
    if (!home) {
      return res.status(403).json({ error: 'Only the class adviser or assistant teacher can view this record.' });
    }

    const [assigned] = await db.query(
      `SELECT s.NAME AS subject_name, u.first_name, u.last_name
       FROM teacher_assignments ta
       JOIN users u ON u.id = ta.teacher_id
       JOIN subjects s ON s.id = ta.subject_id AND s.deleted_at IS NULL
       WHERE ta.teacher_id = ? AND ta.subject_id = ?
         AND ta.grade_level = ? AND TRIM(UPPER(ta.section)) = TRIM(UPPER(?))
         AND ta.school_year = ? AND ta.subject_id IS NOT NULL
         AND COALESCE(u.STATUS, 'active') != 'inactive'
       LIMIT 1`,
      [recordTeacherId, subjectId, grade, sectionNorm, schoolYear]
    );
    if (!assigned.length) {
      return res.status(404).json({ error: 'That subject is not assigned to this class.' });
    }

    const [students] = await db.query(
      `SELECT id, first_name, last_name
       FROM students
       WHERE grade_level = ? AND TRIM(section) = ? AND \`STATUS\` = 'active'
       ORDER BY last_name, first_name`,
      [grade, sectionNorm]
    );

    const [assessments] = await db.query(
      `SELECT a.id, a.title, a.TYPE AS type, a.quarter, a.max_score
       FROM assessments a
       WHERE a.subject_id = ? AND a.created_by = ?
         AND a.grade_level = ? AND TRIM(UPPER(a.section)) = TRIM(UPPER(?))
         AND a.TYPE IN ('quiz', 'activity', 'exam')
       ORDER BY a.created_at, a.id`,
      [subjectId, recordTeacherId, grade, sectionNorm]
    );

    const scoresByAssessment = new Map();
    if (assessments.length) {
      const place = assessments.map(() => '?').join(',');
      const [scoreRows] = await db.query(
        `SELECT assessment_id, student_id, score
         FROM assessment_scores
         WHERE assessment_id IN (${place})`,
        assessments.map((row) => row.id)
      );
      for (const row of scoreRows) {
        if (!scoresByAssessment.has(row.assessment_id)) scoresByAssessment.set(row.assessment_id, {});
        const raw = Number(row.score);
        scoresByAssessment.get(row.assessment_id)[row.student_id] = Number.isFinite(raw) ? raw : null;
      }
    }

    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    function sheet(type) {
      const grouped = { Q1: [], Q2: [], Q3: [], Q4: [] };
      for (const row of assessments) {
        if (String(row.type || '').toLowerCase() !== type) continue;
        const quarter = quarters.includes(String(row.quarter || '').toUpperCase())
          ? String(row.quarter).toUpperCase()
          : 'Q1';
        grouped[quarter].push({
          id: row.id,
          title: row.title,
          max_score: row.max_score,
          scores: scoresByAssessment.get(row.id) || {}
        });
      }
      return grouped;
    }

    res.json({
      subject_id: subjectId,
      subject_name: assigned[0].subject_name,
      teacher_id: recordTeacherId,
      teacher_name: teacherDisplayName(assigned[0]),
      section: sectionNorm,
      students,
      quizzes: sheet('quiz'),
      activities: sheet('activity'),
      exams: sheet('exam')
    });
  } catch (error) {
    console.error('Subject record error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.status ? error.message : 'Server error fetching subject record'
    });
  }
});

router.get('/class-progress/:grade/:section', verifyToken, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.user?.userId;
    const grade = req.params.grade;
    const sectionNorm = String(req.params.section || '').trim();
    const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
    await assertTeacherClassAssignment(teacherId, grade, sectionNorm);

    const [students] = await db.query(
      `SELECT id, first_name, last_name
       FROM students
       WHERE grade_level = ? AND TRIM(section) = ? AND \`STATUS\` = 'active'
       ORDER BY last_name, first_name`,
      [grade, sectionNorm]
    );

    let scoreSql = `SELECT sc.student_id, sc.score, a.max_score, a.subject_id,
              sub.NAME as subject_name
       FROM assessment_scores sc
       JOIN assessments a ON a.id = sc.assessment_id
       JOIN students s ON s.id = sc.student_id
       LEFT JOIN subjects sub ON sub.id = a.subject_id
       WHERE s.grade_level = ? AND TRIM(s.section) = ? AND s.\`STATUS\` = 'active'`;
    const scoreParams = [grade, sectionNorm];
    if (subjectId) {
      scoreSql += ' AND a.subject_id = ?';
      scoreParams.push(subjectId);
    }
    const [scores] = await db.query(scoreSql, scoreParams);

    const byStudent = new Map();
    const subjectsByStudent = new Map();
    const classSubjects = new Map();
    for (const row of scores) {
      const max = Number(row.max_score) || 0;
      const raw = Number(row.score);
      if (!Number.isFinite(raw) || max <= 0) continue;
      const pct = Math.min(100, Math.max(0, Math.round((raw / max) * 100)));
      const subjectName = String(row.subject_name || '').trim() || 'General';
      const subjectKey = subjectName.toLowerCase();
      if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, []);
      byStudent.get(row.student_id).push(pct);
      if (!subjectsByStudent.has(row.student_id)) subjectsByStudent.set(row.student_id, new Map());
      const studentSubjects = subjectsByStudent.get(row.student_id);
      if (!studentSubjects.has(subjectKey)) studentSubjects.set(subjectKey, { name: subjectName, percents: [] });
      studentSubjects.get(subjectKey).percents.push(pct);
      if (!classSubjects.has(subjectKey)) classSubjects.set(subjectKey, { name: subjectName, percents: [] });
      classSubjects.get(subjectKey).percents.push(pct);
    }

    function average(list) {
      return Math.round(list.reduce((sum, n) => sum + n, 0) / list.length);
    }

    function rankedSubjects(map) {
      if (!map || !map.size) return [];
      return [...map.values()].map((entry) => ({
        name: entry.name,
        avg: average(entry.percents)
      })).sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));
    }

    function joinTopics(topics) {
      const arr = [];
      const seen = new Set();
      for (const topic of topics || []) {
        const text = String(topic || '').trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key)) continue;
        seen.add(key);
        arr.push(text);
      }
      if (arr.length <= 1) return arr[0] || '';
      if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
      return `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
    }

    const topicByStudent = new Map();
    for (const student of students) {
      if (!byStudent.get(student.id)?.length) continue;
      try {
        const insight = await topicInsightForStudent(db, student.id);
        const reports = new Map();
        for (const report of insight?.subjects || []) {
          const key = String(report.subject || '').trim().toLowerCase();
          if (key) reports.set(key, report);
        }
        topicByStudent.set(student.id, reports);
      } catch (topicErr) {
        console.warn('[class-progress] topics:', topicErr.message);
        topicByStudent.set(student.id, new Map());
      }
    }

    function topicLabel(studentId, subjectName, side) {
      const report = topicByStudent.get(studentId)?.get(String(subjectName || '').trim().toLowerCase());
      const topics = side === 'strength' ? report?.strongTopics : report?.weakTopics;
      return joinTopics(topics) || subjectName;
    }

    function classTopicLabel(subjectName, side) {
      const collected = [];
      const key = String(subjectName || '').trim().toLowerCase();
      for (const reports of topicByStudent.values()) {
        const report = reports.get(key);
        if (!report) continue;
        collected.push(...((side === 'strength' ? report.strongTopics : report.weakTopics) || []));
      }
      return joinTopics(collected) || subjectName;
    }

    function displayName(student) {
      const last = String(student.last_name || '').trim();
      const first = String(student.first_name || '').trim();
      if (last && first) return `${last}, ${first}`;
      return last || first || 'Student';
    }

    const bands = { excels: [], on_track: [], behind: [] };
    const unscored = [];
    for (const student of students) {
      const percents = byStudent.get(student.id);
      if (!percents || !percents.length) {
        unscored.push({
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name
        });
        continue;
      }
      const avg = Math.round(percents.reduce((sum, n) => sum + n, 0) / percents.length);
      const subjects = rankedSubjects(subjectsByStudent.get(student.id));
      const side = avg >= 85 ? 'strength' : 'weakness';
      const picked = side === 'strength' ? subjects[0] : subjects[subjects.length - 1];
      const entry = {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        avg_percent: avg,
        weakest_lesson: picked ? topicLabel(student.id, picked.name, side) : null,
        topic_side: side
      };
      if (avg >= 85) bands.excels.push(entry);
      else if (avg >= 75) bands.on_track.push(entry);
      else bands.behind.push(entry);
    }
    const byName = (a, b) => String(a.last_name).localeCompare(String(b.last_name))
      || String(a.first_name).localeCompare(String(b.first_name));
    bands.excels.sort((a, b) => b.avg_percent - a.avg_percent || byName(a, b));
    bands.on_track.sort((a, b) => b.avg_percent - a.avg_percent || byName(a, b));
    bands.behind.sort((a, b) => a.avg_percent - b.avg_percent || byName(a, b));
    unscored.sort(byName);

    const counts = {
      excels: bands.excels.length,
      on_track: bands.on_track.length,
      behind: bands.behind.length
    };
    const scored = counts.excels + counts.on_track + counts.behind;
    let summary = 'No scores yet. Open Records to add quiz, activity, or exam scores.';
    if (scored === 1) {
      const one = bands.excels[0] || bands.on_track[0] || bands.behind[0];
      const verb = bands.excels.length ? 'is excelling' : bands.on_track.length ? 'is on track' : 'is left behind';
      summary = `${displayName(one)} ${verb} (${one.avg_percent}%).`;
    } else if (scored > 1) {
      summary = `${counts.excels} excelling, ${counts.on_track} on track, ${counts.behind} left behind.`;
    }

    const subjectAvgs = rankedSubjects(classSubjects);
    let lesson_line = '';
    if (subjectAvgs.length) {
      const lines = [];
      const best = subjectAvgs.find((subject) => subject.avg >= PASSING);
      lines.push(best
        ? `Excelled Lesson: ${classTopicLabel(best.name, 'strength')} (${best.avg}%).`
        : 'Excelled Lesson: none');
      const worst = subjectAvgs[subjectAvgs.length - 1];
      if (subjectAvgs.length > 1 || !best) {
        lines.push(`Needs Improvement: ${classTopicLabel(worst.name, 'weakness')} (${worst.avg}%).`);
      }
      lesson_line = lines.join('\n');
    }

    const subjectReports = subjectId
      ? { is_home_teacher: false, subject_teachers: [] }
      : await loadSubjectTeacherReports(teacherId, grade, sectionNorm);

    res.json({
      total_students: students.length,
      scored_students: scored,
      counts,
      summary,
      lesson_line,
      excels: bands.excels,
      on_track: bands.on_track,
      behind: bands.behind,
      unscored,
      is_home_teacher: subjectReports.is_home_teacher,
      subject_teachers: subjectReports.subject_teachers
    });
  } catch (error) {
    console.error('Class progress error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.status ? error.message : 'Server error fetching class progress'
    });
  }
});

// ========== INBOX ==========
router.get('/inbox', verifyToken, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.user?.userId;
    await ensureInboxTrash();

    // Get teacher's assignments
    let assignmentRows = [];
    try {
      [assignmentRows] = await db.query(
        `SELECT grade_level, section FROM teacher_assignments WHERE teacher_id = ? AND school_year = '${schoolYear}'`,
        [teacherId]
      );
    } catch (e) { console.log('[Inbox] assignments error:', e.message); }

    // Also check teacher_profiles for homeroom
    let profileRows = [];
    try {
      [profileRows] = await db.query(
        `SELECT homeroom_grade, homeroom_section FROM teacher_profiles WHERE user_id = ?`, [teacherId]
      );
    } catch (e) { /* */ }

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

    // Fetch announcements
    let announcements = [];
    try {
      let sql = `SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name,
            ar.read_at IS NOT NULL as is_read
           FROM announcements a 
           JOIN users u ON a.sender_id = u.id
           LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = ?
           WHERE (a.scope = 'school_wide'`;
      const params = [teacherId];
      if (gradeList.length > 0) {
        sql += ` OR (a.scope = 'grade_wide' AND a.target_grade IN (${gradeList.map(() => '?').join(',')}))`;
        params.push(...gradeList);
      }
      if (classList.length > 0) {
        const conds = classList.map(() => '(a.target_grade = ? AND a.target_section = ?)');
        sql += ` OR (a.scope = 'class_specific' AND (${conds.join(' OR ')}))`;
        classList.forEach(cls => { const [g, sec] = cls.split('-'); params.push(g, sec); });
      }
      sql += `)${audienceSql('teacher')}${trashExcludeSql('a', 'announcement')} ORDER BY a.created_at DESC`;
      params.push(teacherId);
      [announcements] = await db.query(sql, params);
    } catch (e) { console.error('[Inbox] announcements error:', e.message); }

    // Concerns only from a parent whose child this teacher handles, and only if sent to this teacher.
    let concerns = [];
    try {
      const sql = `SELECT c.id, c.parent_id, c.teacher_id, c.student_id,
                     c.SUBJECT as subject, c.message, c.STATUS as status, c.priority,
                     c.created_at, c.updated_at, c.teacher_reply, c.replied_at,
                     CONCAT(p.first_name, ' ', p.last_name) as parent_name,
                     CONCAT(s.first_name, ' ', s.last_name) as student_name,
                     s.grade_level, s.section
                   FROM concerns c
                   JOIN users p ON c.parent_id = p.id
                   JOIN students s ON c.student_id = s.id
                   WHERE c.teacher_id = ?
                     AND (
                       EXISTS (
                         SELECT 1 FROM teacher_assignments ta
                         WHERE ta.teacher_id = ? AND ta.school_year = ?
                           AND ta.grade_level = s.grade_level AND ta.section = s.section
                       )
                       OR EXISTS (
                         SELECT 1 FROM teacher_profiles tp
                         WHERE tp.user_id = ?
                           AND tp.homeroom_grade = s.grade_level AND tp.homeroom_section = s.section
                       )
                     )
                     ${trashExcludeSql('c', 'concern')}
                   ORDER BY c.created_at DESC`;
      [concerns] = await db.query(sql, [teacherId, teacherId, schoolYear, teacherId, teacherId]);
      concerns = await attachReplies(concerns);
      concerns = await attachConcernReadState(concerns, teacherId);
    } catch (e) {
      console.error('[Inbox] concerns error:', e.message);
    }

    res.json({ announcements, concerns });
  } catch (error) {
    console.error('Get teacher inbox error:', error);
    res.status(500).json({ error: 'Server error fetching inbox', details: error.message });
  }
});

router.get('/subjects', verifyToken, async (req, res) => {
  try {
    await ensureSoftDeleteSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const [assignmentRows] = await db.query(
      `SELECT ta.grade_level, ta.subject_id, s.NAME as subject_name
       FROM teacher_assignments ta
       LEFT JOIN subjects s ON s.id = ta.subject_id
       WHERE ta.teacher_id = ? AND ta.school_year = '${schoolYear}'`,
      [teacherId]
    );

    // id -> { id, name, grade_levels: Set }
    const byId = new Map();

    const addSubjectGrade = (id, name, grade) => {
      const sid = Number(id);
      const g = Number(grade);
      if (!sid || !name || !g) return;
      if (!byId.has(sid)) {
        byId.set(sid, { id: sid, name, grade_levels: new Set() });
      }
      byId.get(sid).grade_levels.add(g);
    };

    // Explicit subject-teacher rows (any grade, including G4–6)
    for (const row of assignmentRows) {
      if (row.subject_id != null && row.subject_name) {
        addSubjectGrade(row.subject_id, row.subject_name, row.grade_level);
      }
    }

    // Class adviser rows (subject_id NULL) for Grades 1–3 only →
    // subjects that apply to those adviser grades (homeroom teaches all subjects)
    const adviserGrades = [
      ...new Set(
        assignmentRows
          .filter((r) => r.subject_id == null && Number(r.grade_level) >= 1 && Number(r.grade_level) <= 3)
          .map((r) => Number(r.grade_level))
      )
    ];

    if (adviserGrades.length) {
      const [allSubjects] = await db.query(
        `SELECT id, NAME as name, applicable_grades FROM subjects
         WHERE deleted_at IS NULL
         ORDER BY NAME`
      );
      const gradeMatches = (gradeLevel, applicableGrades) => {
        if (!applicableGrades) return false;
        const grade = parseInt(gradeLevel, 10);
        if (Number.isNaN(grade)) return false;
        const str = String(applicableGrades).trim();
        const rangeMatch = str.match(/^(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          return grade >= start && grade <= end;
        }
        if (str.includes(',')) {
          return str.split(',').map((x) => parseInt(x.trim(), 10)).includes(grade);
        }
        return parseInt(str, 10) === grade;
      };

      for (const s of allSubjects) {
        for (const g of adviserGrades) {
          if (gradeMatches(g, s.applicable_grades)) {
            addSubjectGrade(s.id, s.name, g);
          }
        }
      }
    }

    const rows = [...byId.values()]
      .map((s) => ({
        id: s.id,
        name: s.name,
        grade_levels: [...s.grade_levels].sort((a, b) => a - b)
      }))
      .sort((a, b) =>
        String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' })
      );
    res.json(rows);
  } catch (error) {
    console.error('Get teacher subjects error:', error);
    res.status(500).json({ error: 'Server error fetching subjects', details: error.message });
  }
});

// ========== LESSON PLANS ==========
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const lessonPlanDir = path.join(__dirname, '../../public/assets/lesson-plans');
if (!fs.existsSync(lessonPlanDir)) {
  fs.mkdirSync(lessonPlanDir, { recursive: true });
}

const lessonPlanUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, lessonPlanDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `lp_${req.user.id}_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, DOC, or DOCX files are allowed'));
  }
});

router.get('/lesson-plans', verifyToken, async (req, res) => {
  try {
    await ensurePortalClassworkSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const [rows] = await db.query(
      `SELECT lp.id, lp.title, lp.grade_level, lp.objectives, lp.file_path, lp.created_at,
              lp.quarter, lp.subject_id, s.NAME as subject_name
       FROM lesson_plans lp
       LEFT JOIN subjects s ON lp.subject_id = s.id
       WHERE lp.uploaded_by = ?
       ORDER BY lp.created_at DESC`,
      [teacherId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get lesson plans error:', error);
    res.status(500).json({ error: 'Server error fetching lesson plans', details: error.message });
  }
});

router.post('/lesson-plans', verifyToken, (req, res) => {
  lessonPlanUpload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    try {
      await ensurePortalClassworkSchema();
      const teacherId = req.user?.id || req.user?.userId;
      const { title, subject_id, grade_level, objectives, quarter } = req.body;

      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Lesson title is required' });
      }
      if (!grade_level) {
        return res.status(400).json({ error: 'Grade level is required' });
      }

      const filePath = req.file ? `/assets/lesson-plans/${req.file.filename}` : null;
      const subjectId = subject_id ? Number(subject_id) : null;
      const qtr = normalizeQuarter(quarter || 'Q1');

      const [result] = await db.query(
        `INSERT INTO lesson_plans (title, subject_id, grade_level, objectives, file_path, uploaded_by, quarter)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [String(title).trim(), subjectId || null, Number(grade_level), objectives || null, filePath, teacherId, qtr]
      );

      res.status(201).json({
        message: 'Lesson plan uploaded',
        id: result.insertId,
        file_path: filePath
      });
    } catch (error) {
      console.error('Upload lesson plan error:', error);
      res.status(500).json({ error: 'Server error uploading lesson plan', details: error.message });
    }
  });
});

router.delete('/lesson-plans/:id', verifyToken, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;

    const [rows] = await db.query(
      'SELECT id, file_path FROM lesson_plans WHERE id = ? AND uploaded_by = ?',
      [id, teacherId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Lesson plan not found' });
    }

    if (rows[0].file_path) {
      const diskPath = path.join(__dirname, '../../public', rows[0].file_path);
      if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
    }

    await ensureAiRecommendationsSchema();
    await db.query('DELETE FROM ai_recommendations WHERE lesson_plan_id = ? AND teacher_id = ?', [
      id,
      teacherId
    ]);
    await db.query('DELETE FROM lesson_plans WHERE id = ? AND uploaded_by = ?', [id, teacherId]);
    res.json({ message: 'Lesson plan deleted' });
  } catch (error) {
    console.error('Delete lesson plan error:', error);
    res.status(500).json({ error: 'Server error deleting lesson plan', details: error.message });
  }
});

// ========== AI RECOMMENDATIONS (lesson plans → quiz/activity/exam drafts) ==========
ensureAiRecommendationsSchema().catch((e) => {
  console.error('[ai] schema ensure failed:', e.message);
});

router.get('/ai/status', verifyToken, async (_req, res) => {
  const mode = getAiProviderMode();
  res.json({
    dry_run: isAiDryRun(),
    configured: isAiConfigured(),
    mode,
    model: getActiveAiModel()
  });
});

router.post('/ai/generate-rubric', verifyToken, async (req, res) => {
  try {
    const {
      description,
      total_points: totalPoints,
      grade_level: gradeLevel,
      subject_name: subjectName
    } = req.body || {};

    const result = await generateActivityRubric({
      description,
      totalPoints,
      gradeLevel,
      subjectName
    });

    res.json({
      message: 'Rubric generated.',
      provider: result.provider,
      rubric: result.rubric
    });
  } catch (error) {
    console.error('Generate rubric error:', error);
    const status = /description/i.test(error.message) ? 400 : 500;
    res.status(status).json({ error: error.message || 'Could not generate rubric' });
  }
});

router.get('/ai/recommendations', verifyToken, async (req, res) => {
  try {
    await ensureAiRecommendationsSchema();
    await ensureQuestionBankSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const status = req.query.status ? String(req.query.status) : null;

    let sql = `SELECT r.id, r.lesson_plan_id, r.subject_id, r.grade_level, r.status, r.provider,
                      r.source_excerpt, r.content, r.assessment_id, r.approved_type,
                      r.created_at, r.updated_at,
                      lp.title as lesson_title, s.NAME as subject_name,
                      (SELECT qs.id FROM quiz_sets qs
                       WHERE qs.ai_recommendation_id = r.id AND qs.teacher_id = r.teacher_id
                         AND qs.status = 'active'
                       LIMIT 1) as classwork_set_id
               FROM ai_recommendations r
               LEFT JOIN lesson_plans lp ON lp.id = r.lesson_plan_id
               LEFT JOIN subjects s ON s.id = r.subject_id
               WHERE r.teacher_id = ?`;
    const params = [teacherId];
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      sql += ` AND r.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY r.created_at DESC LIMIT 50`;

    const [rows] = await db.query(sql, params);
    res.json(
      rows.map((row) => ({
        ...row,
        content: safeParseJsonContent(row.content)
      }))
    );
  } catch (error) {
    console.error('List AI recommendations error:', error);
    res.status(500).json({ error: 'Server error fetching AI drafts', details: error.message });
  }
});

router.get('/ai/recommendations/:id', verifyToken, async (req, res) => {
  try {
    await ensureAiRecommendationsSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const [[row]] = await db.query(
      `SELECT r.*, lp.title as lesson_title, s.NAME as subject_name
       FROM ai_recommendations r
       LEFT JOIN lesson_plans lp ON lp.id = r.lesson_plan_id
       LEFT JOIN subjects s ON s.id = r.subject_id
       WHERE r.id = ? AND r.teacher_id = ?`,
      [req.params.id, teacherId]
    );
    if (!row) return res.status(404).json({ error: 'AI draft not found' });
    row.content = safeParseJsonContent(row.content);
    res.json(row);
  } catch (error) {
    console.error('Get AI recommendation error:', error);
    res.status(500).json({ error: 'Server error fetching AI draft', details: error.message });
  }
});

router.get('/ai/jobs/:jobId', verifyToken, (req, res) => {
  const teacherId = req.user?.id || req.user?.userId;
  const job = getJobForTeacher(req.params.jobId, teacherId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(publicJob(job));
});

router.post('/lesson-plans/:id/generate', verifyToken, async (req, res) => {
  try {
    await ensureAiRecommendationsSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;

    const [[plan]] = await db.query(
      `SELECT lp.id, lp.title, lp.grade_level, lp.objectives, lp.file_path, lp.subject_id,
              s.NAME as subject_name
       FROM lesson_plans lp
       LEFT JOIN subjects s ON s.id = lp.subject_id
       WHERE lp.id = ? AND lp.uploaded_by = ?`,
      [id, teacherId]
    );
    if (!plan) return res.status(404).json({ error: 'Lesson plan not found' });

    const quizItemCount = req.body?.quiz_item_count;
    const quizItemTypes = req.body?.quiz_item_types;
    const quizItemCounts = req.body?.quiz_item_counts;
    const draftKind = req.body?.draft_kind === 'activity' ? 'activity' : 'quiz';
    const teacherFocus = String(req.body?.teacher_focus || '').trim().slice(0, 500);
    const jobKey = `gen:${teacherId}:${plan.id}`;
    const { id: jobId, reused } = createJob(teacherId, jobKey);
    res.status(202).json({ jobId, status: 'running' });
    if (reused) return;

    setImmediate(async () => {
      try {
        setJobProgress(jobId, { step: 1, total: 3, label: 'Reading the lesson' });
        const generated = await runExclusive(() => generateRecommendationsForLesson({
          lessonPlan: plan,
          subjectName: plan.subject_name,
          quizItemCount,
          quizItemTypes,
          quizItemCounts,
          draftKind,
          teacherFocus,
          onProgress: (progress) => setJobProgress(jobId, progress)
        }));
        setJobProgress(jobId, { step: 3, total: 3, label: 'Saving the draft' });
        const [result] = await db.query(
          `INSERT INTO ai_recommendations
            (lesson_plan_id, teacher_id, subject_id, grade_level, status, provider, source_excerpt, content)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
          [
            plan.id,
            teacherId,
            plan.subject_id || null,
            plan.grade_level,
            generated.provider,
            generated.sourceExcerpt,
            JSON.stringify(generated.content)
          ]
        );
        await logActivity(
          db,
          teacherId,
          'Generated AI lesson resources',
          'lesson_plan',
          plan.title,
          `provider=${generated.provider}`
        );
        finishJob(jobId, {
          status: 'done',
          result: {
            id: result.insertId,
            provider: generated.provider,
            message:
              generated.provider === 'mock'
                ? 'Mock AI draft created (set GROQ_API_KEY and AI_DRY_RUN=false for live generation).'
                : 'AI draft created. Review, then save to Classwork. Create a Quiz or Activity from Classwork for Records.'
          }
        });
      } catch (error) {
        console.error('Generate AI resources error:', error);
        finishJob(jobId, {
          status: 'error',
          error: error.status ? error.message : (error.message || 'Server error generating AI resources')
        });
      }
    });
  } catch (error) {
    console.error('Generate AI resources error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.status ? error.message : 'Server error generating AI resources',
      details: error.message
    });
  }
});

router.post('/ai/generate-exam', verifyToken, async (req, res) => {
  try {
    await ensureAiRecommendationsSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const ids = [...new Set((req.body?.lesson_plan_ids || []).map((n) => Number(n)).filter((n) => n > 0))];
    if (!ids.length) {
      return res.status(400).json({ error: 'Choose at least one lesson.' });
    }
    const quizItemCount = req.body?.quiz_item_count;
    const quizItemTypes = req.body?.quiz_item_types;
    const quizItemCounts = req.body?.quiz_item_counts;
    const draftKind = 'quiz';
    const teacherFocus = String(req.body?.teacher_focus || '').trim().slice(0, 500);
    const placeholders = ids.map(() => '?').join(',');
    const [plans] = await db.query(
      `SELECT lp.id, lp.title, lp.grade_level, lp.objectives, lp.file_path, lp.subject_id,
              s.NAME as subject_name
       FROM lesson_plans lp
       LEFT JOIN subjects s ON s.id = lp.subject_id
       WHERE lp.uploaded_by = ? AND lp.id IN (${placeholders})`,
      [teacherId, ...ids]
    );
    if (plans.length !== ids.length) {
      return res.status(404).json({ error: 'One or more lessons were not found.' });
    }
    const byId = new Map(plans.map((plan) => [Number(plan.id), plan]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    const grades = new Set(ordered.map((plan) => Number(plan.grade_level)));
    if (grades.size > 1) {
      return res.status(400).json({ error: 'Choose lessons from the same grade.' });
    }
    const subjects = new Set(ordered.map((plan) => Number(plan.subject_id) || 0));
    if (subjects.size > 1) {
      return res.status(400).json({ error: 'Choose materials from the same subject.' });
    }

    const jobKey = `gen-exam:${teacherId}:${ids.join(',')}`;
    const { id: jobId, reused } = createJob(teacherId, jobKey);
    res.status(202).json({ jobId, status: 'running' });
    if (reused) return;

    setImmediate(async () => {
      try {
        setJobProgress(jobId, { step: 1, total: 3, label: 'Reading the lessons' });
        const generated = await runExclusive(() => generateRecommendationsForLessons({
          lessons: ordered,
          subjectName: ordered[0]?.subject_name,
          quizItemCount,
          quizItemTypes,
          quizItemCounts,
          quizItemMax: 50,
          draftKind,
          teacherFocus,
          onProgress: (progress) => setJobProgress(jobId, progress)
        }));
        setJobProgress(jobId, { step: 3, total: 3, label: 'Saving the draft' });
        const primary = ordered[0];
        const [result] = await db.query(
          `INSERT INTO ai_recommendations
            (lesson_plan_id, teacher_id, subject_id, grade_level, status, provider, source_excerpt, content)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
          [
            primary.id,
            teacherId,
            primary.subject_id || null,
            primary.grade_level,
            generated.provider,
            generated.sourceExcerpt,
            JSON.stringify(generated.content)
          ]
        );
        await logActivity(
          db,
          teacherId,
          'Generated AI exam',
          'lesson_plan',
          generated.title || primary.title,
          `sources=${ordered.length} provider=${generated.provider}`
        );
        finishJob(jobId, {
          status: 'done',
          result: {
            id: result.insertId,
            provider: generated.provider,
            message: generated.provider === 'mock'
              ? 'Mock exam draft created. Review it, then save as an exam.'
              : 'Exam draft created. Review it, then save as an exam.'
          }
        });
      } catch (error) {
        console.error('Generate exam error:', error);
        finishJob(jobId, {
          status: 'error',
          error: error.status ? error.message : (error.message || 'Server error generating exam')
        });
      }
    });
  } catch (error) {
    console.error('Generate exam error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.status ? error.message : 'Server error generating exam',
      details: error.message
    });
  }
});

router.put('/ai/recommendations/:id', verifyToken, async (req, res) => {
  try {
    await ensureAiRecommendationsSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { content } = req.body || {};
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'content object is required' });
    }

    const [[row]] = await db.query(
      'SELECT id, status FROM ai_recommendations WHERE id = ? AND teacher_id = ?',
      [req.params.id, teacherId]
    );
    if (!row) return res.status(404).json({ error: 'AI draft not found' });
    if (row.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending drafts can be edited' });
    }

    await db.query('UPDATE ai_recommendations SET content = ? WHERE id = ?', [
      JSON.stringify(content),
      req.params.id
    ]);
    res.json({ message: 'Draft updated', content });
  } catch (error) {
    console.error('Update AI recommendation error:', error);
    res.status(500).json({ error: 'Server error updating AI draft', details: error.message });
  }
});

router.post('/ai/recommendations/:id/reject', verifyToken, async (req, res) => {
  try {
    await ensureAiRecommendationsSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const [[row]] = await db.query(
      'SELECT id, status FROM ai_recommendations WHERE id = ? AND teacher_id = ?',
      [req.params.id, teacherId]
    );
    if (!row) return res.status(404).json({ error: 'AI draft not found' });
    if (row.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending drafts can be rejected' });
    }

    await db.query(
      `UPDATE ai_recommendations SET status = 'rejected' WHERE id = ? AND teacher_id = ?`,
      [req.params.id, teacherId]
    );
    res.json({ message: 'AI draft rejected' });
  } catch (error) {
    console.error('Reject AI recommendation error:', error);
    res.status(500).json({ error: 'Server error rejecting AI draft', details: error.message });
  }
});

router.delete('/ai/recommendations/:id', verifyToken, async (req, res) => {
  try {
    await ensureAiRecommendationsSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const [result] = await db.query(
      'DELETE FROM ai_recommendations WHERE id = ? AND teacher_id = ?',
      [req.params.id, teacherId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'AI draft not found' });
    }
    res.json({ message: 'AI draft deleted' });
  } catch (error) {
    console.error('Delete AI recommendation error:', error);
    res.status(500).json({ error: 'Server error deleting AI draft', details: error.message });
  }
});

router.post('/ai/recommendations/:id/regenerate', verifyToken, async (req, res) => {
  try {
    await ensureAiRecommendationsSchema();
    const teacherId = req.user?.id || req.user?.userId;

    const [[row]] = await db.query(
      `SELECT r.*, lp.title, lp.objectives, lp.file_path, lp.subject_id as plan_subject_id,
              s.NAME as subject_name
       FROM ai_recommendations r
       JOIN lesson_plans lp ON lp.id = r.lesson_plan_id
       LEFT JOIN subjects s ON s.id = COALESCE(r.subject_id, lp.subject_id)
       WHERE r.id = ? AND r.teacher_id = ?`,
      [req.params.id, teacherId]
    );
    if (!row) return res.status(404).json({ error: 'AI draft not found' });
    if (row.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending drafts can be regenerated' });
    }

    const quizItemCount = req.body?.quiz_item_count;
    const quizItemTypes = req.body?.quiz_item_types;
    const quizItemCounts = req.body?.quiz_item_counts;
    const draftKind = req.body?.draft_kind === 'activity' ? 'activity' : 'quiz';
    const teacherFocus = String(req.body?.teacher_focus || '').trim().slice(0, 500);
    const recId = Number(req.params.id);
    const jobKey = `regen:${teacherId}:${recId}`;
    const { id: jobId, reused } = createJob(teacherId, jobKey);
    res.status(202).json({ jobId, status: 'running' });
    if (reused) return;

    setImmediate(async () => {
      try {
        setJobProgress(jobId, { step: 1, total: 3, label: 'Reading the lesson' });
        const generated = await runExclusive(() => generateRecommendationsForLesson({
          lessonPlan: {
            title: row.title,
            objectives: row.objectives,
            file_path: row.file_path,
            grade_level: row.grade_level,
            subject_id: row.plan_subject_id || row.subject_id
          },
          subjectName: row.subject_name,
          quizItemCount,
          quizItemTypes,
          quizItemCounts,
          draftKind,
          teacherFocus,
          onProgress: (progress) => setJobProgress(jobId, progress)
        }));
        setJobProgress(jobId, { step: 3, total: 3, label: 'Saving the draft' });
        await db.query(
          `UPDATE ai_recommendations
           SET provider = ?, source_excerpt = ?, content = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND teacher_id = ?`,
          [
            generated.provider,
            generated.sourceExcerpt,
            JSON.stringify(generated.content),
            recId,
            teacherId
          ]
        );
        await logActivity(
          db,
          teacherId,
          'Regenerated AI lesson resources',
          'lesson_plan',
          row.title,
          `provider=${generated.provider}`
        );
        finishJob(jobId, {
          status: 'done',
          result: {
            id: recId,
            provider: generated.provider,
            message:
              generated.provider === 'mock'
                ? 'Draft regenerated (mock). Set GROQ_API_KEY and AI_DRY_RUN=false for live AI.'
                : 'Draft regenerated. Review, then save to Classwork. Create a Quiz or Activity from Classwork for Records.'
          }
        });
      } catch (error) {
        console.error('Regenerate AI recommendation error:', error);
        finishJob(jobId, {
          status: 'error',
          error: error.status ? error.message : (error.message || 'Server error regenerating AI draft')
        });
      }
    });
  } catch (error) {
    console.error('Regenerate AI recommendation error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.status ? error.message : 'Server error regenerating AI draft',
      details: error.message
    });
  }
});

router.post('/ai/recommendations/:id/approve', verifyToken, async (req, res) => {
  try {
    await ensureAiRecommendationsSchema();
    await ensureAssessmentSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { type, section, quarter, max_score, quiz_link } = req.body || {};

    // Single-lesson AI drafts: quiz & activity only. Exams need multiple lessons (later phase).
    if (type === 'exam') {
      return res.status(400).json({
        error:
          'Exams should combine several lessons, not one lesson plan. Approve a quiz or activity instead, or create an exam manually in Progress.'
      });
    }
    if (!['quiz', 'activity'].includes(type)) {
      return res.status(400).json({ error: 'type must be quiz or activity' });
    }
    if (!section || !String(section).trim()) {
      return res.status(400).json({ error: 'section is required to create the progress record' });
    }

    const [[row]] = await db.query(
      `SELECT r.*, lp.title as lesson_title
       FROM ai_recommendations r
       LEFT JOIN lesson_plans lp ON lp.id = r.lesson_plan_id
       WHERE r.id = ? AND r.teacher_id = ?`,
      [req.params.id, teacherId]
    );
    if (!row) return res.status(404).json({ error: 'AI draft not found' });
    if (row.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending drafts can be approved' });
    }

    try {
      await assertTeacherClassAssignment(teacherId, row.grade_level, section);
    } catch (e) {
      return res.status(e.status || 403).json({ error: e.message });
    }

    let quizLink = null;
    try {
      quizLink = sanitizeQuizLink(quiz_link);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    const content = safeParseJsonContent(row.content);
    const part = pickDraftPart(content, type);
    if (!part) return res.status(400).json({ error: `Draft has no ${type} section` });

    const title = String(part.title || `${type}: ${row.lesson_title || 'Lesson'}`).trim();
    const maxScore = Math.max(1, Number(max_score) || Number(part.max_score) || 100);
    const qtr = normalizeQuarter(quarter || 'Q1');
    const current = await getCurrentQuarter();
    if (!isQuarterUnlocked(qtr, current)) {
      return res.status(400).json({
        error: `${qtr} is locked. Admin has unlocked through ${current} only.`
      });
    }

    let assessmentId;
    try {
      const [result] = await db.query(
        `INSERT INTO assessments (title, TYPE, subject_id, grade_level, section, max_score, created_by, quarter, quiz_link, lesson_plan_id, lesson_title)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          type,
          row.subject_id || null,
          row.grade_level,
          String(section).trim(),
          maxScore,
          teacherId,
          qtr,
          quizLink,
          row.lesson_plan_id || null,
          row.lesson_title ? String(row.lesson_title).slice(0, 255) : null
        ]
      );
      assessmentId = result.insertId;
    } catch (inner) {
      try {
        const [result] = await db.query(
          `INSERT INTO assessments (title, TYPE, subject_id, grade_level, section, max_score, created_by, quarter)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            title,
            type,
            row.subject_id || null,
            row.grade_level,
            String(section).trim(),
            maxScore,
            teacherId,
            qtr
          ]
        );
        assessmentId = result.insertId;
      } catch (inner2) {
        const [result] = await db.query(
          `INSERT INTO assessments (title, TYPE, subject_id, grade_level, section, max_score, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            title,
            type,
            row.subject_id || null,
            row.grade_level,
            String(section).trim(),
            maxScore,
            teacherId
          ]
        );
        assessmentId = result.insertId;
      }
    }

    await db.query(
      `UPDATE ai_recommendations
       SET status = 'approved', assessment_id = ?, approved_type = ?
       WHERE id = ? AND teacher_id = ?`,
      [assessmentId, type, req.params.id, teacherId]
    );

    let bankSave = null;
    try {
      bankSave = await saveDraftPartsToBank({
        teacherId,
        subjectId: row.subject_id,
        gradeLevel: row.grade_level,
        lessonPlanId: row.lesson_plan_id,
        lessonTitle: row.lesson_title,
        aiRecommendationId: row.id,
        content,
        types: ['quiz', 'activity']
      });
    } catch (bankErr) {
      console.warn('[classwork] save on approve failed:', bankErr.message);
    }

    await logActivity(
      db,
      teacherId,
      'Approved AI recommendation',
      'assessment',
      title,
      `Grade ${row.grade_level}-${String(section).trim()} · ${type}`
    );

    const bankNote =
      bankSave && bankSave.created
        ? ` Saved as Classwork set “${bankSave.title}” (${bankSave.created} items).`
        : bankSave && bankSave.already_exists
          ? ' Classwork set already saved.'
          : bankSave && bankSave.skipped
            ? ' Quiz items already in Classwork.'
            : '';

    res.json({
      message: `Progress record created.${bankNote} Enter scores in Progress after students finish.`,
      assessment_id: assessmentId,
      type,
      title,
      quiz_link: quizLink,
      bank: bankSave,
      draft_items: part
    });
  } catch (error) {
    console.error('Approve AI recommendation error:', error);
    res.status(500).json({ error: 'Server error approving AI draft', details: error.message });
  }
});

// ========== QUESTION BANK ==========
ensureQuestionBankSchema().catch((e) => {
  console.error('[classwork] schema ensure failed:', e.message);
});

router.post('/classwork/from-ai/:id', verifyToken, async (req, res) => {
  try {
    await ensureAiRecommendationsSchema();
    await ensureQuestionBankSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const typesRaw = req.body?.types;
    const types = Array.isArray(typesRaw) && typesRaw.length
      ? typesRaw.filter((t) => t === 'quiz' || t === 'activity')
      : ['quiz', 'activity'];
    const folder = String(req.body?.folder || '').toLowerCase() === 'exam' ? 'exam' : 'quiz';

    const [[row]] = await db.query(
      `SELECT r.*, lp.title as lesson_title
       FROM ai_recommendations r
       LEFT JOIN lesson_plans lp ON lp.id = r.lesson_plan_id
       WHERE r.id = ? AND r.teacher_id = ?`,
      [req.params.id, teacherId]
    );
    if (!row) return res.status(404).json({ error: 'AI draft not found' });

    const content = safeParseJsonContent(row.content);
    const result = await saveDraftPartsToBank({
      teacherId,
      subjectId: row.subject_id,
      gradeLevel: row.grade_level,
      lessonPlanId: row.lesson_plan_id,
      lessonTitle: row.lesson_title,
      aiRecommendationId: row.id,
      content,
      types,
      folder,
      title: req.body?.title
    });

    await logActivity(
      db,
      teacherId,
      'Saved AI set to Classwork',
      'question_bank',
      result.title || row.lesson_title || `Draft #${row.id}`,
      `${result.created} created, set #${result.quiz_set_id || '-'}`
    );

    res.status(201).json({
      message:
        result.created > 0
          ? (Array.isArray(result.sets) && result.sets.length > 1
            ? `Saved ${result.sets.map((s) => `“${s.title}”`).join(' and ')} to Classwork.`
            : `Saved “${result.title}” to Classwork (${result.created} items).`)
          : result.already_exists
            ? `“${result.title}” is already in your Classwork.`
            : result.skipped > 0
              ? 'Those items are already in your Classwork.'
              : 'No quiz items found to save.',
      ...result
    });
  } catch (error) {
    console.error('Save AI to classwork error:', error);
    res.status(500).json({ error: 'Server error saving to Classwork', details: error.message });
  }
});

router.get('/classwork/sets', verifyToken, async (req, res) => {
  try {
    await ensureQuestionBankSchema();
    const teacherId = req.user?.id || req.user?.userId;
    await migrateOrphanBankItems(teacherId);

    const { grade, subject_id } = req.query;
    const assignmentRows = await getTeacherAssignmentRows(teacherId);
    const allowedGrades = [...new Set(assignmentRows.map((r) => Number(r.grade_level)).filter(Boolean))];
    if (!allowedGrades.length) return res.json([]);

    let sql = `SELECT qs.*, s.NAME as subject_name,
                (SELECT COUNT(*) FROM question_bank qb
                 WHERE qb.quiz_set_id = qs.id AND qb.status = 'active') as item_count,
                (SELECT COUNT(*) FROM question_bank qb
                 WHERE qb.quiz_set_id = qs.id AND qb.status = 'active'
                   AND LOWER(IFNULL(qb.item_type, '')) IN ('activity', 'activity_prompt')) as activity_count,
                (SELECT COUNT(*) FROM question_bank qb
                 WHERE qb.quiz_set_id = qs.id AND qb.status = 'active'
                   AND LOWER(IFNULL(qb.item_type, '')) NOT IN ('activity', 'activity_prompt')
                   AND LOWER(IFNULL(qb.folder, '')) = 'exam') as exam_count,
                (SELECT COUNT(*) FROM question_bank qb
                 WHERE qb.quiz_set_id = qs.id AND qb.status = 'active'
                   AND LOWER(IFNULL(qb.item_type, '')) NOT IN ('activity', 'activity_prompt')
                   AND LOWER(IFNULL(qb.folder, '')) <> 'exam') as quiz_count
               FROM quiz_sets qs
               LEFT JOIN subjects s ON s.id = qs.subject_id
               WHERE qs.teacher_id = ? AND qs.status = 'active'`;
    const params = [teacherId];

    if (grade) {
      const g = Number(grade);
      if (!allowedGrades.includes(g)) return res.json([]);
      sql += ` AND qs.grade_level = ?`;
      params.push(g);
    } else {
      sql += ` AND qs.grade_level IN (${allowedGrades.map(() => '?').join(',')})`;
      params.push(...allowedGrades);
    }
    if (subject_id) {
      sql += ` AND qs.subject_id = ?`;
      params.push(Number(subject_id));
    }

    sql += ` ORDER BY qs.updated_at DESC LIMIT 100`;
    const [rows] = await db.query(sql, params);
    res.json(
      rows.map((r) => ({
        ...r,
        item_count: Number(r.item_count) || 0,
        quiz_count: Number(r.quiz_count) || 0,
        activity_count: Number(r.activity_count) || 0,
        exam_count: Number(r.exam_count) || 0
      }))
    );
  } catch (error) {
    console.error('List quiz sets error:', error);
    res.status(500).json({ error: 'Server error fetching Classwork sets', details: error.message });
  }
});

router.post('/classwork/sets', verifyToken, async (req, res) => {
  try {
    await ensureQuestionBankSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { title, grade_level, subject_id, kind } = req.body || {};
    const setTitle = String(title || '').trim().slice(0, 255);
    const grade = Number(grade_level);
    const setKind = ['quizzes', 'activity', 'exam'].includes(kind) ? kind : 'quizzes';

    if (!setTitle) return res.status(400).json({ error: 'Title is required' });
    if (!grade) return res.status(400).json({ error: 'Grade level is required' });

    const assignmentRows = await getTeacherAssignmentRows(teacherId);
    const allowedGrades = [...new Set(assignmentRows.map((r) => Number(r.grade_level)).filter(Boolean))];
    if (!allowedGrades.includes(grade)) {
      return res.status(403).json({ error: `Grade ${grade} is not in your assigned classes.` });
    }

    const subjectId = subject_id ? Number(subject_id) : null;
    if (subjectId) {
      const hasExplicit = assignmentRows.some(
        (r) => Number(r.grade_level) === grade && Number(r.subject_id) === subjectId
      );
      const isG13Adviser = grade >= 1 && grade <= 3 && assignmentRows.some(
        (r) => Number(r.grade_level) === grade && r.subject_id == null
      );
      if (!hasExplicit && !isG13Adviser) {
        return res.status(403).json({
          error: 'That subject is not assigned to you for this grade.'
        });
      }
      if (!hasExplicit && isG13Adviser) {
        const [[sub]] = await db.query(
          'SELECT id, applicable_grades FROM subjects WHERE id = ? AND deleted_at IS NULL',
          [subjectId]
        );
        if (!sub) return res.status(400).json({ error: 'Subject not found' });
        const str = String(sub.applicable_grades || '').trim();
        let ok = false;
        const rangeMatch = str.match(/^(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
          ok = grade >= parseInt(rangeMatch[1], 10) && grade <= parseInt(rangeMatch[2], 10);
        } else if (str.includes(',')) {
          ok = str.split(',').map((x) => parseInt(x.trim(), 10)).includes(grade);
        } else {
          ok = parseInt(str, 10) === grade;
        }
        if (!ok) {
          return res.status(403).json({
            error: 'That subject is not assigned to you for this grade.'
          });
        }
      }
    }

    const [result] = await db.query(
      `INSERT INTO quiz_sets
        (teacher_id, title, subject_id, grade_level, source, status, kind)
       VALUES (?, ?, ?, ?, 'manual', 'active', ?)`,
      [teacherId, setTitle, subjectId, grade, setKind]
    );

    await logActivity(
      db,
      teacherId,
      'Created classwork set',
      'question_bank',
      setTitle,
      `Grade ${grade}${subjectId ? ` · subject #${subjectId}` : ''} · ${setKind}`
    );

    res.status(201).json({
      id: result.insertId,
      title: setTitle,
      grade_level: grade,
      subject_id: subjectId,
      kind: setKind,
      message: 'Classwork created. Find it in Classwork.'
    });
  } catch (error) {
    console.error('Create quiz set error:', error);
    res.status(500).json({ error: 'Server error creating classwork set', details: error.message });
  }
});

router.get('/classwork/sets/:id', verifyToken, async (req, res) => {
  try {
    await ensureQuestionBankSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const setId = Number(req.params.id);

    const [[setRow]] = await db.query(
      `SELECT qs.*, s.NAME as subject_name
       FROM quiz_sets qs
       LEFT JOIN subjects s ON s.id = qs.subject_id
       WHERE qs.id = ? AND qs.teacher_id = ? AND qs.status = 'active'`,
      [setId, teacherId]
    );
    if (!setRow) return res.status(404).json({ error: 'Classwork set not found' });

    const assignmentRows = await getTeacherAssignmentRows(teacherId);
    const allowedGrades = [...new Set(assignmentRows.map((r) => Number(r.grade_level)).filter(Boolean))];
    if (!allowedGrades.includes(Number(setRow.grade_level))) {
      return res.status(403).json({ error: 'This set is outside your assigned grades.' });
    }

    const [items] = await db.query(
      `SELECT qb.*, s.NAME as subject_name
       FROM question_bank qb
       LEFT JOIN subjects s ON s.id = qb.subject_id
       WHERE qb.quiz_set_id = ? AND qb.teacher_id = ? AND qb.status = 'active'
       ORDER BY FIELD(qb.item_type, 'mcq', 'true_false', 'fill_blank', 'matching', 'sequencing', 'identification', 'enumeration', 'short_answer', 'activity', 'activity_prompt'),
                qb.id ASC`,
      [setId, teacherId]
    );
    const formatted = items.map(formatBankRow);
    res.json({
      set: setRow,
      items: formatted,
      groups: groupItemsByType(formatted),
      categories: groupItemsByCategory(formatted)
    });
  } catch (error) {
    console.error('Get quiz set error:', error);
    res.status(500).json({ error: 'Server error fetching Classwork set', details: error.message });
  }
});

router.delete('/classwork/sets/:id', verifyToken, async (req, res) => {
  try {
    await ensureQuestionBankSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const setId = Number(req.params.id);

    const [[setRow]] = await db.query(
      `SELECT id FROM quiz_sets WHERE id = ? AND teacher_id = ? AND status = 'active'`,
      [setId, teacherId]
    );
    if (!setRow) return res.status(404).json({ error: 'Classwork set not found' });

    await db.query(
      `UPDATE question_bank SET status = 'archived'
       WHERE quiz_set_id = ? AND teacher_id = ? AND status = 'active'`,
      [setId, teacherId]
    );
    await db.query(
      `UPDATE quiz_sets SET status = 'archived' WHERE id = ? AND teacher_id = ?`,
      [setId, teacherId]
    );
    res.json({ message: 'Classwork set removed' });
  } catch (error) {
    console.error('Delete quiz set error:', error);
    res.status(500).json({ error: 'Server error deleting Classwork set', details: error.message });
  }
});

router.get('/classwork', verifyToken, async (req, res) => {
  try {
    await ensureQuestionBankSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { grade, subject_id, lesson_plan_id, q, item_type, quiz_set_id } = req.query;

    const assignmentRows = await getTeacherAssignmentRows(teacherId);
    const allowedGrades = [...new Set(assignmentRows.map((r) => Number(r.grade_level)).filter(Boolean))];
    if (!allowedGrades.length) {
      return res.json([]);
    }

    let sql = `SELECT qb.*, s.NAME as subject_name
               FROM question_bank qb
               LEFT JOIN subjects s ON s.id = qb.subject_id
               WHERE qb.teacher_id = ? AND qb.status = 'active'`;
    const params = [teacherId];

    if (grade) {
      const g = Number(grade);
      if (!allowedGrades.includes(g)) {
        return res.json([]);
      }
      sql += ` AND qb.grade_level = ?`;
      params.push(g);
    } else {
      sql += ` AND qb.grade_level IN (${allowedGrades.map(() => '?').join(',')})`;
      params.push(...allowedGrades);
    }
    if (subject_id) {
      sql += ` AND qb.subject_id = ?`;
      params.push(Number(subject_id));
    }
    if (lesson_plan_id) {
      sql += ` AND qb.lesson_plan_id = ?`;
      params.push(Number(lesson_plan_id));
    }
    if (quiz_set_id) {
      sql += ` AND qb.quiz_set_id = ?`;
      params.push(Number(quiz_set_id));
    }
    if (
      item_type &&
      isAllowedItemType(item_type)
    ) {
      sql += ` AND qb.item_type = ?`;
      params.push(String(item_type));
    }
    if (q && String(q).trim()) {
      sql += ` AND (qb.question LIKE ? OR qb.lesson_title LIKE ?)`;
      const like = `%${String(q).trim()}%`;
      params.push(like, like);
    }

    sql += ` ORDER BY qb.updated_at DESC LIMIT 200`;
    const [rows] = await db.query(sql, params);
    res.json(rows.map(formatBankRow));
  } catch (error) {
    console.error('List classwork error:', error);
    res.status(500).json({ error: 'Server error fetching Classwork', details: error.message });
  }
});

router.post('/classwork', verifyToken, async (req, res) => {
  try {
    await ensureQuestionBankSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const {
      question,
      choices,
      answer,
      points,
      grade_level,
      subject_id,
      lesson_plan_id,
      lesson_title,
      item_type,
      quiz_set_id,
      rubric
    } = req.body || {};

    const qText = String(question || '').trim();
    if (!qText) {
      return res.status(400).json({
        error: isActivityType(item_type)
          ? 'Activity description is required'
          : 'Quiz question is required'
      });
    }
    if (!grade_level) return res.status(400).json({ error: 'grade_level is required' });

    const assignmentRows = await getTeacherAssignmentRows(teacherId);
    const allowedGrades = [...new Set(assignmentRows.map((r) => Number(r.grade_level)).filter(Boolean))];
    if (!allowedGrades.includes(Number(grade_level))) {
      return res.status(403).json({
        error: `Grade ${grade_level} is not in your assigned classes.`
      });
    }

    let quizSetId = quiz_set_id ? Number(quiz_set_id) : null;
    let inheritedSubjectId = subject_id ? Number(subject_id) : null;
    if (quizSetId) {
      const [[setRow]] = await db.query(
        `SELECT id, grade_level, subject_id FROM quiz_sets
         WHERE id = ? AND teacher_id = ? AND status = 'active'`,
        [quizSetId, teacherId]
      );
      if (!setRow) return res.status(404).json({ error: 'Classwork set not found' });
      if (Number(setRow.grade_level) !== Number(grade_level)) {
        return res.status(400).json({ error: 'Item grade must match the Classwork set grade.' });
      }
      if (!inheritedSubjectId && setRow.subject_id) {
        inheritedSubjectId = Number(setRow.subject_id);
      }
    }

    let type = isAllowedItemType(item_type)
      ? canonicalItemType(item_type)
      : normalizeChoices(choices)?.length
        ? 'mcq'
        : 'short_answer';
    type = canonicalItemType(type);
    let choiceList = storesChoiceList(type) ? normalizeChoices(choices) : null;
    if (type === 'true_false') choiceList = ['True', 'False'];
    if (type === 'mcq' && (!choiceList || choiceList.length < 2)) {
      return res.status(400).json({ error: 'MCQ items need at least 2 choices' });
    }
    if (type === 'fill_blank' && (!choiceList || choiceList.length < 2)) {
      return res.status(400).json({ error: 'Fill in the blank needs at least 2 word-bank words' });
    }
    if (type === 'matching' && (!choiceList || choiceList.filter((c) => String(c).includes('|')).length < 3)) {
      return res.status(400).json({ error: 'Matching needs at least 3 pairs written as left | right' });
    }
    if (type === 'matching' && matchingRightsRepeat(choiceList)) {
      return res.status(400).json({ error: 'Each matching answer can be used only once' });
    }
    if (type === 'sequencing' && (!choiceList || choiceList.length < 3)) {
      return res.status(400).json({ error: 'Sequencing needs at least 3 steps' });
    }
    let storedAnswer = answer != null ? String(answer).trim().slice(0, 500) : null;
    if (type === 'true_false') storedAnswer = normalizeTrueFalseAnswer(storedAnswer);
    if (type === 'matching' && choiceList) {
      storedAnswer = choiceList.filter((c) => String(c).includes('|')).join('; ').slice(0, 500);
    }
    if (type === 'sequencing' && choiceList) {
      storedAnswer = choiceList.join(' | ').slice(0, 500);
    }
    if (type === 'identification' && !storedAnswer) {
      return res.status(400).json({ error: 'Identification needs a correct answer' });
    }
    if (type === 'identification' && choiceList) {
      const key = String(storedAnswer || '').trim().toLowerCase();
      choiceList = choiceList.filter((c) => String(c).trim().toLowerCase() !== key);
      if (!choiceList.length) choiceList = null;
    }

    const pts = Math.max(0.5, Number(points) || 1);
    const rubricObj = isActivityType(type) ? normalizeRubric(rubric, pts) : null;
    const folder = !isActivityType(type) && String(req.body?.folder || '').toLowerCase() === 'exam'
      ? 'exam'
      : 'quiz';

    const [result] = await db.query(
      `INSERT INTO question_bank
        (teacher_id, quiz_set_id, subject_id, grade_level, lesson_plan_id, lesson_title,
         item_type, question, choices, answer, points, rubric, source, folder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
      [
        teacherId,
        quizSetId,
        inheritedSubjectId,
        Number(grade_level),
        lesson_plan_id ? Number(lesson_plan_id) : null,
        lesson_title ? String(lesson_title).slice(0, 255) : null,
        type,
        qText,
        choiceList ? JSON.stringify(choiceList) : null,
        storedAnswer,
        pts,
        rubricObj ? JSON.stringify(rubricObj) : null,
        folder
      ]
    );

    res.status(201).json({
      id: result.insertId,
      quiz_set_id: quizSetId,
      folder,
      message: folder === 'exam'
        ? 'Exam question added.'
        : isActivityType(type) ? 'Activity added.' : 'Quiz question added.'
    });
  } catch (error) {
    console.error('Create classwork item error:', error);
    res.status(500).json({ error: 'Server error creating bank item', details: error.message });
  }
});

router.put('/classwork/:id', verifyToken, async (req, res) => {
  try {
    await ensureQuestionBankSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const [[row]] = await db.query(
      `SELECT * FROM question_bank WHERE id = ? AND teacher_id = ? AND status = 'active'`,
      [id, teacherId]
    );
    if (!row) return res.status(404).json({ error: 'Classwork item not found' });

    const {
      question,
      choices,
      answer,
      points,
      grade_level,
      subject_id,
      lesson_title,
      item_type,
      rubric
    } = req.body || {};

    const qText = question != null ? String(question).trim() : row.question;
    if (!qText) {
      return res.status(400).json({
        error: isActivityType(item_type || row.item_type)
          ? 'Activity description cannot be empty'
          : 'Quiz question cannot be empty'
      });
    }

    let choiceList = parseChoicesColumn(row.choices);
    if (choices !== undefined) choiceList = normalizeChoices(choices);

    let type = row.item_type;
    if (item_type && isAllowedItemType(item_type)) {
      type = canonicalItemType(item_type);
    } else if (choices !== undefined) {
      type = choiceList && choiceList.length >= 2 ? 'mcq' : isActivityType(row.item_type) ? 'activity' : 'short_answer';
    }
    type = canonicalItemType(type);
    if (!storesChoiceList(type)) choiceList = null;
    if (type === 'true_false') choiceList = ['True', 'False'];

    if (type === 'mcq' && (!choiceList || choiceList.length < 2)) {
      return res.status(400).json({ error: 'MCQ items need at least 2 choices' });
    }
    if (type === 'fill_blank' && (!choiceList || choiceList.length < 2)) {
      return res.status(400).json({ error: 'Fill in the blank needs at least 2 word-bank words' });
    }
    if (type === 'matching' && (!choiceList || choiceList.filter((c) => String(c).includes('|')).length < 3)) {
      return res.status(400).json({ error: 'Matching needs at least 3 pairs written as left | right' });
    }
    if (type === 'matching' && matchingRightsRepeat(choiceList)) {
      return res.status(400).json({ error: 'Each matching answer can be used only once' });
    }
    if (type === 'sequencing' && (!choiceList || choiceList.length < 3)) {
      return res.status(400).json({ error: 'Sequencing needs at least 3 steps' });
    }

    let nextAnswer =
      answer !== undefined
        ? answer != null
          ? String(answer).trim().slice(0, 500)
          : null
        : row.answer;
    const nextPoints =
      points != null ? Math.max(0.5, Number(points) || 1) : Number(row.points) || 1;
    const nextGrade =
      grade_level != null ? Number(grade_level) : Number(row.grade_level);
    const assignmentRows = await getTeacherAssignmentRows(teacherId);
    const allowedGrades = [...new Set(assignmentRows.map((r) => Number(r.grade_level)).filter(Boolean))];
    if (!allowedGrades.includes(nextGrade)) {
      return res.status(403).json({
        error: `Grade ${nextGrade} is not in your assigned classes.`
      });
    }
    const nextSubject =
      subject_id !== undefined
        ? subject_id
          ? Number(subject_id)
          : null
        : row.subject_id;
    const nextLessonTitle =
      lesson_title != null ? String(lesson_title).slice(0, 255) : row.lesson_title;

    let nextRubric = normalizeRubric(row.rubric, nextPoints);
    if (rubric !== undefined) {
      nextRubric = isActivityType(type) ? normalizeRubric(rubric, nextPoints) : null;
    } else if (!isActivityType(type)) {
      nextRubric = null;
    }
    if (type === 'true_false') nextAnswer = normalizeTrueFalseAnswer(nextAnswer);
    if (type === 'matching' && choiceList) {
      nextAnswer = choiceList.filter((c) => String(c).includes('|')).join('; ').slice(0, 500);
    }
    if (type === 'sequencing' && choiceList) {
      nextAnswer = choiceList.join(' | ').slice(0, 500);
    }
    if (type === 'identification' && !String(nextAnswer || '').trim()) {
      return res.status(400).json({ error: 'Identification needs a correct answer' });
    }
    if (type === 'identification') {
      const key = String(nextAnswer || '').trim().toLowerCase();
      choiceList = (choiceList || []).filter((c) => String(c).trim().toLowerCase() !== key);
      if (!choiceList.length) choiceList = null;
    }

    await db.query(
      `UPDATE question_bank SET
         question = ?, choices = ?, answer = ?, points = ?,
         grade_level = ?, subject_id = ?, lesson_title = ?, item_type = ?, rubric = ?
       WHERE id = ? AND teacher_id = ?`,
      [
        qText,
        storesChoiceList(type) && choiceList ? JSON.stringify(choiceList) : null,
        nextAnswer,
        nextPoints,
        nextGrade,
        nextSubject,
        nextLessonTitle,
        type,
        nextRubric ? JSON.stringify(nextRubric) : null,
        id,
        teacherId
      ]
    );

    const [[updated]] = await db.query(
      `SELECT qb.*, s.NAME as subject_name
       FROM question_bank qb
       LEFT JOIN subjects s ON s.id = qb.subject_id
       WHERE qb.id = ?`,
      [id]
    );
    res.json({
      message: isActivityType(type) ? 'Activity updated.' : 'Quiz question updated.',
      item: formatBankRow(updated)
    });
  } catch (error) {
    console.error('Update classwork item error:', error);
    res.status(500).json({ error: 'Server error updating bank item', details: error.message });
  }
});

router.delete('/classwork/:id', verifyToken, async (req, res) => {
  try {
    await ensureQuestionBankSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const [result] = await db.query(
      `UPDATE question_bank SET status = 'archived' WHERE id = ? AND teacher_id = ? AND status = 'active'`,
      [id, teacherId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Classwork item not found' });
    res.json({ message: 'Removed from Classwork.' });
  } catch (error) {
    console.error('Delete classwork item error:', error);
    res.status(500).json({ error: 'Server error deleting bank item', details: error.message });
  }
});

router.post('/assessments/from-bank', verifyToken, async (req, res) => {
  try {
    await ensureQuestionBankSchema();
    await ensureAssessmentSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const {
      title,
      type = 'quiz',
      grade_level,
      section,
      subject_id,
      quarter,
      question_ids,
      max_score,
      section_totals: sectionTotalsBody,
      activity_mode: activityModeBody,
      activity_target_at: activityTargetBody
    } = req.body || {};

    if (!['quiz', 'activity', 'exam'].includes(type)) {
      return res.status(400).json({ error: 'Type must be quiz, activity, or exam' });
    }
    let activityMode = null;
    let activityTargetAt = null;
    if (type === 'activity') {
      activityMode = String(activityModeBody || '').toLowerCase();
      if (activityMode !== 'classroom' && activityMode !== 'take_home') {
        return res.status(400).json({ error: 'Choose Classroom activity or Take home' });
      }
      activityTargetAt = normalizeSqlDatetime(activityTargetBody);
      if (!activityTargetAt) {
        return res.status(400).json({ error: 'Set a target date' });
      }
    }
    if (!grade_level || !section) {
      return res.status(400).json({ error: 'Grade and section are required' });
    }
    if (!Array.isArray(question_ids) || !question_ids.length) {
      return res.status(400).json({ error: 'Select at least one bank item' });
    }

    try {
      await assertTeacherClassAssignment(teacherId, grade_level, section);
    } catch (e) {
      return res.status(e.status || 403).json({ error: e.message });
    }

    const ids = question_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
    if (!ids.length) return res.status(400).json({ error: 'Select at least one bank item' });

    const placeholders = ids.map(() => '?').join(',');
    const [items] = await db.query(
      `SELECT * FROM question_bank
       WHERE teacher_id = ? AND status = 'active' AND id IN (${placeholders})`,
      [teacherId, ...ids]
    );
    if (!items.length) return res.status(400).json({ error: 'No matching bank items found' });

    // Preserve teacher selection order
    const byId = new Map(items.map((it) => [it.id, it]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    const targetGrade = Number(grade_level);
    const mismatched = ordered.filter((it) => Number(it.grade_level) !== targetGrade);
    if (mismatched.length) {
      return res.status(400).json({
        error: `All selected bank items must be Grade ${targetGrade} to match the class.`
      });
    }

    const pointsByItemId = new Map();
    let sectionTotalsParsed = null;
    if (sectionTotalsBody && typeof sectionTotalsBody === 'object' && !Array.isArray(sectionTotalsBody)) {
      sectionTotalsParsed = {};
      for (const [key, raw] of Object.entries(sectionTotalsBody)) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) sectionTotalsParsed[String(key)] = n;
      }
      const byType = new Map();
      for (const it of ordered) {
        const t = String(it.item_type || 'mcq');
        if (!byType.has(t)) byType.set(t, []);
        byType.get(t).push(it);
      }
      for (const [typeKey, list] of byType.entries()) {
        const partTotal = sectionTotalsParsed[typeKey] != null
          ? Number(sectionTotalsParsed[typeKey])
          : list.reduce((s, it) => s + (Number(it.points) || 1), 0);
        const n = list.length;
        if (!n) continue;
        const each = Math.floor((partTotal / n) * 100) / 100;
        let assigned = 0;
        list.forEach((it, idx) => {
          const pts = idx === n - 1
            ? Math.round((partTotal - assigned) * 100) / 100
            : each;
          pointsByItemId.set(it.id, Math.max(0, pts));
          assigned += pts;
        });
      }
    } else {
      ordered.forEach((it) => pointsByItemId.set(it.id, Number(it.points) || 1));
    }

    const pointsSum = ordered.reduce((sum, it) => sum + (pointsByItemId.get(it.id) || 1), 0);
    let maxScore = Math.max(1, Number(max_score) || Math.round(pointsSum * 100) / 100 || ordered.length);
    if (type === 'activity') {
      let rubricSum = 0;
      let hasRubric = false;
      for (const it of ordered) {
        const cap = rubricPointsTotal(it.rubric, it.points);
        if (cap > 0) {
          hasRubric = true;
          rubricSum += cap;
        } else {
          rubricSum += pointsByItemId.get(it.id) || Number(it.points) || 1;
        }
      }
      if (hasRubric && rubricSum > 0) {
        maxScore = Math.max(1, Math.round(rubricSum * 100) / 100);
      }
    }
    const qtr = normalizeQuarter(quarter || 'Q1');
    const current = await getCurrentQuarter();
    if (!isQuarterUnlocked(qtr, current)) {
      return res.status(400).json({
        error: `${qtr} is locked. Admin has unlocked through ${current} only.`
      });
    }

    const subjectId =
      subject_id != null && subject_id !== ''
        ? Number(subject_id)
        : ordered.find((it) => it.subject_id)?.subject_id || null;
    const recordTitle =
      String(title || '').trim() ||
      `${typeLabelFallback(type)} from bank (${ordered.length} items)`;

    const lesson = dominantLesson(ordered);
    let assessmentId;
    try {
      const [result] = await db.query(
        `INSERT INTO assessments (title, TYPE, subject_id, grade_level, section, max_score, created_by, quarter, lesson_plan_id, lesson_title)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordTitle,
          type,
          subjectId,
          Number(grade_level),
          String(section).trim(),
          maxScore,
          teacherId,
          qtr,
          lesson.lesson_plan_id,
          lesson.lesson_title
        ]
      );
      assessmentId = result.insertId;
    } catch (inner) {
      const [result] = await db.query(
        `INSERT INTO assessments (title, TYPE, subject_id, grade_level, section, max_score, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          recordTitle,
          type,
          subjectId,
          Number(grade_level),
          String(section).trim(),
          maxScore,
          teacherId
        ]
      );
      assessmentId = result.insertId;
    }

    if (activityMode && activityTargetAt) {
      await db.query(
        `UPDATE assessments SET activity_mode = ?, activity_target_at = ? WHERE id = ?`,
        [activityMode, activityTargetAt, assessmentId]
      );
    }

    for (let i = 0; i < ordered.length; i++) {
      const it = ordered[i];
      const itemType = canonicalItemType(it.item_type || 'mcq');
      const rubricObj = isActivityType(itemType)
        ? normalizeRubric(it.rubric, it.points)
        : null;
      const rubricCap = rubricObj ? rubricPointsTotal(rubricObj, it.points) : 0;
      const itemPoints = rubricCap > 0
        ? rubricCap
        : (pointsByItemId.has(it.id) ? pointsByItemId.get(it.id) : (Number(it.points) || 1));
      await db.query(
        `INSERT INTO assessment_questions
          (assessment_id, question_bank_id, sort_order, item_type, question, choices, answer, points, rubric)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assessmentId,
          it.id,
          i,
          itemType,
          it.question,
          it.choices
            ? typeof it.choices === 'string'
              ? it.choices
              : JSON.stringify(normalizeChoices(it.choices) || it.choices)
            : null,
          it.answer,
          itemPoints,
          rubricObj ? JSON.stringify(rubricObj) : null
        ]
      );
    }

    await logActivity(
      db,
      teacherId,
      type === 'exam'
        ? 'Created period exam from Classwork'
        : type === 'activity'
          ? 'Created activity from Classwork'
          : 'Created quiz from Classwork',
      'assessment',
      recordTitle,
      `Grade ${grade_level}-${String(section).trim()} · ${ordered.length} items`
    );

    res.status(201).json({
      id: assessmentId,
      message:
        type === 'exam'
          ? 'Exam created. Find it in Records → Exam.'
          : type === 'activity'
            ? 'Activity created. Find it in Records → Activity.'
            : 'Quiz created. Find it in Records → Quiz.',
      question_count: ordered.length,
      max_score: maxScore
    });
  } catch (error) {
    console.error('Create assessment from bank error:', error);
    res.status(500).json({
      error: 'Server error creating assessment from bank',
      details: error.message
    });
  }
});

function typeLabelFallback(type) {
  if (type === 'quiz') return 'Quiz';
  if (type === 'activity') return 'Activity';
  if (type === 'exam') return 'Exam';
  return 'Assessment';
}

function sanitizeQuizLink(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      const err = new Error('Online link must start with http:// or https://');
      err.status = 400;
      throw err;
    }
    return u.toString().slice(0, 500);
  } catch (e) {
    if (e.status === 400) throw e;
    const err = new Error('Invalid online link URL');
    err.status = 400;
    throw err;
  }
}

async function ensureAssessmentSchema() {
  try {
    await db.query(`ALTER TABLE assessments ADD COLUMN quarter VARCHAR(10) DEFAULT 'Q1'`);
  } catch (e) { /* column may already exist */ }
  try {
    await db.query(`ALTER TABLE assessments ADD COLUMN quiz_link VARCHAR(500) NULL`);
  } catch (e) { /* column may already exist */ }
  try {
    await db.query(`ALTER TABLE assessment_scores ADD COLUMN rubric_scores JSON NULL`);
  } catch (e) { /* column may already exist */ }
  // Lesson link (parent analytics: strengths / weaknesses per lesson)
  try {
    await db.query(`ALTER TABLE assessments ADD COLUMN lesson_plan_id INT NULL`);
  } catch (e) { /* column may already exist */ }
  try {
    await db.query(`ALTER TABLE assessments ADD COLUMN lesson_title VARCHAR(255) NULL`);
  } catch (e) { /* column may already exist */ }
  try {
    await db.query(`ALTER TABLE assessments ADD COLUMN rubric JSON NULL`);
  } catch (e) { /* column may already exist */ }
  try {
    const { ensurePortalClassworkSchema } = require('../utils/portalClasswork');
    await ensurePortalClassworkSchema();
  } catch (e) {
    console.warn('[portal] schema ensure:', e.message);
  }
  try {
    const { ensureQuizShareSchema } = require('../utils/quizShare');
    await ensureQuizShareSchema();
  } catch (e) {
    console.warn('[quiz-share] schema ensure:', e.message);
  }
  try {
    await ensureQuizAttendanceSchema();
  } catch (e) {
    console.warn('[quiz-attendance] schema ensure:', e.message);
  }
  await backfillAssessmentLessons();
}

/**
 * One-time fill of assessments.lesson_plan_id / lesson_title for rows created
 * before the columns existed. Sources: approved AI drafts, then the dominant
 * lesson of attached question-bank items.
 */
async function backfillAssessmentLessons() {
  try {
    await db.query(
      `UPDATE assessments a
       JOIN ai_recommendations r ON r.assessment_id = a.id
       JOIN lesson_plans lp ON lp.id = r.lesson_plan_id
       SET a.lesson_plan_id = r.lesson_plan_id, a.lesson_title = lp.title
       WHERE a.lesson_title IS NULL`
    );
  } catch (e) { /* tables may not exist yet */ }
  try {
    const [rows] = await db.query(
      `SELECT aq.assessment_id, qb.lesson_plan_id, qb.lesson_title, COUNT(*) as n
       FROM assessment_questions aq
       JOIN question_bank qb ON qb.id = aq.question_bank_id
       JOIN assessments a ON a.id = aq.assessment_id
       WHERE a.lesson_title IS NULL
         AND (qb.lesson_title IS NOT NULL OR qb.lesson_plan_id IS NOT NULL)
       GROUP BY aq.assessment_id, qb.lesson_plan_id, qb.lesson_title
       ORDER BY aq.assessment_id, n DESC`
    );
    const seen = new Set();
    for (const r of rows) {
      if (seen.has(r.assessment_id)) continue;
      seen.add(r.assessment_id);
      let title = r.lesson_title || null;
      if (!title && r.lesson_plan_id) {
        const [[lp]] = await db.query('SELECT title FROM lesson_plans WHERE id = ?', [r.lesson_plan_id]);
        title = lp?.title || null;
      }
      if (!title && !r.lesson_plan_id) continue;
      await db.query(
        'UPDATE assessments SET lesson_plan_id = ?, lesson_title = ? WHERE id = ? AND lesson_title IS NULL',
        [r.lesson_plan_id || null, title, r.assessment_id]
      );
    }
  } catch (e) { /* tables may not exist yet */ }
}

/** Pick the most common (lesson_plan_id, lesson_title) among bank items. */
function dominantLesson(items) {
  const counts = new Map();
  for (const it of items || []) {
    const lpId = it.lesson_plan_id || null;
    const title = it.lesson_title ? String(it.lesson_title).trim() : '';
    if (!lpId && !title) continue;
    const key = `${lpId || 'x'}|${title}`;
    const cur = counts.get(key) || { lesson_plan_id: lpId, lesson_title: title || null, n: 0 };
    cur.n += 1;
    counts.set(key, cur);
  }
  let best = null;
  for (const v of counts.values()) {
    if (!best || v.n > best.n) best = v;
  }
  return best ? { lesson_plan_id: best.lesson_plan_id, lesson_title: best.lesson_title } : { lesson_plan_id: null, lesson_title: null };
}

function parseRubricScoresColumn(raw) {
  if (raw == null || raw === '') return null;
  let v = raw;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) {
    v = v.toString('utf8');
  }
  for (let i = 0; i < 4; i++) {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    if (typeof v !== 'string') break;
    const t = v.trim();
    if (!t || t === '[object Object]') return null;
    try {
      v = JSON.parse(t);
    } catch {
      return null;
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

ensureAssessmentSchema();

router.post('/assessments/:id/assign-link', verifyToken, async (req, res) => {
  try {
    await ensureAssessmentSchema();
    await ensureQuizAttendanceSchema();
    const { generateShareToken, getAssessmentQuestions, ensureQuizShareSchema } = require('../utils/quizShare');
    await ensureQuizShareSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;

    const [[assessment]] = await db.query(
      `SELECT id, title, TYPE as type, grade_level, section, subject_id, share_token, share_enabled, created_by,
              activity_mode, activity_target_at
       FROM assessments WHERE id = ? AND created_by = ?`,
      [id, teacherId]
    );
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    try {
      await assertTeacherClassAssignment(teacherId, assessment.grade_level, assessment.section);
    } catch (e) {
      return res.status(e.status || 403).json({ error: e.message });
    }

    const questions = await getAssessmentQuestions(assessment.id);
    if (!questions.length) {
      return res.status(400).json({
        error: 'Add Classwork items first before assigning a shared link.'
      });
    }

    const today = manilaISODate();
    const slot = attendanceSlotForAssessment(
      { ...assessment, quiz_attendance_date: today, quiz_attendance_session: null },
      { date: today, session: req.body?.session, subject_id: assessment.subject_id }
    );
    const completion = await getAttendanceCompletion(
      assessment.grade_level,
      assessment.section,
      slot
    );
    if (!completion.complete) {
      const names = completion.unmarked.slice(0, 5).map((u) => u.name).join('; ');
      const more = completion.unmarked.length > 5 ? ` (+${completion.unmarked.length - 5} more)` : '';
      return res.status(400).json({
        error: `Mark attendance for every student before enabling the link (${completion.unmarked.length} unmarked).`,
        unmarked: completion.unmarked,
        hint: names ? `Unmarked: ${names}${more}` : undefined
      });
    }

    let token = assessment.share_token;
    let quiz_closes_at;
    if (String(assessment.activity_mode || '') === 'take_home') {
      quiz_closes_at = normalizeSqlDatetime(assessment.activity_target_at);
      if (!quiz_closes_at) {
        return res.status(400).json({ error: 'Set a target date before enabling the link.' });
      }
    } else {
      quiz_closes_at = resolveQuizWindowsFromBody(req.body || {}).quiz_closes_at;
      if (!quiz_closes_at) {
        return res.status(400).json({
          error: 'Set how many minutes the link stays open so it can close automatically.'
        });
      }
    }

    const attendanceUpdates = [
      slot.date,
      slot.session,
      isSubjectGrade(assessment.grade_level) ? assessment.subject_id : null,
      JSON.stringify([]),
      quiz_closes_at,
      null
    ];

    if (!token) {
      for (let i = 0; i < 5; i++) {
        token = generateShareToken();
        try {
          await db.query(
            `UPDATE assessments SET share_token = ?, share_enabled = 1,
             quiz_attendance_date = ?, quiz_attendance_session = ?,
             quiz_subject_id = ?, quiz_makeup_student_ids = ?,
             quiz_closes_at = ?, quiz_makeup_closes_at = ?
             WHERE id = ? AND created_by = ?`,
            [token, ...attendanceUpdates, id, teacherId]
          );
          break;
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') token = null;
          else throw err;
        }
      }
      if (!token) return res.status(500).json({ error: 'Could not generate a unique link' });
    } else {
      await db.query(
        `UPDATE assessments SET share_enabled = 1,
         quiz_attendance_date = ?, quiz_attendance_session = ?,
         quiz_subject_id = ?, quiz_makeup_student_ids = ?,
         quiz_closes_at = ?, quiz_makeup_closes_at = ?
         WHERE id = ? AND created_by = ?`,
        [...attendanceUpdates, id, teacherId]
      );
    }

    await logActivity(
      db,
      teacherId,
      'Assigned shared link',
      'assessment',
      assessment.title,
      `token=${token}`
    );

    let smsQueued = 0;
    const kind = String(assessment.type || 'quiz').toLowerCase();
    const shareSegment = kind === 'activity' || kind === 'exam' ? kind : 'quiz';
    if (kind === 'activity' && String(assessment.activity_mode || '') === 'take_home') {
      try {
        const notice = await notifyTakeHomeLink({
          title: assessment.title,
          grade: assessment.grade_level,
          section: assessment.section,
          token,
          origin: `${req.protocol}://${req.get('host')}`,
          closesAt: quiz_closes_at
        });
        smsQueued = notice.queued;
      } catch (err) {
        console.error('Take-home link SMS error:', err.message);
      }
    }

    const linkMessage = kind === 'activity' && String(assessment.activity_mode || '') === 'take_home'
      ? (smsQueued
        ? `Shared link is active. Texted the link to ${smsQueued} parent${smsQueued === 1 ? '' : 's'}.`
        : 'Shared link is active.')
      : 'Shared link is active. Present and Late students can open it.';

    res.json({
      message: linkMessage,
      share_token: token,
      share_enabled: true,
      share_path: `/${shareSegment}/${token}`,
      type: kind,
      sms_queued: smsQueued,
      question_count: questions.length,
      attendance_date: today,
      attendance_session: slot.session,
      quiz_closes_at,
      quiz_makeup_closes_at: null
    });
  } catch (error) {
    console.error('Assign quiz link error:', error);
    res.status(500).json({ error: 'Server error assigning link', details: error.message });
  }
});

router.post('/assessments/:id/revoke-link', verifyToken, async (req, res) => {
  try {
    await ensureAssessmentSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const [[assessment]] = await db.query(
      `SELECT id, title FROM assessments WHERE id = ? AND created_by = ?`,
      [id, teacherId]
    );
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    await db.query(
      `UPDATE assessments SET share_enabled = 0, quiz_makeup_student_ids = NULL,
       quiz_closes_at = NULL, quiz_makeup_closes_at = NULL
       WHERE id = ? AND created_by = ?`,
      [id, teacherId]
    );

    await logActivity(
      db,
      teacherId,
      'Revoked shared link',
      'assessment',
      assessment.title,
      null
    );

    res.json({ message: 'Shared link disabled.', share_enabled: false });
  } catch (error) {
    console.error('Revoke quiz link error:', error);
    res.status(500).json({ error: 'Server error revoking link', details: error.message });
  }
});

router.post('/assessments/:id/portal-post', verifyToken, async (req, res) => {
  try {
    await ensureAssessmentSchema();
    const { normalizeSqlDatetime, isPastManila } = require('../utils/quizAttendance');
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const [[assessment]] = await db.query(
      `SELECT id, title, grade_level, section
       FROM assessments WHERE id = ? AND created_by = ?`,
      [id, teacherId]
    );
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    try {
      await assertTeacherClassAssignment(teacherId, assessment.grade_level, assessment.section);
    } catch (e) {
      return res.status(e.status || 403).json({ error: e.message });
    }
    const [questions] = await db.query(
      'SELECT id FROM assessment_questions WHERE assessment_id = ? LIMIT 1',
      [id]
    );
    if (!questions.length) {
      return res.status(400).json({ error: 'Add classwork items before posting to the student portal.' });
    }
    const dueAt = normalizeSqlDatetime(req.body?.due_at);
    if (!dueAt) return res.status(400).json({ error: 'Set a due date before posting.' });
    if (isPastManila(dueAt)) {
      return res.status(400).json({ error: 'The due date must still be ahead.' });
    }
    await db.query(
      'UPDATE assessments SET portal_posted = 1, portal_due_at = ? WHERE id = ? AND created_by = ?',
      [dueAt, id, teacherId]
    );
    await logActivity(db, teacherId, 'Posted classwork to student portal', 'assessment', assessment.title, `due ${dueAt}`);
    res.json({
      message: 'Posted to the student portal.',
      portal_posted: 1,
      portal_due_at: dueAt
    });
  } catch (error) {
    console.error('Portal post error:', error);
    res.status(500).json({ error: 'Server error posting classwork' });
  }
});

router.post('/assessments/:id/portal-unpost', verifyToken, async (req, res) => {
  try {
    await ensureAssessmentSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const [[assessment]] = await db.query(
      'SELECT id, title FROM assessments WHERE id = ? AND created_by = ?',
      [id, teacherId]
    );
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    await db.query(
      'UPDATE assessments SET portal_posted = 0, portal_due_at = NULL WHERE id = ? AND created_by = ?',
      [id, teacherId]
    );
    await logActivity(db, teacherId, 'Removed classwork from student portal', 'assessment', assessment.title, null);
    res.json({ message: 'Removed from the student portal.', portal_posted: 0, portal_due_at: null });
  } catch (error) {
    console.error('Portal unpost error:', error);
    res.status(500).json({ error: 'Server error removing the post' });
  }
});

router.post('/assessments/:id/quiz-windows', verifyToken, async (req, res) => {
  try {
    await ensureAssessmentSchema();
    await ensureQuizAttendanceSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const [[assessment]] = await db.query(
      `SELECT id, title, share_enabled, activity_mode FROM assessments WHERE id = ? AND created_by = ?`,
      [id, teacherId]
    );
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (!Number(assessment.share_enabled)) {
      return res.status(400).json({ error: 'Enable the shared link before updating deadlines.' });
    }
    if (String(assessment.activity_mode || '') === 'take_home') {
      return res.status(400).json({ error: 'Take-home activities close on the target date.' });
    }

    const { quiz_closes_at } = resolveQuizWindowsFromBody(req.body || {});
    if (!quiz_closes_at) {
      return res.status(400).json({
        error: 'Set how many minutes the link stays open so it can close automatically.'
      });
    }

    await db.query(
      `UPDATE assessments SET quiz_closes_at = ?
       WHERE id = ? AND created_by = ?`,
      [quiz_closes_at, id, teacherId]
    );

    res.json({
      message: 'Link deadline updated.',
      quiz_closes_at
    });
  } catch (error) {
    console.error('Update quiz windows error:', error);
    res.status(500).json({ error: 'Server error updating deadlines', details: error.message });
  }
});

router.post('/assessments/:id/makeup-quiz', verifyToken, async (req, res) => {
  try {
    await ensureAssessmentSchema();
    await ensureQuizAttendanceSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const { mode, student_ids: studentIdsBody } = req.body || {};

    const [[assessment]] = await db.query(
      `SELECT id, title, grade_level, section, subject_id, share_enabled, share_token,
              quiz_attendance_date, quiz_attendance_session, quiz_subject_id, quiz_makeup_student_ids,
              quiz_closes_at, quiz_makeup_closes_at
       FROM assessments WHERE id = ? AND created_by = ?`,
      [id, teacherId]
    );
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (!assessment.share_enabled || !assessment.share_token) {
      return res.status(400).json({ error: 'Enable the shared link first.' });
    }
    if (!assessment.quiz_attendance_date) {
      return res.status(400).json({
        error: 'This quiz has no attendance session yet. Re-enable the link after marking attendance.'
      });
    }

    const existing = parseMakeupIds(assessment.quiz_makeup_student_ids);
    const submittedSet = await getSubmittedStudentIds(assessment.id);

    // Revoke make-up access for selected students (not yet submitted)
    if (mode === 'revoke' || mode === 'unallow') {
      const revokeIds = Array.isArray(studentIdsBody)
        ? studentIdsBody.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        : [];
      if (!revokeIds.length) {
        return res.status(400).json({ error: 'Select at least one student to unallow.' });
      }
      const revokeSet = new Set(revokeIds);
      const alreadySubmitted = revokeIds.filter((sid) => submittedSet.has(sid));
      if (alreadySubmitted.length) {
        return res.status(400).json({
          error: 'Cannot unallow students who already submitted.',
          invalid_ids: alreadySubmitted
        });
      }
      const merged = existing.filter((sid) => !revokeSet.has(Number(sid)));
      await db.query(
        `UPDATE assessments SET quiz_makeup_student_ids = ? WHERE id = ? AND created_by = ?`,
        [JSON.stringify(merged), id, teacherId]
      );
      await logActivity(
        db,
        teacherId,
        'Revoked quiz make-up access',
        'assessment',
        assessment.title,
        `${revokeIds.length} student(s)`
      );
      return res.json({
        message: `Make-up access removed for ${revokeIds.length} student(s).`,
        revoked_count: revokeIds.length,
        makeup_student_ids: merged
      });
    }

    const candidates = await getMakeupCandidates(assessment);
    const candidateIds = new Set(candidates.map((c) => c.id));
    let grantIds = [];

    if (mode === 'all') {
      grantIds = candidates.map((c) => c.id);
    } else if (mode === 'selected' && Array.isArray(studentIdsBody)) {
      grantIds = studentIdsBody.map(Number).filter((n) => Number.isFinite(n) && n > 0);
      const invalid = grantIds.filter((sid) => !candidateIds.has(sid));
      if (invalid.length) {
        return res.status(400).json({
          error: 'Some selected students are not eligible for make-up (must be Absent or Excused and not yet submitted).',
          invalid_ids: invalid
        });
      }
    } else {
      return res.status(400).json({ error: 'Use mode "all", "selected", or "unallow" with student_ids.' });
    }

    if (!grantIds.length) {
      return res.status(400).json({ error: 'No eligible absent or excused students to grant make-up access.' });
    }

    let quiz_makeup_closes_at = assessment.quiz_makeup_closes_at || null;
    const makeupStillOpen = quiz_makeup_closes_at && !isPastManila(quiz_makeup_closes_at);
    if (!makeupStillOpen) {
      const resolved = resolveQuizWindowsFromBody(req.body || {});
      quiz_makeup_closes_at = resolved.quiz_makeup_closes_at;
      if (!quiz_makeup_closes_at) {
        return res.status(400).json({
          error: 'Set Extra Hours for make-up access when allowing students.'
        });
      }
    }

    const merged = [...new Set([...existing, ...grantIds])].filter((sid) => !submittedSet.has(sid));

    await db.query(
      `UPDATE assessments SET quiz_makeup_student_ids = ?, quiz_makeup_closes_at = ?
       WHERE id = ? AND created_by = ?`,
      [JSON.stringify(merged), quiz_makeup_closes_at, id, teacherId]
    );

    await logActivity(
      db,
      teacherId,
      'Granted quiz make-up access',
      'assessment',
      assessment.title,
      `${grantIds.length} student(s)`
    );

    res.json({
      message: `Make-up access granted for ${grantIds.length} student(s).`,
      granted_count: grantIds.length,
      makeup_student_ids: merged,
      quiz_makeup_closes_at
    });
  } catch (error) {
    console.error('Makeup quiz error:', error);
    res.status(500).json({ error: 'Server error granting make-up access', details: error.message });
  }
});

router.get('/assessments', verifyToken, async (req, res) => {
  try {
    const { grade, section, quarter } = req.query;
    if (!grade || !section) {
      return res.status(400).json({ error: 'grade and section are required' });
    }

    await ensureAssessmentSchema();
    let sql = `SELECT a.id, a.title, a.TYPE as type, a.subject_id, a.grade_level, a.section,
                      a.max_score, a.quiz_link, a.share_token, a.share_enabled, a.created_by, a.created_at,
                      a.quiz_attendance_date, a.quiz_attendance_session, a.quiz_subject_id,
                      a.activity_mode, a.activity_target_at, a.portal_posted, a.portal_due_at,
                      s.NAME as subject_name,
                      (SELECT COUNT(*) FROM assessment_scores sc WHERE sc.assessment_id = a.id) as scored_count,
                      (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id) as question_count
               FROM assessments a
               LEFT JOIN subjects s ON a.subject_id = s.id
               WHERE a.grade_level = ? AND a.section = ?`;
    const params = [grade, section];

    if (quarter) {
      sql += ` AND a.quarter = ?`;
      params.push(quarter);
    }

    sql += ` ORDER BY a.created_at DESC`;

    try {
      const [rows] = await db.query(sql, params);
      return res.json(rows.map((r) => ({
        ...r,
        quiz_attendance_date: r.quiz_attendance_date != null && r.quiz_attendance_date !== ''
          ? sqlDateToISO(r.quiz_attendance_date)
          : r.quiz_attendance_date
      })));
    } catch (inner) {
      const [rows] = await db.query(
        `SELECT a.id, a.title, a.TYPE as type, a.subject_id, a.grade_level, a.section,
                a.max_score, a.created_by, a.created_at, s.NAME as subject_name,
                (SELECT COUNT(*) FROM assessment_scores sc WHERE sc.assessment_id = a.id) as scored_count
         FROM assessments a
         LEFT JOIN subjects s ON a.subject_id = s.id
         WHERE a.grade_level = ? AND a.section = ?
         ORDER BY a.created_at DESC`,
        [grade, section]
      );
      return res.json(rows);
    }
  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({ error: 'Server error fetching assessments', details: error.message });
  }
});

router.post('/assessments', verifyToken, async (req, res) => {
  try {
    await ensureAssessmentSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { title, type, subject_id, grade_level, section, max_score, quarter, quiz_link, lesson_plan_id, rubric } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!['quiz', 'activity', 'exam'].includes(type)) {
      return res.status(400).json({ error: 'Type must be quiz, activity, or exam' });
    }
    if (!grade_level || !section) {
      return res.status(400).json({ error: 'Grade and section are required' });
    }

    try {
      await assertTeacherClassAssignment(teacherId, grade_level, section);
    } catch (e) {
      return res.status(e.status || 403).json({ error: e.message });
    }

    let quizLink = null;
    try {
      quizLink = sanitizeQuizLink(quiz_link);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    let maxScore = Math.max(1, Number(max_score) || 100);
    let rubricJson = null;
    if (type === 'activity') {
      const rubricObj = normalizeRubric(rubric, maxScore);
      if (!rubricObj?.categories?.length) {
        return res.status(400).json({ error: 'Add at least one named rubric category.' });
      }
      const total = rubricPointsTotal(rubricObj, maxScore);
      if (total > 0) maxScore = total;
      rubricJson = JSON.stringify(rubricObj);
    }
    const subjectId = subject_id ? Number(subject_id) : null;
    const qtr = normalizeQuarter(quarter || 'Q1');
    const current = await getCurrentQuarter();
    if (!isQuarterUnlocked(qtr, current)) {
      return res.status(400).json({
        error: `${qtr} is locked. Admin has unlocked through ${current} only.`
      });
    }

    // Optional lesson link (used by parent analytics)
    let lessonPlanId = null;
    let lessonTitle = null;
    if (lesson_plan_id != null && lesson_plan_id !== '') {
      const [[lp]] = await db.query(
        'SELECT id, title FROM lesson_plans WHERE id = ? AND uploaded_by = ?',
        [Number(lesson_plan_id), teacherId]
      );
      if (!lp) return res.status(400).json({ error: 'Selected lesson plan was not found' });
      lessonPlanId = lp.id;
      lessonTitle = String(lp.title || '').slice(0, 255) || null;
    }

    const storeRubric = async (assessmentId) => {
      if (!rubricJson || !assessmentId) return;
      try {
        await db.query('UPDATE assessments SET rubric = ? WHERE id = ?', [rubricJson, assessmentId]);
      } catch (e) { /* column may be missing on a partial schema */ }
    };

    try {
      const [result] = await db.query(
        `INSERT INTO assessments (title, TYPE, subject_id, grade_level, section, max_score, created_by, quarter, quiz_link, lesson_plan_id, lesson_title)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [String(title).trim(), type, subjectId, Number(grade_level), section, maxScore, teacherId, qtr, quizLink, lessonPlanId, lessonTitle]
      );
      await storeRubric(result.insertId);
      await logActivity(
        db,
        teacherId,
        'Created progress record',
        'assessment',
        String(title).trim(),
        `Grade ${grade_level}-${section} · ${qtr}`
      );
      return res.status(201).json({ id: result.insertId, message: 'Progress record created' });
    } catch (inner) {
      try {
        const [result] = await db.query(
          `INSERT INTO assessments (title, TYPE, subject_id, grade_level, section, max_score, created_by, quarter)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [String(title).trim(), type, subjectId, Number(grade_level), section, maxScore, teacherId, qtr]
        );
        await storeRubric(result.insertId);
        return res.status(201).json({ id: result.insertId, message: 'Progress record created' });
      } catch (inner2) {
        const [result] = await db.query(
          `INSERT INTO assessments (title, TYPE, subject_id, grade_level, section, max_score, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [String(title).trim(), type, subjectId, Number(grade_level), section, maxScore, teacherId]
        );
        await storeRubric(result.insertId);
        await logActivity(
          db,
          teacherId,
          'Created progress record',
          'assessment',
          String(title).trim(),
          `Grade ${grade_level}-${section}`
        );
        return res.status(201).json({ id: result.insertId, message: 'Progress record created' });
      }
    }
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({ error: 'Server error creating assessment', details: error.message });
  }
});

router.put('/assessments/:id', verifyToken, async (req, res) => {
  try {
    await ensureAssessmentSchema();
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const { quiz_link, max_score } = req.body || {};

    const [[assessment]] = await db.query(
      'SELECT id, title, max_score, quiz_link FROM assessments WHERE id = ? AND created_by = ?',
      [id, teacherId]
    );
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const updates = [];
    const params = [];
    const out = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'quiz_link')) {
      let quizLink;
      try {
        quizLink = sanitizeQuizLink(quiz_link);
      } catch (e) {
        return res.status(e.status || 400).json({ error: e.message });
      }
      updates.push('quiz_link = ?');
      params.push(quizLink);
      out.quiz_link = quizLink;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'max_score')) {
      const maxScore = Math.max(1, Number(max_score) || 0);
      if (!Number.isFinite(maxScore) || maxScore < 1) {
        return res.status(400).json({ error: 'Total score must be at least 1.' });
      }
      updates.push('max_score = ?');
      params.push(maxScore);
      out.max_score = maxScore;
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    params.push(id, teacherId);
    await db.query(
      `UPDATE assessments SET ${updates.join(', ')} WHERE id = ? AND created_by = ?`,
      params
    );

    res.json({
      message: out.max_score != null && out.quiz_link !== undefined
        ? 'Record updated'
        : out.max_score != null
          ? 'Total score saved'
          : 'Online link saved',
      ...out
    });
  } catch (error) {
    console.error('Update assessment error:', error);
    res.status(500).json({ error: 'Server error updating assessment', details: error.message });
  }
});

router.get('/assessments/:id', verifyToken, async (req, res) => {
  try {
    await ensureAssessmentSchema();
    const { id } = req.params;
    let assessment;
    try {
      const [[row]] = await db.query(
        `SELECT a.id, a.title, a.TYPE as type, a.subject_id, a.grade_level, a.section,
                a.max_score, a.quiz_link, a.share_token, a.share_enabled, a.created_by, a.created_at,
                a.quiz_attendance_date, a.quiz_attendance_session, a.quiz_subject_id, a.quiz_makeup_student_ids,
                a.quiz_closes_at, a.quiz_makeup_closes_at,
                a.activity_mode, a.activity_target_at, a.rubric,
                a.portal_posted, a.portal_due_at,
                s.NAME as subject_name
         FROM assessments a
         LEFT JOIN subjects s ON a.subject_id = s.id
         WHERE a.id = ?`,
        [id]
      );
      assessment = row;
    } catch (inner) {
      const [[row]] = await db.query(
        `SELECT a.id, a.title, a.TYPE as type, a.subject_id, a.grade_level, a.section,
                a.max_score, a.created_by, a.created_at, s.NAME as subject_name
         FROM assessments a
         LEFT JOIN subjects s ON a.subject_id = s.id
         WHERE a.id = ?`,
        [id]
      );
      assessment = row;
    }
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    assessment.rubric = normalizeRubric(assessment.rubric, assessment.max_score);
    if (assessment.quiz_attendance_date != null && assessment.quiz_attendance_date !== '') {
      assessment.quiz_attendance_date = sqlDateToISO(assessment.quiz_attendance_date) || null;
    }

    await ensureQuizAttendanceSchema();
    let attendance_meta = null;
    let makeup_candidates = [];
    try {
      const shareOn = Number(assessment.share_enabled) === 1;
      // Link off: preview today + teacher's current session. Link on: frozen quiz gate slot.
      const slot = shareOn
        ? attendanceSlotForAssessment(assessment)
        : attendanceSlotForAssessment(
          { ...assessment, quiz_attendance_date: manilaISODate(), quiz_attendance_session: null },
          {
            date: manilaISODate(),
            session: req.query.session,
            subject_id: assessment.subject_id
          }
        );
      const completion = await getAttendanceCompletion(
        assessment.grade_level,
        assessment.section,
        slot
      );
      attendance_meta = {
        date: slot.date,
        session: slot.session,
        subject_id: slot.subjectId,
        locked: shareOn,
        complete: completion.complete,
        unmarked_count: completion.unmarked.length,
        unmarked: completion.unmarked
      };
      if (shareOn) {
        makeup_candidates = await getMakeupCandidates(assessment);
      }
    } catch (metaErr) {
      console.warn('[assessment] attendance meta:', metaErr.message);
    }

    assessment.quiz_makeup_student_ids = parseMakeupIds(assessment.quiz_makeup_student_ids);

    const [studentRows] = await db.query(
      `SELECT s.id, s.lrn, s.first_name, s.last_name, s.gender, sc.score, sc.rubric_scores
       FROM students s
       LEFT JOIN assessment_scores sc ON sc.student_id = s.id AND sc.assessment_id = ?
       WHERE s.grade_level = ? AND s.section = ? AND s.STATUS = 'active'
       ORDER BY s.gender DESC, s.last_name, s.first_name`,
      [id, assessment.grade_level, assessment.section]
    );

    let students = studentRows.map((s) => ({
      ...s,
      rubric_scores: parseRubricScoresColumn(s.rubric_scores)
    }));
    try {
      const shareOn = Number(assessment.share_enabled) === 1;
      if (shareOn) {
        const slot = attendanceSlotForAssessment(assessment);
        const roster = await loadAttendanceRoster(assessment.grade_level, assessment.section, slot);
        const byId = new Map(roster.map((r) => [Number(r.id), r]));
        const submittedSet = await getSubmittedStudentIds(assessment.id);
        const makeupSet = new Set(assessment.quiz_makeup_student_ids.map(Number));
        students = students.map((s) => {
          const row = byId.get(Number(s.id));
          return {
            ...s,
            attendance_status: row?.attendance_status || null,
            submitted: submittedSet.has(Number(s.id)),
            makeup: makeupSet.has(Number(s.id))
          };
        });
      }
    } catch (enrichErr) {
      console.warn('[assessment] student enrich:', enrichErr.message);
    }

    let questions = [];
    try {
      await ensureQuestionBankSchema();
      const [qrows] = await db.query(
        `SELECT id, question_bank_id, sort_order, item_type, question, choices, answer, points, rubric
         FROM assessment_questions
         WHERE assessment_id = ?
         ORDER BY sort_order ASC, id ASC`,
        [id]
      );
      questions = qrows.map((r) => ({
        ...formatBankRow(r),
        points: Number(r.points) || 1
      }));
    } catch (qErr) {
      questions = [];
    }

    try {
      const { ensureQuizShareSchema, activityWorkFromSubmission, quizTakenFromSubmission } = require('../utils/quizShare');
      await ensureQuizShareSchema();
      const [subs] = await db.query(
        `SELECT student_id, answers FROM quiz_submissions WHERE assessment_id = ?`,
        [id]
      );
      const workByStudent = new Map(
        subs.map((row) => [Number(row.student_id), activityWorkFromSubmission(row.answers, questions)])
      );
      const quizByStudent = new Map(
        subs.map((row) => [Number(row.student_id), quizTakenFromSubmission(row.answers, questions)])
      );
      students = students.map((s) => ({
        ...s,
        activity_work: workByStudent.get(Number(s.id)) || [],
        quiz_taken: quizByStudent.get(Number(s.id)) || []
      }));
    } catch (workErr) {
      console.warn('[assessment] activity work:', workErr.message);
    }

    res.json({ assessment, students, questions, attendance_meta, makeup_candidates });
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ error: 'Server error fetching assessment', details: error.message });
  }
});

router.post('/assessments/:id/scores', verifyToken, async (req, res) => {
  try {
    await ensureAssessmentSchema();
    const { id } = req.params;
    const { scores } = req.body;
    if (!Array.isArray(scores)) {
      return res.status(400).json({ error: 'scores must be an array' });
    }

    const [[assessment]] = await db.query(
      `SELECT id, title, TYPE as type, max_score, share_enabled, grade_level, section, subject_id,
              quiz_attendance_date, quiz_attendance_session, quiz_subject_id
       FROM assessments WHERE id = ?`,
      [id]
    );
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const maxScore = Number(assessment.max_score) || 100;

    let blockedIds = new Set();
    if (Number(assessment.share_enabled) === 1) {
      try {
        await ensureQuizAttendanceSchema();
        const slot = attendanceSlotForAssessment(assessment);
        const roster = await loadAttendanceRoster(assessment.grade_level, assessment.section, slot);
        const submittedSet = await getSubmittedStudentIds(assessment.id);
        blockedIds = new Set(
          roster
            .filter((s) => {
              const st = String(s.attendance_status || '');
              return (st === 'Absent' || st === 'Excused') && !submittedSet.has(Number(s.id));
            })
            .map((s) => Number(s.id))
        );
      } catch (gateErr) {
        console.warn('[scores] attendance gate:', gateErr.message);
      }
    }

    const recorded = [];
    for (const row of scores) {
      if (!row.student_id) continue;
      const hasScore = !(row.score === '' || row.score === null || row.score === undefined);
      const rubricObj =
        row.rubric_scores && typeof row.rubric_scores === 'object' && !Array.isArray(row.rubric_scores)
          ? row.rubric_scores
          : null;
      const hasRubric = rubricObj && Object.keys(rubricObj).length > 0;

      if (!hasScore && !hasRubric) continue;
      if (blockedIds.has(Number(row.student_id))) {
        return res.status(400).json({
          error: 'Cannot score a student who is absent or excused until they submit.'
        });
      }

      if (hasRubric) {
        const negativeRubric = Object.values(rubricObj).some((v) => {
          if (v === '' || v == null) return false;
          const n = Number(v);
          return Number.isNaN(n) || n < 0;
        });
        if (negativeRubric) {
          return res.status(400).json({ error: 'Scores cannot be negative.' });
        }
      }

      let score = hasScore ? Number(row.score) : null;
      if (hasScore && (Number.isNaN(score) || score < 0 || score > maxScore)) {
        return res.status(400).json({ error: `Score must be between 0 and ${maxScore}` });
      }
      if (!hasScore && hasRubric) {
        score = Object.values(rubricObj).reduce((sum, v) => sum + (Number(v) || 0), 0);
        if (score > maxScore) {
          return res.status(400).json({ error: `Rubric total exceeds max score (${maxScore})` });
        }
      }

      const rubricJson = hasRubric ? JSON.stringify(rubricObj) : null;

      const [existing] = await db.query(
        'SELECT id FROM assessment_scores WHERE assessment_id = ? AND student_id = ?',
        [id, row.student_id]
      );
      if (existing.length) {
        if (hasRubric) {
          await db.query(
            'UPDATE assessment_scores SET score = ?, rubric_scores = ? WHERE id = ?',
            [score, rubricJson, existing[0].id]
          );
        } else {
          await db.query(
            'UPDATE assessment_scores SET score = ? WHERE id = ?',
            [score, existing[0].id]
          );
        }
      } else {
        await db.query(
          'INSERT INTO assessment_scores (assessment_id, student_id, score, rubric_scores) VALUES (?, ?, ?, ?)',
          [id, row.student_id, score, rubricJson]
        );
      }
      recorded.push({ studentId: row.student_id, score });
    }

    if (String(assessment.type || '').toLowerCase() === 'activity') {
      for (const item of recorded) {
        try {
          await notifyStudentScore({
            studentId: item.studentId,
            score: item.score,
            maxScore,
            title: assessment.title
          });
        } catch (smsError) {
          console.error('[sms] activity score notice:', smsError.message);
        }
      }
    }

    const teacherId = req.user?.id || req.user?.userId;
    await logActivity(
      db,
      teacherId,
      'Updated progress scores',
      'assessment',
      assessment.title,
      `${scores.length} score${scores.length === 1 ? '' : 's'} saved`
    );

    res.json({ message: 'Scores saved' });
  } catch (error) {
    console.error('Save scores error:', error);
    res.status(500).json({ error: 'Server error saving scores', details: error.message });
  }
});

router.put('/assessments/:id/section-order', verifyToken, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const requested = Array.isArray(req.body?.section_order)
      ? req.body.section_order.map((t) => String(t || '').trim()).filter(Boolean)
      : [];
    if (!requested.length) return res.status(400).json({ error: 'Section order is required' });

    const [owned] = await db.query(
      'SELECT id FROM assessments WHERE id = ? AND created_by = ?',
      [id, teacherId]
    );
    if (!owned.length) return res.status(404).json({ error: 'Record not found' });

    const [rows] = await db.query(
      `SELECT id, item_type
       FROM assessment_questions
       WHERE assessment_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [id]
    );
    const groups = new Map();
    const seen = [];
    for (const row of rows) {
      const key = String(row.item_type || 'mcq');
      if (!groups.has(key)) {
        groups.set(key, []);
        seen.push(key);
      }
      groups.get(key).push(row.id);
    }
    const orderedTypes = [];
    for (const key of requested) {
      if (groups.has(key) && !orderedTypes.includes(key)) orderedTypes.push(key);
    }
    for (const key of seen) {
      if (!orderedTypes.includes(key)) orderedTypes.push(key);
    }
    let sort = 0;
    for (const key of orderedTypes) {
      for (const questionId of groups.get(key)) {
        await db.query(
          'UPDATE assessment_questions SET sort_order = ? WHERE id = ? AND assessment_id = ?',
          [sort, questionId, id]
        );
        sort += 1;
      }
    }
    res.json({ message: 'Section order saved', section_order: orderedTypes });
  } catch (error) {
    console.error('Save section order error:', error);
    res.status(500).json({ error: 'Server error saving section order', details: error.message });
  }
});

router.delete('/assessments/:id', verifyToken, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const [rows] = await db.query(
      'SELECT id FROM assessments WHERE id = ? AND created_by = ?',
      [id, teacherId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });
    await db.query('DELETE FROM assessment_scores WHERE assessment_id = ?', [id]);
    await db.query('DELETE FROM assessments WHERE id = ?', [id]);
    res.json({ message: 'Progress record deleted' });
  } catch (error) {
    console.error('Delete assessment error:', error);
    res.status(500).json({ error: 'Server error deleting assessment', details: error.message });
  }
});

router.post('/concerns/:id/read', verifyToken, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const allowed = await teacherHandlesConcern(teacherId, id);
    if (!allowed) return res.status(404).json({ error: 'Concern not found' });
    await markConcernRead(id, teacherId);
    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Teacher mark concern read error:', error);
    res.status(500).json({ error: 'Server error marking concern read', details: error.message });
  }
});

router.post('/concerns/:id/reply', verifyToken, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const { message } = req.body;

    const allowed = await teacherHandlesConcern(teacherId, id);
    if (!allowed) return res.status(404).json({ error: 'Concern not found' });

    const result = await addConcernReply({
      concernId: id,
      senderId: teacherId,
      senderRole: 'teacher',
      message
    });

    await logActivity(
      db,
      teacherId,
      'Replied to concern',
      'concern',
      null,
      null
    );

    res.json({ id: result.id, message: 'Reply sent to the parent' });
  } catch (error) {
    console.error('Teacher reply error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.status ? error.message : 'Server error sending reply',
      details: error.message
    });
  }
});

router.patch('/concerns/:id/resolve', verifyToken, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const allowed = await teacherHandlesConcern(teacherId, id);
    if (!allowed) return res.status(404).json({ error: 'Concern not found' });

    await db.query("UPDATE concerns SET STATUS = 'resolved' WHERE id = ?", [id]);
    try {
      await markConcernReadForParticipants(id, teacherId);
    } catch (e) {
      console.error('[concern_reads] mark on resolve:', e.message);
    }
    await logActivity(db, teacherId, 'Resolved concern', 'concern', null, null);
    res.json({ message: 'Concern marked as resolved' });
  } catch (error) {
    console.error('Teacher resolve concern error:', error);
    res.status(500).json({ error: 'Server error resolving concern', details: error.message });
  }
});

/* Legacy /question-bank path aliases (same handlers as /classwork) */
function mountClassworkLegacyAliases(routerRef) {
  const pairs = [];
  for (const layer of routerRef.stack || []) {
    if (!layer.route) continue;
    const path = layer.route.path;
    if (typeof path === 'string' && path.startsWith('/classwork')) {
      pairs.push(layer.route);
    }
  }
  for (const route of pairs) {
    const legacyPath = route.path.replace(/^\/classwork/, '/question-bank');
    if (legacyPath === route.path) continue;
    for (const method of Object.keys(route.methods)) {
      const handlers = route.stack.map((l) => l.handle);
      routerRef[method](legacyPath, ...handlers);
    }
  }
}
mountClassworkLegacyAliases(router);

module.exports = router;