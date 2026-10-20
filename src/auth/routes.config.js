'use strict';

const ROLE_HOME = {
  admin: '/admin',
  teacher: '/teacher',
  parent: '/parent',
  student: '/student'
};

const ROUTES = [
  { path: '/', public: true, roles: null, loggedOut: '/login', loggedIn: 'home' },
  { path: '/login', public: true, roles: null, loggedIn: 'home' },
  { path: '/admin', public: false, roles: ['admin'] },
  { path: '/teacher', public: false, roles: ['teacher'] },
  { path: '/parent', public: false, roles: ['parent'] },
  { path: '/student', public: false, roles: ['student'] }
];

const PORTAL_PAGES = ['/login', '/admin', '/teacher', '/parent', '/student'];

function normalizePath(pathname) {
  const path = String(pathname || '/');
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

function homeForRole(role) {
  return ROLE_HOME[role] || '/login';
}

function findRoute(pathname) {
  const path = normalizePath(pathname);
  return ROUTES.find((route) => route.path === path) || null;
}

function safeNext(next, role) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return null;
  const path = normalizePath(next.split('?')[0]);
  const route = findRoute(path);
  if (!route || route.public || !route.roles || !route.roles.includes(role)) return null;
  return path;
}

module.exports = {
  ROLE_HOME,
  ROUTES,
  PORTAL_PAGES,
  normalizePath,
  homeForRole,
  findRoute,
  safeNext
};
