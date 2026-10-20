'use strict';

const jwt = require('jsonwebtoken');
const db = require('../../db');
const { routingV2Enabled } = require('./flags');
const { readAuthToken } = require('./cookies');
const { findRoute, homeForRole, normalizePath, PORTAL_PAGES } = require('./routes.config');

const NO_STORE = 'no-store, no-cache, must-revalidate';

async function viewerFromRequest(req) {
  const { ensureAuthColumns } = require('../controllers/authController');
  await ensureAuthColumns();
  const token = readAuthToken(req);
  if (!token) return null;
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
  const [rows] = await db.query(
    'SELECT role, token_version FROM users WHERE id = ?',
    [decoded.id]
  );
  if (!rows.length) return null;
  const current = Number(rows[0].token_version) || 0;
  if ((Number(decoded.tv) || 0) !== current) return null;
  return { id: decoded.id, role: rows[0].role };
}

function sendIndex(res, indexHtmlPath, status) {
  res.status(status);
  res.setHeader('Cache-Control', NO_STORE);
  res.setHeader('Pragma', 'no-cache');
  res.sendFile(indexHtmlPath);
}

function portalRoot() {
  return async function portalRootGate(req, res, next) {
    try {
      if (!routingV2Enabled()) return next();
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (normalizePath(req.path) !== '/') return next();
      const user = await viewerFromRequest(req);
      if (!user) return res.redirect(303, '/login');
      return res.redirect(303, homeForRole(user.role));
    } catch (error) {
      next(error);
    }
  };
}

function portalPages(indexHtmlPath) {
  const pages = new Set(PORTAL_PAGES);
  return async function portalPageGate(req, res, next) {
    try {
      if (!routingV2Enabled()) return next();
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const pathname = normalizePath(req.path);
      if (!pages.has(pathname)) return next();
      const route = findRoute(pathname);
      const user = await viewerFromRequest(req);
      if (route && route.public && user && route.loggedIn === 'home') {
        return res.redirect(303, homeForRole(user.role));
      }
      if (route && !route.public && !user) {
        return res.redirect(303, '/login?next=' + encodeURIComponent(pathname));
      }
      if (route && !route.public && user && !route.roles.includes(user.role)) {
        return sendIndex(res, indexHtmlPath, 403);
      }
      return sendIndex(res, indexHtmlPath, 200);
    } catch (error) {
      next(error);
    }
  };
}

function unknownPage(indexHtmlPath) {
  return function unknownPageGate(req, res, next) {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
    }
    if (!routingV2Enabled()) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(404).json({ error: 'Not found' });
    }
    return sendIndex(res, indexHtmlPath, 404);
  };
}

module.exports = { portalRoot, portalPages, unknownPage, viewerFromRequest };
