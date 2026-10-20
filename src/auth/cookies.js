'use strict';

const COOKIE_NAME = 'connected_token';

function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return '';
  const parts = String(header).split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return trimmed.slice(eq + 1);
    }
  }
  return '';
}

function readAuthToken(req) {
  const header = req.headers && req.headers.authorization;
  const bearer = header && header.split(' ')[1];
  if (bearer && bearer !== 'null' && bearer !== 'undefined') return bearer;
  return readCookie(req, COOKIE_NAME);
}

function setAuthCookie(res, token, staySignedIn) {
  const maxAge = (staySignedIn ? 30 * 24 * 60 * 60 : 8 * 60 * 60) * 1000;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}

module.exports = {
  COOKIE_NAME,
  readCookie,
  readAuthToken,
  setAuthCookie,
  clearAuthCookie
};
