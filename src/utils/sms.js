const db = require('../../db');
const { formatManilaSqlDatetime, normalizeSqlDatetime, ensureQuizAttendanceSchema } = require('./quizAttendance');

let schemaPromise = null;
let workerStarted = false;

const ITEXMO_LEGACY_ERRORS = {
  '1': 'Invalid number',
  '2': 'Number prefix not supported',
  '3': 'Invalid ApiCode',
  '4': 'Maximum messages per day reached',
  '5': 'Maximum message characters reached',
  '6': 'iTexMo system offline',
  '7': 'Expired ApiCode',
  '8': 'iTexMo error — try again later',
  '9': 'Invalid function parameters',
  '10': 'Recipient blocked due to flooding',
  '11': 'Recipient temporarily blocked (hard send)',
  '12': 'Invalid request (priority on non-corporate code)',
  '13': 'Invalid or not registered custom sender ID'
};

async function ensureSmsSchema(conn = db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sms_queue (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parent_id INT NULL,
        student_id INT NULL,
        phone VARCHAR(20) NOT NULL,
        body VARCHAR(500) NOT NULL,
        status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        last_error VARCHAR(500) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP NULL,
        KEY idx_sms_status_created (status, created_at),
        KEY idx_sms_parent (parent_id),
        KEY idx_sms_student (student_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS activity_due_notices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_id INT NOT NULL,
        student_id INT NOT NULL,
        parent_id INT NOT NULL,
        closes_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_activity_due_notice (assessment_id, student_id, parent_id, closes_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  })().catch((e) => {
    schemaPromise = null;
    throw e;
  });
  return schemaPromise;
}

/** Normalize PH mobile to 09XXXXXXXXX or null if invalid. */
function normalizePhMobile(raw) {
  if (raw == null) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('63') && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    digits = `0${digits}`;
  }
  if (!/^09\d{9}$/.test(digits)) return null;
  return digits;
}

function isValidPhMobile(raw) {
  return !!normalizePhMobile(raw);
}

function getSmsProvider() {
  const p = String(process.env.SMS_PROVIDER || 'itexmo').trim().toLowerCase();
  if (p === 'semaphore') return 'semaphore';
  if (p === 'philsms') return 'philsms';
  if (p === 'smsgate') return 'smsgate';
  return 'itexmo';
}

function isSmsConfigured() {
  if (getSmsProvider() === 'smsgate') {
    const username = String(process.env.SMSGATE_USERNAME || '').trim();
    const password = String(process.env.SMSGATE_PASSWORD || '').trim();
    return !!(username && password);
  }
  const key = String(process.env.SMS_API_KEY || '').trim();
  if (!key) return false;
  if (getSmsProvider() === 'itexmo') {
    const email = String(process.env.ITEXMO_EMAIL || '').trim();
    const password = String(process.env.ITEXMO_PASSWORD || '').trim();
    return !!(email && password);
  }
  return true;
}

/** PhilSMS wants 63XXXXXXXXXX (no leading 0). Queue stores 09XXXXXXXXX. */
function toPhilsmsRecipient(phone) {
  const local = normalizePhMobile(phone);
  if (!local) return null;
  return `63${local.slice(1)}`;
}

/** SMSGate wants E.164. Queue stores 09XXXXXXXXX. */
function toSmsgateRecipient(phone) {
  const local = normalizePhMobile(phone);
  if (!local) return null;
  return `+63${local.slice(1)}`;
}

function smsgateMessageUrl() {
  const raw = String(process.env.SMSGATE_URL || 'https://api.sms-gate.app/3rdparty/v1').trim();
  const base = raw.replace(/\/+$/, '');
  if (/\/message$/i.test(base)) return base;
  return `${base}/message`;
}

function isSmsDryRun() {
  const v = String(process.env.SMS_DRY_RUN || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Resolve best phone for a parent user row.
 * Prefers users.phone, then parent_profiles.emergency_contact.
 */
function pickParentPhone(userPhone, emergencyContact) {
  return normalizePhMobile(userPhone) || normalizePhMobile(emergencyContact);
}

const ANNOUNCEMENT_SMS_BODY = 'ConnectED: New Announcement Posted!';

function formatSmsScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  const rounded = Math.round(num * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function scoreNoticeBody({ firstName, lastName, score, maxScore, title }) {
  const name = `${firstName || ''} ${lastName || ''}`.trim() || 'Your child';
  const label = String(title || 'assessment').trim().slice(0, 80) || 'assessment';
  return `ConnectED: ${name} scored ${formatSmsScore(score)}/${formatSmsScore(maxScore)} on ${label}.`;
}

async function enqueueSms({
  parentId = null,
  studentId = null,
  phone,
  body,
  allowDuplicate = false,
  conn = db
}) {
  await ensureSmsSchema(conn);
  const normalized = normalizePhMobile(phone);
  if (!normalized) {
    return { queued: false, reason: 'invalid_phone' };
  }
  const text = String(body || '').trim().slice(0, 480);
  if (!text) {
    return { queued: false, reason: 'empty_body' };
  }

  if (allowDuplicate) {
    const [result] = await conn.query(
      `INSERT INTO sms_queue (parent_id, student_id, phone, body, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [parentId, studentId, normalized, text]
    );
    return { queued: true, id: result.insertId };
  }

  const [dup] = await conn.query(
    `SELECT id FROM sms_queue
     WHERE phone = ? AND student_id <=> ? AND body = ?
       AND status IN ('pending','sent')
       AND DATE(created_at) = CURDATE()
       AND (last_error IS NULL OR last_error NOT LIKE 'DRY_RUN:%')
     LIMIT 1`,
    [normalized, studentId, text]
  );
  if (dup.length) {
    return { queued: false, reason: 'duplicate', id: dup[0].id };
  }

  const [result] = await conn.query(
    `INSERT INTO sms_queue (parent_id, student_id, phone, body, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [parentId, studentId, normalized, text]
  );
  return { queued: true, id: result.insertId };
}

async function sendViaSemaphore(phone, message) {
  const apikey = String(process.env.SMS_API_KEY || '').trim();
  if (!apikey) {
    const err = new Error('SMS_API_KEY is not configured');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const sendername = String(process.env.SMS_SENDER || '').trim();
  const params = new URLSearchParams();
  params.set('apikey', apikey);
  params.set('number', phone);
  params.set('message', message);
  if (sendername) params.set('sendername', sendername);

  const res = await fetch('https://api.semaphore.co/api/v4/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!res.ok) {
    const msg =
      (Array.isArray(data) && data[0]?.message) ||
      data?.message ||
      data?.error ||
      raw ||
      `HTTP ${res.status}`;
    throw new Error(String(msg).slice(0, 400));
  }

  if (Array.isArray(data) && data[0]?.status === 'Failed') {
    throw new Error(data[0].message || 'Semaphore reported Failed');
  }

  return data;
}

/**
 * PhilSMS API v3 (POST {base}/sms/send)
 * Account docs: https://dashboard.philsms.com/api/v3/
 * Authorization: Bearer {api_token}
 * Body JSON: recipient (63…), sender_id, type, message
 */
async function sendViaPhilsms(phone, message) {
  const token = String(process.env.SMS_API_KEY || '').trim();
  if (!token) {
    const err = new Error('SMS_API_KEY (PhilSMS token) is not configured');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const recipient = toPhilsmsRecipient(phone);
  if (!recipient) {
    throw new Error('Invalid Philippine mobile number for PhilSMS');
  }

  const senderId = String(process.env.SMS_SENDER || 'ConnectED').trim().slice(0, 11) || 'ConnectED';
  const base = String(process.env.SMS_PHILSMS_BASE || 'https://dashboard.philsms.com/api/v3')
    .trim()
    .replace(/\/$/, '');
  const res = await fetch(`${base}/sms/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      recipient,
      sender_id: senderId,
      type: 'plain',
      message
    })
  });

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!res.ok || String(data?.status || '').toLowerCase() === 'error') {
    const msg =
      data?.message ||
      data?.error ||
      (typeof data?.raw === 'string' ? data.raw : null) ||
      raw ||
      `HTTP ${res.status}`;
    throw new Error(String(msg).slice(0, 400));
  }

  return { provider: 'philsms', version: 'v3', data };
}

/**
 * iTexMo API v5 (docs: POST https://api.itexmo.com/api/broadcast)
 * Body JSON: Email, Password, ApiCode, Recipients[], Message, optional SenderId
 * Also sends Basic Auth (email/password) as in their Postman examples.
 */
async function sendViaItexmo(phone, message) {
  const apicode = String(process.env.SMS_API_KEY || '').trim();
  const email = String(process.env.ITEXMO_EMAIL || '').trim();
  const password = String(process.env.ITEXMO_PASSWORD || '').trim();

  if (!apicode) {
    const err = new Error('SMS_API_KEY (iTexMo ApiCode) is not configured');
    err.code = 'NO_API_KEY';
    throw err;
  }
  if (!email || !password) {
    const err = new Error('ITEXMO_EMAIL and ITEXMO_PASSWORD are required for iTexMo API v5');
    err.code = 'NO_ITEXMO_AUTH';
    throw err;
  }

  const senderId = String(process.env.SMS_SENDER || '').trim();
  const payload = {
    Email: email,
    Password: password,
    ApiCode: apicode,
    Recipients: [phone],
    Message: message
  };
  if (senderId) payload.SenderId = senderId;

  const basic = Buffer.from(`${email}:${password}`).toString('base64');
  const res = await fetch('https://api.itexmo.com/api/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${basic}`
    },
    body: JSON.stringify(payload)
  });

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!res.ok) {
    const msg =
      data?.Message ||
      data?.message ||
      data?.error ||
      data?.Error ||
      (typeof data?.raw === 'string' ? data.raw : null) ||
      raw ||
      `HTTP ${res.status}`;
    throw new Error(String(msg).slice(0, 400));
  }

  // Some responses may still return legacy numeric codes in a field
  const code = data?.Code ?? data?.code ?? data?.Status ?? data?.status;
  if (code != null && String(code) !== '0' && String(code).toLowerCase() !== 'success' && String(code).toLowerCase() !== 'ok') {
    const c = String(code);
    if (/^\d+$/.test(c) && c !== '0') {
      throw new Error(`iTexMo ${c}: ${ITEXMO_LEGACY_ERRORS[c] || raw.slice(0, 200)}`);
    }
  }

  return { provider: 'itexmo', version: 'v5', data };
}

/**
 * SMSGate (https://sms-gate.app) cloud or local device API.
 * POST {base}/message with Basic auth.
 * Body: { textMessage: { text }, phoneNumbers: ["+639..."] }
 * 200 or 202 means the gateway accepted the message.
 */
async function sendViaSmsgate(phone, message) {
  const username = String(process.env.SMSGATE_USERNAME || '').trim();
  const password = String(process.env.SMSGATE_PASSWORD || '').trim();
  if (!username || !password) {
    const err = new Error('SMSGATE_USERNAME and SMSGATE_PASSWORD are required');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const recipient = toSmsgateRecipient(phone);
  if (!recipient) {
    throw new Error('Invalid Philippine mobile number for SMSGate');
  }

  const basic = Buffer.from(`${username}:${password}`).toString('base64');
  const res = await fetch(smsgateMessageUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      textMessage: { text: message },
      phoneNumbers: [recipient]
    })
  });

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (res.status !== 200 && res.status !== 202) {
    const msg =
      data?.message ||
      data?.error ||
      (typeof data?.raw === 'string' ? data.raw : null) ||
      raw ||
      `HTTP ${res.status}`;
    throw new Error(String(msg).slice(0, 400));
  }

  return { provider: 'smsgate', data };
}

async function sendSms(phone, message) {
  const provider = getSmsProvider();
  if (provider === 'semaphore') {
    return sendViaSemaphore(phone, message);
  }
  if (provider === 'philsms') {
    return sendViaPhilsms(phone, message);
  }
  if (provider === 'smsgate') {
    return sendViaSmsgate(phone, message);
  }
  return sendViaItexmo(phone, message);
}

async function processOneSms(row, conn = db) {
  const maxAttempts = Number(process.env.SMS_MAX_ATTEMPTS || 5);
  try {
    if (isSmsDryRun() || !isSmsConfigured()) {
      const note = isSmsDryRun()
        ? `DRY_RUN:${getSmsProvider()}`
        : 'NO_API_KEY_QUEUED_AS_SIMULATED';
      console.log(`[sms] ${note} → ${row.phone}: ${String(row.body).slice(0, 80)}`);
      await conn.query(
        `UPDATE sms_queue
         SET status = 'sent', attempts = attempts + 1, sent_at = NOW(), last_error = ?
         WHERE id = ?`,
        [note, row.id]
      );
      return { ok: true, simulated: true };
    }

    await sendSms(row.phone, row.body);
    await conn.query(
      `UPDATE sms_queue
       SET status = 'sent', attempts = attempts + 1, sent_at = NOW(), last_error = NULL
       WHERE id = ?`,
      [row.id]
    );
    return { ok: true };
  } catch (e) {
    const attempts = Number(row.attempts || 0) + 1;
    const failed = attempts >= maxAttempts;
    await conn.query(
      `UPDATE sms_queue
       SET status = ?, attempts = ?, last_error = ?
       WHERE id = ?`,
      [failed ? 'failed' : 'pending', attempts, String(e.message || e).slice(0, 480), row.id]
    );
    return { ok: false, error: e.message };
  }
}

async function processSmsQueue({ limit = 20 } = {}) {
  await ensureSmsSchema();
  const [rows] = await db.query(
    `SELECT id, parent_id, student_id, phone, body, status, attempts
     FROM sms_queue
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit]
  );

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await processOneSms(row);
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return { processed: rows.length, sent, failed };
}

async function sendQueuedNow(ids) {
  for (const id of ids) {
    const [[row]] = await db.query(
      `SELECT id, parent_id, student_id, phone, body, status, attempts
       FROM sms_queue
       WHERE id = ? AND status = 'pending'`,
      [id]
    );
    if (row) await processOneSms(row);
  }
}

async function queueParentSms(parents, { studentId = null, body, allowDuplicate = false }) {
  const ids = [];
  for (const parent of parents) {
    const phone = pickParentPhone(parent.phone, parent.emergency_contact);
    if (!phone) continue;
    const result = await enqueueSms({
      parentId: parent.parent_id,
      studentId,
      phone,
      body,
      allowDuplicate
    });
    if (result.queued && result.id) ids.push(result.id);
  }
  if (ids.length) {
    try {
      await sendQueuedNow(ids);
    } catch (error) {
      console.error('[sms] immediate send:', error.message);
    }
  }
  return { queued: ids.length };
}

async function notifyStudentScore({
  studentId,
  firstName = null,
  lastName = null,
  score,
  maxScore,
  title
}) {
  let first = firstName;
  let last = lastName;
  if (!first && !last) {
    const [[student]] = await db.query(
      'SELECT first_name, last_name FROM students WHERE id = ?',
      [studentId]
    );
    if (!student) return { queued: 0 };
    first = student.first_name;
    last = student.last_name;
  }
  const [parents] = await db.query(
    `SELECT psl.parent_id, u.phone, pp.emergency_contact
     FROM parent_student_links psl
     JOIN users u ON u.id = psl.parent_id
     LEFT JOIN parent_profiles pp ON pp.user_id = u.id
     WHERE psl.student_id = ? AND u.role = 'parent'
       AND COALESCE(u.STATUS, u.status, 'active') != 'inactive'`,
    [studentId]
  );
  return queueParentSms(parents, {
    studentId,
    body: scoreNoticeBody({ firstName: first, lastName: last, score, maxScore, title })
  });
}

async function notifyClassAnnouncement({ grade, section }) {
  const [parents] = await db.query(
    `SELECT u.id AS parent_id, u.phone, pp.emergency_contact, MIN(s.id) AS student_id
     FROM students s
     JOIN parent_student_links psl ON psl.student_id = s.id
     JOIN users u ON u.id = psl.parent_id
     LEFT JOIN parent_profiles pp ON pp.user_id = u.id
     WHERE s.grade_level = ? AND TRIM(s.section) = TRIM(?)
       AND s.\`STATUS\` = 'active' AND s.deleted_at IS NULL
       AND u.role = 'parent'
       AND COALESCE(u.STATUS, u.status, 'active') != 'inactive'
     GROUP BY u.id, u.phone, pp.emergency_contact`,
    [grade, section]
  );
  let queued = 0;
  for (const parent of parents) {
    const result = await queueParentSms([parent], {
      studentId: parent.student_id,
      body: ANNOUNCEMENT_SMS_BODY,
      allowDuplicate: true
    });
    queued += result.queued;
  }
  return { queued };
}

function formatActivityDueWhen(closesAt) {
  const normalized = normalizeSqlDatetime(closesAt);
  if (!normalized) return 'soon';
  const [date, time] = normalized.split(' ');
  const [, month, day] = date.split('-').map(Number);
  const [hour, minute] = (time || '00:00:00').split(':').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hour12 = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const year = date.slice(0, 4);
  return `${months[(month || 1) - 1]} ${day}, ${year}, ${hour12}:${String(minute || 0).padStart(2, '0')} ${ampm}`;
}

function activityDueNoticeBody({ title, firstName, lastName, grade, section, closesAt }) {
  const child = `${firstName || ''} ${lastName || ''}`.trim() || 'your child';
  const label = String(title || 'Activity').trim().slice(0, 80) || 'Activity';
  const gradeBit = `Grade ${grade}-${String(section || '').trim()}`;
  return `ConnectED: Activity "${label}" for ${child} (${gradeBit}) is due ${formatActivityDueWhen(closesAt)}. It is not submitted yet.`.slice(0, 480);
}

function activityLinkSmsBody({ title, firstName, lastName, grade, section, url, closesAt }) {
  const child = `${firstName || ''} ${lastName || ''}`.trim() || 'your child';
  const label = String(title || 'Activity').trim().slice(0, 60) || 'Activity';
  const gradeBit = `Grade ${grade}-${String(section || '').trim()}`;
  const due = closesAt ? ` Due ${formatActivityDueWhen(closesAt)}.` : '';
  return `ConnectED: Activity "${label}" for ${child} (${gradeBit}).${due} Open: ${url}`.slice(0, 480);
}

async function notifyTakeHomeLink({ title, grade, section, token, origin, closesAt }) {
  const base = String(origin || '').replace(/\/+$/, '');
  if (!base || !token) return { queued: 0 };
  const url = `${base}/activity/${token}`;
  const [parents] = await db.query(
    `SELECT psl.parent_id, u.phone, pp.emergency_contact, s.id AS student_id, s.first_name, s.last_name
     FROM students s
     JOIN parent_student_links psl ON psl.student_id = s.id
     JOIN users u ON u.id = psl.parent_id
     LEFT JOIN parent_profiles pp ON pp.user_id = u.id
     WHERE s.grade_level = ? AND TRIM(s.section) = TRIM(?)
       AND s.\`STATUS\` = 'active' AND s.deleted_at IS NULL
       AND u.role = 'parent'
       AND COALESCE(u.STATUS, u.status, 'active') != 'inactive'`,
    [grade, section]
  );
  let queued = 0;
  for (const parent of parents) {
    const result = await queueParentSms([parent], {
      studentId: parent.student_id,
      allowDuplicate: true,
      body: activityLinkSmsBody({
        title,
        firstName: parent.first_name,
        lastName: parent.last_name,
        grade,
        section,
        url,
        closesAt
      })
    });
    queued += result.queued;
  }
  return { queued };
}

async function listActivitiesNearDue(now = new Date()) {
  await ensureSmsSchema();
  await ensureQuizAttendanceSchema();
  const start = formatManilaSqlDatetime(now);
  const end = formatManilaSqlDatetime(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const [rows] = await db.query(
    `SELECT id, title, grade_level, section,
            CASE
              WHEN activity_mode = 'take_home' THEN activity_target_at
              ELSE quiz_closes_at
            END AS quiz_closes_at
     FROM assessments
     WHERE \`TYPE\` = 'activity'
       AND share_enabled = 1
       AND (
         (activity_mode = 'take_home'
           AND activity_target_at IS NOT NULL
           AND activity_target_at > ?
           AND activity_target_at <= ?)
         OR (activity_mode IS NULL
           AND quiz_closes_at IS NOT NULL
           AND quiz_closes_at > ?
           AND quiz_closes_at <= ?)
       )`,
    [start, end, start, end]
  );
  return rows;
}

async function notifyActivitiesNearDue(now = new Date()) {
  const activities = await listActivitiesNearDue(now);
  let queued = 0;
  for (const activity of activities) {
    const closesAt = normalizeSqlDatetime(activity.quiz_closes_at);
    if (!closesAt) continue;
    const [students] = await db.query(
      `SELECT s.id, s.first_name, s.last_name
       FROM students s
       WHERE s.grade_level = ? AND TRIM(s.section) = TRIM(?)
         AND s.\`STATUS\` = 'active' AND s.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM quiz_submissions qs
           WHERE qs.assessment_id = ? AND qs.student_id = s.id
         )`,
      [activity.grade_level, activity.section, activity.id]
    );
    for (const student of students) {
      const [parents] = await db.query(
        `SELECT psl.parent_id, u.phone, pp.emergency_contact
         FROM parent_student_links psl
         JOIN users u ON u.id = psl.parent_id
         LEFT JOIN parent_profiles pp ON pp.user_id = u.id
         WHERE psl.student_id = ? AND u.role = 'parent'
           AND COALESCE(u.STATUS, u.status, 'active') != 'inactive'`,
        [student.id]
      );
      for (const parent of parents) {
        const phone = pickParentPhone(parent.phone, parent.emergency_contact);
        if (!phone) continue;
        const [inserted] = await db.query(
          `INSERT IGNORE INTO activity_due_notices (assessment_id, student_id, parent_id, closes_at)
           VALUES (?, ?, ?, ?)`,
          [activity.id, student.id, parent.parent_id, closesAt]
        );
        if (!inserted.affectedRows) continue;
        const result = await enqueueSms({
          parentId: parent.parent_id,
          studentId: student.id,
          phone,
          body: activityDueNoticeBody({
            title: activity.title,
            firstName: student.first_name,
            lastName: student.last_name,
            grade: activity.grade_level,
            section: activity.section,
            closesAt
          })
        });
        if (result.queued) queued += 1;
      }
    }
  }
  return { queued, activities: activities.length };
}

function startSmsWorker() {
  if (workerStarted) return;
  workerStarted = true;
  const intervalMs = Number(process.env.SMS_POLL_MS || 60000);
  const provider = getSmsProvider();

  const tick = async () => {
    try {
      const due = await notifyActivitiesNearDue();
      if (due.queued > 0) {
        console.log(`[sms] activity due reminders queued=${due.queued}`);
      }
    } catch (e) {
      console.error('[sms] activity due:', e.message);
    }
    try {
      const result = await processSmsQueue({ limit: 25 });
      if (result.processed > 0) {
        console.log(
          `[sms] queue processed=${result.processed} sent=${result.sent} failed=${result.failed}`
        );
      }
    } catch (e) {
      console.error('[sms] worker:', e.message);
    }
  };

  setTimeout(tick, 3000);
  setInterval(tick, intervalMs);
  console.log(
    `[sms] worker started provider=${provider} (every ${intervalMs}ms)` +
      (isSmsDryRun()
        ? ' DRY_RUN=on'
        : isSmsConfigured()
          ? ''
          : provider === 'itexmo'
            ? ' (need SMS_API_KEY + ITEXMO_EMAIL + ITEXMO_PASSWORD — simulated)'
            : provider === 'smsgate'
              ? ' (need SMSGATE_USERNAME + SMSGATE_PASSWORD — simulated)'
              : ' (no SMS_API_KEY — simulated send)')
  );
}

module.exports = {
  ensureSmsSchema,
  normalizePhMobile,
  isValidPhMobile,
  toSmsgateRecipient,
  getSmsProvider,
  isSmsConfigured,
  isSmsDryRun,
  pickParentPhone,
  enqueueSms,
  processSmsQueue,
  startSmsWorker,
  scoreNoticeBody,
  ANNOUNCEMENT_SMS_BODY,
  notifyStudentScore,
  notifyClassAnnouncement,
  notifyActivitiesNearDue,
  notifyTakeHomeLink,
  activityDueNoticeBody
};
