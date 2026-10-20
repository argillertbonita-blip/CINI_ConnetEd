const db = require('../../db');

const RECENT_LIMIT = 5;
let schemaPromise = null;
let hasUserRoleColumn = false;

async function ensureActivityLogSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    try {
      const [cols] = await db.query('DESCRIBE activity_log');
      hasUserRoleColumn = cols.some((c) => String(c.Field).toLowerCase() === 'user_role');
      if (!hasUserRoleColumn) {
        await db.query(
          'ALTER TABLE activity_log ADD COLUMN user_role VARCHAR(20) DEFAULT NULL AFTER user_name'
        );
        hasUserRoleColumn = true;
        console.log('[activityLog] added user_role column');
      }
    } catch (e) {
      console.error('[activityLog] schema:', e.message);
      // Retry describe in case another process added it
      try {
        const [cols] = await db.query('DESCRIBE activity_log');
        hasUserRoleColumn = cols.some((c) => String(c.Field).toLowerCase() === 'user_role');
      } catch (_) {
        hasUserRoleColumn = false;
      }
    }
  })();
  return schemaPromise;
}

function formatRoleLabel(role) {
  if (!role) return '';
  const r = String(role).toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'teacher') return 'Teacher';
  if (r === 'parent') return 'Parent';
  return r.charAt(0).toUpperCase() + r.slice(1);
}

async function logActivity(conn, userId, action, targetType, targetName, details, userRole) {
  try {
    await ensureActivityLogSchema();
    const queryConn = conn || db;
    let userName = 'System';
    let role = userRole || null;

    if (userId) {
      const [userRows] = await queryConn.query(
        'SELECT first_name, last_name, role FROM users WHERE id = ?',
        [userId]
      );
      if (userRows.length) {
        userName = `${userRows[0].first_name} ${userRows[0].last_name}`;
        role = role || userRows[0].role;
      }
    }

    if (hasUserRoleColumn) {
      await queryConn.query(
        `INSERT INTO activity_log (user_id, user_name, user_role, action, target_type, target_name, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId || null, userName, role, action, targetType, targetName, details || null]
      );
    } else {
      await queryConn.query(
        `INSERT INTO activity_log (user_id, user_name, action, target_type, target_name, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId || null, userName, action, targetType, targetName, details || null]
      );
    }
  } catch (err) {
    console.error('Log activity error:', err.message || err);
  }
}

async function logActivityThrottled(conn, userId, action, targetType, targetName, details, windowMinutes = 15) {
  try {
    await ensureActivityLogSchema();
    const queryConn = conn || db;
    const [recent] = await queryConn.query(
      `SELECT id FROM activity_log
       WHERE user_id = ? AND action = ? AND target_name = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
       LIMIT 1`,
      [userId, action, targetName, windowMinutes]
    );
    if (recent.length) return;
    await logActivity(queryConn, userId, action, targetType, targetName, details);
  } catch (err) {
    console.error('Log activity throttled error:', err.message || err);
  }
}

async function getRecentActivity(limit = RECENT_LIMIT) {
  await ensureActivityLogSchema();
  const roleSelect = hasUserRoleColumn ? 'user_role' : 'NULL as user_role';
  const [logs] = await db.query(
    `SELECT user_name, ${roleSelect}, action, target_type, target_name, details, created_at
     FROM activity_log
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
  return logs;
}

module.exports = {
  RECENT_LIMIT,
  logActivity,
  logActivityThrottled,
  getRecentActivity,
  formatRoleLabel
};
