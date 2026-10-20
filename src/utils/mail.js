const nodemailer = require('nodemailer');

function mailFrom() {
  return String(process.env.MAIL_FROM || '').trim();
}

function isMailConfigured() {
  return Boolean(String(process.env.SMTP_HOST || '').trim() && mailFrom());
}

function roleLabel(role) {
  const value = String(role || '').toLowerCase();
  if (value === 'teacher') return 'Teacher';
  if (value === 'parent') return 'Parent';
  if (value === 'admin') return 'Administrator';
  if (value === 'student') return 'Student';
  return 'User';
}

function accountEmailBody({ firstName, lastName, email, role, password }) {
  const name = `${firstName || ''} ${lastName || ''}`.trim() || 'there';
  return [
    `Hello ${name},`,
    '',
    'An administrator created your ConnectED account.',
    '',
    `Name: ${name}`,
    `Role: ${roleLabel(role)}`,
    `Sign-in email: ${email}`,
    `Temporary password: ${password}`,
    '',
    'Sign in with this email and temporary password, then set your own password when prompted.',
    'Do not share this password.',
    '',
    'ConnectED'
  ].join('\n');
}

async function sendAccountDetails({ firstName, lastName, email, role, password }) {
  const to = String(email || '').trim();
  if (!to || !password) {
    return { sent: false, error: 'The account has no email or temporary password to send.' };
  }
  if (!isMailConfigured()) {
    return { sent: false, error: 'Mail is not configured.' };
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');
  const transporter = nodemailer.createTransport({
    host: String(process.env.SMTP_HOST).trim(),
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined
  });

  try {
    await transporter.sendMail({
      from: mailFrom(),
      to,
      subject: 'Your ConnectED account',
      text: accountEmailBody({ firstName, lastName, email: to, role, password })
    });
    return { sent: true };
  } catch (error) {
    console.error('[mail] account details:', error.message);
    return { sent: false, error: 'The mail provider did not accept the message.' };
  }
}

function studentCredentialBody({ parentName, studentName, username, password }) {
  const hello = String(parentName || '').trim() || 'there';
  const child = String(studentName || '').trim() || 'your child';
  return [
    `Hello ${hello},`,
    '',
    `A ConnectED login was created for ${child}.`,
    '',
    `Sign-in email: ${username}`,
    `Temporary password: ${password}`,
    '',
    'Your child signs in with this email and temporary password, then sets a new password when prompted.',
    'Do not share this password.',
    '',
    'ConnectED'
  ].join('\n');
}

async function sendStudentCredentials({ parentEmail, parentName, studentName, username, password }) {
  const to = String(parentEmail || '').trim();
  if (!to || !username || !password) {
    return { sent: false, error: 'The parent has no email, or the login has no username or temporary password.' };
  }
  if (!isMailConfigured()) {
    return { sent: false, error: 'Mail is not configured.' };
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');
  const transporter = nodemailer.createTransport({
    host: String(process.env.SMTP_HOST).trim(),
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined
  });

  try {
    await transporter.sendMail({
      from: mailFrom(),
      to,
      subject: 'ConnectED login for your child',
      text: studentCredentialBody({ parentName, studentName, username, password })
    });
    return { sent: true };
  } catch (error) {
    console.error('[mail] student credentials:', error.message);
    return { sent: false, error: 'The mail provider did not accept the message.' };
  }
}

module.exports = {
  isMailConfigured,
  sendAccountDetails,
  sendStudentCredentials
};
