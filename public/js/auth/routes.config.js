export const ROLE_HOME = {
  admin: '/admin',
  teacher: '/teacher',
  parent: '/parent',
  student: '/student'
};

export const ROUTES = [
  { path: '/', public: true, roles: null },
  { path: '/login', public: true, roles: null },
  { path: '/admin', public: false, roles: ['admin'] },
  { path: '/teacher', public: false, roles: ['teacher'] },
  { path: '/parent', public: false, roles: ['parent'] },
  { path: '/student', public: false, roles: ['student'] }
];

export function normalizePath(pathname) {
  const path = String(pathname || '/');
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

export function homeForRole(role) {
  return ROLE_HOME[role] || '/login';
}

export function findRoute(pathname) {
  const path = normalizePath(pathname);
  return ROUTES.find((route) => route.path === path) || null;
}

export function safeNext(next, role) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return null;
  const path = normalizePath(next.split('?')[0]);
  const route = findRoute(path);
  if (!route || route.public || !route.roles || !route.roles.includes(role)) return null;
  return path;
}
