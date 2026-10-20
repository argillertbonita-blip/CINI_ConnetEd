import { findRoute, homeForRole, normalizePath, safeNext } from './routes.config.js';
import { createSessionSync } from './sessionSync.js';

const VIEW_PATH = {
  admin: '/admin',
  teacher: '/teacher',
  parent: '/parent',
  student: '/student',
  login: '/login'
};

export async function bootRouting(hooks) {
  const { switchView, enterPortal, clearAuth, apiUrl } = hooks;
  const tabId = Math.random().toString(36).slice(2);
  const sync = createSessionSync(tabId);
  let busy = false;
  let wrapped = false;

  function showLogin() {
    window.__routeLock = true;
    switchView('login');
    window.__routeLock = false;
  }

  async function forceLocalLogout() {
    if (busy) return;
    busy = true;
    clearAuth();
    if (normalizePath(location.pathname) !== '/login') location.replace('/login');
    else showLogin();
    busy = false;
  }

  window.__routingNext = (next, role) => safeNext(next, role) || homeForRole(role);
  window.__routingPublish = (type) => sync.publish(type);
  window.__routingLogout = async () => {
    if (busy) return;
    busy = true;
    try {
      await fetch(`${apiUrl}/auth/logout`, { method: 'POST' });
    } catch { /* still leave locally */ }
    clearAuth();
    sync.publish('LOGOUT');
    location.replace('/login');
  };
  window.__syncRoute = (viewName) => {
    const path = VIEW_PATH[viewName];
    if (!path || normalizePath(location.pathname) === path) return;
    history.pushState({ view: viewName }, '', path);
  };

  if (!wrapped) {
    wrapped = true;
    const origFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await origFetch(...args);
      const raw = args[0];
      const url = typeof raw === 'string' ? raw : (raw && raw.url) || '';
      if (response.status === 401 && url.includes('/api/') && !url.includes('/api/auth/login')) {
        forceLocalLogout();
      }
      return response;
    };
  }

  sync.listen((type) => {
    if (type === 'LOGOUT') forceLocalLogout();
    if (type === 'LOGIN' && normalizePath(location.pathname) === '/login') location.reload();
  });

  async function checkSession() {
    if (busy || document.visibilityState === 'hidden') return;
    const response = await fetch(`${apiUrl}/auth/me`);
    if (response.status === 401) return;
    if (response.ok && normalizePath(location.pathname) === '/login') {
      const user = await response.json();
      location.replace(homeForRole(user.role));
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkSession();
  });
  window.addEventListener('focus', () => checkSession());
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) checkSession();
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') checkSession();
  }, 60000);
  window.addEventListener('popstate', () => applyRoute());

  async function applyRoute() {
    const path = normalizePath(location.pathname);
    const route = findRoute(path);
    const response = await fetch(`${apiUrl}/auth/me`);
    const user = response.ok ? await response.json() : null;
    const homeLink = document.getElementById('forbidden-home');
    if (homeLink && user) homeLink.href = homeForRole(user.role);

    if (!route) {
      window.__routeLock = true;
      switchView('notfound');
      window.__routeLock = false;
      return;
    }
    if (!user) {
      if (path === '/' || !route.public) {
        const next = route.public ? '' : ('?next=' + encodeURIComponent(path));
        location.replace('/login' + next);
        return;
      }
      showLogin();
      return;
    }
    if (path === '/login' || path === '/') {
      location.replace(homeForRole(user.role));
      return;
    }
    if (!route.roles.includes(user.role)) {
      window.__routeLock = true;
      switchView('forbidden');
      window.__routeLock = false;
      return;
    }
    window.__routeLock = true;
    enterPortal(user);
    window.__routeLock = false;
  }

  await applyRoute();
}
