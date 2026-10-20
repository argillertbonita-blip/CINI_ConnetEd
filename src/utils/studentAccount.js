const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../db');

let schemaReady = null;

function ignoreDup(error) {
  if (!error) return;
  if (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060) return;
  if (error.code === 'ER_DUP_KEYNAME' || error.errno === 1061) return;
  throw error;
}

function ensureStudentLoginSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.query(
        "ALTER TABLE users MODIFY COLUMN role ENUM('admin','teacher','parent','student') NOT NULL"
      );
      await db.query('ALTER TABLE students ADD COLUMN user_id INT NULL').catch(ignoreDup);
      await db.query('ALTER TABLE students ADD UNIQUE KEY uq_students_user_id (user_id)').catch(ignoreDup);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function lettersOnly(value) {
  return String(value || '').replace(/[^a-zA-Z]/g, '').toLowerCase();
}

function studentUsernameLocal(firstName, lastName) {
  const first = lettersOnly(firstName);
  const last = lettersOnly(lastName);
  if (first.length < 2 || !last) return '';
  return `${first.slice(0, 2)}${last}`;
}

function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function allocateStudentUsername(conn, firstName, lastName) {
  const local = studentUsernameLocal(firstName, lastName);
  if (!local) {
    const error = new Error('First name needs at least two letters, and last name at least one letter, to build a username.');
    error.status = 400;
    throw error;
  }
  let email = `${local}@gmail.com`;
  for (let n = 2; n < 500; n += 1) {
    const [rows] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (!rows.length) return email;
    email = `${local}${n}@gmail.com`;
  }
  const error = new Error('Could not build a unique username.');
  error.status = 409;
  throw error;
}

async function createStudentLogin(conn, { firstName, lastName, studentId }) {
  await ensureStudentLoginSchema();
  const username = await allocateStudentUsername(conn, firstName, lastName);
  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await conn.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, phone, role, status, must_change_password)
     VALUES (?, ?, ?, ?, NULL, 'student', 'active', 1)`,
    [firstName, lastName, username, passwordHash]
  );
  await conn.query('UPDATE students SET user_id = ? WHERE id = ?', [created.insertId, studentId]);
  return { userId: created.insertId, username, password };
}

async function setStudentLoginStatus(studentId, status) {
  await ensureStudentLoginSchema();
  const [[row]] = await db.query('SELECT user_id FROM students WHERE id = ?', [studentId]);
  if (!row?.user_id) return;
  await db.query(
    "UPDATE users SET status = ? WHERE id = ? AND role = 'student'",
    [status, row.user_id]
  );
}

module.exports = {
  ensureStudentLoginSchema,
  studentUsernameLocal,
  createStudentLogin,
  setStudentLoginStatus
};
