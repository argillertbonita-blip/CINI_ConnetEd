const db = require('../../db');
const { schoolYear } = require('../config');
const { attachReplies, attachConcernReadState } = require('./concernReplies');

const ITEM_TYPES = ['announcement', 'concern', 'message'];

let schemaPromise = null;

async function ensureInboxTrash() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = db.query(
    `CREATE TABLE IF NOT EXISTS inbox_trash (
      user_id INT NOT NULL,
      item_type ENUM('announcement','concern','message') NOT NULL,
      item_id INT NOT NULL,
      emptied TINYINT(1) NOT NULL DEFAULT 0,
      trashed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, item_type, item_id),
      KEY idx_inbox_trash_user (user_id, emptied)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
  ).then(() => {});
  try {
    await schemaPromise;
  } catch (e) {
    schemaPromise = null;
    throw e;
  }
}

function trashExcludeSql(alias, itemType) {
  if (!ITEM_TYPES.includes(itemType)) throw new Error('Invalid trash type');
  if (!/^[a-z]+$/.test(String(alias || ''))) throw new Error('Invalid alias');
  return ` AND NOT EXISTS (
    SELECT 1 FROM inbox_trash itr
    WHERE itr.user_id = ?
      AND itr.item_type = '${itemType}'
      AND itr.item_id = ${alias}.id
  )`;
}

async function teacherHandlesConcern(teacherId, concernId) {
  const [rows] = await db.query(
    `SELECT c.id
     FROM concerns c
     JOIN students s ON s.id = c.student_id
     WHERE c.id = ? AND c.teacher_id = ?
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
       )`,
    [concernId, teacherId, teacherId, schoolYear, teacherId]
  );
  return rows.length > 0;
}

async function userMayTrash(userId, role, itemType, itemId) {
  if (itemType === 'message') {
    const [rows] = await db.query(
      'SELECT id FROM messages WHERE id = ? AND (receiver_id = ? OR sender_id = ?)',
      [itemId, userId, userId]
    );
    return rows.length > 0;
  }
  if (itemType === 'concern') {
    if (role === 'parent') {
      const [rows] = await db.query(
        'SELECT id FROM concerns WHERE id = ? AND parent_id = ?',
        [itemId, userId]
      );
      return rows.length > 0;
    }
    if (role === 'teacher') return teacherHandlesConcern(userId, itemId);
    return false;
  }
  if (itemType === 'announcement') {
    const [rows] = await db.query(
      'SELECT id, audience, sender_id FROM announcements WHERE id = ?',
      [itemId]
    );
    if (!rows.length) return false;
    const audience = String(rows[0].audience || 'everyone');
    if (role === 'parent') return audience === 'everyone' || audience === 'parents';
    if (role === 'teacher') {
      return audience === 'everyone' || audience === 'teachers' || Number(rows[0].sender_id) === Number(userId);
    }
    return false;
  }
  return false;
}

async function moveToTrash(userId, role, itemType, itemId) {
  await ensureInboxTrash();
  if (!ITEM_TYPES.includes(itemType)) {
    const err = new Error('That item cannot be moved to trash');
    err.status = 400;
    throw err;
  }
  const id = Number(itemId);
  if (!id) {
    const err = new Error('Item not found');
    err.status = 400;
    throw err;
  }
  const allowed = await userMayTrash(userId, role, itemType, id);
  if (!allowed) {
    const err = new Error('Item not found');
    err.status = 404;
    throw err;
  }
  await db.query(
    `INSERT INTO inbox_trash (user_id, item_type, item_id, emptied, trashed_at)
     VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE emptied = 0, trashed_at = CURRENT_TIMESTAMP`,
    [userId, itemType, id]
  );
}

async function restoreFromTrash(userId, itemType, itemId) {
  await ensureInboxTrash();
  if (!ITEM_TYPES.includes(itemType)) {
    const err = new Error('That item cannot be restored');
    err.status = 400;
    throw err;
  }
  const [result] = await db.query(
    `DELETE FROM inbox_trash
     WHERE user_id = ? AND item_type = ? AND item_id = ? AND emptied = 0`,
    [userId, itemType, Number(itemId)]
  );
  if (!result.affectedRows) {
    const err = new Error('Item not found in trash');
    err.status = 404;
    throw err;
  }
}

async function emptyTrash(userId) {
  await ensureInboxTrash();
  await db.query(
    'UPDATE inbox_trash SET emptied = 1 WHERE user_id = ? AND emptied = 0',
    [userId]
  );
}

async function listTrash(userId) {
  await ensureInboxTrash();
  const [announcements] = await db.query(
    `SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name,
            u.role as sender_role, 1 as is_read, t.trashed_at
     FROM inbox_trash t
     JOIN announcements a ON a.id = t.item_id
     JOIN users u ON u.id = a.sender_id
     WHERE t.user_id = ? AND t.item_type = 'announcement' AND t.emptied = 0
     ORDER BY t.trashed_at DESC`,
    [userId]
  );
  const [concerns] = await db.query(
    `SELECT c.id, c.parent_id, c.teacher_id, c.student_id,
            c.SUBJECT as subject, c.message, c.STATUS as status, c.priority,
            c.created_at, c.updated_at, c.teacher_reply, c.replied_at,
            CONCAT(p.first_name, ' ', p.last_name) as parent_name,
            CONCAT(tchr.first_name, ' ', tchr.last_name) as teacher_name,
            CONCAT(s.first_name, ' ', s.last_name) as student_name,
            s.grade_level, s.section, t.trashed_at
     FROM inbox_trash t
     JOIN concerns c ON c.id = t.item_id
     LEFT JOIN users p ON c.parent_id = p.id
     LEFT JOIN users tchr ON c.teacher_id = tchr.id
     LEFT JOIN students s ON c.student_id = s.id
     WHERE t.user_id = ? AND t.item_type = 'concern' AND t.emptied = 0
     ORDER BY t.trashed_at DESC`,
    [userId]
  );
  const [messages] = await db.query(
    `SELECT m.id, m.SUBJECT as subject, m.message, m.is_read, m.created_at, m.student_id,
            CONCAT(u.first_name, ' ', u.last_name) as sender_name,
            u.role as sender_role,
            CONCAT(s.first_name, ' ', s.last_name) as student_name,
            t.trashed_at
     FROM inbox_trash t
     JOIN messages m ON m.id = t.item_id
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN students s ON s.id = m.student_id
     WHERE t.user_id = ? AND t.item_type = 'message' AND t.emptied = 0
       AND (m.receiver_id = ? OR m.sender_id = ?)
     ORDER BY t.trashed_at DESC`,
    [userId, userId, userId]
  );
  return {
    announcements,
    concerns: await attachConcernReadState(await attachReplies(concerns), userId),
    messages
  };
}

module.exports = {
  ensureInboxTrash,
  trashExcludeSql,
  teacherHandlesConcern,
  moveToTrash,
  restoreFromTrash,
  emptyTrash,
  listTrash
};
