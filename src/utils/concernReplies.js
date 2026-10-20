const db = require('../../db');

let schemaPromise = null;

async function ensureConcernRepliesSchema() {
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    try {
      await db.query('ALTER TABLE concerns ADD COLUMN teacher_reply TEXT NULL');
    } catch (e) { /* exists */ }
    try {
      await db.query('ALTER TABLE concerns ADD COLUMN replied_at TIMESTAMP NULL');
    } catch (e) { /* exists */ }

    await db.query(`
      CREATE TABLE IF NOT EXISTS concern_replies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        concern_id INT NOT NULL,
        sender_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_concern_replies_concern (concern_id),
        INDEX idx_concern_replies_sender (sender_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    try {
      await db.query(`
        INSERT INTO concern_replies (concern_id, sender_id, message, created_at)
        SELECT c.id,
               COALESCE(
                 c.teacher_id,
                 (SELECT u.id FROM users u WHERE u.role = 'admin' ORDER BY u.id ASC LIMIT 1),
                 c.parent_id
               ),
               c.teacher_reply,
               COALESCE(c.replied_at, c.updated_at, c.created_at)
        FROM concerns c
        WHERE c.teacher_reply IS NOT NULL
          AND TRIM(c.teacher_reply) <> ''
          AND NOT EXISTS (
            SELECT 1 FROM concern_replies cr
            WHERE cr.concern_id = c.id
              AND cr.message = c.teacher_reply
          )
      `);
    } catch (e) {
      console.error('[concern_replies] migrate teacher_reply:', e.message);
    }
  })();

  try {
    await schemaPromise;
  } catch (e) {
    schemaPromise = null;
    throw e;
  }
}

async function attachReplies(concerns) {
  await ensureConcernRepliesSchema();
  if (!concerns || !concerns.length) return concerns || [];

  const ids = concerns.map((c) => c.id);
  const placeholders = ids.map(() => '?').join(',');
  const [replies] = await db.query(
    `SELECT cr.id, cr.concern_id, cr.sender_id, cr.message, cr.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS sender_name,
            u.role AS sender_role
     FROM concern_replies cr
     JOIN users u ON u.id = cr.sender_id
     WHERE cr.concern_id IN (${placeholders})
     ORDER BY cr.created_at ASC, cr.id ASC`,
    ids
  );

  const byId = {};
  for (const reply of replies) {
    if (!byId[reply.concern_id]) byId[reply.concern_id] = [];
    byId[reply.concern_id].push(reply);
  }

  return concerns.map((c) => ({
    ...c,
    replies: byId[c.id] || []
  }));
}

function isConcernOpen(status) {
  const s = String(status || 'open').toLowerCase();
  return s !== 'resolved' && s !== 'closed';
}

async function ensureConcernReadsSchema() {
  await ensureConcernRepliesSchema();
  await db.query(`
    CREATE TABLE IF NOT EXISTS concern_reads (
      user_id INT NOT NULL,
      concern_id INT NOT NULL,
      read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, concern_id),
      INDEX idx_concern_reads_concern (concern_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function concernLastActivityMs(concern) {
  let last = new Date(concern.created_at || 0).getTime() || 0;
  if (concern.replied_at) {
    const t = new Date(concern.replied_at).getTime();
    if (t > last) last = t;
  }
  if (concern.updated_at) {
    const t = new Date(concern.updated_at).getTime();
    if (t > last) last = t;
  }
  const replies = Array.isArray(concern.replies) ? concern.replies : [];
  for (const r of replies) {
    const t = new Date(r.created_at || 0).getTime();
    if (t > last) last = t;
  }
  return last;
}

/**
 * Attach is_read + last_activity for a viewer.
 * Unread when never opened, or when activity is newer than read_at.
 */
async function attachConcernReadState(concerns, userId) {
  await ensureConcernReadsSchema();
  if (!concerns || !concerns.length || !userId) {
    return (concerns || []).map((c) => ({
      ...c,
      last_activity: new Date(concernLastActivityMs(c) || Date.now()).toISOString(),
      is_read: isConcernOpen(c.status) ? 0 : 1
    }));
  }

  const ids = concerns.map((c) => c.id);
  const placeholders = ids.map(() => '?').join(',');
  const [reads] = await db.query(
    `SELECT concern_id, read_at
     FROM concern_reads
     WHERE user_id = ? AND concern_id IN (${placeholders})`,
    [userId, ...ids]
  );
  const readMap = {};
  for (const row of reads) {
    readMap[row.concern_id] = row.read_at;
  }

  return concerns.map((c) => {
    const lastMs = concernLastActivityMs(c);
    const readAt = readMap[c.id] ? new Date(readMap[c.id]).getTime() : null;
    // Resolved/closed conversations are treated as read
    const isRead = !isConcernOpen(c.status) || (readAt != null && readAt >= lastMs);
    return {
      ...c,
      last_activity: new Date(lastMs || Date.now()).toISOString(),
      read_at: readMap[c.id] || null,
      is_read: isRead ? 1 : 0
    };
  });
}

async function markConcernRead(concernId, userId) {
  await ensureConcernReadsSchema();
  if (!concernId || !userId) return;
  await db.query(
    `INSERT INTO concern_reads (user_id, concern_id, read_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP`,
    [userId, concernId]
  );
}

/** Mark resolved for actor + parent + assigned teacher so Resolved stays neutral for everyone. */
async function markConcernReadForParticipants(concernId, actorId = null) {
  await ensureConcernReadsSchema();
  const [rows] = await db.query(
    'SELECT parent_id, teacher_id FROM concerns WHERE id = ?',
    [concernId]
  );
  if (!rows.length) return;
  const ids = new Set();
  if (actorId) ids.add(Number(actorId));
  if (rows[0].parent_id) ids.add(Number(rows[0].parent_id));
  if (rows[0].teacher_id) ids.add(Number(rows[0].teacher_id));
  for (const uid of ids) {
    if (uid) await markConcernRead(concernId, uid);
  }
}

/**
 * Insert a follow-up reply. Fails if concern is resolved/closed.
 * For teacher/admin senders, also mirrors into teacher_reply for older clients.
 */
async function addConcernReply({ concernId, senderId, senderRole, message }) {
  await ensureConcernRepliesSchema();

  const text = String(message || '').trim();
  if (!text) {
    const err = new Error('Reply message is required');
    err.status = 400;
    throw err;
  }

  const [rows] = await db.query(
    'SELECT id, parent_id, teacher_id, STATUS as status FROM concerns WHERE id = ?',
    [concernId]
  );
  if (!rows.length) {
    const err = new Error('Concern not found');
    err.status = 404;
    throw err;
  }

  const concern = rows[0];
  if (!isConcernOpen(concern.status)) {
    const err = new Error('This concern is resolved. New replies are closed.');
    err.status = 400;
    throw err;
  }

  const [result] = await db.query(
    `INSERT INTO concern_replies (concern_id, sender_id, message)
     VALUES (?, ?, ?)`,
    [concernId, senderId, text]
  );

  if (senderRole === 'teacher' || senderRole === 'admin') {
    await db.query(
      `UPDATE concerns
       SET teacher_reply = ?, replied_at = NOW(),
           teacher_id = COALESCE(teacher_id, ?)
       WHERE id = ?`,
      [text, senderRole === 'teacher' ? senderId : null, concernId]
    );
  }

  try {
    await markConcernRead(concernId, senderId);
  } catch (e) {
    console.error('[concern_reads] mark after reply:', e.message);
  }

  return { id: result.insertId, concern };
}

ensureConcernRepliesSchema().catch((e) => {
  console.error('[concern_replies] schema init:', e.message);
});

module.exports = {
  ensureConcernRepliesSchema,
  ensureConcernReadsSchema,
  attachReplies,
  attachConcernReadState,
  markConcernRead,
  markConcernReadForParticipants,
  addConcernReply,
  isConcernOpen
};
