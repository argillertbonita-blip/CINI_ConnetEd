const jwt = require('jsonwebtoken');
const db = require('../../db');
const { routingV2Enabled } = require('../auth/flags');
const { readCookie, COOKIE_NAME } = require('../auth/cookies');
const { ensureAuthColumns } = require('../controllers/authController');

function requestToken(req) {
  const header = req.headers && req.headers.authorization;
  const bearer = header && header.split(' ')[1];
  if (bearer && bearer !== 'null' && bearer !== 'undefined') return bearer;
  if (!routingV2Enabled()) return '';
  return readCookie(req, COOKIE_NAME);
}

exports.verifyToken = (req, res, next) => {
  const token = requestToken(req);

  if (!token) {
    const status = routingV2Enabled() ? 401 : 403;
    return res.status(status).json({ error: 'Access denied. No token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (!routingV2Enabled()) {
    req.user = decoded;
    return next();
  }

  ensureAuthColumns()
    .then(() => db.query('SELECT token_version FROM users WHERE id = ?', [decoded.id]))
    .then(([rows]) => {
      if (!rows.length) return res.status(401).json({ error: 'Invalid or expired token' });
      const current = Number(rows[0].token_version) || 0;
      const claimed = Number(decoded.tv) || 0;
      if (claimed !== current) return res.status(401).json({ error: 'Invalid or expired token' });
      req.user = decoded;
      next();
    })
    .catch((error) => {
      console.error('Verify token error:', error);
      res.status(500).json({ error: 'Server error' });
    });
};

exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
  };
};
