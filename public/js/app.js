import { bootRouting } from './auth/routeGuard.js?v=20261020s1';
import { createSessionSync } from './auth/sessionSync.js';
import { initStudentPortal, loadStudentPortal, refreshEnrollUsernamePreview } from './studentPortal.js?v=20261020s5';

const sessionSync = createSessionSync(Math.random().toString(36).slice(2));

const API_URL = `${window.location.origin}/api`;
initStudentPortal({
  apiUrl: API_URL,
  authHeaders: () => getAuthHeaders(),
  escapeHtml: (value) => escapeHtml(value),
  showToast: (message, type) => showToast(message, type)
});
let SCHOOL_YEAR = '2025-2026';
let CURRENT_QUARTER = 'Q1';
let UNLOCKED_QUARTERS = ['Q1'];
let lastAccountsData = [];
const selectedAccountIds = new Set();
let lastStudentsData = [];
let currentAccountRoleFilter = 'all';
let currentAccountStatusFilter = 'active';
let currentAccountSearch = '';
let currentAccountSort = 'az';
let accountPage = 1;
let studentPage = 1;
let subjectPage = 1;
const ADMIN_PAGE_SIZE = 10;

function paintAdminPager(hostId, pager, onPage) {
  const host = document.getElementById(hostId);
  if (!host) return;
  const innerId = `${hostId}-inner`;
  host.innerHTML = parentPagerHtml(innerId, pager);
  wireParentPager(innerId, onPage);
} 
let accountSortMenuApi = null;

function normalizeQuarterClient(value) {
  const q = String(value || 'Q1').toUpperCase();
  return ['Q1', 'Q2', 'Q3', 'Q4'].includes(q) ? q : 'Q1';
}

/** Fill a <select> with unlocked quarters only (future quarters stay inaccessible). */
function fillUnlockedQuarterSelect(selectEl, preferred) {
  if (!selectEl) return null;
  const unlocked = (UNLOCKED_QUARTERS || ['Q1']).map(normalizeQuarterClient);
  const list = unlocked.length ? unlocked : [normalizeQuarterClient(CURRENT_QUARTER || 'Q1')];
  const want = normalizeQuarterClient(preferred || teacherCurrentQuarter || CURRENT_QUARTER || list[list.length - 1]);
  const selected = list.includes(want) ? want : list[list.length - 1];
  selectEl.innerHTML = list.map((q) =>
    `<option value="${q}">${q}${q === normalizeQuarterClient(CURRENT_QUARTER) ? ' (current)' : ''}</option>`
  ).join('');
  selectEl.value = selected;
  return selected;
}

function refreshUnlockedQuarterSelects() {
  fillUnlockedQuarterSelect(document.getElementById('qb-exam-quarter'));
  fillUnlockedQuarterSelect(document.getElementById('qb-create-quarter'));
}

function applyQuarterUnlockUI() {
  const unlocked = new Set((UNLOCKED_QUARTERS || ['Q1']).map(normalizeQuarterClient));
  document.querySelectorAll('#teacher-quarter-list [data-quarter]').forEach(chip => {
    const q = normalizeQuarterClient(chip.dataset.quarter);
    const isUnlocked = unlocked.has(q);
    chip.hidden = !isUnlocked;
    if (!isUnlocked) chip.classList.remove('active');
  });

  if (!unlocked.has(normalizeQuarterClient(teacherCurrentQuarter))) {
    teacherCurrentQuarter = CURRENT_QUARTER || 'Q1';
  }

  document.querySelectorAll('#teacher-quarter-list [data-quarter]').forEach(chip => {
    chip.classList.toggle('active', normalizeQuarterClient(chip.dataset.quarter) === normalizeQuarterClient(teacherCurrentQuarter));
  });

  const note = document.getElementById('progress-quarter-note');
  if (note) {
    note.textContent = '';
    note.hidden = true;
  }

  const help = document.getElementById('admin-quarter-help');
  if (help) {
    help.textContent = CURRENT_QUARTER === 'Q4'
      ? 'All quarters are unlocked for Progress records.'
      : `Teachers can record Progress through ${CURRENT_QUARTER}.`;
  }

  const select = document.getElementById('admin-current-quarter');
  if (select) select.value = CURRENT_QUARTER;

  refreshUnlockedQuarterSelects();
}

async function loadAppConfig() {
  try {
    const res = await fetch(`${API_URL}/config`);
    const data = await res.json();
    window.__routingV2 = data.routingV2 === true;
    if (data.schoolYear) {
      SCHOOL_YEAR = data.schoolYear;
      const yearEl = document.getElementById('teacher-school-year-label');
      if (yearEl) yearEl.textContent = SCHOOL_YEAR;
    }
    CURRENT_QUARTER = normalizeQuarterClient(data.currentQuarter || 'Q1');
    UNLOCKED_QUARTERS = Array.isArray(data.unlockedQuarters) && data.unlockedQuarters.length
      ? data.unlockedQuarters.map(normalizeQuarterClient)
      : ['Q1'];
    if (typeof teacherCurrentQuarter !== 'undefined') {
      if (!UNLOCKED_QUARTERS.includes(normalizeQuarterClient(teacherCurrentQuarter))) {
        teacherCurrentQuarter = CURRENT_QUARTER;
      }
    }
    applyQuarterUnlockUI();
  } catch (err) {
    console.error('Load config error:', err);
  }
}

function getAuthToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function getAuthUser() {
  const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function authUserStore() {
  if (localStorage.getItem('token')) return localStorage;
  if (sessionStorage.getItem('token')) return sessionStorage;
  return localStorage;
}

function saveAuth(token, user, persist) {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('rememberMe', persist ? '1' : '0');
  sessionStorage.setItem('connected.session', '1');
}

function persistAuthUser(user) {
  authUserStore().setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('rememberMe');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('connected.session');
}

function applyLoggedInUser(user) {
  if (!user) return;

  if (!user.first_name && !user.last_name && user.name) {
    const parts = String(user.name).split(' ');
    user.first_name = parts[0] || '';
    user.last_name = parts.slice(1).join(' ') || '';
  }

  const displayName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = displayName;
  });
  document.querySelectorAll('[data-user-initial]').forEach(el => {
    el.textContent = initial;
    el.style.display = 'flex';
  });

  document.querySelectorAll('[data-topbar-avatar]').forEach(avatarImg => {
    const initialSpan = avatarImg.nextElementSibling;
    if (user.avatar_url) {
      avatarImg.src = user.avatar_url + '?t=' + Date.now();
      avatarImg.style.display = 'block';
      if (initialSpan) initialSpan.style.display = 'none';
    } else {
      avatarImg.removeAttribute('src');
      avatarImg.src = '';
      avatarImg.style.display = 'none';
      if (initialSpan) initialSpan.style.display = 'flex';
    }
  });

  const firstInput = document.getElementById('admin-profile-first');
  const lastInput = document.getElementById('admin-profile-last');
  const emailInput = document.getElementById('admin-profile-email');
  if (firstInput) firstInput.value = user.first_name || '';
  if (lastInput) lastInput.value = user.last_name || '';
  if (emailInput) emailInput.value = user.email || '';
}

function clearUserAvatars() {
  document.querySelectorAll('[data-topbar-avatar]').forEach(avatarImg => {
    avatarImg.removeAttribute('src');
    avatarImg.src = '';
    avatarImg.style.display = 'none';
    const initialSpan = avatarImg.nextElementSibling;
    if (initialSpan) {
      initialSpan.textContent = '?';
      initialSpan.style.display = 'flex';
    }
  });
  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = 'User';
  });
}

function enterPortal(user) {
  applyLoggedInUser(user);
  if (user.role === 'admin') switchView('admin');
  else if (user.role === 'teacher') switchView('teacher');
  else if (user.role === 'parent') switchView('parent');
  else if (user.role === 'student') {
    switchView('student');
    loadStudentPortal();
  }
  maybeForcePasswordChange(user);
}

// ========== VIEW ROUTER ==========
function switchView(viewName) {
  document.querySelectorAll('.app-view').forEach(view => {
    view.hidden = view.dataset.view !== viewName;
  });
  document.body.setAttribute('data-view', viewName);
  if (window.__routingV2 && !window.__routeLock && window.__syncRoute) window.__syncRoute(viewName);
}

function showLoginScreen() {
  clearAuth();
  clearUserAvatars();
  const emailEl = document.getElementById('login-email');
  const passwordEl = document.getElementById('login-password');
  if (emailEl) emailEl.value = '';
  if (passwordEl) passwordEl.value = '';
  const rememberEl = document.getElementById('login-remember');
  if (rememberEl) rememberEl.checked = true;
  switchView('login');
}

let sessionPeer = false;

function openSharedAccount() {
  const token = getAuthToken();
  const user = getAuthUser();
  if (!token || !user?.role) return false;
  sessionStorage.setItem('connected.session', '1');
  const view = document.body?.getAttribute('data-view');
  if (view && view !== 'login') return true;
  enterPortal(user);
  loadUserProfile();
  return true;
}

sessionSync.listen((type) => {
  if (type === 'LOGOUT') showLoginScreen();
  if (type === 'LOGIN') openSharedAccount();
  if (type === 'PING' && sessionStorage.getItem('connected.session') === '1' && getAuthToken()) {
    sessionSync.publish('PONG');
  }
  if (type === 'PONG') sessionPeer = true;
});

async function claimSharedSession() {
  if (!localStorage.getItem('token')) return false;
  if (localStorage.getItem('rememberMe') !== '0' || sessionStorage.getItem('connected.session') === '1') {
    sessionStorage.setItem('connected.session', '1');
    return true;
  }
  sessionPeer = false;
  sessionSync.publish('PING');
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!sessionPeer) {
    clearAuth();
    return false;
  }
  sessionStorage.setItem('connected.session', '1');
  return true;
}

// ========== LOGIN ==========
document.getElementById('login-signin-btn')?.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember')?.checked !== false;
  const msgEl = document.getElementById('login-message');

  if (openSharedAccount()) return;

  if (!email || !password) {
    msgEl.textContent = 'Please enter email and password';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    const existingUser = getAuthUser() || {};
    const mergedUser = { ...existingUser };

    if (data.user) {
      Object.keys(data.user).forEach(key => {
        if (data.user[key] !== undefined && data.user[key] !== null) {
          mergedUser[key] = data.user[key];
        }
      });
    }

    if (!mergedUser.name && (mergedUser.first_name || mergedUser.last_name)) {
      mergedUser.name = `${mergedUser.first_name || ''} ${mergedUser.last_name || ''}`.trim();
    }
    if (!mergedUser.first_name && !mergedUser.last_name && mergedUser.name) {
      const parts = mergedUser.name.split(' ');
      mergedUser.first_name = parts[0] || '';
      mergedUser.last_name = parts.slice(1).join(' ') || '';
    }

    saveAuth(data.token, mergedUser, remember);
    sessionSync.publish('LOGIN');
    if (window.__routingV2) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      if (window.__routingPublish) window.__routingPublish('LOGIN');
      const next = new URLSearchParams(location.search).get('next');
      location.assign(window.__routingNext ? window.__routingNext(next, mergedUser.role) : '/');
      return;
    }
    enterPortal(mergedUser);
    loadUserProfile();

  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.style.color = '#b71c1c';
  }
});

document.getElementById('login-password')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-signin-btn')?.click();
});
document.getElementById('login-email')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-signin-btn')?.click();
});

// ========== LOGOUT ==========
document.querySelectorAll('[data-action="logout"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (window.__routingV2 && window.__routingLogout) {
      window.__routingLogout();
      return;
    }
    showLoginScreen();
    sessionSync.publish('LOGOUT');
  });
});

// ========== PASSWORD TOGGLE ==========
function resetPasswordFieldVisibility(inputId) {
  const input = document.getElementById(inputId);
  const btn = document.querySelector(`[data-password-toggle="${inputId}"]`);
  if (!input) return;
  input.type = 'password';
  if (btn) {
    btn.textContent = '👁';
    btn.setAttribute('aria-label', btn.dataset.showLabel || 'Show password');
  }
}

function resetChangePasswordFields() {
  ['cp-current', 'cp-new', 'cp-confirm'].forEach(resetPasswordFieldVisibility);
}

document.getElementById('toggle-password')?.addEventListener('click', (e) => {
  const input = document.getElementById('login-password');
  input.type = input.type === 'password' ? 'text' : 'password';
  e.currentTarget.textContent = input.type === 'password' ? '👁' : '🙈';
  e.currentTarget.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
});

document.querySelectorAll('[data-password-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const inputId = btn.getAttribute('data-password-toggle');
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
    btn.setAttribute(
      'aria-label',
      input.type === 'password'
        ? (btn.dataset.showLabel || 'Show password')
        : (btn.dataset.hideLabel || 'Hide password')
    );
  });
});

const forgotModal = document.getElementById('forgot-password-modal');
document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
  forgotModal?.removeAttribute('hidden');
});
document.getElementById('forgot-password-close')?.addEventListener('click', () => {
  forgotModal?.setAttribute('hidden', '');
});
forgotModal?.addEventListener('click', (e) => {
  if (e.target.id === 'forgot-password-modal') forgotModal.setAttribute('hidden', '');
});

const LEGAL_PAGES = ['privacy', 'terms', 'help'];

function showLegalTab(page) {
  const id = LEGAL_PAGES.includes(page) ? page : 'privacy';
  LEGAL_PAGES.forEach((name) => {
    const panel = document.getElementById(`legal-panel-${name}`);
    if (panel) panel.hidden = name !== id;
  });
  document.querySelectorAll('#legal-modal [data-legal-tab]').forEach((el) => {
    el.classList.toggle('is-active', el.getAttribute('data-legal-tab') === id);
  });
}

function openLegalModal(page) {
  showLegalTab(page);
  document.getElementById('legal-modal')?.removeAttribute('hidden');
}

function closeLegalModal() {
  document.getElementById('legal-modal')?.setAttribute('hidden', '');
}

document.querySelectorAll('[data-legal-open]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    openLegalModal(el.getAttribute('data-legal-open'));
  });
});
document.querySelectorAll('#legal-modal [data-legal-tab]').forEach((el) => {
  el.addEventListener('click', () => showLegalTab(el.getAttribute('data-legal-tab')));
});
document.getElementById('legal-modal-close')?.addEventListener('click', closeLegalModal);
document.getElementById('legal-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'legal-modal') closeLegalModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const modal = document.getElementById('legal-modal');
  if (modal && !modal.hasAttribute('hidden')) closeLegalModal();
});

// ========== ON LOAD: Restore previous session ==========
window.addEventListener('DOMContentLoaded', async () => {
  await loadAppConfig();

  if (window.__routingV2) {
    await bootRouting({
      switchView,
      enterPortal,
      clearAuth,
      apiUrl: API_URL
    });
    return;
  }

  const rememberEl = document.getElementById('login-remember');
  if (rememberEl) {
    rememberEl.checked = localStorage.getItem('rememberMe') !== '0';
  }

  const shared = await claimSharedSession();
  if (!shared) return;

  const token = getAuthToken();
  const user = getAuthUser();
  if (!token || !user?.role) return;

  enterPortal(user);

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      clearAuth();
      switchView('login');
      return;
    }
    await loadUserProfile();
  } catch (err) {
    console.error('Session restore error:', err);
  }
});

// ========== ADMIN SETTINGS DROPDOWN ==========
const adminAvatarBtn = document.getElementById('admin-avatar-btn');
const adminSettingsDropdown = document.getElementById('admin-settings-dropdown');

if (adminAvatarBtn && adminSettingsDropdown) {
  adminAvatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = adminSettingsDropdown.hasAttribute('hidden');
    if (isHidden) {
      adminSettingsDropdown.removeAttribute('hidden');
    } else {
      adminSettingsDropdown.setAttribute('hidden', '');
    }
  });

  document.addEventListener('click', (e) => {
    if (!adminSettingsDropdown.contains(e.target) && e.target !== adminAvatarBtn) {
      adminSettingsDropdown.setAttribute('hidden', '');
    }
  });
}

const teacherAvatarBtn = document.getElementById('teacher-avatar-btn');
const teacherSettingsDropdown = document.getElementById('teacher-settings-dropdown');
if (teacherAvatarBtn && teacherSettingsDropdown) {
  teacherAvatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = teacherSettingsDropdown.hasAttribute('hidden');
    if (isHidden) teacherSettingsDropdown.removeAttribute('hidden');
    else teacherSettingsDropdown.setAttribute('hidden', '');
  });
  document.addEventListener('click', (e) => {
    if (!teacherSettingsDropdown.contains(e.target) && e.target !== teacherAvatarBtn) {
      teacherSettingsDropdown.setAttribute('hidden', '');
    }
  });
}

const studentAvatarBtn = document.getElementById('student-avatar-btn');
const studentSettingsDropdown = document.getElementById('student-settings-dropdown');
if (studentAvatarBtn && studentSettingsDropdown) {
  studentAvatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = studentSettingsDropdown.hasAttribute('hidden');
    if (isHidden) studentSettingsDropdown.removeAttribute('hidden');
    else studentSettingsDropdown.setAttribute('hidden', '');
  });
  document.addEventListener('click', (e) => {
    if (!studentSettingsDropdown.contains(e.target) && e.target !== studentAvatarBtn) {
      studentSettingsDropdown.setAttribute('hidden', '');
    }
  });
}

const parentAvatarBtn = document.getElementById('parent-avatar-btn');
const parentSettingsDropdown = document.getElementById('parent-settings-dropdown');
if (parentAvatarBtn && parentSettingsDropdown) {
  parentAvatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = parentSettingsDropdown.hasAttribute('hidden');
    if (isHidden) parentSettingsDropdown.removeAttribute('hidden');
    else parentSettingsDropdown.setAttribute('hidden', '');
  });
  document.addEventListener('click', (e) => {
    if (!parentSettingsDropdown.contains(e.target) && e.target !== parentAvatarBtn) {
      parentSettingsDropdown.setAttribute('hidden', '');
    }
  });
}

// ========== HELPERS ==========
function getAuthHeaders() {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function loadUserProfile() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;

    const fresh = await res.json();
    if (!fresh || !fresh.id) return;

    const stored = getAuthUser() || {};
    const merged = { ...stored, ...fresh };
    if (fresh.name && (!stored.name || stored.name !== fresh.name)) {
      merged.name = fresh.name;
    }
    persistAuthUser(merged);
    applyLoggedInUser(merged);
    maybeForcePasswordChange(merged);
  } catch (err) {
    console.error('loadUserProfile error:', err);
  }
}


// ========== ADMIN ACCOUNTS ==========
const roleSelect = document.getElementById('admin-account-role');
const teacherFields = document.getElementById('teacher-fields');
const parentFields = document.getElementById('parent-fields');

function toggleRoleFields() {
  const role = roleSelect?.value;
  if (!teacherFields) return;

  if (role === 'teacher') {
    teacherFields.style.display = 'block';
    parentFields.style.display = 'none';
    // Reset checkboxes when switching to teacher
    document.querySelectorAll('input[name="teacher-home-role"]').forEach((el) => { el.checked = false; });
    toggleClassAdviserFields();
  } else if (role === 'parent') {
    teacherFields.style.display = 'none';
    document.getElementById('class-adviser-fields').style.display = 'none';
    document.getElementById('subject-teacher-fields').style.display = 'none';
    parentFields.style.display = 'grid';
  } else {
    teacherFields.style.display = 'none';
    document.getElementById('class-adviser-fields').style.display = 'none';
    document.getElementById('subject-teacher-fields').style.display = 'none';
    parentFields.style.display = 'none';
  }
}

function isUpperSchoolGrade(grade) {
  return ['4', '5', '6'].includes(String(grade || ''));
}

function isLowerSchoolGrade(grade) {
  return ['1', '2', '3'].includes(String(grade || ''));
}

function otherClassAssignmentCopy(grade) {
  const title = 'Also handles subjects in other grade levels or sections';
  if (isUpperSchoolGrade(grade)) {
    return {
      title,
      help: 'Add subjects this teacher handles in other Grade 4–6 sections. Subjects in this class are selected above. One teacher per subject per class.'
    };
  }
  if (isLowerSchoolGrade(grade)) {
    return {
      title,
      help: 'Add subjects this teacher handles in Grades 4–6. Only the class adviser and assistant teacher cover Grades 1–3.'
    };
  }
  return { title, help: '' };
}

function selectedHomeRole(inputName) {
  return document.querySelector(`input[name="${inputName}"]:checked`)?.value || '';
}

function homeRoleTitle(role) {
  return role === 'assistant' ? 'Assistant Teacher Assignment' : 'Class Adviser Assignment';
}

let subjectCatalogPromise = null;
function loadSubjectCatalog() {
  if (!subjectCatalogPromise) {
    subjectCatalogPromise = fetch(`${API_URL}/subjects`, { headers: getAuthHeaders() })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load subjects');
        return Array.isArray(data) ? data : [];
      })
      .catch((err) => {
        subjectCatalogPromise = null;
        throw err;
      });
  }
  return subjectCatalogPromise;
}

function subjectAppliesToGrade(subject, grade) {
  if (!subject?.applicable_grades) return false;
  const ag = String(subject.applicable_grades).trim();
  const g = parseInt(grade, 10);
  if (Number.isNaN(g)) return false;
  const rangeMatch = ag.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    return g >= start && g <= end;
  }
  if (ag.includes(',')) {
    return ag.split(',').map((x) => parseInt(x.trim(), 10)).includes(g);
  }
  return parseInt(ag, 10) === g;
}

async function fetchClassSlots(grade, section, excludeTeacherId) {
  if (!grade || !section) return { adviser: null, assistant: null, taken_subjects: [] };
  const params = new URLSearchParams({
    grade_level: String(grade),
    section: String(section)
  });
  if (excludeTeacherId) params.set('exclude_teacher_id', String(excludeTeacherId));
  const res = await fetch(`${API_URL}/admin/class-slots?${params}`, { headers: getAuthHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load class assignments');
  return data;
}

function activeHomeForm() {
  const editOpen = document.getElementById('edit-teacher-modal') && !document.getElementById('edit-teacher-modal').hasAttribute('hidden');
  const prefix = editOpen ? 'edit-' : '';
  const grade = document.getElementById(`${prefix}class-adviser-grade`)?.value || '';
  const sectionSelect = document.getElementById(`${prefix}class-adviser-section`);
  let section = sectionSelect?.value || '';
  if (section === '__NEW__') {
    section = (document.getElementById(`${prefix}class-adviser-new-section`)?.value || '').trim();
  }
  const listId = prefix ? 'edit-class-adviser-subjects-list' : 'class-adviser-subjects-list';
  const boxClass = prefix ? '.edit-ca-subject-checkbox' : '.ca-subject-checkbox';
  const claimed = [...document.querySelectorAll(`#${listId} ${boxClass}:checked`)].map((cb) => String(cb.value));
  const excludeId = prefix ? document.getElementById('edit-teacher-id')?.value : '';
  return { grade, section, claimed, excludeId };
}

function subjectOptionLabel(subject) {
  return subject.subject_name || subject.name || subject.NAME || 'Unnamed';
}

function collectSubjectAssignmentRows(containerSelector) {
  const rows = document.querySelectorAll(`${containerSelector} > .form-row`);
  const assignments = [];
  for (const row of rows) {
    const subjectId = row.querySelector('.subject-id-select')?.value;
    const grade = row.querySelector('.subject-grade-select')?.value;
    const sectionSelect = row.querySelector('.subject-section-select');
    const sectionNew = row.querySelector('.subject-new-section');
    const errorEl = row.querySelector('.subject-section-error');
    let section = null;
    if (sectionSelect?.value === '__NEW__') {
      section = validateSectionName(sectionNew?.value || '', null, errorEl?.id);
      if (sectionNew?.value?.trim() && !section) return null;
    } else {
      section = sectionSelect?.value || null;
    }
    const started = !!(subjectId || grade || section);
    if (!started) continue;
    if (!subjectId || !isUpperSchoolGrade(grade) || !section) {
      alert('Each subject row needs a subject, a Grades 4–6 level, and a section.');
      return null;
    }
    assignments.push({
      subject_id: parseInt(subjectId, 10),
      grade_level: parseInt(grade, 10),
      section
    });
  }
  return assignments;
}

function syncCreateSubjectPanel() {
  const isCA = !!selectedHomeRole('teacher-home-role');
  const also = document.getElementById('teacher-also-teaches');
  const wrap = document.getElementById('teacher-also-teaches-wrap');
  const grade = document.getElementById('class-adviser-grade')?.value;
  if (!isCA && also) also.checked = false;
  if (wrap) wrap.style.display = isCA ? 'flex' : 'none';
  const copy = otherClassAssignmentCopy(grade);
  const label = document.getElementById('teacher-also-teaches-label');
  if (label) label.textContent = copy.title;
  const showRows = !!(isCA && also?.checked);
  const fields = document.getElementById('subject-teacher-fields');
  if (fields) fields.style.display = showRows ? 'block' : 'none';
  const title = document.getElementById('subject-teacher-title');
  const help = document.getElementById('subject-teacher-help');
  if (title) title.style.display = 'none';
  if (help) help.textContent = copy.help;
  const container = document.getElementById('subject-assignments-container');
  if (showRows && container && container.children.length === 0) addSubjectAssignment();
}
window.syncCreateSubjectPanel = syncCreateSubjectPanel;

window.toggleClassAdviserFields = function() {
  const role = selectedHomeRole('teacher-home-role');
  const checked = !!role;
  const caFields = document.getElementById('class-adviser-fields');
  const title = document.getElementById('class-adviser-fields-title');
  if (title) title.textContent = homeRoleTitle(role);
  if (caFields) caFields.style.display = checked ? 'grid' : 'none';
  if (!checked) {
    const wrap = document.getElementById('class-adviser-subjects-wrap');
    const note = document.getElementById('class-adviser-auto-note');
    if (wrap) wrap.style.display = 'none';
    if (note) note.style.display = 'none';
  }
  if (checked) loadClassAdviserSections();
  syncCreateSubjectPanel();
};

window.loadClassAdviserSections = async function() {
  const gradeSelect = document.getElementById('class-adviser-grade');
  const sectionSelect = document.getElementById('class-adviser-section');
  const newInput = document.getElementById('class-adviser-new-section');
  if (!gradeSelect || !sectionSelect) return;

  // Reset
  sectionSelect.style.display = '';
  if (newInput) { newInput.hidden = true; newInput.style.display = ''; newInput.value = ''; }

  const grade = gradeSelect.value;
  if (!grade) {
    sectionSelect.innerHTML = '<option value="">-- Select Grade First --</option>';
    sectionSelect.disabled = true;
    loadClassAdviserSubjects();
    syncCreateSubjectPanel();
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/sections?grade_level=${grade}`, { headers: getAuthHeaders() });
    const sections = await res.json();
    if (!res.ok) throw new Error(sections.error);

    let html = '<option value="">-- Select Section --</option>';
    if (sections.length > 0) {
      html += sections.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    html += '<option value="__NEW__">— Add New Section —</option>';

    sectionSelect.innerHTML = html;
    sectionSelect.disabled = false;
  } catch (err) {
    console.error('Load sections error:', err);
    sectionSelect.innerHTML = '<option value="">Failed to load</option><option value="__NEW__">— Add New Section —</option>';
    sectionSelect.disabled = false;
  }
  loadClassAdviserSubjects();
  syncCreateSubjectPanel();
};

let createSubjectLoadGen = 0;

function homeSectionValue(selectId, newInputId) {
  const sectionSelect = document.getElementById(selectId);
  const raw = sectionSelect?.value || '';
  if (raw === '__NEW__') return { known: false, section: '' };
  return { known: !!raw, section: raw };
}

async function renderHomeSubjectChecks({ grade, section, knownSection, list, checkboxClass, preselectedIds, excludeTeacherId, generation, generationRef }) {
  const subjects = await loadSubjectCatalog();
  if (generation !== generationRef()) return;
  let taken = new Set();
  if (knownSection && section) {
    const slots = await fetchClassSlots(grade, section, excludeTeacherId);
    if (generation !== generationRef()) return;
    taken = new Set((slots.taken_subjects || []).map((row) => String(row.subject_id)));
  }
  const selected = new Set((preselectedIds || []).map((id) => String(id)));
  const applicable = subjects.filter((subject) => subjectAppliesToGrade(subject, grade) && !taken.has(String(subject.id)));
  if (!applicable.length) {
    list.innerHTML = `<span style="color:var(--text-muted);font-size:0.8rem;">${taken.size ? 'Every subject in this class is already assigned.' : 'No subjects found for this grade.'}</span>`;
    return;
  }
  list.innerHTML = applicable.map((subject) => `
    <label style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-maroon);cursor:pointer;font-size:0.9rem;width:100%;box-sizing:border-box;">
      <input type="checkbox" class="${checkboxClass}" value="${subject.id}" ${selected.has(String(subject.id)) ? 'checked' : ''} onchange="refreshOpenSubjectRows()" style="width:18px;height:18px;cursor:pointer;flex-shrink:0;">
      <span style="font-size:0.76rem;color:var(--text-muted);font-weight:400;">${subjectOptionLabel(subject)}</span>
    </label>
  `).join('');
  refreshOpenSubjectRows();
}

// Load subject checkboxes for the home class (Grades 1-6)
window.loadClassAdviserSubjects = async function() {
  const gradeSelect = document.getElementById('class-adviser-grade');
  const wrap = document.getElementById('class-adviser-subjects-wrap');
  const list = document.getElementById('class-adviser-subjects-list');
  if (!gradeSelect || !wrap || !list) return;

  const grade = gradeSelect.value;
  const hasGrade = ['1', '2', '3', '4', '5', '6'].includes(grade);
  const isLowerGrade = isLowerSchoolGrade(grade);
  const autoNote = document.getElementById('class-adviser-auto-note');
  if (autoNote) autoNote.style.display = isLowerGrade ? 'block' : 'none';

  if (!hasGrade) {
    wrap.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  wrap.style.display = 'block';
  const sectionState = homeSectionValue('class-adviser-section', 'class-adviser-new-section');
  if (!sectionState.known && document.getElementById('class-adviser-section')?.value !== '__NEW__') {
    list.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem;">Select a section to choose subjects.</span>';
    return;
  }

  const generation = ++createSubjectLoadGen;
  list.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem;">Loading subjects...</span>';
  try {
    await renderHomeSubjectChecks({
      grade,
      section: sectionState.section,
      knownSection: sectionState.known,
      list,
      checkboxClass: 'ca-subject-checkbox',
      preselectedIds: [],
      excludeTeacherId: '',
      generation,
      generationRef: () => createSubjectLoadGen
    });
  } catch (err) {
    if (generation !== createSubjectLoadGen) return;
    console.error('Load class adviser subjects error:', err);
    list.innerHTML = '<span style="color:#b71c1c;font-size:0.8rem;">Failed to load subjects.</span>';
  }
};

window.onClassAdviserSectionChange = function(selectEl, inputId, which) {
  handleSectionSelect(selectEl, inputId);
  if (which === 'edit') loadEditClassAdviserSubjects();
  else loadClassAdviserSubjects();
};

// Hybrid section handler: toggles between dropdown and text input
window.handleSectionSelect = function(selectEl, inputId) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(inputId + '-error');
  if (!input) return;

  if (selectEl.value === '__NEW__') {
    selectEl.style.display = 'none';
    input.hidden = false;
    input.style.display = '';
    input.focus();
    if (errorEl) errorEl.style.display = 'none';
  } else {
    selectEl.style.display = '';
    input.hidden = true;
    input.style.display = '';
    input.value = '';
    if (errorEl) errorEl.style.display = 'none';
  }
};

// Validate section name: not empty, no duplicates, valid chars, max length
window.validateSectionName = function(name, existingSections, errorElId) {
  const errorEl = document.getElementById(errorElId);
  const normalized = name.trim().toUpperCase();

  if (!normalized) {
    if (errorEl) { errorEl.textContent = 'Section name is required'; errorEl.style.display = 'block'; }
    return null;
  }
  if (normalized.length > 10) {
    if (errorEl) { errorEl.textContent = 'Section name too long (max 10 characters)'; errorEl.style.display = 'block'; }
    return null;
  }
  if (!/^[A-Z0-9-]+$/.test(normalized)) {
    if (errorEl) { errorEl.textContent = 'Only letters, numbers, and hyphens allowed'; errorEl.style.display = 'block'; }
    return null;
  }
  if (existingSections && existingSections.includes(normalized)) {
    if (errorEl) { errorEl.textContent = `Section '${normalized}' already exists for this grade`; errorEl.style.display = 'block'; }
    return null;
  }
  if (errorEl) errorEl.style.display = 'none';
  return normalized;
};

let subjectCounter = 0;

window.addSubjectAssignment = async function() {
  subjectCounter++;
  const container = document.getElementById('subject-assignments-container');
  if (!container) return;

  const rowId = `subject-row-${subjectCounter}`;

  let subjectOptions = '<option value="">-- Select Subject --</option>';
  try {
    const subjects = await loadSubjectCatalog();
    subjectOptions += subjects.map((s) =>
      `<option value="${s.id}">${subjectOptionLabel(s)}</option>`
    ).join('');
  } catch (err) {
    console.error('Load subjects error:', err);
  }

  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'form-row';
  row.style.cssText = 'align-items:end;gap:10px;margin-bottom:8px;padding:10px;background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;';
  row.innerHTML = `
    <div class="field-small" style="flex:1.5;">
      <label>Subject</label>
      <select class="subject-id-select" >
        ${subjectOptions}
      </select>
    </div>
    <div class="field-small" style="flex:1;">
      <label>Grade Level</label>
      <select class="subject-grade-select" onchange="loadSubjectSections(this)" >
        <option value="">-- Select --</option>
        <option value="4">Grade 4</option>
        <option value="5">Grade 5</option>
        <option value="6">Grade 6</option>
      </select>
    </div>
    <div class="field-small" style="flex:1;">
      <label>Section</label>
      <div class="subject-section-wrap">
        <select class="subject-section-select" disabled onchange="handleSubjectSectionSelect(this, '${rowId}')">
          <option value="">-- Select Grade First --</option>
        </select>
        <input type="text" class="subject-new-section" placeholder="e.g., A, Bonifacio" hidden maxlength="10">
      </div>
      <small class="subject-section-error" style="color:#b71c1c;font-size:0.75rem;display:none;"></small>
    </div>
    <button type="button" class="chip-ghost" onclick="removeSubjectAssignment('${rowId}')" style="color:#b71c1c;border-color:#b71c1c;height:fit-content;padding:6px 10px;">Remove</button>
  `;
  container.appendChild(row);
}

window.removeSubjectAssignment = function(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
};

window.loadSubjectSections = async function(gradeSelect) {
  const row = gradeSelect.closest('.form-row');
  const sectionSelect = row.querySelector('.subject-section-select');
  const newInput = row.querySelector('.subject-new-section');
  const grade = gradeSelect.value;

  // Reset
  sectionSelect.style.display = '';
  if (newInput) { newInput.hidden = true; newInput.style.display = ''; newInput.value = ''; }

  if (!grade) {
    sectionSelect.innerHTML = '<option value="">-- Select Grade First --</option>';
    sectionSelect.disabled = true;
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/sections?grade_level=${grade}`, { headers: getAuthHeaders() });
    const sections = await res.json();
    if (!res.ok) throw new Error(sections.error);

    let html = '<option value="">-- Select Section --</option>';
    if (sections.length > 0) {
      html += sections.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    html += '<option value="__NEW__">— Add New Section —</option>';

    sectionSelect.innerHTML = html;
    sectionSelect.disabled = false;
  } catch (err) {
    console.error('Load sections error:', err);
    sectionSelect.innerHTML = '<option value="">Failed to load</option><option value="__NEW__">— Add New Section —</option>';
    sectionSelect.disabled = false;
  }
  await refreshSubjectRowOptions(row);
};

// Handle subject section select change
window.handleSubjectSectionSelect = function(selectEl, rowId) {
  const row = document.getElementById(rowId);
  const input = row.querySelector('.subject-new-section');
  const errorEl = row.querySelector('.subject-section-error');
  if (!input) return;

  if (selectEl.value === '__NEW__') {
    selectEl.style.display = 'none';
    input.hidden = false;
    input.style.display = '';
    input.focus();
    if (errorEl) errorEl.style.display = 'none';
  } else {
    selectEl.style.display = '';
    input.hidden = true;
    input.style.display = '';
    input.value = '';
    if (errorEl) errorEl.style.display = 'none';
  }
  refreshSubjectRowOptions(row);
};

window.refreshOpenSubjectRows = async function() {
  const rows = document.querySelectorAll('#subject-assignments-container > .form-row, #edit-subject-assignments-container > .form-row');
  for (const row of rows) {
    await refreshSubjectRowOptions(row);
  }
};

async function refreshSubjectRowOptions(row) {
  const subjectSelect = row?.querySelector('.subject-id-select');
  if (!subjectSelect) return;
  const grade = row.querySelector('.subject-grade-select')?.value || '';
  const sectionSelect = row.querySelector('.subject-section-select');
  const section = sectionSelect?.value && sectionSelect.value !== '__NEW__' ? sectionSelect.value : '';
  const current = subjectSelect.value;
  let taken = new Set();
  const home = activeHomeForm();
  if (grade && section) {
    try {
      const slots = await fetchClassSlots(grade, section, home.excludeId);
      taken = new Set((slots.taken_subjects || []).map((item) => String(item.subject_id)));
    } catch (err) {
      console.error('Load taken subjects error:', err);
    }
  }
  const sameHome = grade && section
    && String(grade) === String(home.grade)
    && String(section).trim().toUpperCase() === String(home.section || '').trim().toUpperCase();
  if (sameHome) home.claimed.forEach((id) => taken.add(String(id)));
  let subjects = [];
  try {
    subjects = await loadSubjectCatalog();
  } catch (err) {
    console.error('Load subjects error:', err);
    return;
  }
  const options = ['<option value="">-- Select Subject --</option>'];
  subjects.forEach((subject) => {
    const id = String(subject.id);
    if (taken.has(id)) return;
    const selected = id === String(current) ? 'selected' : '';
    options.push(`<option value="${subject.id}" ${selected}>${subjectOptionLabel(subject)}</option>`);
  });
  subjectSelect.innerHTML = options.join('');
  if (current && !taken.has(String(current))) subjectSelect.value = current;
}

roleSelect?.addEventListener('change', toggleRoleFields);
toggleRoleFields();


// loadTeacherSubjectsDropdown removed — subjects now loaded per-row in addSubjectAssignment()

// Create account form submit
document.getElementById('admin-account-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    first_name: document.getElementById('admin-account-first').value.trim(),
    last_name: document.getElementById('admin-account-last').value.trim(),
    email: document.getElementById('admin-account-email').value.trim(),
    phone: document.getElementById('admin-account-phone').value.trim(),
    password: document.getElementById('admin-account-password').value,
    role: roleSelect.value
  };

  // Email validation based on role
  if (payload.role === 'teacher') {
    if (!payload.email.endsWith('@usant.edu.ph')) {
      alert('Teachers must use a school email ending with @usant.edu.ph');
      return;
    }
  } else if (payload.role === 'parent') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      alert('Please enter a valid email address for the parent');
      return;
    }
    payload.address = document.getElementById('admin-account-address')?.value.trim() || null;
    payload.emergency_contact = document.getElementById('admin-account-emergency')?.value.trim() || null;
  }

  if (payload.role === 'teacher') {
    const homeRole = selectedHomeRole('teacher-home-role');

    if (!homeRole) {
      alert('Choose Class Adviser or Assistant Teacher');
      return;
    }

    payload.home_role = homeRole;
    payload.is_class_adviser = homeRole === 'adviser';
    payload.is_assistant = homeRole === 'assistant';
    payload.is_subject_teacher = false;

    if (homeRole) {
      payload.class_adviser_grade = document.getElementById('class-adviser-grade')?.value;
      const caSectionSelect = document.getElementById('class-adviser-section');
      const caSectionNew = document.getElementById('class-adviser-new-section');

      // Get section from either dropdown or text input
      if (caSectionSelect?.value === '__NEW__') {
        payload.class_adviser_section = validateSectionName(
          caSectionNew?.value || '',
          null,
          'class-adviser-section-error'
        );
      } else {
        payload.class_adviser_section = caSectionSelect?.value || null;
      }

      const checkedSubjects = Array.from(document.querySelectorAll('#class-adviser-subjects-list .ca-subject-checkbox:checked')).map(cb => parseInt(cb.value, 10));
      if (isLowerSchoolGrade(payload.class_adviser_grade) && !checkedSubjects.length) {
        alert('Select at least one subject this teacher handles in Grades 1–3.');
        return;
      }
      if (checkedSubjects.length > 0) {
        payload.class_adviser_subjects = checkedSubjects;
      }

      if (!payload.class_adviser_grade || !payload.class_adviser_section) {
        if (!payload.class_adviser_section) {
          // validateSectionName already showed error, or section is empty
          const errorEl = document.getElementById('class-adviser-section-error');
          if (errorEl && errorEl.style.display !== 'block') {
            errorEl.textContent = 'Section is required';
            errorEl.style.display = 'block';
          }
        }
        return;
      }
    }

    const alsoTeaches = document.getElementById('teacher-also-teaches')?.checked;
    const otherAssignments = alsoTeaches
      ? collectSubjectAssignmentRows('#subject-assignments-container')
      : [];
    if (otherAssignments === null) return;
    if (otherAssignments.length > 0) {
      payload.is_subject_teacher = true;
      payload.subject_assignments = otherAssignments;
    }
  }

  try {
    const res = await fetch(`${API_URL}/admin/accounts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create account');

    alert(data.message || 'Account created successfully');
    e.target.reset();
    document.getElementById('subject-assignments-container').innerHTML = '';
    subjectCounter = 0;
    // Reset hybrid section fields
    const caNewSection = document.getElementById('class-adviser-new-section');
    const caSectionSelect = document.getElementById('class-adviser-section');
    if (caNewSection) { caNewSection.hidden = true; caNewSection.style.display = ''; caNewSection.value = ''; }
    if (caSectionSelect) { caSectionSelect.style.display = 'block'; caSectionSelect.innerHTML = '<option value="">-- Select Grade First --</option>'; caSectionSelect.disabled = true; }
    const caError = document.getElementById('class-adviser-section-error');
    if (caError) caError.style.display = 'none';
    toggleRoleFields();
    closeAdminModal('add-account-modal', { reset: false });
    await refreshSchoolData({ accounts: true, teachers: true, parents: true, overview: true });
  } catch (err) {
    alert(err.message);
  }
});

// ========== ADMIN: STUDENT ENROLLMENT ==========
document.getElementById('admin-student-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const lrnVal = document.getElementById('student-lrn').value.trim();
  if (lrnVal && lrnVal.length !== 12) {
    alert('LRN must be exactly 12 digits');
    return;
  }

  const payload = {
    lrn: lrnVal || null,
    first_name: document.getElementById('student-first').value.trim(),
    middle_name: document.getElementById('student-middle').value.trim() || null,
    last_name: document.getElementById('student-last').value.trim(),
    grade_level: document.getElementById('student-grade').value,
    section: document.getElementById('student-section').value,
    date_of_birth: document.getElementById('student-dob').value,
    dob: document.getElementById('student-dob').value || null,
    gender: document.getElementById('student-gender').value,
    parent_id: document.getElementById('student-parent').value || null,
    homeroom_teacher_id: document.getElementById('student-homeroom').value || null
  };

  try {
    const res = await fetch(`${API_URL}/admin/students`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to enroll student');

    let enrolled = data.message || 'Student enrolled successfully';
    if (data.username) enrolled += `\nUsername: ${data.username}`;
    if (data.temporaryPassword) enrolled += `\nTemporary password: ${data.temporaryPassword}`;
    alert(enrolled);
    e.target.reset();
    refreshEnrollUsernamePreview();
    document.getElementById('student-section').innerHTML = '<option value="">-- Select Grade First --</option>';
    document.getElementById('student-section').disabled = true;
    document.getElementById('student-section')?._syncSearch?.();
    document.getElementById('student-parent')?._syncSearch?.();
    closeAdminModal('add-student-modal', { reset: false });
    await refreshSchoolData({ students: true, teachers: true, overview: true });
  } catch (err) {
    alert(err.message);
  }
});

// Load accounts table
async function loadAccountsTable() {
  const tbody = document.querySelector('#admin-accounts-table tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_URL}/admin/accounts`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // FIX #3: Hide system admin from the list
    lastAccountsData = Array.isArray(data) ? data.filter(u => u.role !== 'admin' && u.role !== 'student') : [];
    applyAccountFilters();

  } catch (err) {
    console.error('Load accounts error:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">Failed to load accounts</td></tr>`;
  }
}

function applyAccountFilters() {
  const tbody = document.querySelector('#admin-accounts-table tbody');
  if (!tbody) return;

  // Highlight active role filter buttons
  document.querySelectorAll('[data-account-filter]').forEach(btn => {
    btn.classList.toggle('primary', btn.dataset.accountFilter === currentAccountRoleFilter);
  });

  // Highlight active status filter buttons
  document.querySelectorAll('[data-account-status]').forEach(btn => {
    btn.classList.toggle('primary', btn.dataset.accountStatus === currentAccountStatusFilter);
  });

  let filtered = lastAccountsData;

  // Apply role filter
  if (currentAccountRoleFilter !== 'all') {
    filtered = filtered.filter(u => u.role === currentAccountRoleFilter);
  }

  // Apply status filter
  if (currentAccountStatusFilter !== 'all') {
    filtered = filtered.filter(u => u.status === currentAccountStatusFilter);
  }

  // Apply search (name or email)
  const q = String(currentAccountSearch || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((u) => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const email = String(u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }

  // Sort
  filtered = [...filtered];
  if (currentAccountSort === 'recent') {
    filtered.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      if (tb !== ta) return tb - ta;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  } else {
    filtered.sort((a, b) => {
      const ln = String(a.last_name || '').localeCompare(String(b.last_name || ''), undefined, { sensitivity: 'base' });
      if (ln !== 0) return ln;
      return String(a.first_name || '').localeCompare(String(b.first_name || ''), undefined, { sensitivity: 'base' });
    });
  }

  if (!filtered.length) {
    selectedAccountIds.clear();
    updateAccountsBulkBar();
    const statusLabel = currentAccountStatusFilter === 'active' ? 'active ' : currentAccountStatusFilter === 'inactive' ? 'inactive ' : '';
    const roleLabel = currentAccountRoleFilter === 'all' ? 'accounts' : currentAccountRoleFilter + 's';
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No ${statusLabel}${roleLabel} found</td></tr>`;
    paintAdminPager('admin-accounts-pager', null, () => {});
    return;
  }

  const visibleIds = new Set(filtered.map((u) => Number(u.id)));
  [...selectedAccountIds].forEach((id) => {
    if (!visibleIds.has(id)) selectedAccountIds.delete(id);
  });

  const accountPager = paginate(filtered, accountPage, ADMIN_PAGE_SIZE);
  accountPage = accountPager.page;

  tbody.innerHTML = accountPager.rows.map(u => `
    <tr data-account-id="${u.id}" style="${u.status === 'inactive' ? 'opacity:0.6;background:#f9f9f9;' : ''}">
      <td class="col-check">
        <input type="checkbox" class="admin-account-check" data-account-id="${u.id}" ${selectedAccountIds.has(Number(u.id)) ? 'checked' : ''} aria-label="Select account" />
      </td>
      <td>${u.role === 'teacher' 
        ? `<span class="clickable-name" onclick="openTeacherDetailModal(${u.id})" style="cursor:pointer;color:var(--maroon);text-decoration:underline;font-weight:600;">${escapeHtml(u.last_name)}, ${escapeHtml(u.first_name)}</span>`
        : u.role === 'parent'
        ? `<span class="clickable-name" onclick="openParentDetailModal(${u.id})" style="cursor:pointer;color:var(--maroon);text-decoration:underline;font-weight:600;">${escapeHtml(u.last_name)}, ${escapeHtml(u.first_name)}</span>`
        : `${escapeHtml(u.last_name)}, ${escapeHtml(u.first_name)}`}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${formatActivityRole(u.role)}</td>
      <td>
        ${u.role === 'teacher'
          ? accountAssignmentLabel(u)
          : (u.emergency_contact
              ? `Emergency: ${u.emergency_contact}`
              : u.phone
              ? `Phone: ${u.phone}`
              : u.address
              ? u.address
              : '-')}
      </td>
      <td>${statusBadgeHtml(u.status)}</td>
    </tr>
  `).join('');
  paintAdminPager('admin-accounts-pager', accountPager, (p) => {
    accountPage = p;
    applyAccountFilters();
  });
  updateAccountsBulkBar();
}

function updateAccountsBulkBar() {
  const bar = document.getElementById('admin-accounts-bulk-bar');
  const countEl = document.getElementById('admin-accounts-bulk-count');
  const actionBtn = document.getElementById('admin-accounts-bulk-status');
  const selectAll = document.getElementById('admin-accounts-select-all');
  const n = selectedAccountIds.size;
  if (countEl) countEl.textContent = `${n} selected`;
  if (bar) {
    if (n === 0) bar.setAttribute('hidden', '');
    else bar.removeAttribute('hidden');
  }
  if (actionBtn) {
    const activating = currentAccountStatusFilter === 'inactive';
    actionBtn.textContent = activating ? 'Activate Selected' : 'Deactivate Selected';
    actionBtn.classList.toggle('chip-danger', !activating);
    actionBtn.classList.toggle('primary', activating);
  }
  const checks = [...document.querySelectorAll('#admin-accounts-table .admin-account-check')];
  if (selectAll) {
    const anyChecked = checks.some((c) => c.checked);
    const allChecked = checks.length > 0 && checks.every((c) => c.checked);
    selectAll.indeterminate = false;
    selectAll.checked = allChecked;
    selectAll.indeterminate = anyChecked && !allChecked;
    selectAll.disabled = checks.length === 0;
  }
}

(function setupAccountTableSelection() {
  const tbody = document.querySelector('#admin-accounts-table tbody');
  tbody?.addEventListener('change', (e) => {
    const check = e.target.closest('.admin-account-check');
    if (!check) return;
    const id = Number(check.dataset.accountId);
    if (!id) return;
    if (check.checked) selectedAccountIds.add(id);
    else selectedAccountIds.delete(id);
    updateAccountsBulkBar();
  });

  const selectAll = document.getElementById('admin-accounts-select-all');
  if (!selectAll) return;
  let wasIndeterminate = false;
  const captureState = () => {
    wasIndeterminate = !!selectAll.indeterminate;
  };
  selectAll.addEventListener('pointerdown', captureState);
  selectAll.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') captureState();
  });
  selectAll.addEventListener('click', () => {
    const checks = [...document.querySelectorAll('#admin-accounts-table .admin-account-check')];
    const shouldSelectAll = !wasIndeterminate && selectAll.checked;
    checks.forEach((cb) => {
      cb.checked = shouldSelectAll;
      const id = Number(cb.dataset.accountId);
      if (!id) return;
      if (shouldSelectAll) selectedAccountIds.add(id);
      else selectedAccountIds.delete(id);
    });
    selectAll.indeterminate = false;
    selectAll.checked = shouldSelectAll;
    wasIndeterminate = false;
    updateAccountsBulkBar();
  });
})();

document.getElementById('admin-accounts-bulk-status')?.addEventListener('click', async () => {
  const ids = [...selectedAccountIds];
  if (!ids.length) return;
  const newStatus = currentAccountStatusFilter === 'inactive' ? 'active' : 'inactive';
  const verb = newStatus === 'inactive' ? 'Deactivate' : 'Activate';
  const detail = newStatus === 'inactive'
    ? 'They will no longer be able to log in.'
    : 'They will be able to log in again.';
  if (!confirm(`${verb} ${ids.length} selected account(s)? ${detail}`)) return;

  const selfId = Number(getAuthUser()?.id || getAuthUser()?.userId);
  const blocked = [];
  try {
    for (const id of ids) {
      if (selfId && Number(id) === selfId) continue;
      const account = lastAccountsData.find((u) => Number(u.id) === Number(id));
      if (!account || account.role === 'admin' || account.status === newStatus) continue;
      const res = await fetch(`${API_URL}/admin/accounts/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(data.classes) && data.classes.length) {
        const who = account ? `${account.first_name} ${account.last_name}` : `account #${id}`;
        blocked.push(who);
        continue;
      }
      if (!res.ok) throw new Error(data.error || `Failed to update account #${id}`);
      account.status = newStatus;
    }
    selectedAccountIds.clear();
    if (blocked.length) {
      showToast(`Deactivated the other accounts. Transfer classes before deactivating: ${blocked.join(', ')}.`, 'error');
    } else {
      showToast(newStatus === 'inactive' ? 'Selected accounts deactivated.' : 'Selected accounts activated.');
    }
    await refreshSchoolData({ accounts: true, teachers: true, parents: true, overview: true });
  } catch (err) {
    alert(err.message);
    await refreshSchoolData({ accounts: true, teachers: true, parents: true, overview: true });
  }
});


// FIX #5: Add confirmation before deactivating/activating
let editSubjectCounter = 0;
let currentEditTeacherId = null;

// ========== EDIT TEACHER ASSIGNMENTS MODAL ==========
window.openEditTeacherModal = async function(teacherId) {
  currentEditTeacherId = teacherId;
  const modal = document.getElementById('edit-teacher-modal');
  const nameEl = document.getElementById('edit-teacher-name');
  const form = document.getElementById('edit-teacher-form');

  // Reset form
  form.reset();
  document.getElementById('edit-subject-assignments-container').innerHTML = '';
  editSubjectCounter = 0;
  document.getElementById('edit-class-adviser-fields').style.display = 'none';
  document.getElementById('edit-subject-teacher-fields').style.display = 'none';
  document.getElementById('edit-class-adviser-new-section').hidden = true;
  document.getElementById('edit-class-adviser-section-error').style.display = 'none';

  try {
    const res = await fetch(`${API_URL}/admin/accounts/${teacherId}`, { headers: getAuthHeaders() });
    const teacher = await res.json();
    if (!res.ok) throw new Error(teacher.error);

    nameEl.textContent = `Editing: ${teacher.first_name} ${teacher.last_name} (${teacher.email})`;
    document.getElementById('edit-teacher-id').value = teacherId;

    const mode = teacher.teaching_mode;
    const hasHome = mode === 'class_adviser' || mode === 'both' || mode === 'homeroom' || !!teacher.homeroom_grade;
    const homeRole = teacher.homeroom_role === 'assistant' ? 'assistant' : (hasHome ? 'adviser' : '');
    const roleInput = document.querySelector(`input[name="edit-teacher-home-role"][value="${homeRole}"]`);
    if (roleInput) roleInput.checked = true;

    if (homeRole) {
      document.getElementById('edit-class-adviser-fields').style.display = 'grid';
      const title = document.getElementById('edit-class-adviser-fields-title');
      if (title) title.textContent = homeRoleTitle(homeRole);
      if (teacher.homeroom_grade) {
        document.getElementById('edit-class-adviser-grade').value = teacher.homeroom_grade;
        await loadEditClassAdviserSections();
        const sectionSelect = document.getElementById('edit-class-adviser-section');
        if (sectionSelect && teacher.homeroom_section) {
          const exists = Array.from(sectionSelect.options).some(o => o.value === teacher.homeroom_section);
          if (exists) {
            sectionSelect.value = teacher.homeroom_section;
          } else {
            sectionSelect.value = '__NEW__';
            handleSectionSelect(sectionSelect, 'edit-class-adviser-new-section');
            document.getElementById('edit-class-adviser-new-section').value = teacher.homeroom_section;
          }
        }
        const caSubjectIds = (teacher.assignments || [])
          .filter(a => a.subject_id != null && String(a.grade_level) === String(teacher.homeroom_grade) && String(a.section || '').trim().toUpperCase() === String(teacher.homeroom_section || '').trim().toUpperCase())
          .map(a => a.subject_id);
        await loadEditClassAdviserSubjects(caSubjectIds);
      }
    }

    const outside = outsideClassAssignments(teacher, !!homeRole);
    const also = document.getElementById('edit-teacher-also-teaches');
    if (also) also.checked = outside.length > 0;
    document.getElementById('edit-subject-assignments-container').innerHTML = '';
    if (homeRole && outside.length) {
      for (const assignment of outside) await addEditSubjectAssignment(assignment);
    }
    syncEditSubjectPanel();

    modal.removeAttribute('hidden');

  } catch (err) {
    alert('Failed to load teacher data: ' + err.message);
  }
};

function syncEditSubjectPanel() {
  const isCA = !!selectedHomeRole('edit-teacher-home-role');
  const also = document.getElementById('edit-teacher-also-teaches');
  const wrap = document.getElementById('edit-teacher-also-teaches-wrap');
  const grade = document.getElementById('edit-class-adviser-grade')?.value;
  if (!isCA && also) also.checked = false;
  if (wrap) wrap.style.display = isCA ? 'flex' : 'none';
  const copy = otherClassAssignmentCopy(grade);
  const label = document.getElementById('edit-teacher-also-teaches-label');
  if (label) label.textContent = copy.title;
  const showRows = !!(isCA && also?.checked);
  const fields = document.getElementById('edit-subject-teacher-fields');
  if (fields) fields.style.display = showRows ? 'block' : 'none';
  const title = document.getElementById('edit-subject-teacher-title');
  const help = document.getElementById('edit-subject-teacher-help');
  if (title) title.style.display = 'none';
  if (help) help.textContent = copy.help;
  const container = document.getElementById('edit-subject-assignments-container');
  if (showRows && container && container.children.length === 0) addEditSubjectAssignment();
}
window.syncEditSubjectPanel = syncEditSubjectPanel;

function outsideClassAssignments(teacher, isClassAdviser) {
  const grade = String(teacher?.homeroom_grade || '');
  const section = String(teacher?.homeroom_section || '').trim().toUpperCase();
  return (teacher?.assignments || []).filter((assignment) => {
    if (assignment.subject_id == null) return false;
    if (!isUpperSchoolGrade(assignment.grade_level)) return false;
    if (isClassAdviser && isUpperSchoolGrade(grade)) {
      const sameClass = String(assignment.grade_level) === grade
        && String(assignment.section || '').trim().toUpperCase() === section;
      if (sameClass) return false;
    }
    return true;
  });
}

window.toggleEditClassAdviser = function() {
  const role = selectedHomeRole('edit-teacher-home-role');
  const checked = !!role;
  const caFields = document.getElementById('edit-class-adviser-fields');
  const title = document.getElementById('edit-class-adviser-fields-title');
  if (title) title.textContent = homeRoleTitle(role);
  if (caFields) caFields.style.display = checked ? 'grid' : 'none';
  if (!checked) {
    const wrap = document.getElementById('edit-class-adviser-subjects-wrap');
    const note = document.getElementById('edit-class-adviser-auto-note');
    if (wrap) wrap.style.display = 'none';
    if (note) note.style.display = 'none';
  }
  if (checked) loadEditClassAdviserSections();
  syncEditSubjectPanel();
};

window.loadEditClassAdviserSections = async function() {
  const gradeSelect = document.getElementById('edit-class-adviser-grade');
  const sectionSelect = document.getElementById('edit-class-adviser-section');
  const newInput = document.getElementById('edit-class-adviser-new-section');
  if (!gradeSelect || !sectionSelect) return;

  sectionSelect.style.display = '';
  if (newInput) { newInput.hidden = true; newInput.style.display = ''; newInput.value = ''; }

  const grade = gradeSelect.value;
  if (!grade) {
    sectionSelect.innerHTML = '<option value="">-- Select Grade First --</option>';
    sectionSelect.disabled = true;
    loadEditClassAdviserSubjects();
    syncEditSubjectPanel();
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/sections?grade_level=${grade}`, { headers: getAuthHeaders() });
    const sections = await res.json();
    if (!res.ok) throw new Error(sections.error);

    let html = '<option value="">-- Select Section --</option>';
    if (sections.length > 0) {
      html += sections.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    html += '<option value="__NEW__">— Add New Section —</option>';

    sectionSelect.innerHTML = html;
    sectionSelect.disabled = false;
  } catch (err) {
    console.error('Load sections error:', err);
    sectionSelect.innerHTML = '<option value="">Failed to load</option><option value="__NEW__">— Add New Section —</option>';
    sectionSelect.disabled = false;
  }
  loadEditClassAdviserSubjects();
  syncEditSubjectPanel();
};

// Load subject checkboxes for Edit Class Adviser (Grades 4-6 only)
let editSubjectLoadGen = 0;

window.loadEditClassAdviserSubjects = async function(preselectedIds = []) {
  const gradeSelect = document.getElementById('edit-class-adviser-grade');
  const wrap = document.getElementById('edit-class-adviser-subjects-wrap');
  const list = document.getElementById('edit-class-adviser-subjects-list');
  if (!gradeSelect || !wrap || !list) return;

  const grade = gradeSelect.value;
  const hasGrade = ['1', '2', '3', '4', '5', '6'].includes(grade);
  const isLowerGrade = isLowerSchoolGrade(grade);
  const autoNote = document.getElementById('edit-class-adviser-auto-note');
  if (autoNote) autoNote.style.display = isLowerGrade ? 'block' : 'none';

  if (!hasGrade) {
    wrap.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  wrap.style.display = 'block';
  const sectionState = homeSectionValue('edit-class-adviser-section', 'edit-class-adviser-new-section');
  if (!sectionState.known && document.getElementById('edit-class-adviser-section')?.value !== '__NEW__') {
    list.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem;">Select a section to choose subjects.</span>';
    return;
  }

  const generation = ++editSubjectLoadGen;
  list.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem;">Loading subjects...</span>';
  try {
    await renderHomeSubjectChecks({
      grade,
      section: sectionState.section,
      knownSection: sectionState.known,
      list,
      checkboxClass: 'edit-ca-subject-checkbox',
      preselectedIds,
      excludeTeacherId: document.getElementById('edit-teacher-id')?.value || '',
      generation,
      generationRef: () => editSubjectLoadGen
    });
  } catch (err) {
    if (generation !== editSubjectLoadGen) return;
    console.error('Load edit class adviser subjects error:', err);
    list.innerHTML = '<span style="color:#b71c1c;font-size:0.8rem;">Failed to load subjects.</span>';
  }
};

window.addEditSubjectAssignment = async function(existing = null) {
  editSubjectCounter++;
  const container = document.getElementById('edit-subject-assignments-container');
  if (!container) return;

  const rowId = `edit-subject-row-${editSubjectCounter}`;

  let subjectOptions = '<option value="">-- Select Subject --</option>';
  try {
    const subjects = await loadSubjectCatalog();
    subjectOptions += subjects.map((s) =>
      `<option value="${s.id}" ${existing && existing.subject_id == s.id ? 'selected' : ''}>${subjectOptionLabel(s)}</option>`
    ).join('');
  } catch (err) {
    console.error('Load subjects error:', err);
  }

  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'form-row';
  row.style.cssText = 'align-items:end;gap:10px;margin-bottom:8px;padding:10px;background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;';
  row.innerHTML = `
    <div class="field-small" style="flex:1.5;">
      <label>Subject</label>
      <select class="subject-id-select" >
        ${subjectOptions}
      </select>
    </div>
    <div class="field-small" style="flex:1;">
      <label>Grade Level</label>
      <select class="subject-grade-select" onchange="loadSubjectSections(this)" >
        <option value="">-- Select --</option>
        <option value="4" ${existing && existing.grade_level == 4 ? 'selected' : ''}>Grade 4</option>
        <option value="5" ${existing && existing.grade_level == 5 ? 'selected' : ''}>Grade 5</option>
        <option value="6" ${existing && existing.grade_level == 6 ? 'selected' : ''}>Grade 6</option>
      </select>
    </div>
    <div class="field-small" style="flex:1;">
      <label>Section</label>
      <div class="subject-section-wrap">
        <select class="subject-section-select" disabled onchange="handleSubjectSectionSelect(this, '${rowId}')">
          <option value="">-- Select Grade First --</option>
        </select>
        <input type="text" class="subject-new-section" placeholder="e.g., A, Bonifacio" hidden maxlength="10">
      </div>
      <small class="subject-section-error" style="color:#b71c1c;font-size:0.75rem;display:none;"></small>
    </div>
    <button type="button" class="chip-ghost" onclick="removeSubjectAssignment('${rowId}')" style="color:#b71c1c;border-color:#b71c1c;height:fit-content;padding:6px 10px;">Remove</button>
  `;
  container.appendChild(row);

  // If existing data, load sections and set value
  if (existing && existing.grade_level) {
    const gradeSelect = row.querySelector('.subject-grade-select');
    setTimeout(async () => {
      await loadSubjectSections(gradeSelect);
      const sectionSelect = row.querySelector('.subject-section-select');
      if (sectionSelect && existing.section) {
        const exists = Array.from(sectionSelect.options).some(o => o.value === existing.section);
        if (exists) {
          sectionSelect.value = existing.section;
        } else {
          sectionSelect.value = '__NEW__';
          handleSubjectSectionSelect(sectionSelect, rowId);
          row.querySelector('.subject-new-section').value = existing.section;
        }
      }
    }, 100);
  }
};

// Modal close handlers
document.getElementById('edit-teacher-cancel')?.addEventListener('click', () => {
  document.getElementById('edit-teacher-modal')?.setAttribute('hidden', '');
});

// Close modal on overlay click
document.getElementById('edit-teacher-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'edit-teacher-modal') {
    document.getElementById('edit-teacher-modal').setAttribute('hidden', '');
  }
});

// Edit teacher form submit
document.getElementById('edit-teacher-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const teacherId = document.getElementById('edit-teacher-id').value;
  const homeRole = selectedHomeRole('edit-teacher-home-role');

  if (!homeRole) {
    alert('Choose Class Adviser or Assistant Teacher');
    return;
  }

  const payload = {
    home_role: homeRole,
    is_class_adviser: homeRole === 'adviser',
    is_assistant: homeRole === 'assistant',
    is_subject_teacher: false
  };

  if (homeRole) {
    payload.class_adviser_grade = document.getElementById('edit-class-adviser-grade')?.value;
    const caSectionSelect = document.getElementById('edit-class-adviser-section');
    const caSectionNew = document.getElementById('edit-class-adviser-new-section');

    if (caSectionSelect?.value === '__NEW__') {
      payload.class_adviser_section = validateSectionName(
        caSectionNew?.value || '',
        null,
        'edit-class-adviser-section-error'
      );
    } else {
      payload.class_adviser_section = caSectionSelect?.value || null;
    }

    const checkedSubjects = Array.from(document.querySelectorAll('#edit-class-adviser-subjects-list .edit-ca-subject-checkbox:checked')).map(cb => parseInt(cb.value, 10));
    if (isLowerSchoolGrade(payload.class_adviser_grade) && !checkedSubjects.length) {
      alert('Select at least one subject this teacher handles in Grades 1–3.');
      return;
    }
    if (checkedSubjects.length > 0) {
      payload.class_adviser_subjects = checkedSubjects;
    }

    if (!payload.class_adviser_grade || !payload.class_adviser_section) {
      const errorEl = document.getElementById('edit-class-adviser-section-error');
      if (errorEl && errorEl.style.display !== 'block') {
        errorEl.textContent = 'Section is required';
        errorEl.style.display = 'block';
      }
      return;
    }
  }

  const alsoTeaches = document.getElementById('edit-teacher-also-teaches')?.checked;
  const otherAssignments = alsoTeaches
    ? collectSubjectAssignmentRows('#edit-subject-assignments-container')
    : [];
  if (otherAssignments === null) return;
  if (otherAssignments.length > 0) {
    payload.is_subject_teacher = true;
    payload.subject_assignments = otherAssignments;
  }

  try {
    const res = await fetch(`${API_URL}/admin/accounts/${teacherId}/assignments`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update assignments');

    alert('Assignments updated successfully');
    document.getElementById('edit-teacher-modal').setAttribute('hidden', '');
    await refreshSchoolData({ accounts: true, teachers: true, overview: true });
  } catch (err) {
    alert(err.message);
  }
});

function generateTempPassword(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function fillTempPasswordInput(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return '';
  const pw = generateTempPassword();
  el.value = pw;
  return pw;
}

window.resetAccountPassword = async function(id) {
  const user = lastAccountsData.find(u => u.id === id);
  const label = user ? `${user.first_name} ${user.last_name}` : 'this account';
  const modal = document.getElementById('reset-password-modal');
  const subtitle = document.getElementById('reset-password-subtitle');
  const errEl = document.getElementById('reset-password-error');
  document.getElementById('reset-password-user-id').value = id;
  fillTempPasswordInput('reset-password-temp');
  if (subtitle) subtitle.textContent = `Set a temporary password for ${label}. They must change it after they sign in.`;
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  modal?.removeAttribute('hidden');
};

window.toggleAccountStatus = async function(id, newStatus) {
  const confirmMsg = newStatus === 'inactive' 
    ? 'Deactivate this account? The user will no longer be able to log in.'
    : 'Activate this account? The user will be able to log in again.';

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`${API_URL}/admin/accounts/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (res.status === 409 && Array.isArray(data.classes) && data.classes.length) {
      openTransferTeacherModal(id, data.classes);
      return;
    }
    if (!res.ok) throw new Error(data.error);
    await refreshSchoolData({ accounts: true, teachers: true, parents: true, overview: true });
    if (currentDetailAccountId === id) {
      currentDetailAccountStatus = newStatus;
      updateDetailStatusActionLabel(newStatus);
      if (currentDetailAccountRole === 'teacher') openTeacherDetailModal(id);
      else if (currentDetailAccountRole === 'parent') openParentDetailModal(id);
    }
  } catch (err) {
    alert(err.message);
  }
};

function openTransferTeacherModal(teacherId, classes) {
  const teacher = lastAccountsData.find((user) => Number(user.id) === Number(teacherId));
  const name = teacher ? `${teacher.first_name} ${teacher.last_name}` : 'this teacher';
  const sub = document.getElementById('transfer-teacher-sub');
  const errEl = document.getElementById('transfer-teacher-error');
  const list = document.getElementById('transfer-teacher-list');
  const idInput = document.getElementById('transfer-teacher-id');
  if (sub) {
    sub.textContent = `${name} still handles ${classes.length} class${classes.length === 1 ? '' : 'es'}. A class adviser or assistant class goes to a newly hired teacher. A subject class goes to an active teacher who already handles that subject.`;
  }
  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = '';
  }
  if (idInput) idInput.value = teacherId;
  if (list) {
    list.innerHTML = classes.map((item, index) => {
      const isHomeSlot = item.kind === 'adviser' || item.kind === 'assistant';
      const candidates = Array.isArray(item.candidates) ? item.candidates : [];
      const options = isHomeSlot
        ? '<option value="new" selected>Newly hired teacher</option>'
        : candidates.map((user) =>
          `<option value="${user.id}">${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</option>`
        ).join('');
      const emptyNote = !isHomeSlot && !candidates.length
        ? '<p class="page-subheading">No other active teacher handles this subject yet.</p>'
        : '';
      return `
      <div class="field-small" style="margin-bottom:12px;">
        <label for="transfer-teacher-${index}">${escapeHtml(item.label)}</label>
        <select id="transfer-teacher-${index}" class="transfer-teacher-pick" required
          data-grade="${escapeHtml(String(item.grade_level))}"
          data-section="${escapeHtml(item.section || '')}"
          data-subject="${item.subject_id == null ? '' : escapeHtml(String(item.subject_id))}"
          ${!isHomeSlot && !candidates.length ? 'disabled' : ''}>
          ${isHomeSlot ? '' : '<option value="">Select a teacher</option>'}
          ${options}
        </select>
        ${emptyNote}
      </div>`;
    }).join('');
    list.querySelectorAll('.transfer-teacher-pick').forEach((select) => {
      select.addEventListener('change', syncTransferNewTeacher);
    });
  }
  syncTransferNewTeacher();
  const submit = document.querySelector('#transfer-teacher-form button[type="submit"]');
  if (submit) submit.disabled = false;
  document.getElementById('teacher-detail-modal')?.setAttribute('hidden', '');
  document.getElementById('parent-detail-modal')?.setAttribute('hidden', '');
  openAdminModal('transfer-teacher-modal');
}

function syncTransferNewTeacher() {
  const needsNew = [...document.querySelectorAll('.transfer-teacher-pick')]
    .some((select) => select.value === 'new');
  const box = document.getElementById('transfer-new-teacher');
  if (!box) return;
  box.hidden = !needsNew;
  if (needsNew) box.removeAttribute('hidden');
  else box.setAttribute('hidden', '');
}

document.getElementById('transfer-new-password-generate')?.addEventListener('click', () => {
  fillTempPasswordInput('transfer-new-password');
});

document.getElementById('transfer-teacher-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('transfer-teacher-error');
  const teacherId = document.getElementById('transfer-teacher-id')?.value;
  const picks = [...document.querySelectorAll('.transfer-teacher-pick')];
  if (picks.some((select) => select.disabled)) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = 'A subject class can move only when another active teacher already handles that subject.';
    }
    return;
  }
  const transfers = picks.map((select) => ({
    grade_level: Number(select.dataset.grade),
    section: select.dataset.section,
    subject_id: select.dataset.subject === '' ? null : Number(select.dataset.subject),
    replacement_id: select.value === 'new' ? 'new' : Number(select.value)
  }));
  if (transfers.some((item) => item.replacement_id !== 'new' && !item.replacement_id)) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = 'Choose a teacher for every class.';
    }
    return;
  }
  const needsNew = transfers.some((item) => item.replacement_id === 'new');
  const newTeacher = needsNew ? {
    first_name: document.getElementById('transfer-new-first')?.value.trim() || '',
    last_name: document.getElementById('transfer-new-last')?.value.trim() || '',
    email: document.getElementById('transfer-new-email')?.value.trim() || '',
    password: document.getElementById('transfer-new-password')?.value || ''
  } : null;
  if (needsNew && (!newTeacher.first_name || !newTeacher.last_name || !newTeacher.email || newTeacher.password.length < 6)) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = 'Enter the new teacher’s name, email, and a temporary password of at least 6 characters.';
    }
    return;
  }
  try {
    const res = await fetch(`${API_URL}/admin/accounts/${teacherId}/transfer-deactivate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ transfers, new_teacher: newTeacher })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not transfer the classes');
    closeAdminModal('transfer-teacher-modal');
    showToast(data.message || 'Classes transferred and account deactivated');
    await refreshSchoolData({ accounts: true, teachers: true, parents: true, overview: true });
    if (Number(currentDetailAccountId) === Number(teacherId)) {
      document.getElementById('teacher-detail-modal')?.setAttribute('hidden', '');
    }
  } catch (err) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = err.message;
    } else {
      alert(err.message);
    }
  }
});

// ========== ADMIN: STUDENTS ==========
function bindSearchableSelect(select, { inputId, placeholder }) {
  if (!select || select.dataset.searchBound) return;
  select.dataset.searchBound = '1';
  const wrap = document.createElement('div');
  wrap.className = 'select-search';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);
  const input = document.createElement('input');
  input.type = 'search';
  input.id = inputId;
  input.className = 'select-search-input';
  input.autocomplete = 'off';
  input.placeholder = placeholder;
  const list = document.createElement('div');
  list.className = 'select-search-list';
  list.hidden = true;
  wrap.insertBefore(input, select);
  document.body.appendChild(list);
  select.classList.add('select-search-native');

  function placeList() {
    const rect = input.getBoundingClientRect();
    list.style.left = `${rect.left}px`;
    list.style.top = `${rect.bottom + 4}px`;
    list.style.width = `${rect.width}px`;
  }

  function selectedLabel() {
    const option = select.selectedOptions[0];
    if (!option || !option.value) return '';
    return option.textContent || '';
  }

  function syncInput() {
    input.disabled = select.disabled;
    list.hidden = true;
    if (select.disabled) {
      const hint = select.selectedOptions[0]?.textContent || placeholder;
      input.placeholder = hint;
      input.value = '';
      return;
    }
    input.placeholder = placeholder;
    if (document.activeElement !== input) input.value = selectedLabel();
  }

  function render(query) {
    const q = String(query || '').trim().toLowerCase();
    const matches = [...select.options].filter((option) => {
      if (!option.value) return false;
      return !q || option.textContent.toLowerCase().includes(q);
    });
    list.innerHTML = matches.length
      ? matches.map((option) => {
          const active = option.value === select.value ? ' is-active' : '';
          return `<button type="button" class="select-search-option${active}" data-value="${escapeHtml(option.value)}">${escapeHtml(option.textContent)}</button>`;
        }).join('')
      : '<p class="select-search-empty">No matches</p>';
    placeList();
    list.hidden = false;
  }

  function choose(value) {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    list.hidden = true;
    syncInput();
  }

  input.addEventListener('focus', () => {
    if (input.disabled) return;
    input.value = '';
    render('');
  });
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      list.hidden = true;
      input.blur();
      return;
    }
    if (event.key === 'Enter' && !list.hidden) {
      const first = list.querySelector('[data-value]');
      if (!first) return;
      event.preventDefault();
      choose(first.dataset.value);
    }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      list.hidden = true;
      syncInput();
    }, 150);
  });
  list.addEventListener('mousedown', (event) => {
    const button = event.target.closest('[data-value]');
    if (!button) return;
    event.preventDefault();
    choose(button.dataset.value);
  });
  window.addEventListener('scroll', () => {
    if (!list.hidden) placeList();
  }, true);
  window.addEventListener('resize', () => {
    if (!list.hidden) placeList();
  });
  select.addEventListener('change', syncInput);
  const observer = new MutationObserver(syncInput);
  observer.observe(select, { childList: true, attributes: true, attributeFilter: ['disabled'] });
  select._syncSearch = syncInput;
  syncInput();
}

async function loadDropdowns() {
  const parentSelect = document.getElementById('student-parent');
  if (!parentSelect) return;

  try {
    const parentsRes = await fetch(`${API_URL}/admin/parents`, { headers: getAuthHeaders() });
    const parents = await parentsRes.json();

    parentSelect.innerHTML = '<option value="">-- Select Parent --</option>' +
      parents.map(p => `<option value="${p.id}">${escapeHtml(p.last_name)}, ${escapeHtml(p.first_name)} (${escapeHtml(p.email)})</option>`).join('');
    parentSelect._syncSearch?.();

  } catch (err) {
    console.error('Load dropdowns error:', err);
  }
}

const gradeSelect = document.getElementById('student-grade');
const sectionSelect = document.getElementById('student-section');

async function loadSectionsForGrade(grade) {
  if (!sectionSelect) return;

  if (!grade) {
    sectionSelect.innerHTML = '<option value="">-- Select Grade First --</option>';
    sectionSelect.disabled = true;
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/sections?grade_level=${encodeURIComponent(grade)}`, { headers: getAuthHeaders() });
    const sections = await res.json();

    if (!res.ok) throw new Error(sections.error);

    if (!sections.length) {
      sectionSelect.innerHTML = '<option value="">No sections available (assign a teacher first)</option>';
      sectionSelect.disabled = true;
      return;
    }

    // FIX: Add placeholder so change event always fires on user selection
    let html = '<option value="">-- Select Section --</option>';
    html += sections.map(sec => `<option value="${sec}">${sec}</option>`).join('');
    sectionSelect.innerHTML = html;
    sectionSelect.disabled = false;

    // Auto-load class adviser if only one section exists
    if (sections.length === 1) {
      sectionSelect.value = sections[0];
      loadClassAdviserForStudent();
    }
    sectionSelect._syncSearch?.();

  } catch (err) {
    console.error('Load sections error:', err);
    sectionSelect.innerHTML = '<option value="">Failed to load sections</option>';
    sectionSelect.disabled = true;
  }
}

function setSelectDisplayState(displayBox, displayText, { text, state = 'placeholder' } = {}) {
  if (displayText && text != null) displayText.textContent = text;
  if (displayText) displayText.style.color = '';
  if (!displayBox) return;
  displayBox.classList.remove('is-placeholder', 'is-filled', 'is-error');
  displayBox.classList.add(
    state === 'filled' ? 'is-filled' : state === 'error' ? 'is-error' : 'is-placeholder'
  );
  displayBox.style.borderColor = '';
}

gradeSelect?.addEventListener('change', (e) => {
  loadSectionsForGrade(e.target.value);
  // Reset class adviser when grade changes
  setSelectDisplayState(
    document.getElementById('student-class-adviser-display'),
    document.getElementById('student-class-adviser-text'),
    { text: '-- Auto Select --', state: 'placeholder' }
  );
  const hiddenInput = document.getElementById('student-homeroom');
  if (hiddenInput) hiddenInput.value = '';
});

sectionSelect?.addEventListener('change', () => {
  loadClassAdviserForStudent();
});

bindSearchableSelect(sectionSelect, {
  inputId: 'student-section-search',
  placeholder: 'Search section'
});
bindSearchableSelect(document.getElementById('student-parent'), {
  inputId: 'student-parent-search',
  placeholder: 'Search parent'
});

// Auto-load sections if grade is pre-selected (e.g., after hard refresh)
if (gradeSelect?.value) {
  loadSectionsForGrade(gradeSelect.value);
}

async function loadClassAdviserForStudent() {
  const grade = document.getElementById('student-grade')?.value;
  const section = document.getElementById('student-section')?.value;
  const displayText = document.getElementById('student-class-adviser-text');
  const displayBox = document.getElementById('student-class-adviser-display');
  const hiddenInput = document.getElementById('student-homeroom');
  const errorEl = document.getElementById('student-class-adviser-error');

  if (!grade || !section) {
    setSelectDisplayState(displayBox, displayText, {
      text: '-- Auto Select --',
      state: 'placeholder'
    });
    if (hiddenInput) hiddenInput.value = '';
    return;
  }

  setSelectDisplayState(displayBox, displayText, { text: 'Loading...', state: 'placeholder' });

  const url = `${API_URL}/admin/class-adviser?grade_level=${encodeURIComponent(grade)}&section=${encodeURIComponent(section)}`;

  try {
    const res = await fetch(url, { headers: getAuthHeaders() });
    const contentType = res.headers.get('content-type') || '';

    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      console.error('[Class Adviser] Non-JSON response:', text.substring(0, 300));
      throw new Error(`Server returned ${res.status} (not JSON)`);
    }

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (data.teacher) {
      setSelectDisplayState(displayBox, displayText, {
        text: classTeacherSummary(data),
        state: 'filled'
      });
      if (hiddenInput) hiddenInput.value = data.teacher.id;
      if (errorEl) errorEl.style.display = 'none';
    } else {
      setSelectDisplayState(displayBox, displayText, {
        text: classTeacherSummary(data),
        state: 'error'
      });
      if (hiddenInput) hiddenInput.value = '';
      if (errorEl) {
        errorEl.textContent = data.message || 'No class adviser assigned';
        errorEl.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Load class adviser error:', err);
    setSelectDisplayState(displayBox, displayText, {
      text: err.message || 'Failed to load',
      state: 'error'
    });
    if (hiddenInput) hiddenInput.value = '';
  }
}

// Helper to render a single student row from cached data (no API call)
function renderStudentRow(student) {
  const checked = selectedStudentIds.has(Number(student.id)) ? 'checked' : '';
  const statusAction = student.status === 'inactive'
    ? `<button type="button" class="row-menu-item" data-action="reenroll-student" data-student-id="${student.id}">Re-enroll</button>`
    : `<button type="button" class="row-menu-item" data-action="unenroll-student" data-student-id="${student.id}">Unenroll</button>`;
  return `
    <td class="col-check">
      <input type="checkbox" class="admin-student-check" data-student-id="${student.id}" ${checked} aria-label="Select student" />
    </td>
    <td class="att-lrn-cell">${escapeHtml(student.lrn || '-')}</td>
    <td class="att-name-cell">${formatStudentNameStacked(student)}</td>
    <td>Grade ${escapeHtml(String(student.grade_level))}</td>
    <td>${escapeHtml(student.section)}</td>
    <td>${student.parent_last ? escapeHtml(student.parent_last + ', ' + student.parent_first) : '<span style="color:#b71c1c">Unlinked</span>'}</td>
    <td>${statusBadgeHtml(student.status)}</td>
    <td class="row-actions">
      <div class="row-menu-wrap">
        <button type="button" class="icon-btn row-menu-toggle" title="More actions" aria-label="More actions" aria-expanded="false">⋮</button>
        <div class="row-menu" hidden>
          <button type="button" class="row-menu-item" data-action="edit-student" data-student-id="${student.id}">Edit</button>
          ${statusAction}
          <button type="button" class="row-menu-item row-menu-item--danger" data-action="delete-student" data-student-id="${student.id}">Delete</button>
        </div>
      </div>
    </td>
  `;
}

const selectedStudentIds = new Set();
const selectedSubjectIds = new Set();

let currentStudentFilter = '';
let currentStudentGradeFilter = '';
let currentStudentSectionFilter = '';
let studentGradeMenuApi = null;
let studentSectionMenuApi = null;

const STUDENT_GRADE_FILTER_OPTS = [
  { value: '', label: 'All grades' },
  { value: '1', label: 'Grade 1' },
  { value: '2', label: 'Grade 2' },
  { value: '3', label: 'Grade 3' },
  { value: '4', label: 'Grade 4' },
  { value: '5', label: 'Grade 5' },
  { value: '6', label: 'Grade 6' }
];

async function loadStudentFilterSections(grade) {
  if (!studentSectionMenuApi) return;

  if (!grade) {
    currentStudentSectionFilter = '';
    studentSectionMenuApi.setOptions([{ value: '', label: 'All sections' }]);
    studentSectionMenuApi.setDisabled(true);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/sections?grade_level=${encodeURIComponent(grade)}`, { headers: getAuthHeaders() });
    const sections = await res.json();
    if (!res.ok) throw new Error(sections.error);

    if (!sections.length) {
      currentStudentSectionFilter = '';
      studentSectionMenuApi.setOptions([{ value: '', label: 'No sections yet' }]);
      studentSectionMenuApi.setDisabled(true);
      return;
    }

    if (currentStudentSectionFilter && !sections.includes(currentStudentSectionFilter)) {
      currentStudentSectionFilter = '';
    }
    studentSectionMenuApi.setOptions([
      { value: '', label: 'All sections' },
      ...sections.map((sec) => ({ value: sec, label: sec }))
    ]);
    studentSectionMenuApi.setDisabled(false);
  } catch (err) {
    console.error('Load student filter sections error:', err);
    currentStudentSectionFilter = '';
    studentSectionMenuApi.setOptions([{ value: '', label: 'Failed to load' }]);
    studentSectionMenuApi.setDisabled(true);
  }
}

function getFilteredStudents() {
  let filtered = lastStudentsData;

  if (currentStudentGradeFilter) {
    filtered = filtered.filter((s) => String(s.grade_level) === String(currentStudentGradeFilter));
  }
  if (currentStudentSectionFilter) {
    filtered = filtered.filter(
      (s) => String(s.section || '').toUpperCase() === String(currentStudentSectionFilter).toUpperCase()
    );
  }
  if (currentStudentFilter) {
    const search = currentStudentFilter.toLowerCase();
    filtered = filtered.filter((s) => {
      const name = `${s.first_name} ${s.middle_name || ''} ${s.last_name}`.toLowerCase();
      return (
        name.includes(search) ||
        (s.lrn && s.lrn.includes(search)) ||
        String(s.section || '').toLowerCase().includes(search)
      );
    });
  }

  return filtered;
}

function clearStudentFilters() {
  currentStudentFilter = '';
  currentStudentGradeFilter = '';
  currentStudentSectionFilter = '';
  studentPage = 1;

  const search = document.getElementById('admin-student-search');
  if (search) search.value = '';
  studentGradeMenuApi?.sync();
  loadStudentFilterSections('');
  filterStudentsTable();
}

function updateStudentsBulkBar() {
  const bar = document.getElementById('admin-students-bulk-bar');
  const countEl = document.getElementById('admin-students-bulk-count');
  const selectAll = document.getElementById('admin-students-select-all');
  const n = selectedStudentIds.size;
  if (countEl) countEl.textContent = `${n} selected`;
  if (bar) {
    bar.hidden = n === 0;
    if (n === 0) bar.setAttribute('hidden', '');
    else bar.removeAttribute('hidden');
  }
  const checks = [...document.querySelectorAll('#admin-students-table .admin-student-check')];
  if (selectAll) {
    const anyChecked = checks.some((c) => c.checked);
    const allChecked = checks.length > 0 && checks.every((c) => c.checked);
    // Clear indeterminate first so the checked mark can render reliably
    selectAll.indeterminate = false;
    selectAll.checked = allChecked;
    selectAll.indeterminate = anyChecked && !allChecked;
  }
}

function filterStudentsTable() {
  const tbody = document.querySelector('#admin-students-table tbody');
  if (!tbody) return;

  if (!lastStudentsData.length) {
    selectedStudentIds.clear();
    updateStudentsBulkBar();
    tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">No students enrolled</td></tr>';
    paintAdminPager('admin-students-pager', null, () => {});
    return;
  }

  const filtered = getFilteredStudents();

  if (!filtered.length) {
    selectedStudentIds.clear();
    updateStudentsBulkBar();
    const parts = [];
    if (currentStudentGradeFilter) parts.push(`Grade ${currentStudentGradeFilter}`);
    if (currentStudentSectionFilter) parts.push(`Section ${currentStudentSectionFilter}`);
    if (currentStudentFilter) parts.push(`"${currentStudentFilter}"`);
    const label = parts.length ? parts.join(', ') : 'your filters';
    tbody.innerHTML = `<tr><td colspan="8" class="empty-cell">No students match ${label}</td></tr>`;
    paintAdminPager('admin-students-pager', null, () => {});
    return;
  }

  const sorted = [...filtered].sort(compareStudentsByName);
  const visibleIds = new Set(sorted.map((s) => Number(s.id)));
  [...selectedStudentIds].forEach((id) => {
    if (!visibleIds.has(id)) selectedStudentIds.delete(id);
  });

  const studentPager = paginate(sorted, studentPage, ADMIN_PAGE_SIZE);
  studentPage = studentPager.page;

  tbody.innerHTML = studentPager.rows.map(s => `
    <tr data-student-id="${s.id}" style="${s.status === 'inactive' ? 'opacity:0.6;background:#f9f9f9;' : ''}">
      ${renderStudentRow(s)}
    </tr>
  `).join('');
  paintAdminPager('admin-students-pager', studentPager, (p) => {
    studentPage = p;
    filterStudentsTable();
  });
  updateStudentsBulkBar();
}

async function loadStudentsTable() {
  const tbody = document.querySelector('#admin-students-table tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_URL}/admin/students`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    lastStudentsData = data;
    filterStudentsTable();

  } catch (err) {
    console.error('Load students error:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="empty-cell">Failed to load students</td></tr>`;
  }
}


// Fixed-position row menus so they never expand .dash-body scroll height
function closeAllRowMenus() {
  document.querySelectorAll('.row-menu').forEach((menu) => {
    menu.setAttribute('hidden', '');
    menu.classList.remove('row-menu--up', 'row-menu--fixed');
    menu.style.top = '';
    menu.style.left = '';
    menu.style.right = '';
    menu.style.bottom = '';
    menu.style.position = '';
    menu.style.zIndex = '';
  });
  document.querySelectorAll('.row-menu-toggle').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

function positionFixedRowMenu(toggle, menu) {
  menu.classList.add('row-menu--fixed');
  menu.style.position = 'fixed';
  menu.style.right = 'auto';
  menu.style.bottom = 'auto';
  menu.style.zIndex = '5000';

  const btnRect = toggle.getBoundingClientRect();
  const menuWidth = Math.max(menu.offsetWidth || 0, 148);
  const menuHeight = Math.max(menu.offsetHeight || 0, 40);
  let top = btnRect.bottom + 4;
  let left = btnRect.right - menuWidth;

  if (top + menuHeight > window.innerHeight - 8) {
    top = Math.max(8, btnRect.top - menuHeight - 4);
  }
  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - menuWidth - 8);
  }

  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(left)}px`;
}

function toggleRowMenu(toggle, scopeSelector) {
  const wrap = toggle.closest('.row-menu-wrap');
  const menu = wrap?.querySelector('.row-menu');
  if (!menu) return;

  const wasOpen = !menu.hasAttribute('hidden');
  document.querySelectorAll(`${scopeSelector} .row-menu`).forEach((m) => {
    if (m === menu) return;
    m.setAttribute('hidden', '');
    m.classList.remove('row-menu--up', 'row-menu--fixed');
    m.style.top = '';
    m.style.left = '';
    m.style.right = '';
    m.style.bottom = '';
    m.style.position = '';
    m.style.zIndex = '';
  });
  document.querySelectorAll(`${scopeSelector} .row-menu-toggle`).forEach((btn) => {
    if (btn !== toggle) btn.setAttribute('aria-expanded', 'false');
  });

  if (wasOpen) {
    menu.setAttribute('hidden', '');
    menu.classList.remove('row-menu--up', 'row-menu--fixed');
    menu.style.top = '';
    menu.style.left = '';
    menu.style.right = '';
    menu.style.bottom = '';
    menu.style.position = '';
    menu.style.zIndex = '';
    toggle.setAttribute('aria-expanded', 'false');
    return;
  }

  document.getElementById('admin-students-export-panel')?.setAttribute('hidden', '');
  document.getElementById('admin-students-export-btn')?.setAttribute('aria-expanded', 'false');
  menu.removeAttribute('hidden');
  positionFixedRowMenu(toggle, menu);
  requestAnimationFrame(() => positionFixedRowMenu(toggle, menu));
  toggle.setAttribute('aria-expanded', 'true');
}

// Event delegation for student table action buttons (Edit/Unenroll/Re-enroll/Delete)
(function setupStudentTableDelegation() {
  const tbody = document.querySelector('#admin-students-table tbody');
  if (!tbody) return;

  tbody.addEventListener('click', (e) => {
    const toggle = e.target.closest('.row-menu-toggle');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      toggleRowMenu(toggle, '#admin-students-table');
      return;
    }

    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const studentId = parseInt(btn.dataset.studentId, 10);
    if (!studentId || isNaN(studentId)) return;

    e.preventDefault();
    e.stopPropagation();
    closeAllRowMenus();

    switch (action) {
      case 'edit-student': startEditStudent(studentId); break;
      case 'unenroll-student': unenrollStudent(studentId); break;
      case 'reenroll-student': reenrollStudent(studentId); break;
      case 'delete-student': deleteStudent(studentId); break;
    }
  });

  tbody.addEventListener('change', (e) => {
    const check = e.target.closest('.admin-student-check');
    if (!check) return;
    const id = Number(check.dataset.studentId);
    if (!id) return;
    if (check.checked) selectedStudentIds.add(id);
    else selectedStudentIds.delete(id);
    updateStudentsBulkBar();
  });
})();

document.addEventListener('click', (e) => {
  if (!e.target.closest('.row-menu-wrap') && !e.target.closest('.row-menu')) {
    closeAllRowMenus();
  }
});

document.querySelector('.dash-body')?.addEventListener('scroll', () => {
  closeAllRowMenus();
  if (typeof closeStudentsExportMenu === 'function') closeStudentsExportMenu();
}, { passive: true });

window.addEventListener('resize', () => {
  closeAllRowMenus();
  if (typeof closeStudentsExportMenu === 'function') closeStudentsExportMenu();
});

(function wireStudentsSelectAll() {
  const selectAll = document.getElementById('admin-students-select-all');
  if (!selectAll) return;
  let wasIndeterminate = false;

  const captureState = () => {
    wasIndeterminate = !!selectAll.indeterminate;
  };
  selectAll.addEventListener('pointerdown', captureState);
  selectAll.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') captureState();
  });

  selectAll.addEventListener('click', () => {
    const checks = [...document.querySelectorAll('#admin-students-table .admin-student-check')];
    // After browser toggle:
    // - was minus → force clear (don't keep checked/select-all)
    // - was empty → now checked → select all rows
    // - was all checked → now empty → clear all rows
    const shouldSelectAll = !wasIndeterminate && selectAll.checked;

    checks.forEach((cb) => {
      cb.checked = shouldSelectAll;
      const id = Number(cb.dataset.studentId);
      if (!id) return;
      if (shouldSelectAll) selectedStudentIds.add(id);
      else selectedStudentIds.delete(id);
    });

    selectAll.indeterminate = false;
    selectAll.checked = shouldSelectAll;
    wasIndeterminate = false;
    updateStudentsBulkBar();
  });
})();

document.getElementById('admin-students-bulk-unenroll')?.addEventListener('click', async () => {
  const ids = [...selectedStudentIds];
  if (!ids.length) return;
  if (!confirm(`Unenroll ${ids.length} selected student(s)? They will be marked inactive.`)) return;
  try {
    for (const id of ids) {
      const student = lastStudentsData.find((s) => Number(s.id) === Number(id));
      if (!student || student.status === 'inactive') continue;
      const res = await fetch(`${API_URL}/admin/students/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'inactive' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to unenroll student #${id}`);
      student.status = 'inactive';
    }
    selectedStudentIds.clear();
    showToast('Selected students unenrolled.');
    await refreshSchoolData({ students: true, teachers: true, overview: true });
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('admin-students-bulk-delete')?.addEventListener('click', async () => {
  const ids = [...selectedStudentIds];
  if (!ids.length) return;
  if (!confirm(`Remove ${ids.length} selected student(s) from the lists? Attendance and scores are kept.`)) return;
  try {
    for (const id of ids) {
      const res = await fetch(`${API_URL}/admin/students/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to delete student #${id}`);
    }
    selectedStudentIds.clear();
    showToast('Selected students deleted.');
    await refreshSchoolData({ students: true, teachers: true, overview: true });
  } catch (err) {
    alert(err.message);
  }
});

function getStudentsExportRows() {
  return getFilteredStudents().slice().sort(compareStudentsByName);
}

function exportStudentsExcel() {
  const rows = getStudentsExportRows();
  if (!rows.length) {
    showToast('No students to export for the current filters.', 'error');
    return;
  }
  const header = ['LRN', 'Last Name', 'First Name', 'Middle Name', 'Grade', 'Section', 'Parent', 'Status'];
  const lines = [header.join(',')];
  const esc = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  rows.forEach((s) => {
    const parent = s.parent_last ? `${s.parent_last}, ${s.parent_first}` : '';
    lines.push([
      s.lrn || '',
      s.last_name || '',
      s.first_name || '',
      s.middle_name || '',
      s.grade_level || '',
      s.section || '',
      parent,
      s.status || ''
    ].map(esc).join(','));
  });
  // UTF-8 BOM so Excel opens special characters correctly
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `students-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${rows.length} student(s) to Excel.`);
}

/** Shared hidden-iframe print (no new tab). Used by Parent / Admin / Teacher PDF exports. */
function printHtmlInHiddenFrame(fullHtml) {
  document.getElementById('connected-print-frame')?.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'connected-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'Print report';
  // Keep in layout but invisible — display:none can block printing in some browsers
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      try { iframe.remove(); } catch { /* ignore */ }
    }, 500);
  };

  const runPrint = () => {
    const win = iframe.contentWindow;
    if (!win) {
      showToast('Unable to open print dialog.', 'error');
      cleanup();
      return;
    }
    const after = () => {
      win.removeEventListener('afterprint', after);
      cleanup();
    };
    win.addEventListener('afterprint', after);
    setTimeout(cleanup, 120000);
    try {
      win.focus();
      win.print();
    } catch (err) {
      showToast('Unable to open print dialog.', 'error');
      cleanup();
    }
  };

  iframe.onload = () => {
    requestAnimationFrame(() => setTimeout(runPrint, 50));
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    showToast('Unable to prepare print report.', 'error');
    cleanup();
    return false;
  }
  doc.open();
  doc.write(fullHtml);
  doc.close();
  return true;
}

/** Wrap body content in a clean print document (blank title = no name in browser header). */
function openPrintHtmlDocument(title, bodyHtml) {
  const docTitle = title == null || title === '' ? '\u00A0' : String(title);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(docTitle)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #222; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      h2 { font-size: 14px; margin: 20px 0 8px; color: #5c1010; }
      p { margin: 0 0 12px; color: #555; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f5ebe8; }
      .meta { margin: 0 0 16px; color: #555; font-size: 12px; }
      .kpi-row td { font-weight: 600; }
      @media print {
        body { padding: 0; }
        @page { margin: 12mm; }
      }
    </style>
  </head><body>
    ${bodyHtml}
  </body></html>`;
  return printHtmlInHiddenFrame(html);
}

/** Print a full HTML document (e.g. server-built attendance sheet) via hidden iframe. */
function openPrintFullDocument(fullHtml) {
  let html = String(fullHtml || '');
  // Blank title so browser print chrome doesn't show the report name
  html = html.replace(/<title>[^<]*<\/title>/i, '<title>\u00A0</title>');
  // Remove auto-print scripts — we trigger print once from the iframe helper
  html = html.replace(/<script\b[^>]*>[\s\S]*?window\.print[\s\S]*?<\/script>/gi, '');
  return printHtmlInHiddenFrame(html);
}

function exportStudentsPdf() {
  const rows = getStudentsExportRows();
  if (!rows.length) {
    showToast('No students to export for the current filters.', 'error');
    return;
  }
  const stamp = new Date().toLocaleString();
  const bodyRows = rows.map((s) => {
    const parent = s.parent_last ? `${s.parent_last}, ${s.parent_first}` : 'Unlinked';
    const name = [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(', ');
    return `<tr>
      <td>${escapeHtml(s.lrn || '')}</td>
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(String(s.grade_level ?? ''))}</td>
      <td>${escapeHtml(s.section || '')}</td>
      <td>${escapeHtml(parent)}</td>
      <td>${escapeHtml(s.status || '')}</td>
    </tr>`;
  }).join('');

  openPrintHtmlDocument('', `
    <h1>Student List</h1>
    <p>Exported ${rows.length} student(s) · ${escapeHtml(stamp)}</p>
    <table>
      <thead><tr><th>LRN</th><th>Name</th><th>Grade</th><th>Section</th><th>Parent</th><th>Status</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`);
}

/** Shared Export-style dropdown (`.download-menu`) used across portals. */
function closeDownloadMenu(panel, btn) {
  if (panel) {
    panel.setAttribute('hidden', '');
    panel.hidden = true;
    panel.classList.remove('download-menu-panel--fixed');
    panel.style.top = '';
    panel.style.left = '';
    panel.style.right = '';
    panel.style.position = '';
    panel.style.zIndex = '';
  }
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function closeAllDownloadMenus(exceptPanel = null) {
  document.querySelectorAll('.download-menu-panel').forEach((panel) => {
    if (exceptPanel && panel === exceptPanel) return;
    if (!isDownloadMenuOpen(panel)) return;
    const menu = panel.closest('.download-menu');
    const btn = menu?.querySelector('[aria-haspopup="true"]') || null;
    closeDownloadMenu(panel, btn);
  });
}

function positionFixedExportPanel(btn, panel) {
  panel.classList.add('download-menu-panel--fixed');
  panel.style.position = 'fixed';
  panel.style.right = 'auto';
  panel.style.zIndex = '5000';
  const btnRect = btn.getBoundingClientRect();
  const width = Math.max(panel.offsetWidth || 0, 140);
  const height = Math.max(panel.offsetHeight || 0, 40);
  let top = btnRect.bottom + 6;
  let left = btnRect.right - width;
  if (top + height > window.innerHeight - 8) top = Math.max(8, btnRect.top - height - 6);
  if (left < 8) left = 8;
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
  panel.style.top = `${Math.round(top)}px`;
  panel.style.left = `${Math.round(left)}px`;
}

function isDownloadMenuOpen(panel) {
  if (!panel) return false;
  return !(panel.hasAttribute('hidden') || panel.hidden === true);
}

function toggleDownloadMenu(btn, panel) {
  if (!btn || !panel) return;
  if (isDownloadMenuOpen(panel)) {
    closeDownloadMenu(panel, btn);
    return;
  }
  closeAllRowMenus();
  closeAllDownloadMenus();
  panel.removeAttribute('hidden');
  panel.hidden = false;
  positionFixedExportPanel(btn, panel);
  requestAnimationFrame(() => positionFixedExportPanel(btn, panel));
  btn.setAttribute('aria-expanded', 'true');
}

/**
 * Chip/filter dropdown matching Admin Export.
 * options: [{ value, label }], getValue/setValue for current selection.
 */
function wireDownloadSelectMenu({
  menuId,
  btnId,
  panelId,
  options = [],
  getValue,
  setValue,
  onPick,
  emptyLabel = 'No options',
  disabled = false,
  formatButtonLabel = null
} = {}) {
  const menu = document.getElementById(menuId);
  const btn = document.getElementById(btnId);
  const panel = document.getElementById(panelId);
  if (!menu || !btn || !panel) return null;

  let currentOptions = Array.isArray(options) ? options : [];

  function setDisabled(next) {
    btn.disabled = !!next;
    if (next) closeDownloadMenu(panel, btn);
  }

  function sync() {
    const val = typeof getValue === 'function' ? getValue() : '';
    const opt = currentOptions.find((o) => String(o.value) === String(val)) || currentOptions[0];
    let label;
    if (typeof formatButtonLabel === 'function') {
      label = formatButtonLabel(opt, val) || emptyLabel;
    } else {
      label = opt ? opt.label : emptyLabel;
    }
    btn.textContent = String(label).includes('▾') ? String(label) : `${label} ▾`;
    if (!currentOptions.length) {
      panel.innerHTML = `<button type="button" class="download-menu-item" disabled>${escapeHtml(emptyLabel)}</button>`;
      return;
    }
    panel.innerHTML = currentOptions.map((o) => {
      const active = String(o.value) === String(val) ? ' download-menu-item--active' : '';
      return `<button type="button" class="download-menu-item${active}" data-value="${escapeHtml(String(o.value))}">${escapeHtml(o.label)}</button>`;
    }).join('');
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.disabled) return;
    sync();
    toggleDownloadMenu(btn, panel);
  });

  panel.addEventListener('click', (e) => {
    const item = e.target.closest('.download-menu-item');
    if (!item || !panel.contains(item) || item.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const next = item.dataset.value ?? '';
    if (typeof setValue === 'function') setValue(next);
    closeDownloadMenu(panel, btn);
    sync();
    if (typeof onPick === 'function') onPick(next);
  });

  setDisabled(disabled);
  sync();
  return {
    sync,
    setOptions(next) {
      currentOptions = Array.isArray(next) ? next : [];
      sync();
    },
    setDisabled
  };
}

function closeStudentsExportMenu() {
  closeDownloadMenu(
    document.getElementById('admin-students-export-panel'),
    document.getElementById('admin-students-export-btn')
  );
}

document.getElementById('admin-students-export-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleDownloadMenu(
    document.getElementById('admin-students-export-btn'),
    document.getElementById('admin-students-export-panel')
  );
});

document.getElementById('admin-students-export-excel')?.addEventListener('click', () => {
  closeStudentsExportMenu();
  exportStudentsExcel();
});
document.getElementById('admin-students-export-pdf')?.addEventListener('click', () => {
  closeStudentsExportMenu();
  exportStudentsPdf();
});

document.addEventListener('click', (e) => {
  if (e.target.closest('.download-menu')) return;
  closeAllDownloadMenus();
});

window.startEditStudent = function(id) {
  const student = lastStudentsData.find(s => Number(s.id) === Number(id));
  if (!student) return;

  const modal = document.getElementById('edit-student-modal');
  const errEl = document.getElementById('edit-student-error');
  const subtitle = document.getElementById('edit-student-subtitle');
  document.getElementById('edit-student-id').value = String(student.id);
  document.getElementById('edit-student-lrn').value = student.lrn || '';
  document.getElementById('edit-student-last').value = student.last_name || '';
  document.getElementById('edit-student-first').value = student.first_name || '';
  document.getElementById('edit-student-middle').value = student.middle_name || '';

  const classText = document.getElementById('edit-student-class-text');
  if (classText) {
    classText.textContent = `Grade ${student.grade_level || '—'} · ${student.section || '—'}`;
  }
  const parentText = document.getElementById('edit-student-parent-text');
  const parentField = document.getElementById('edit-student-parent-field');
  const parentSelect = document.getElementById('edit-student-parent');
  const unlinked = student.parent_id == null || student.parent_id === '';
  if (parentText) {
    parentText.textContent = student.parent_last
      ? `${student.parent_last}, ${student.parent_first || ''}`.trim()
      : 'Unlinked';
  }
  if (parentField) parentField.hidden = !unlinked;
  if (parentSelect) parentSelect.value = '';
  if (unlinked) loadEditStudentParents();
  if (subtitle) {
    subtitle.textContent = unlinked
      ? `${student.last_name || ''}, ${student.first_name || ''} has no parent. You can link a registered parent.`
      : `Editing ${student.last_name || ''}, ${student.first_name || ''}`;
  }
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  modal?.removeAttribute('hidden');
  document.getElementById('edit-student-last')?.focus();
};

async function loadEditStudentParents() {
  const parentSelect = document.getElementById('edit-student-parent');
  if (!parentSelect) return;
  parentSelect.innerHTML = '<option value="">Loading parents...</option>';
  parentSelect.disabled = true;
  try {
    const res = await fetch(`${API_URL}/admin/parents`, { headers: getAuthHeaders() });
    const parents = await res.json();
    if (!res.ok) throw new Error(parents.error || 'Failed to load parents');
    const active = (Array.isArray(parents) ? parents : []).filter((p) => {
      const status = String(p.status || p.STATUS || 'active').toLowerCase();
      return status === 'active';
    });
    parentSelect.innerHTML = '<option value="">-- Select Parent --</option>' +
      active.map((p) => `<option value="${p.id}">${escapeHtml(p.last_name)}, ${escapeHtml(p.first_name)} (${escapeHtml(p.email)})</option>`).join('');
    if (!active.length) {
      parentSelect.innerHTML = '<option value="">No registered parents</option>';
    }
  } catch (err) {
    console.error('Load edit student parents error:', err);
    parentSelect.innerHTML = '<option value="">Failed to load parents</option>';
  } finally {
    parentSelect.disabled = false;
  }
}

function closeEditStudentModal() {
  const modal = document.getElementById('edit-student-modal');
  modal?.setAttribute('hidden', '');
  document.getElementById('edit-student-form')?.reset();
  document.getElementById('edit-student-id').value = '';
  const parentField = document.getElementById('edit-student-parent-field');
  if (parentField) parentField.hidden = true;
  const errEl = document.getElementById('edit-student-error');
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
}

document.getElementById('edit-student-cancel')?.addEventListener('click', () => closeEditStudentModal());
document.getElementById('edit-student-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'edit-student-modal') closeEditStudentModal();
});

document.getElementById('edit-student-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = Number(document.getElementById('edit-student-id').value);
  const errEl = document.getElementById('edit-student-error');
  if (!id) return;

  const payload = {
    lrn: document.getElementById('edit-student-lrn')?.value.trim() || null,
    last_name: document.getElementById('edit-student-last')?.value.trim(),
    first_name: document.getElementById('edit-student-first')?.value.trim(),
    middle_name: document.getElementById('edit-student-middle')?.value.trim() || null
  };
  const parentField = document.getElementById('edit-student-parent-field');
  const parentId = document.getElementById('edit-student-parent')?.value || '';
  if (parentField && !parentField.hidden && parentId) payload.parent_id = Number(parentId);

  if (!payload.last_name || !payload.first_name) {
    if (errEl) { errEl.hidden = false; errEl.textContent = 'First and last name are required.'; }
    return;
  }
  if (payload.lrn && payload.lrn.length !== 12) {
    if (errEl) { errEl.hidden = false; errEl.textContent = 'LRN must be exactly 12 digits.'; }
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/students/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Server returned an unexpected response. The update endpoint may not exist.');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update student');

    closeEditStudentModal();
    showToast(payload.parent_id ? 'Student updated and linked to parent.' : 'Student updated.');
    await refreshSchoolData({ students: true, teachers: true, overview: true });
  } catch (err) {
    if (errEl) { errEl.hidden = false; errEl.textContent = err.message; }
    else alert(err.message);
  }
});

window.unenrollStudent = async function(id) {
  if (!confirm('Unenroll this student? They will be marked as inactive but their records will be preserved.')) return;
  try {
    const res = await fetch(`${API_URL}/admin/students/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: 'inactive' })
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('Server response (not JSON):', text.substring(0, 200));
      throw new Error('Server error: The unenroll endpoint is not set up yet. Please add PATCH /api/admin/students/:id/status to your backend.');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Update cached data locally for instant feedback
    const student = lastStudentsData.find(s => s.id === id);
    if (student) student.status = 'inactive';

    await refreshSchoolData({ students: true, teachers: true, overview: true });
  } catch (err) {
    alert(err.message);
  }
};

window.reenrollStudent = function(id) {
  openReenrollModal(id);
};

// ========== RE-ENROLL MODAL ==========
window.openReenrollModal = async function(id) {
  const student = lastStudentsData.find(s => Number(s.id) === Number(id));
  if (!student) return;

  const modal = document.getElementById('reenroll-student-modal');
  if (!modal) return;

  const formatDobForInput = (dob) => {
    if (!dob) return '';
    const s = String(dob);
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
  };

  // Pre-fill form
  document.getElementById('reenroll-student-id').value = student.id;
  document.getElementById('reenroll-lrn').value = student.lrn || '';
  document.getElementById('reenroll-first').value = student.first_name || '';
  document.getElementById('reenroll-middle').value = student.middle_name || '';
  document.getElementById('reenroll-last').value = student.last_name || '';
  document.getElementById('reenroll-grade').value = String(student.grade_level || '1');
  document.getElementById('reenroll-gender').value = student.gender || 'M';
  document.getElementById('reenroll-dob').value = formatDobForInput(student.dob);
  document.getElementById('reenroll-homeroom').value = '';

  // Reset class adviser display
  setSelectDisplayState(
    document.getElementById('reenroll-class-adviser-display'),
    document.getElementById('reenroll-class-adviser-text'),
    { text: '-- Auto Select --', state: 'placeholder' }
  );

  // Load sections for current grade
  await loadReenrollSections(student.grade_level);

  // Set section if it exists in dropdown
  const sectionSelect = document.getElementById('reenroll-section');
  if (student.section && sectionSelect) {
    const exists = Array.from(sectionSelect.options).some(o => o.value === student.section);
    if (exists) sectionSelect.value = student.section;
  }

  // Load parents dropdown
  await loadReenrollParents(student.parent_id);

  // Load class adviser if grade + section are set
  await loadReenrollClassAdviser();

  modal.removeAttribute('hidden');
};

async function loadReenrollSections(grade) {
  const sectionSelect = document.getElementById('reenroll-section');
  if (!sectionSelect) return;

  if (!grade) {
    sectionSelect.innerHTML = '<option value="">-- Select Grade First --</option>';
    sectionSelect.disabled = true;
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/sections?grade_level=${encodeURIComponent(grade)}`, { headers: getAuthHeaders() });
    const sections = await res.json();
    if (!res.ok) throw new Error(sections.error);

    if (!sections.length) {
      sectionSelect.innerHTML = '<option value="">No sections available</option>';
      sectionSelect.disabled = true;
      return;
    }

    // FIX: Add placeholder
    let html = '<option value="">-- Select Section --</option>';
    html += sections.map(sec => `<option value="${sec}">${sec}</option>`).join('');
    sectionSelect.innerHTML = html;
    sectionSelect.disabled = false;

    if (sections.length === 1) {
      sectionSelect.value = sections[0];
      loadReenrollClassAdviser();
    }

  } catch (err) {
    console.error('Load reenroll sections error:', err);
    sectionSelect.innerHTML = '<option value="">Failed to load</option>';
    sectionSelect.disabled = true;
  }
}

async function loadReenrollParents(selectedParentId) {
  const parentSelect = document.getElementById('reenroll-parent');
  if (!parentSelect) return;

  try {
    const res = await fetch(`${API_URL}/admin/parents`, { headers: getAuthHeaders() });
    const parents = await res.json();
    if (!res.ok) throw new Error(parents.error);

    parentSelect.innerHTML = '<option value="">-- Select Parent --</option>' +
      parents.map(p => `<option value="${p.id}" ${selectedParentId == p.id ? 'selected' : ''}>${escapeHtml(p.last_name)}, ${escapeHtml(p.first_name)} (${escapeHtml(p.email)})</option>`).join('');
  } catch (err) {
    console.error('Load reenroll parents error:', err);
    parentSelect.innerHTML = '<option value="">Failed to load</option>';
  }
}

async function loadReenrollClassAdviser() {
  const grade = document.getElementById('reenroll-grade')?.value;
  const section = document.getElementById('reenroll-section')?.value;
  const displayText = document.getElementById('reenroll-class-adviser-text');
  const displayBox = document.getElementById('reenroll-class-adviser-display');
  const hiddenInput = document.getElementById('reenroll-homeroom');
  const errorEl = document.getElementById('reenroll-class-adviser-error');

  if (!grade || !section) {
    setSelectDisplayState(displayBox, displayText, {
      text: '-- Auto Select --',
      state: 'placeholder'
    });
    if (hiddenInput) hiddenInput.value = '';
    return;
  }

  setSelectDisplayState(displayBox, displayText, { text: 'Loading...', state: 'placeholder' });

  try {
    const res = await fetch(`${API_URL}/admin/class-adviser?grade_level=${encodeURIComponent(grade)}&section=${encodeURIComponent(section)}`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.teacher) {
      setSelectDisplayState(displayBox, displayText, {
        text: classTeacherSummary(data),
        state: 'filled'
      });
      if (hiddenInput) hiddenInput.value = data.teacher.id;
      if (errorEl) errorEl.style.display = 'none';
    } else {
      setSelectDisplayState(displayBox, displayText, {
        text: classTeacherSummary(data),
        state: 'error'
      });
      if (hiddenInput) hiddenInput.value = '';
      if (errorEl) {
        errorEl.textContent = data.message || 'No class adviser assigned';
        errorEl.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Load reenroll class adviser error:', err);
    setSelectDisplayState(displayBox, displayText, {
      text: 'Failed to load',
      state: 'error'
    });
    if (hiddenInput) hiddenInput.value = '';
  }
}

// Re-enroll modal event listeners
document.getElementById('reenroll-grade')?.addEventListener('change', async (e) => {
  await loadReenrollSections(e.target.value);
  setSelectDisplayState(
    document.getElementById('reenroll-class-adviser-display'),
    document.getElementById('reenroll-class-adviser-text'),
    { text: '-- Auto Select --', state: 'placeholder' }
  );
  const hiddenInput = document.getElementById('reenroll-homeroom');
  if (hiddenInput) hiddenInput.value = '';
});

document.getElementById('reenroll-section')?.addEventListener('change', () => {
  loadReenrollClassAdviser();
});

document.getElementById('reenroll-cancel')?.addEventListener('click', () => {
  document.getElementById('reenroll-student-modal')?.setAttribute('hidden', '');
});

document.getElementById('reenroll-student-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'reenroll-student-modal') {
    document.getElementById('reenroll-student-modal').setAttribute('hidden', '');
  }
});

document.getElementById('reenroll-student-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('reenroll-student-id').value;
  const lrnVal = document.getElementById('reenroll-lrn').value.trim();
  const sectionVal = document.getElementById('reenroll-section').value;
  if (lrnVal && lrnVal.length !== 12) {
    alert('LRN must be exactly 12 digits');
    return;
  }
  if (!sectionVal) {
    alert('Please select a section');
    return;
  }

  const payload = {
    lrn: lrnVal || null,
    first_name: document.getElementById('reenroll-first').value.trim(),
    middle_name: document.getElementById('reenroll-middle').value.trim() || null,
    last_name: document.getElementById('reenroll-last').value.trim(),
    grade_level: document.getElementById('reenroll-grade').value,
    section: sectionVal,
    gender: document.getElementById('reenroll-gender').value,
    parent_id: document.getElementById('reenroll-parent').value || null,
    homeroom_teacher_id: document.getElementById('reenroll-homeroom').value || null,
    dob: document.getElementById('reenroll-dob').value || null,
    status: 'active'
  };

  try {
    const res = await fetch(`${API_URL}/admin/students/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error('Server returned HTML instead of JSON. The update endpoint may not support all these fields yet.');
    }

    if (!res.ok) throw new Error(data.error || 'Failed to re-enroll student');

    alert('Student re-enrolled successfully');
    document.getElementById('reenroll-student-modal').setAttribute('hidden', '');
    await refreshSchoolData({ students: true, teachers: true });
  } catch (err) {
    alert(err.message);
  }
});

// FIX #5: Add confirmation before permanent delete
window.deleteStudent = async function(id) {
  if (!confirm('Remove this student from the lists? Attendance and scores are kept.')) return;
  try {
    const res = await fetch(`${API_URL}/admin/students/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await refreshSchoolData({ students: true, teachers: true, overview: true });
  } catch (err) {
    alert(err.message);
  }
};

function formatActivityRole(role) {
  if (!role) return '';
  const labels = { admin: 'Admin', teacher: 'Teacher', parent: 'Parent', student: 'Student' };
  return labels[String(role).toLowerCase()] || role;
}

function refreshAdminOverview() {
  const adminView = document.getElementById('view-admin');
  if (!adminView || adminView.hidden) return;
  const activeTab = document.querySelector('[data-admin-tab].active')?.dataset.adminTab;
  if (activeTab === 'overview' || !activeTab) {
    loadOverviewStats();
    loadActivityLog();
  }
}

function statusBadgeHtml(status) {
  const normalized = String(status || 'active').toLowerCase();
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return `<span class="badge status-badge status-badge--${normalized}">${label}</span>`;
}

function openAdminModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  if (modalId === 'add-account-modal') {
    resetAdminModalForm(modalId);
    fillTempPasswordInput('admin-account-password');
  }
  modal.removeAttribute('hidden');
}

function resetAdminModalForm(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const form = modal.querySelector('form');
  form?.reset();

  if (modalId === 'add-account-modal') {
    const container = document.getElementById('subject-assignments-container');
    if (container) container.innerHTML = '';
    subjectCounter = 0;
    const caNewSection = document.getElementById('class-adviser-new-section');
    const caSectionSelect = document.getElementById('class-adviser-section');
    if (caNewSection) { caNewSection.hidden = true; caNewSection.style.display = ''; caNewSection.value = ''; }
    if (caSectionSelect) {
      caSectionSelect.style.display = 'block';
      caSectionSelect.innerHTML = '<option value="">-- Select Grade First --</option>';
      caSectionSelect.disabled = true;
    }
    const caError = document.getElementById('class-adviser-section-error');
    if (caError) caError.style.display = 'none';
    fillTempPasswordInput('admin-account-password');
    if (typeof toggleRoleFields === 'function') toggleRoleFields();
  }

  if (modalId === 'add-student-modal') {
    const sectionSelect = document.getElementById('student-section');
    if (sectionSelect) {
      sectionSelect.innerHTML = '<option value="">-- Select Grade First --</option>';
      sectionSelect.disabled = true;
    }
    const displayText = document.getElementById('student-class-adviser-text');
    const hiddenInput = document.getElementById('student-homeroom');
    setSelectDisplayState(
      document.getElementById('student-class-adviser-display'),
      displayText,
      { text: '-- Auto Select --', state: 'placeholder' }
    );
    if (hiddenInput) hiddenInput.value = '';
    document.getElementById('student-section')?._syncSearch?.();
    document.getElementById('student-parent')?._syncSearch?.();
  }

  if (modalId === 'bulk-account-modal' || modalId === 'bulk-student-modal') {
    const prefix = modalId === 'bulk-account-modal' ? 'bulk-account' : 'bulk-student';
    const err = document.getElementById(`${prefix}-error`);
    const result = document.getElementById(`${prefix}-result`);
    if (err) err.textContent = '';
    if (result) result.innerHTML = '';
  }

  if (modalId === 'compose-announcement-modal') {
    const msgEl = document.getElementById('admin-announcement-message');
    if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
    if (typeof updateAnnouncementScopeFields === 'function') updateAnnouncementScopeFields();
  }
}

function closeAdminModal(modalId, { reset = true } = {}) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.setAttribute('hidden', '');
  if (reset) resetAdminModalForm(modalId);
}

function wireAdminModal(modalId, openBtnId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  document.getElementById(openBtnId)?.addEventListener('click', () => openAdminModal(modalId));

  modal.querySelector('[data-modal-cancel]')?.addEventListener('click', () => closeAdminModal(modalId));

  modal.addEventListener('click', (e) => {
    if (e.target.id === modalId) closeAdminModal(modalId);
  });
}

function wireSimpleModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.querySelector('[data-modal-cancel]')?.addEventListener('click', () => {
    modal.setAttribute('hidden', '');
    modal.querySelector('form')?.reset();
  });

  modal.addEventListener('click', (e) => {
    if (e.target.id === modalId) {
      modal.setAttribute('hidden', '');
      modal.querySelector('form')?.reset();
    }
  });
}

/** Refresh shared lists/caches across admin and teacher portals after data changes. */
async function refreshSchoolData(scopes = {}) {
  const all = scopes.all === true || !Object.keys(scopes).length;
  const want = (key) => all || scopes[key] === true;
  const jobs = [];

  if (want('overview') || want('accounts') || want('students') || want('parents') || want('announcements')) {
    jobs.push(loadOverviewStats());
  }
  if (want('overview') || want('accounts') || want('students') || want('subjects') || want('announcements')) {
    jobs.push(loadActivityLog());
  }

  if (want('accounts')) {
    jobs.push(loadAccountsTable());
  }

  if (want('students') || want('parents')) {
    jobs.push(loadDropdowns());
  }

  if (want('students')) {
    jobs.push(loadStudentsTable());
    const grade = document.getElementById('student-grade')?.value;
    if (grade) jobs.push(loadSectionsForGrade(grade));
  }

  if (want('subjects')) {
    jobs.push(loadSubjectsTable());
    jobs.push(refreshAdminSubjectPickers());
  }

  if (want('accounts') || want('teachers')) {
    const grade = document.getElementById('student-grade')?.value;
    if (grade) jobs.push(loadSectionsForGrade(grade));
  }

  if (want('teachers') || want('accounts') || want('subjects')) {
    jobs.push(refreshTeacherClassesPreserveSelection());
  }
  if (want('students')) {
    jobs.push(refreshTeacherRosterIfActive());
  }
  if (want('subjects')) {
    teacherSubjectsLoaded = false;
    jobs.push(loadTeacherSubjects(true));
    jobs.push(refreshTeacherRosterIfActive());
  }
  if (want('students') || want('subjects')) {
    const panel = document.querySelector('[data-teacher-panel].active')?.dataset.teacherPanel;
    if (panel === 'progress') jobs.push(loadProgressList());
    if (panel === 'quiz-bank') jobs.push(loadQuestionBank());
  }
  if (want('announcements')) {
    jobs.push(loadTeacherInbox());
    jobs.push(loadAdminAnnouncements());
  }

  await Promise.allSettled(jobs);
}

async function refreshTeacherClassesPreserveSelection() {
  const prev = teacherCurrentClass
    ? {
        grade: teacherCurrentClass.grade,
        section: teacherCurrentClass.section,
        subjectName: teacherCurrentClass.subjectName,
        subjectId: teacherCurrentClass.subjectId
      }
    : null;

  try {
    const res = await fetch(`${API_URL}/teacher/classes`, { headers: getAuthHeaders() });
    const classes = await res.json();
    if (!res.ok) throw new Error(classes.error);

    teacherAssignedClasses = Array.isArray(classes) ? classes : [];
    fillTeacherNoticeClasses();

    const listEl = document.getElementById('teacher-class-list');
    if (!listEl) return;

    if (!classes.length) {
      setMyClassesTriggerLabel();
      listEl.innerHTML = '<div class="class-nav-empty">No classes assigned</div>';
      return;
    }

    renderTeacherClassNav(classes);

    if (prev) {
      const still = classes.find(
        (c) => String(c.grade_level) === String(prev.grade) && String(c.section) === String(prev.section)
      );
      if (still) {
        await selectTeacherClassContext({
          grade: prev.grade,
          section: prev.section,
          subjectName: prev.subjectName,
          subjectId: prev.subjectId,
          goToPanel: null,
          expandGroup: true
        });
        return;
      }
    }

    const first = classes[0];
    if (first) {
      await selectTeacherClassContext({
        grade: first.grade_level,
        section: first.section,
        subjectName: null,
        subjectId: null,
        goToPanel: null
      });
    }
  } catch (err) {
    console.error('Refresh teacher classes error:', err);
  }
}

async function refreshTeacherRosterIfActive() {
  if (!teacherCurrentClass?.grade || !teacherCurrentClass?.section) return;

  const panel = document.querySelector('[data-teacher-panel].active')?.dataset.teacherPanel;
  const { grade, section } = teacherCurrentClass;
  const subjectMode = isSubjectAttendanceGrade(grade);
  const canLoadRoster = !subjectMode || !!teacherCurrentClass.subjectId;

  // Always refresh roster + stats when a usable class context exists (even if panel is hidden),
  // so admin enrolls show up as soon as the teacher opens Classroom / Attendance Sheet.
  if (canLoadRoster) {
    await loadRoster(grade, section);
    loadClassStats(grade, section);
    if (panel === 'classroom') {
      refreshClassroomAttendanceStatus();
      loadTeacherClassProgress(grade, section);
    }
  }

  if (panel === 'attendance-sheet' || canLoadRoster) {
    // Refresh sheet data whenever we have a valid subject/class context
    if (!subjectMode || teacherCurrentClass.subjectId) {
      await loadAttendanceSheet();
    }
  }
}

async function refreshAdminSubjectPickers() {
  subjectCatalogPromise = null;
  const caWrap = document.getElementById('class-adviser-subjects-wrap');
  if (caWrap && caWrap.style.display !== 'none' && typeof loadClassAdviserSubjects === 'function') {
    await loadClassAdviserSubjects();
  }

  const editCaWrap = document.getElementById('edit-class-adviser-subjects-wrap');
  if (editCaWrap && editCaWrap.style.display !== 'none' && typeof loadEditClassAdviserSubjects === 'function') {
    const gradeSelect = document.getElementById('edit-class-adviser-grade');
    const preselected = Array.from(document.querySelectorAll('#edit-class-adviser-subjects-list .edit-ca-subject-checkbox:checked'))
      .map((cb) => parseInt(cb.value, 10))
      .filter((n) => Number.isFinite(n));
    if (gradeSelect?.value) {
      await loadEditClassAdviserSubjects(preselected);
    }
  }

  if (typeof refreshOpenSubjectRows === 'function') await refreshOpenSubjectRows();
}

async function loadActivityLog() {
  const tbody = document.getElementById('admin-activity-log');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_URL}/admin/activity-log`, { headers: getAuthHeaders() });
    const logs = await res.json();
    if (!res.ok) throw new Error(logs.error);

    const recent = Array.isArray(logs) ? logs.slice(0, 5) : [];

    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-cell">No recent activity</td></tr>';
      return;
    }

    tbody.innerHTML = recent.map(log => {
      const roleLabel = formatActivityRole(log.user_role);
      const roleHtml = roleLabel ? `<span class="log-role">${roleLabel}</span>` : '';
      const concernLog = log.target_type === 'concern'
        || /concern/i.test(String(log.action || ''));
      const detail = !concernLog && log.details
        ? ` <span style="color:var(--text-muted);font-size:0.78rem;">· ${escapeHtml(log.details)}</span>`
        : '';
      const target = !concernLog && log.target_name
        ? ` — <em>${escapeHtml(log.target_name)}</em>`
        : '';
      return `
      <tr>
        <td>
          <span class="log-user">${escapeHtml(log.user_name || 'System')}</span>
          ${roleHtml}
        </td>
        <td><span class="log-action">${escapeHtml(log.action || '')}</span>${target}${detail}</td>
        <td class="log-time">${new Date(log.created_at).toLocaleString()}</td>
      </tr>
    `;
    }).join('');
  } catch (err) {
    console.error('Load activity log error:', err);
    tbody.innerHTML = '<tr><td colspan="3" class="empty-cell">Failed to load activity</td></tr>';
  }
}

async function loadOverviewStats() {
  const teachersEl = document.getElementById('admin-kpi-teachers');
  const parentsEl = document.getElementById('admin-kpi-parents');
  const studentsEl = document.getElementById('admin-kpi-students');

  if (teachersEl) teachersEl.textContent = '...';
  if (parentsEl) parentsEl.textContent = '...';
  if (studentsEl) studentsEl.textContent = '...';
  loadAdminOverviewCharts();

  try {
    const [accountsRes, studentsRes, settingsRes] = await Promise.all([
      fetch(`${API_URL}/admin/accounts`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/admin/students`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/admin/settings`, { headers: getAuthHeaders() })
    ]);

    const accounts = await accountsRes.json();
    const students = await studentsRes.json();
    const settings = settingsRes.ok ? await settingsRes.json() : null;

    if (!accountsRes.ok) throw new Error(accounts.error || 'Failed to load accounts');
    if (!studentsRes.ok) throw new Error(students.error || 'Failed to load students');

    const teachers = Array.isArray(accounts) ? accounts.filter(u => u.role === 'teacher' && u.status === 'active').length : 0;
    const parents = Array.isArray(accounts) ? accounts.filter(u => u.role === 'parent' && u.status === 'active').length : 0;
    const studentCount = Array.isArray(students) ? students.length : 0;

    if (teachersEl) teachersEl.textContent = teachers;
    if (parentsEl) parentsEl.textContent = parents;
    if (studentsEl) studentsEl.textContent = studentCount;

    if (settings?.currentQuarter) {
      CURRENT_QUARTER = normalizeQuarterClient(settings.currentQuarter);
      UNLOCKED_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'].slice(0, ['Q1', 'Q2', 'Q3', 'Q4'].indexOf(CURRENT_QUARTER) + 1);
      applyQuarterUnlockUI();
    }

  } catch (err) {
    console.error('Load overview stats error:', err);
    if (teachersEl) teachersEl.textContent = '--';
    if (parentsEl) parentsEl.textContent = '--';
    if (studentsEl) studentsEl.textContent = '--';
  }
}

const adminCharts = {};

function destroyAdminCharts() {
  for (const key of Object.keys(adminCharts)) {
    try { adminCharts[key]?.destroy(); } catch { /* ignore */ }
    delete adminCharts[key];
  }
}

function adminChartCanvas(wrapId, canvasId, label) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return null;
  wrap.innerHTML = `<canvas id="${canvasId}" aria-label="${label}" role="img"></canvas>`;
  return document.getElementById(canvasId);
}

async function loadAdminOverviewCharts() {
  const gradeWrap = document.getElementById('admin-grade-chart-wrap');
  const attWrap = document.getElementById('admin-att-chart-wrap');
  const annEl = document.getElementById('admin-today-announcement');
  if (!gradeWrap && !attWrap && !annEl) return;

  destroyAdminCharts();
  try {
    const res = await fetch(`${API_URL}/admin/overview-charts`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load overview charts');
    paintAdminGradeChart(data.studentsByGrade || []);
    paintAdminAttendanceChart(data.attendance || {});
    paintAdminTodayAnnouncement(data.announcement || null);
    paintAdminAnnouncementCard('admin-important-announcement', data.importantAnnouncement || null, {
      badge: importantAnnouncementBadge(data.importantAnnouncement),
      badgeClass: importantAnnouncementBadgeClass(data.importantAnnouncement),
      emptyBadge: 'None',
      emptyTitle: 'No other announcement',
      emptyText: 'The highest-priority announcement that is not already shown for today will appear here.'
    });
  } catch (err) {
    console.error('Overview charts error:', err);
    if (gradeWrap) gradeWrap.innerHTML = '<p class="admin-chart-empty">Could not load enrollment chart.</p>';
    if (attWrap) attWrap.innerHTML = '<p class="admin-chart-empty">Could not load attendance chart.</p>';
    if (annEl) annEl.innerHTML = '';
    const importantEl = document.getElementById('admin-important-announcement');
    if (importantEl) importantEl.innerHTML = '';
  }
}

function paintAdminGradeChart(rows) {
  const canvas = adminChartCanvas('admin-grade-chart-wrap', 'admin-grade-chart', 'Students by grade');
  const ChartLib = typeof window !== 'undefined' ? window.Chart : null;
  if (!canvas || !ChartLib) {
    const wrap = document.getElementById('admin-grade-chart-wrap');
    if (wrap && !ChartLib) wrap.innerHTML = '<p class="admin-chart-empty">Charts are unavailable right now.</p>';
    return;
  }
  const labels = [1, 2, 3, 4, 5, 6].map((g) => `Grade ${g}`);
  const counts = [1, 2, 3, 4, 5, 6].map((g) => {
    const row = rows.find((r) => Number(r.grade) === g);
    return row ? Number(row.count) || 0 : 0;
  });
  adminCharts.grade = new ChartLib(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Students',
        data: counts,
        backgroundColor: '#60100b',
        borderRadius: 6,
        maxBarThickness: 36
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { grid: { display: false } }
      }
    }
  });
}

function paintAdminAttendanceChart(attendance) {
  const sub = document.getElementById('admin-att-chart-sub');
  if (sub) {
    const recorded = Number(attendance.recorded) || 0;
    const total = Number(attendance.activeStudents) || 0;
    sub.textContent = `${recorded} of ${total} active students marked today`;
  }
  const canvas = adminChartCanvas('admin-att-chart-wrap', 'admin-att-chart', "Today's attendance");
  const ChartLib = typeof window !== 'undefined' ? window.Chart : null;
  if (!canvas || !ChartLib) {
    const wrap = document.getElementById('admin-att-chart-wrap');
    if (wrap && !ChartLib) wrap.innerHTML = '<p class="admin-chart-empty">Charts are unavailable right now.</p>';
    return;
  }
  const slices = [
    { label: 'Present', value: Number(attendance.present) || 0, color: '#2e7d32' },
    { label: 'Late', value: Number(attendance.late) || 0, color: '#f39c12' },
    { label: 'Absent', value: Number(attendance.absent) || 0, color: '#c62828' },
    { label: 'Excused', value: Number(attendance.excused) || 0, color: '#1565c0' },
    { label: 'Not yet marked', value: Number(attendance.unmarked) || 0, color: '#d7ccc8' }
  ].filter((s) => s.value > 0);
  if (!slices.length) {
    const wrap = document.getElementById('admin-att-chart-wrap');
    if (wrap) wrap.innerHTML = '<p class="admin-chart-empty">No active students to chart.</p>';
    return;
  }
  adminCharts.attendance = new ChartLib(canvas, {
    type: 'doughnut',
    data: {
      labels: slices.map((s) => s.label),
      datasets: [{ data: slices.map((s) => s.value), backgroundColor: slices.map((s) => s.color), borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
      },
      cutout: '58%'
    }
  });
}

function dashboardAnnouncementAudience(item) {
  const teachersOnly = String(item.audience || 'everyone') === 'teachers';
  const who = teachersOnly ? 'Teachers' : 'Parents & teachers';
  if (item.scope === 'grade_wide' && item.target_grade) return `Grade ${item.target_grade} · ${who}`;
  if (item.scope === 'class_specific' && item.target_grade) {
    const section = item.target_section ? `-${item.target_section}` : '';
    return `Grade ${item.target_grade}${section} · ${who}`;
  }
  return teachersOnly ? 'All teachers' : 'All parents & teachers';
}

function dashboardAnnouncementWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day} | ${time}`;
}

function importantAnnouncementBadge(item) {
  const priority = String(item?.priority || 'normal').toLowerCase();
  if (priority === 'urgent') return 'Urgent';
  if (priority === 'high') return 'High';
  return 'Important';
}

function importantAnnouncementBadgeClass(item) {
  const priority = String(item?.priority || 'normal').toLowerCase();
  if (priority === 'urgent') return 'admin-announce-badge--urgent';
  if (priority === 'high') return 'admin-announce-badge--high';
  return 'admin-announce-badge--important';
}

function paintAdminAnnouncementCard(hostId, item, labels) {
  const el = document.getElementById(hostId);
  if (!el) return;
  const emptyBadge = labels.emptyBadge || 'None today';
  const emptyTitle = labels.emptyTitle || 'No announcement yet';
  const emptyText = labels.emptyText || 'An announcement sent today will show here.';
  if (!item) {
    el.innerHTML = `
      <div class="admin-announce admin-announce--empty">
        <span class="admin-announce-badge">${escapeHtml(emptyBadge)}</span>
        <h3 class="admin-announce-title">${escapeHtml(emptyTitle)}</h3>
        <p class="admin-announce-text">${escapeHtml(emptyText)}</p>
      </div>
    `;
    return;
  }
  const when = dashboardAnnouncementWhen(item.created_at);
  const audience = dashboardAnnouncementAudience(item);
  const sender = item.sender_name || 'Admin';
  const initial = escapeHtml(sender.trim().charAt(0).toUpperCase() || 'A');
  const avatar = item.sender_avatar
    ? `<img src="${escapeHtml(item.sender_avatar)}" alt="" />`
    : initial;
  const reached = Number(item.reached) || 0;
  const body = String(item.body || '').trim();
  const badge = labels.badge || 'Sent';
  const badgeClass = labels.badgeClass ? ` ${labels.badgeClass}` : '';
  el.innerHTML = `
    <article class="admin-announce">
      <span class="admin-announce-badge${badgeClass}">${escapeHtml(badge)}</span>
      <h3 class="admin-announce-title">${escapeHtml(item.title || 'Announcement')}</h3>
      <p class="admin-announce-meta">
        ${when ? `<span>${escapeHtml(when)}</span>` : ''}
        <span>${escapeHtml(audience)}</span>
      </p>
      ${body ? `<p class="admin-announce-text">${escapeHtml(body)}</p>` : ''}
      <div class="admin-announce-foot">
        <div class="admin-announce-sender">
          <span class="admin-announce-avatar">${avatar}</span>
          <span class="admin-announce-name">${escapeHtml(sender)}</span>
        </div>
        <span class="admin-announce-reached">${reached} reached</span>
      </div>
    </article>
  `;
}

function paintAdminTodayAnnouncement(item) {
  paintAdminAnnouncementCard('admin-today-announcement', item, {
    badge: 'Sent',
    emptyBadge: 'None today',
    emptyTitle: 'No announcement yet',
    emptyText: 'An announcement sent today will show here.'
  });
}

window.resolveConcern = async function(id) {
  if (!confirm('Mark this concern as resolved?')) return;
  try {
    const role = getAuthUser()?.role;
    const url = role === 'teacher'
      ? `${API_URL}/teacher/concerns/${id}/resolve`
      : `${API_URL}/admin/concerns/${id}/resolve`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Concern marked as resolved.');
    if (role === 'teacher') {
      teacherExpandedConcernId = null;
      loadTeacherInbox(teacherInboxFilter || 'unresolved');
    } else if (role === 'admin') {
      adminExpandedConcernId = null;
      loadAdminInbox(adminInboxFilter || 'unresolved');
    } else if (role === 'parent') {
      parentExpandedConcernId = null;
      parentInboxFilter = 'resolved';
      renderParentInbox();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.replyToConcern = async function(id, btn) {
  const box = document.getElementById(`concern-reply-${id}`);
  const nearBox = btn && btn.closest ? btn.closest('li')?.querySelector('.concern-reply-input') : null;
  const sendBox = nearBox || box;
  const sendMessage = sendBox ? sendBox.value.trim() : '';
  if (!sendMessage) {
    showToast('Write a reply first.', 'error');
    return;
  }
  try {
    const role = getAuthUser()?.role;
    let url;
    if (role === 'parent') url = `${API_URL}/parent/concerns/${id}/reply`;
    else if (role === 'teacher') url = `${API_URL}/teacher/concerns/${id}/reply`;
    else url = `${API_URL}/admin/concerns/${id}/reply`;

    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message: sendMessage })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(role === 'parent' ? 'Reply sent to the teacher.' : 'Reply sent to the parent.');
    if (role === 'parent') {
      parentExpandedConcernId = Number(id);
      parentInboxFilter = 'unresolved';
      renderParentInbox();
    } else if (role === 'teacher') {
      teacherExpandedConcernId = Number(id);
      loadTeacherInbox(teacherInboxFilter || 'unresolved');
    } else if (role === 'admin') {
      adminExpandedConcernId = Number(id);
      loadAdminInbox(adminInboxFilter || 'unresolved');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};


let adminInboxFilter = 'unresolved';
let adminExpandedConcernId = null;
let adminInboxSearchQuery = '';
let adminAnnouncementSearchQuery = '';
let adminInboxCache = { concerns: [], announcements: [] };
let adminExpandedAnnouncementId = null;

async function loadAdminAnnouncements() {
  const listEl = document.getElementById('admin-announcement-list');
  if (!listEl) return;

  try {
    const res = await fetch(`${API_URL}/admin/inbox`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    adminInboxCache.announcements = Array.isArray(data.announcements) ? data.announcements : [];
    if (Array.isArray(data.concerns)) adminInboxCache.concerns = data.concerns;
    paintAdminAnnouncementsList();
    wireInboxSearch({
      inputId: 'admin-announcement-search',
      clearId: 'admin-announcement-search-clear',
      getValue: () => adminAnnouncementSearchQuery,
      setValue: (v) => { adminAnnouncementSearchQuery = v; },
      onChange: () => paintAdminAnnouncementsList()
    });
  } catch (err) {
    console.error('Load announcements error:', err);
    listEl.innerHTML = '<li class="empty-state"><p>Failed to load announcements</p></li>';
  }
}

function paintAdminAnnouncementsList() {
  const listEl = document.getElementById('admin-announcement-list');
  if (!listEl) return;
  let announcements = [...(adminInboxCache.announcements || [])];
  announcements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  announcements = announcements.filter((a) => matchesInboxSearch(a, adminAnnouncementSearchQuery));

  if (!announcements.length) {
    listEl.innerHTML = `<li class="empty-state"><p>${String(adminAnnouncementSearchQuery || '').trim() ? 'No matches' : 'No announcements sent yet'}</p></li>`;
    return;
  }

  listEl.innerHTML = announcements.map((a) => {
    const isEdited = a.updated_at && new Date(a.updated_at).getTime() > new Date(a.created_at).getTime() + 1000;
    const editedBit = isEdited ? ` · Edited ${new Date(a.updated_at).toLocaleString()}` : '';
    return renderMailAnnouncementRow(a, {
      expandedId: adminExpandedAnnouncementId,
      toggleFn: 'toggleAdminAnnouncement',
      badgeLabel: 'Announcement',
      badgeColor: 'var(--maroon)',
      metaLine: `${escapeHtml(announcementMeta(a))}${editedBit}`,
      actionsHtml: `
        <button type="button" class="chip-ghost" onclick="startEditAnnouncement(${a.id})">Edit</button>
        <button type="button" class="chip-ghost" style="color:#b71c1c;border-color:#b71c1c;" onclick="deleteAnnouncement(${a.id})">Delete</button>`
    });
  }).join('');
}

window.toggleAdminAnnouncement = async function(id) {
  const announcementId = Number(id);
  if (!announcementId) return;
  if (Number(adminExpandedAnnouncementId) === announcementId) {
    adminExpandedAnnouncementId = null;
    paintAdminAnnouncementsList();
    return;
  }
  adminExpandedAnnouncementId = announcementId;
  const cached = (adminInboxCache.announcements || []).find((a) => Number(a.id) === announcementId);
  if (cached && isUnread(cached)) {
    try {
      await fetch(`${API_URL}/admin/announcements/${announcementId}/read`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      cached.is_read = 1;
    } catch (err) {
      console.error('Mark announcement read error:', err);
    }
  }
  paintAdminAnnouncementsList();
};

async function loadAdminInbox(filter = adminInboxFilter || 'unresolved') {
  const listEl = document.getElementById('admin-inbox-list');
  if (!listEl) return;
  adminInboxFilter = filter || 'unresolved';

  document.querySelectorAll('[data-admin-inbox-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.adminInboxFilter === adminInboxFilter);
  });

  try {
    const res = await fetch(`${API_URL}/admin/inbox`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    adminInboxCache = {
      concerns: Array.isArray(data.concerns) ? data.concerns : [],
      announcements: Array.isArray(data.announcements) ? data.announcements : adminInboxCache.announcements
    };
    if (adminExpandedConcernId) {
      const still = adminInboxCache.concerns.some((c) => Number(c.id) === Number(adminExpandedConcernId));
      if (!still) adminExpandedConcernId = null;
    }
    paintAdminInboxList();
    wireInboxSearch({
      inputId: 'admin-inbox-search',
      clearId: 'admin-inbox-search-clear',
      getValue: () => adminInboxSearchQuery,
      setValue: (v) => { adminInboxSearchQuery = v; },
      onChange: () => paintAdminInboxList()
    });
  } catch (err) {
    console.error('Load admin inbox error:', err);
    listEl.innerHTML = '<li class="empty-state"><p>Failed to load inbox</p></li>';
  }
}

function paintAdminInboxList() {
  const listEl = document.getElementById('admin-inbox-list');
  if (!listEl) return;
  const filter = adminInboxFilter || 'unresolved';
  document.querySelectorAll('[data-admin-inbox-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.adminInboxFilter === filter);
  });

  const concerns = adminInboxCache.concerns || [];
  setInboxFilterCounts(
    document.querySelectorAll('[data-admin-inbox-filter]'),
    {
      unresolved: concerns.filter((c) => concernIsOpen(c)).length
      // resolved: no count
    },
    'data-admin-inbox-filter'
  );

  let items = concerns.filter((c) =>
    filter === 'resolved' ? !concernIsOpen(c) : concernIsOpen(c)
  );
  items.sort((a, b) => concernActivityTime(b) - concernActivityTime(a));
  items = items.filter((c) => matchesInboxSearch(c, adminInboxSearchQuery));

  if (!items.length) {
    const emptyLabel = String(adminInboxSearchQuery || '').trim()
      ? 'matches'
      : filter === 'resolved' ? 'resolved concerns' : 'unresolved concerns';
    listEl.innerHTML = `<li class="empty-state"><p>No ${emptyLabel}</p></li>`;
    return;
  }

  listEl.innerHTML = items.map((item) => {
    const studentBit = item.student_name
      ? `${escapeHtml(item.student_name)} (Grade ${item.grade_level || '?'}-${escapeHtml(item.section || '?')})`
      : 'N/A';
    const teacherBit = item.teacher_name ? ` · Teacher: ${escapeHtml(item.teacher_name)}` : '';
    return renderMailConcernRow(item, {
      expandedId: adminExpandedConcernId,
      toggleFn: 'toggleAdminConcern',
      badgeLabel: item.parent_name || 'Parent',
      metaLine: `Student: ${studentBit}${teacherBit}`,
      canReply: true
    });
  }).join('');
}

window.toggleAdminConcern = async function(id) {
  const concernId = Number(id);
  if (!concernId) return;
  if (Number(adminExpandedConcernId) === concernId) {
    adminExpandedConcernId = null;
    paintAdminInboxList();
    return;
  }
  adminExpandedConcernId = concernId;
  await markConcernReadForRole(concernId);
  const cached = adminInboxCache.concerns.find((c) => Number(c.id) === concernId);
  if (cached) {
    cached.is_read = 1;
    cached.read_at = new Date().toISOString();
  }
  paintAdminInboxList();
};

function isUnread(item) {
  return item.is_read === 0 || item.is_read === false || !item.is_read;
}

function announcementAudienceLabel(item) {
  const audience = String(item.audience || 'everyone');
  if (audience === 'teachers') return 'Teachers only';
  if (audience === 'parents') return 'Parents only';
  return 'Parents & teachers';
}

function inboxDeleteAction(itemType, itemId) {
  return `<button type="button" class="chip-ghost" style="color:#b71c1c;border-color:#b71c1c;" onclick="moveInboxToTrash('${itemType}', ${Number(itemId)})">Delete</button>`;
}

function inboxRestoreAction(itemType, itemId) {
  return `<button type="button" class="chip-ghost" onclick="restoreInboxItem('${itemType}', ${Number(itemId)})">Restore</button>`;
}

window.moveInboxToTrash = async function(itemType, itemId) {
  try {
    const res = await fetch(`${API_URL}/inbox/trash`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ item_type: itemType, item_id: Number(itemId) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not move to trash');
    showToast('Moved to Trash');
    await reloadOpenInbox();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.restoreInboxItem = async function(itemType, itemId) {
  try {
    const res = await fetch(`${API_URL}/inbox/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ item_type: itemType, item_id: Number(itemId) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not restore');
    showToast('Restored to Inbox');
    await reloadOpenInbox();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.emptyInboxTrash = async function() {
  if (!window.confirm('Empty trash? These messages stay hidden on your account only.')) return;
  try {
    const res = await fetch(`${API_URL}/inbox/empty`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not empty trash');
    showToast('Trash emptied');
    await reloadOpenInbox();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

async function reloadOpenInbox() {
  const role = getAuthUser()?.role;
  if (role === 'parent') {
    await renderParentInbox();
    return;
  }
  if (role === 'teacher') await loadTeacherInbox();
}

function priorityCardClass(item) {
  const priority = String(item?.priority || 'normal').toLowerCase();
  if (priority === 'high') return 'priority-card-high';
  if (priority === 'low') return 'priority-card-low';
  return 'priority-card-normal';
}

function priorityBadgeHtml(item) {
  const priority = String(item.priority || 'normal').toLowerCase();
  const priorityClass = priority === 'high' ? 'priority-high' : (priority === 'low' ? 'priority-low' : 'priority-normal');
  const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
  return `<span class="badge ${priorityClass}">${priorityLabel}</span>`;
}

function teachingModeDisplay(mode, label, homeroomRole) {
  if (label) return label;
  const home = homeroomRole === 'assistant' ? 'Assistant Teacher' : 'Class Adviser';
  const m = String(mode || '').toLowerCase();
  if (m === 'both') return `${home} & Subject Teacher`;
  if (m === 'class_adviser' || m === 'homeroom') return home;
  if (m === 'subject_teacher' || m === 'subject') return 'Subject Teacher';
  return 'Not set';
}

function accountAssignmentLabel(user) {
  const home = user.homeroom_role === 'assistant' ? 'Assistant Teacher' : 'Class Adviser';
  const grade = user.homeroom_grade || '?';
  const section = user.homeroom_section || '?';
  if (user.teaching_mode === 'class_adviser' || user.teaching_mode === 'homeroom') {
    return `${home} — Grade ${grade}-${section}`;
  }
  if (user.teaching_mode === 'both') {
    return `${home} — Grade ${grade}-${section} + Subjects`;
  }
  if (user.teaching_mode === 'subject_teacher' || user.teaching_mode === 'subject') return 'Subject Teacher';
  if (user.homeroom_grade && user.homeroom_section) return `${home} — Grade ${grade}-${section}`;
  if (user.assignments && user.assignments.some((a) => a.subject_id !== null)) return 'Subject Teacher';
  return 'Teacher — No assignments set';
}

function classTeacherSummary(data) {
  const adviser = data?.teacher
    ? `${data.teacher.last_name}, ${data.teacher.first_name}`
    : 'No class adviser';
  const assistant = data?.assistant
    ? `${data.assistant.last_name}, ${data.assistant.first_name}`
    : 'No assistant teacher';
  return `${adviser} · Assistant: ${assistant}`;
}

function announcementMeta(item) {
  const parts = [
    `Audience: ${announcementAudienceLabel(item)}`,
    `Scope: ${item.scope || 'school_wide'}`
  ];
  if (item.target_grade) parts.push('Grade ' + item.target_grade);
  if (item.target_section) parts.push('Section ' + item.target_section);
  return parts.join(' | ');
}

function concernSubject(item) {
  return item.subject || item.SUBJECT || 'N/A';
}

function concernStatus(item) {
  return String(item.status || item.STATUS || 'open').toLowerCase();
}

function concernIsOpen(item) {
  const status = concernStatus(item);
  return status !== 'resolved' && status !== 'closed';
}

function roleLabel(role) {
  if (role === 'parent') return 'Parent';
  if (role === 'teacher') return 'Teacher';
  if (role === 'admin') return 'Admin';
  if (role === 'student') return 'Student';
  return role || 'User';
}

function concernThreadHtml(item, canReply, extraActionsHtml = '') {
  const open = concernIsOpen(item);
  let replies = Array.isArray(item.replies) ? item.replies : [];
  if (!replies.length && item.teacher_reply) {
    replies = [{
      sender_name: 'Teacher',
      sender_role: 'teacher',
      message: item.teacher_reply,
      created_at: item.replied_at
    }];
  }

  const original = `
    <div class="concern-reply concern-reply--parent">
      <div class="concern-reply-meta">
        <strong>Parent</strong>
        ${item.parent_name ? ` · ${escapeHtml(item.parent_name)}` : ''}
        ${item.created_at ? ` <span style="color:var(--text-muted);font-size:0.75rem;">(${new Date(item.created_at).toLocaleString()})</span>` : ''}
      </div>
      <div class="concern-reply-body">${escapeHtml(item.message || '')}</div>
    </div>`;

  const followUps = replies.length
    ? replies.map(r => `
        <div class="concern-reply concern-reply--${r.sender_role || 'user'}">
          <div class="concern-reply-meta">
            <strong>${roleLabel(r.sender_role)}</strong>
            ${r.sender_name ? ` · ${escapeHtml(r.sender_name)}` : ''}
            ${r.created_at ? ` <span style="color:var(--text-muted);font-size:0.75rem;">(${new Date(r.created_at).toLocaleString()})</span>` : ''}
          </div>
          <div class="concern-reply-body">${escapeHtml(r.message || '')}</div>
        </div>`).join('')
    : '';

  const thread = `<div class="concern-thread">${original}${followUps}</div>`;

  const replyForm = canReply && open
    ? `<textarea id="concern-reply-${item.id}" rows="2" class="concern-reply-input" placeholder="Write a message..."></textarea>`
    : '';

  const extra = extraActionsHtml || '';
  const actions = (canReply || extra)
    ? `<div class="inbox-item-actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
         ${canReply && open ? `<button type="button" class="chip-ghost primary" onclick="replyToConcern(${item.id}, this)">Send Reply</button>` : ''}
         ${canReply && getAuthUser()?.role !== 'parent' && open
           ? `<button type="button" class="chip-ghost" onclick="resolveConcern(${item.id})">Mark Resolved</button>`
           : ''}
         ${canReply && !open ? '<span class="page-subheading" style="margin:0;">Replies closed</span>' : ''}
         ${extra}
       </div>`
    : (!open ? '<p class="page-subheading">Replies closed</p>' : '');

  return thread + replyForm + actions;
}

function concernReplyHtml(item, canReply) {
  return concernThreadHtml(item, canReply);
}

function concernPreviewText(item) {
  const text = String(item.message || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'No message';
  return text.length > 110 ? `${text.slice(0, 110)}…` : text;
}

function concernActivityTime(item) {
  return new Date(item.last_activity || item.created_at || 0).getTime() || 0;
}

function isConcernUnread(item) {
  // Resolved/closed = already handled → always show as read/neutral
  if (!concernIsOpen(item)) return false;
  return !(item.is_read === 1 || item.is_read === true);
}

function inboxSearchHaystack(item) {
  const parts = [
    item.subject,
    item.SUBJECT,
    item.title,
    item.message,
    item.body,
    item.parent_name,
    item.teacher_name,
    item.student_name,
    item.sender_name,
    item.admin_name,
    item.grade_level,
    item.section
  ];
  if (Array.isArray(item.replies)) {
    item.replies.forEach((r) => {
      parts.push(r.message, r.sender_name, r.sender_role);
    });
  }
  return parts.filter((p) => p != null && String(p).trim() !== '').join(' ').toLowerCase();
}

function matchesInboxSearch(item, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return inboxSearchHaystack(item).includes(q);
}

function syncInboxSearchClearBtn(inputEl, clearBtn) {
  if (!clearBtn || !inputEl) return;
  const has = !!String(inputEl.value || '').trim();
  clearBtn.hidden = !has;
  if (has) clearBtn.removeAttribute('hidden');
  else clearBtn.setAttribute('hidden', '');
}

function wireInboxSearch({ inputId, clearId, getValue, setValue, onChange }) {
  const input = document.getElementById(inputId);
  const clearBtn = document.getElementById(clearId);
  if (!input || input.dataset.searchWired === '1') return;
  input.dataset.searchWired = '1';
  if (typeof getValue === 'function') input.value = getValue() || '';
  syncInboxSearchClearBtn(input, clearBtn);
  input.addEventListener('input', () => {
    const val = input.value || '';
    if (typeof setValue === 'function') setValue(val);
    syncInboxSearchClearBtn(input, clearBtn);
    onChange?.(val);
  });
  clearBtn?.addEventListener('click', () => {
    input.value = '';
    if (typeof setValue === 'function') setValue('');
    syncInboxSearchClearBtn(input, clearBtn);
    onChange?.('');
    input.focus();
  });
}

async function markConcernReadForRole(id) {
  const role = getAuthUser()?.role;
  const base = role === 'parent' ? 'parent' : role === 'admin' ? 'admin' : 'teacher';
  try {
    await fetch(`${API_URL}/${base}/concerns/${id}/read`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (err) {
    console.error('Mark concern read error:', err);
  }
}

function renderMailConcernRow(item, {
  expandedId = null,
  toggleFn = 'toggleTeacherConcern',
  metaLine = '',
  canReply = true,
  badgeLabel = null,
  extraActionsHtml = ''
} = {}) {
  const unread = isConcernUnread(item);
  const expanded = Number(expandedId) === Number(item.id);
  const when = new Date(item.last_activity || item.created_at).toLocaleString();
  const role = getAuthUser()?.role;
  const label = badgeLabel != null && String(badgeLabel).trim() !== ''
    ? String(badgeLabel).trim()
    : (role === 'parent'
      ? (item.teacher_name || 'Teacher')
      : (item.parent_name || 'Parent'));

  return `
    <li class="inbox-item inbox-item--concern ${unread ? 'inbox-item--unread' : 'inbox-item--read'} ${expanded ? 'is-expanded' : ''}" data-concern-id="${item.id}">
      <button type="button" class="inbox-item-summary" onclick="${toggleFn}(${item.id})" aria-expanded="${expanded ? 'true' : 'false'}">
        <div class="inbox-item-summary-top">
          <span class="badge" style="background:var(--maroon);color:#fff;">${escapeHtml(label)}</span>
          ${unread ? '<span class="inbox-unread-dot" title="Unread"></span>' : ''}
          <span class="inbox-item-time">${when}</span>
          <span class="inbox-item-chev" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
        </div>
        <div class="inbox-item-summary-title">${escapeHtml(concernSubject(item))}</div>
        <div class="inbox-item-summary-meta">${metaLine}</div>
        ${expanded ? '' : `<p class="inbox-item-preview">${escapeHtml(concernPreviewText(item))}</p>`}
      </button>
      ${expanded ? `<div class="inbox-item-detail">${concernThreadHtml(item, canReply, extraActionsHtml)}</div>` : ''}
    </li>`;
}

function announcementPreviewText(item) {
  const text = String(item.body || item.message || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'No message';
  return text.length > 110 ? `${text.slice(0, 110)}…` : text;
}

function renderMailAnnouncementRow(item, {
  expandedId = null,
  expanded = null,
  toggleFn = 'toggleTeacherAnnouncement',
  onToggle = null,
  badgeLabel = null,
  badgeColor = 'var(--maroon)',
  metaLine = '',
  actionsHtml = '',
  showTypeBadge = true
} = {}) {
  const unread = isUnread(item);
  const isExpanded = expanded != null
    ? !!expanded
    : Number(expandedId) === Number(item.id);
  const when = new Date(item.created_at || item.last_activity || 0).toLocaleString();
  const toggleAttr = onToggle || `${toggleFn}(${item.id})`;
  const typeBadge = showTypeBadge && badgeLabel
    ? `<span class="badge" style="background:${badgeColor};color:#fff;">${escapeHtml(badgeLabel)}</span>`
    : '';

  return `
    <li class="inbox-item inbox-item--announcement ${priorityCardClass(item)} ${unread ? 'inbox-item--unread' : 'inbox-item--read'} ${isExpanded ? 'is-expanded' : ''}" data-announcement-id="${item.id}">
      <button type="button" class="inbox-item-summary" onclick="${toggleAttr}" aria-expanded="${isExpanded ? 'true' : 'false'}">
        <div class="inbox-item-summary-top">
          ${typeBadge}
          ${priorityBadgeHtml(item)}
          ${unread ? '<span class="inbox-unread-dot" title="Unread"></span>' : ''}
          <span class="inbox-item-time">${when}</span>
          <span class="inbox-item-chev" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>
        </div>
        <div class="inbox-item-summary-title">${escapeHtml(item.title || item.subject || 'Announcement')}</div>
        <div class="inbox-item-summary-meta">${metaLine}</div>
        ${isExpanded ? '' : `<p class="inbox-item-preview">${escapeHtml(announcementPreviewText(item))}</p>`}
      </button>
      ${isExpanded ? `
        <div class="inbox-item-detail">
          <p style="margin:0;color:var(--text-dark);font-size:0.85rem;white-space:pre-wrap;">${escapeHtml(item.body || item.message || '')}</p>
          <div class="inbox-item-actions" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            ${actionsHtml}
          </div>
        </div>` : ''}
    </li>`;
}

function renderTeacherConcernRow(item, { trashed = false } = {}) {
  const studentBit = item.student_name
    ? `${escapeHtml(item.student_name)} (Grade ${item.grade_level || '?'}-${escapeHtml(item.section || '?')})`
    : 'N/A';
  return renderMailConcernRow(item, {
    expandedId: teacherExpandedConcernId,
    toggleFn: 'toggleTeacherConcern',
    badgeLabel: item.parent_name || 'Parent',
    metaLine: `Student: ${studentBit}`,
    canReply: !trashed,
    extraActionsHtml: trashed ? inboxRestoreAction('concern', item.id) : inboxDeleteAction('concern', item.id)
  });
}

function renderTeacherAnnouncementRow(item, { trashed = false } = {}) {
  const unread = isUnread(item);
  const readBtn = trashed
    ? ''
    : `<button type="button" class="chip-ghost announcement-read-btn ${unread ? 'primary' : ''}" onclick="toggleAnnouncementRead(${item.id}, ${!unread})">${unread ? 'Mark as Read' : 'Mark as Unread'}</button>`;
  return renderMailAnnouncementRow(item, {
    expandedId: teacherExpandedAnnouncementId,
    toggleFn: 'toggleTeacherAnnouncement',
    showTypeBadge: false,
    metaLine: `From: ${escapeHtml(item.sender_name || 'Admin')} | ${escapeHtml(announcementMeta(item))}`,
    actionsHtml: `${readBtn}${trashed ? inboxRestoreAction('announcement', item.id) : inboxDeleteAction('announcement', item.id)}`
  });
}

let teacherInboxFilter = 'unresolved';
let teacherExpandedConcernId = null;
let teacherExpandedAnnouncementId = null;
let teacherInboxSearchQuery = '';
let teacherInboxCache = { announcements: [], concerns: [], trash: { announcements: [], concerns: [], messages: [] } };

async function markTeacherConcernRead(id) {
  await markConcernReadForRole(id);
}

window.toggleTeacherConcern = async function(id) {
  const concernId = Number(id);
  if (!concernId) return;
  if (Number(teacherExpandedConcernId) === concernId) {
    teacherExpandedConcernId = null;
    paintTeacherInboxList();
    return;
  }
  teacherExpandedConcernId = concernId;
  teacherExpandedAnnouncementId = null;
  await markTeacherConcernRead(concernId);
  const cached = teacherInboxCache.concerns.find((c) => Number(c.id) === concernId);
  if (cached) {
    cached.is_read = 1;
    cached.read_at = new Date().toISOString();
  }
  paintTeacherInboxList();
  updateTeacherInboxBadge();
};

window.toggleTeacherAnnouncement = async function(id) {
  const announcementId = Number(id);
  if (!announcementId) return;
  if (Number(teacherExpandedAnnouncementId) === announcementId) {
    teacherExpandedAnnouncementId = null;
    paintTeacherInboxList();
    return;
  }
  teacherExpandedAnnouncementId = announcementId;
  teacherExpandedConcernId = null;

  const cached = teacherInboxCache.announcements.find((a) => Number(a.id) === announcementId);
  if (cached && isUnread(cached)) {
    try {
      await fetch(`${API_URL}/admin/announcements/${announcementId}/read`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      cached.is_read = 1;
    } catch (err) {
      console.error('Mark announcement read error:', err);
    }
  }
  paintTeacherInboxList();
  updateTeacherInboxBadge();
};

function setInboxDotBadge(badgeEl, count, label = 'unread messages') {
  if (!badgeEl) return;
  const n = Number(count) || 0;
  badgeEl.textContent = '';
  badgeEl.classList.add('inbox-badge--dot');
  badgeEl.hidden = n === 0;
  if (n > 0) {
    badgeEl.setAttribute('aria-label', `${n} ${label}`);
    badgeEl.removeAttribute('aria-hidden');
  } else {
    badgeEl.removeAttribute('aria-label');
    badgeEl.setAttribute('aria-hidden', 'true');
  }
}

function setInboxFilterCounts(buttons, countsByKey, dataAttr) {
  if (!buttons?.forEach) return;
  buttons.forEach((btn) => {
    const key = btn.getAttribute(dataAttr);
    if (!key) return;
    const hasCount = Object.prototype.hasOwnProperty.call(countsByKey, key);
    const n = Number(countsByKey[key]) || 0;
    let badge = btn.querySelector('.inbox-filter-count');
    if (!hasCount || n <= 0) {
      if (badge) badge.hidden = true;
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'inbox-filter-count';
      badge.setAttribute('aria-hidden', 'true');
      btn.appendChild(badge);
    }
    badge.textContent = String(n);
    badge.hidden = false;
  });
}

function updateTeacherInboxBadge() {
  const badgeEl = document.getElementById('teacher-inbox-badge');
  const unreadAnnouncements = (teacherInboxCache.announcements || []).filter((a) => isUnread(a)).length;
  const openConcerns = (teacherInboxCache.concerns || []).filter((c) => concernIsOpen(c)).length;
  // Dot = still has unresolved work OR unread admin notices
  setInboxDotBadge(badgeEl, openConcerns + unreadAnnouncements, 'inbox items needing attention');
}

function updateTeacherInboxFilterCounts() {
  const concerns = teacherInboxCache.concerns || [];
  const announcements = teacherInboxCache.announcements || [];
  setInboxFilterCounts(
    document.querySelectorAll('#teacher-panel-inbox [data-inbox-filter]'),
    {
      unresolved: concerns.filter((c) => concernIsOpen(c)).length,
      // resolved: no count
      admin: announcements.filter((a) => isUnread(a)).length
    },
    'data-inbox-filter'
  );
}

function paintTeacherInboxList() {
  const listEl = document.getElementById('teacher-inbox-list');
  if (!listEl) return;
  const filter = teacherInboxFilter || 'unresolved';
  const q = teacherInboxSearchQuery;

  document.querySelectorAll('#teacher-panel-inbox [data-inbox-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.inboxFilter === filter);
  });
  updateTeacherInboxFilterCounts();

  let items = [];
  if (filter === 'trash') {
    const trash = teacherInboxCache.trash || {};
    items = [
      ...(trash.concerns || []).map((c) => ({ ...c, type: 'parent', trashed: true })),
      ...(trash.announcements || []).map((a) => ({ ...a, type: 'admin', trashed: true }))
    ];
    items.sort((a, b) => new Date(b.trashed_at || b.created_at) - new Date(a.trashed_at || a.created_at));
  } else if (filter === 'admin') {
    items = (teacherInboxCache.announcements || []).map((a) => ({ ...a, type: 'admin' }));
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (filter === 'resolved') {
    items = (teacherInboxCache.concerns || [])
      .filter((c) => !concernIsOpen(c))
      .map((c) => ({ ...c, type: 'parent' }));
    items.sort((a, b) => concernActivityTime(b) - concernActivityTime(a));
  } else {
    items = (teacherInboxCache.concerns || [])
      .filter((c) => concernIsOpen(c))
      .map((c) => ({ ...c, type: 'parent' }));
    items.sort((a, b) => concernActivityTime(b) - concernActivityTime(a));
  }

  items = items.filter((item) => matchesInboxSearch(item, q));

  const unreadAdmin = (teacherInboxCache.announcements || []).filter((a) => isUnread(a)).length;
  const trashCount = ((teacherInboxCache.trash || {}).concerns || []).length
    + ((teacherInboxCache.trash || {}).announcements || []).length;
  const markAllBtn = filter === 'admin' && unreadAdmin > 0 && !String(q || '').trim()
    ? `<div style="margin-bottom:10px;"><button class="chip-ghost primary" onclick="markAllAnnouncementsRead()">Mark All as Read (${unreadAdmin})</button></div>`
    : '';
  const emptyTrashBtn = filter === 'trash' && trashCount > 0 && !String(q || '').trim()
    ? `<div style="margin-bottom:10px;"><button type="button" class="chip-ghost" style="color:#b71c1c;border-color:#b71c1c;" onclick="emptyInboxTrash()">Empty Trash</button></div>`
    : '';

  if (!items.length) {
    const emptyLabel = String(q || '').trim()
      ? 'matches'
      : filter === 'trash'
        ? 'items in trash'
        : filter === 'admin'
        ? 'admin announcements'
        : filter === 'resolved'
          ? 'resolved concerns'
          : 'unresolved concerns';
    listEl.innerHTML = markAllBtn + emptyTrashBtn + `<li class="empty-state"><p>No ${emptyLabel}</p></li>`;
    return;
  }

  listEl.innerHTML = markAllBtn + emptyTrashBtn + items.map((item) => (
    item.type === 'admin'
      ? renderTeacherAnnouncementRow(item, { trashed: !!item.trashed })
      : renderTeacherConcernRow(item, { trashed: !!item.trashed })
  )).join('');
}

async function loadTeacherInbox(filter = teacherInboxFilter || 'unresolved') {
  const listEl = document.getElementById('teacher-inbox-list');
  if (!listEl) return;

  teacherInboxFilter = filter || 'unresolved';
  if (teacherInboxFilter === 'all' || teacherInboxFilter === 'parent') {
    teacherInboxFilter = 'unresolved';
  }

  document.querySelectorAll('[data-inbox-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.inboxFilter === teacherInboxFilter);
  });

  try {
    const [res, trashRes] = await Promise.all([
      fetch(`${API_URL}/teacher/inbox`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/inbox/trash`, { headers: getAuthHeaders() })
    ]);
    const data = await res.json();
    const trashData = await trashRes.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error);

    teacherInboxCache = {
      announcements: Array.isArray(data.announcements) ? data.announcements : [],
      concerns: Array.isArray(data.concerns) ? data.concerns : [],
      trash: {
        announcements: Array.isArray(trashData.announcements) ? trashData.announcements : [],
        concerns: Array.isArray(trashData.concerns) ? trashData.concerns : [],
        messages: Array.isArray(trashData.messages) ? trashData.messages : []
      }
    };

    // Keep expanded only if still present
    if (teacherExpandedConcernId) {
      const stillThere = teacherInboxCache.concerns.some(
        (c) => Number(c.id) === Number(teacherExpandedConcernId)
      );
      if (!stillThere) teacherExpandedConcernId = null;
    }

    updateTeacherInboxBadge();
    paintTeacherInboxList();
    paintTeacherTodayInbox();
    wireInboxSearch({
      inputId: 'teacher-inbox-search',
      clearId: 'teacher-inbox-search-clear',
      getValue: () => teacherInboxSearchQuery,
      setValue: (v) => { teacherInboxSearchQuery = v; },
      onChange: () => paintTeacherInboxList()
    });
  } catch (err) {
    console.error('Load teacher inbox error:', err);
    listEl.innerHTML = '<li class="empty-state"><p>Failed to load inbox</p></li>';
    const badgeEl = document.getElementById('teacher-inbox-badge');
    if (badgeEl) badgeEl.hidden = true;
  }
}

function manilaDayKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return localISODate(d);
}

function paintTeacherTodayInbox() {
  const list = document.getElementById('teacher-today-inbox-list');
  if (!list) return;
  const today = localISODate();
  const concerns = (teacherInboxCache.concerns || [])
    .filter((c) => manilaDayKey(c.created_at) === today)
    .map((c) => ({
      kind: 'concern',
      title: concernSubject(c),
      meta: c.parent_name || 'Parent',
      unread: concernIsOpen(c)
    }));
  const announcements = (teacherInboxCache.announcements || [])
    .filter((a) => manilaDayKey(a.created_at) === today)
    .map((a) => ({
      kind: 'announcement',
      title: a.title || 'Announcement',
      meta: a.sender_name || 'Admin',
      unread: isUnread(a)
    }));
  const items = [...concerns, ...announcements];
  if (!items.length) {
    list.innerHTML = '<li class="page-subheading">No Inbox for Today.</li>';
    return;
  }
  list.innerHTML = items.map((item) => `
    <li class="inbox-item ${item.unread ? 'inbox-item--unread' : 'inbox-item--read'}">
      <button type="button" class="inbox-item-summary" data-today-inbox="${item.kind}">
        <span class="inbox-item-summary-title">${escapeHtml(item.title)}</span>
        <span class="inbox-item-summary-meta">${escapeHtml(item.meta)}</span>
      </button>
    </li>
  `).join('');
}

async function loadTeacherTodayInbox() {
  const list = document.getElementById('teacher-today-inbox-list');
  if (!list) return;
  try {
    const res = await fetch(`${API_URL}/teacher/inbox`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load inbox');
    teacherInboxCache = {
      ...teacherInboxCache,
      announcements: Array.isArray(data.announcements) ? data.announcements : [],
      concerns: Array.isArray(data.concerns) ? data.concerns : []
    };
    updateTeacherInboxBadge();
    paintTeacherTodayInbox();
  } catch (err) {
    console.error('Today inbox error:', err);
    list.innerHTML = '<li class="page-subheading">Could not load today\'s inbox.</li>';
  }
}

document.getElementById('teacher-today-inbox-list')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-today-inbox]');
  if (!btn) return;
  teacherInboxFilter = btn.dataset.todayInbox === 'announcement' ? 'admin' : 'unresolved';
  goToTeacherPanel('inbox');
});

async function refreshParentInboxBadge() {
  try {
    const [inboxRes, concernsRes] = await Promise.all([
      fetch(`${API_URL}/parent/inbox`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/parent/concerns`, { headers: getAuthHeaders() })
    ]);
    const data = await inboxRes.json();
    const concerns = await concernsRes.json();
    if (!inboxRes.ok) throw new Error(data.error);
    const announcements = data.announcements || [];
    const notices = data.messages || [];
    const concernRows = Array.isArray(concerns) ? concerns : [];
    const unreadCount = announcements.filter((a) => isUnread(a)).length
      + notices.filter((m) => m.is_read === 0 || m.is_read === false).length
      + concernRows.filter((c) => concernIsOpen(c) && isConcernUnread(c)).length;
    const badgeEl = document.getElementById('parent-inbox-badge');
    if (badgeEl) {
      badgeEl.textContent = unreadCount;
      badgeEl.hidden = unreadCount === 0;
    }
  } catch (err) {
    console.error('Refresh parent badge error:', err);
  }
}

async function toggleAnnouncementRead(id, currentReadState) {
  try {
    const method = currentReadState ? 'DELETE' : 'POST';
    const res = await fetch(`${API_URL}/admin/announcements/${id}/read`, {
      method,
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to update');

    // Refresh the currently visible list
    const activeAdminTab = document.querySelector('[data-admin-tab].active')?.dataset.adminTab;
    if (activeAdminTab === 'announcements') loadAdminAnnouncements();

    const activeTeacherPanel = document.querySelector('[data-teacher-panel].active')?.dataset.teacherPanel;
    if (activeTeacherPanel === 'inbox') loadTeacherInbox();

    const activeParentTab = document.querySelector('[data-parent-tab].active')?.dataset.parentTab;
    if (activeParentTab === 'inbox') renderParentInbox();

    // Always refresh inbox badge counts
    loadTeacherInbox();
    refreshParentInboxBadge();
  } catch (err) {
    console.error('Toggle read error:', err);
  }
}

window.toggleParentMessageRead = async function(id, currentlyUnread) {
  try {
    const res = await fetch(`${API_URL}/parent/messages/${id}/read`, {
      method: currentlyUnread ? 'POST' : 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update');
    renderParentInbox();
    refreshParentInboxBadge();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColor = type === 'success' ? '#1b5e20' : '#b71c1c';
  const icon = type === 'success' ? '✓' : '✕';

  toast.style.cssText = `
    background: ${bgColor};
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 280px;
    pointer-events: auto;
    transform: translateX(120%);
    opacity: 0;
    transition: all 0.35s cubic-bezier(0.25, 0.8, 0.25, 1);
  `;

  toast.innerHTML = `<span style="font-size:1.1rem;line-height:1;">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  // Slide in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

function unreadAnnouncementIds(list) {
  return (list || [])
    .filter((a) => a && isUnread(a))
    .map((a) => Number(a.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function markAllAnnouncementsRead() {
  const activeAdminTab = document.querySelector('[data-admin-tab].active')?.dataset.adminTab;
  const activeTeacherPanel = document.querySelector('[data-teacher-panel].active')?.dataset.teacherPanel;
  const activeParentTab = document.querySelector('[data-parent-tab].active')?.dataset.parentTab;
  const parentViewOpen = document.getElementById('view-parent') && !document.getElementById('view-parent').hidden;

  if (parentViewOpen && activeParentTab === 'inbox') {
    await markParentInboxRead();
    return;
  }

  let ids = [];
  if (activeTeacherPanel === 'inbox') {
    ids = unreadAnnouncementIds(teacherInboxCache.announcements);
  } else if (activeAdminTab === 'announcements') {
    ids = unreadAnnouncementIds(adminInboxCache.announcements);
  }
  if (!ids.length) return;

  if (!confirm(`Mark all ${ids.length} announcement${ids.length > 1 ? 's' : ''} as read?`)) return;

  try {
    const res = await fetch(`${API_URL}/admin/announcements/mark-all-read`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ announcement_ids: ids })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not mark announcements as read');

    if (activeAdminTab === 'announcements') loadAdminAnnouncements();
    else if (activeTeacherPanel === 'inbox') loadTeacherInbox();
  } catch (err) {
    console.error('Mark all read error:', err);
    showToast(err.message || 'Could not mark announcements as read.', 'error');
  }
}

async function markParentInboxRead() {
  const announcements = (parentInboxCache.announcements || []).filter(announcementBelongsToSelectedChild);
  const isAdminAnnouncement = (a) => String(a.sender_role || 'admin') !== 'teacher';
  const filter = parentInboxFilter || 'unresolved';
  let announcementIds = [];
  let messageIds = [];

  if (filter === 'admin') {
    announcementIds = unreadAnnouncementIds(announcements.filter(isAdminAnnouncement));
  } else if (filter === 'teacher') {
    announcementIds = unreadAnnouncementIds(announcements.filter((a) => !isAdminAnnouncement(a)));
    messageIds = (parentInboxCache.messages || [])
      .filter(noticeBelongsToSelectedChild)
      .filter((m) => m.is_read === 0 || m.is_read === false)
      .map((m) => Number(m.id))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  const total = announcementIds.length + messageIds.length;
  if (!total) return;
  if (!confirm(`Mark all ${total} item${total > 1 ? 's' : ''} as read?`)) return;

  try {
    if (announcementIds.length) {
      const res = await fetch(`${API_URL}/admin/announcements/mark-all-read`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ announcement_ids: announcementIds })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not mark announcements as read');
    }
    if (messageIds.length) {
      const res = await fetch(`${API_URL}/parent/messages/mark-all-read`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message_ids: messageIds })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not mark notices as read');
    }
    await renderParentInbox();
    if (typeof refreshParentInboxBadge === 'function') refreshParentInboxBadge();
  } catch (err) {
    console.error('Parent mark all read error:', err);
    showToast(err.message || 'Could not mark items as read.', 'error');
  }
}

// ========== ADMIN TAB SWITCHING (single source of truth) ==========
function scrollPortalMain(viewId) {
  const view = document.getElementById(viewId);
  const main = view?.querySelector('.dash-main') || view?.querySelector('.admin-main');
  if (main) main.scrollTop = 0;
}

const ADMIN_ADD_MODAL_IDS = [
  'add-account-modal',
  'bulk-account-modal',
  'add-student-modal',
  'bulk-student-modal',
  'add-subject-modal',
  'compose-announcement-modal'
];

function closeAllAdminAddModals() {
  ADMIN_ADD_MODAL_IDS.forEach((id) => {
    const modal = document.getElementById(id);
    if (modal && !modal.hasAttribute('hidden')) closeAdminModal(id);
  });
}

function resetAdminTabState(tabId) {
  if (tabId === 'students') {
    clearStudentFilters();
  }
  if (tabId === 'accounts') {
    currentAccountRoleFilter = 'all';
    currentAccountStatusFilter = 'active';
    currentAccountSearch = '';
    currentAccountSort = 'az';
    const searchInput = document.getElementById('admin-account-search');
    if (searchInput) searchInput.value = '';
    accountSortMenuApi?.sync?.();
    accountPage = 1;
    applyAccountFilters();
  }
}

function resetTeacherPanelState(panelId) {
  if (panelId === 'progress') {
    showProgressCreateForm(false);
    const editor = document.getElementById('progress-editor');
    if (editor) {
      editor.hidden = true;
      editor.setAttribute('hidden', '');
    }
    setProgressListChromeVisible(true);
    const listWrap = document.getElementById('progress-list-wrap');
    if (listWrap) {
      listWrap.hidden = false;
      listWrap.removeAttribute('hidden');
    }
    const progressSearch = document.getElementById('progress-search-input');
    if (progressSearch) progressSearch.value = '';
    progressTypeFilter = 'all';
    document.querySelectorAll('[data-progress-type]').forEach((btn) => {
      btn.classList.toggle('active', (btn.dataset.progressType || 'all') === 'all');
    });
  }

  if (panelId === 'quiz-bank') {
    questionBankCurrentSetId = null;
    questionBankCurrentSet = null;
    questionBankCurrentCategory = null;
    questionBankSelected.clear();
    showQuizBankListView();
    if (typeof updateQuizBankSelectionMeta === 'function') updateQuizBankSelectionMeta();
  }

  if (panelId === 'lesson-plans') {
    materialsCurrentSubjectKey = null;
    showMaterialsLanding();
  }

  if (panelId === 'inbox') {
    document.querySelectorAll('[data-inbox-filter]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.inboxFilter === 'unresolved');
    });
  }
}

function resetParentTabState(tabId) {
  if (tabId === 'inbox') parentInboxFilter = 'unresolved';
  if (tabId === 'attendance') {
    parentAttendanceStatus = 'all';
    parentAttPage = 1;
    // keep period preference across visits
  }
  if (tabId === 'progress') parentProgressPage = 1;
  if (tabId === 'overview') destroyParentCharts();
}

const adminTabHistory = [];
let isNavigatingBack = false;

const adminBackBtn = document.getElementById('admin-back-btn');

function updateBackButton() {
  if (adminBackBtn) {
    adminBackBtn.style.display = adminTabHistory.length > 0 ? 'inline-flex' : 'none';
  }
}

if (adminBackBtn) {
  adminBackBtn.addEventListener('click', () => {
    if (adminTabHistory.length > 0) {
      isNavigatingBack = true;
      const prevTab = adminTabHistory.pop();
      document.querySelector(`[data-admin-tab="${prevTab}"]`)?.click();
    }
  });
}

document.querySelectorAll('[data-admin-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const currentTab = document.querySelector('[data-admin-tab].active')?.dataset.adminTab;
    const tabId = btn.dataset.adminTab;

    // Record history
    if (!isNavigatingBack && currentTab && currentTab !== tabId) {
      resetAdminTabState(currentTab);
      adminTabHistory.push(currentTab);
      updateBackButton();
    }
    isNavigatingBack = false;

    closeAllAdminAddModals();

    document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.hidden = tab.id !== `admin-tab-${tabId}`;
    });

    if (tabId === 'overview') { loadOverviewStats(); loadActivityLog(); }
    if (tabId === 'accounts') { 
      loadAccountsTable(); 
    }
    if (tabId === 'students') { loadDropdowns(); loadStudentsTable(); }
    if (tabId === 'subjects') loadSubjectsTable();
    if (tabId === 'inbox') loadAdminInbox('unresolved');
    if (tabId === 'announcements') loadAdminAnnouncements();
    scrollPortalMain('view-admin');
    closeMobileNav();
  });
});

// Filter buttons inside Accounts tab
document.querySelectorAll('[data-account-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentAccountRoleFilter = btn.dataset.accountFilter;
    accountPage = 1;
    applyAccountFilters();
  });
});

document.querySelectorAll('[data-account-status]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentAccountStatusFilter = btn.dataset.accountStatus;
    accountPage = 1;
    applyAccountFilters();
  });
});

document.getElementById('admin-account-search')?.addEventListener('input', (e) => {
  currentAccountSearch = e.target.value || '';
  accountPage = 1;
  applyAccountFilters();
});

accountSortMenuApi = wireDownloadSelectMenu({
  menuId: 'admin-account-sort-menu',
  btnId: 'admin-account-sort-btn',
  panelId: 'admin-account-sort-panel',
  options: [
    { value: 'az', label: 'A–Z' },
    { value: 'recent', label: 'Recent' }
  ],
  getValue: () => currentAccountSort,
  setValue: (v) => { currentAccountSort = v === 'recent' ? 'recent' : 'az'; },
  onPick: () => { accountPage = 1; applyAccountFilters(); },
  formatButtonLabel: (opt) => (opt?.label || 'A–Z')
});

// Overview / Quick Action links that jump to other tabs
document.querySelectorAll('[data-admin-tab-click]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const tabId = link.dataset.adminTabClick;
    const roleFilter = link.dataset.roleFilter;
    const openModal = link.dataset.openModal;
    document.querySelector(`[data-admin-tab="${tabId}"]`)?.click();

    if (roleFilter) {
      currentAccountRoleFilter = roleFilter;
      currentAccountStatusFilter = 'active';
      setTimeout(() => applyAccountFilters(), 50);
    }

    if (openModal) {
      setTimeout(() => {
        openAdminModal(openModal);
        if (openModal === 'add-student-modal') loadDropdowns();
      }, 80);
    }
  });
});

wireAdminModal('add-account-modal', 'open-add-account-modal');
wireAdminModal('bulk-account-modal', 'open-bulk-account-modal');
wireAdminModal('add-student-modal', 'open-add-student-modal');
wireAdminModal('bulk-student-modal', 'open-bulk-student-modal');

function downloadCsvTemplate(filename, headerLine) {
  const blob = new Blob(['\uFEFF' + headerLine], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function paintBulkResult(el, data, noun) {
  if (!el) return;
  const failed = Array.isArray(data.failed) ? data.failed : [];
  const items = failed.map((f) => {
    const who = f.email || f.name || '';
    return `<li>Row ${escapeHtml(String(f.row ?? ''))}${who ? ` (${escapeHtml(who)})` : ''}: ${escapeHtml(f.error || 'Failed')}</li>`;
  }).join('');
  const emailed = Number(data.emailed);
  const mailNote = Number.isFinite(emailed)
    ? ` Sign-in details emailed to ${emailed}.`
    : '';
  const mailFailed = Array.isArray(data.mail_failed) ? data.mail_failed : [];
  const mailItems = mailFailed.map((row) => (
    `<li>Row ${escapeHtml(String(row.row ?? ''))}${row.name ? ` (${escapeHtml(row.name)})` : ''}: ${escapeHtml(row.error || 'Email was not sent.')} Username ${escapeHtml(row.username || '')}. Temporary password ${escapeHtml(row.temporaryPassword || '')}.</li>`
  )).join('');
  el.innerHTML = `<p class="page-subheading">${Number(data.created) || 0} ${noun}.${mailNote}</p>${items ? `<ul class="bulk-result-list">${items}</ul>` : ''}${mailItems ? `<ul class="bulk-result-list">${mailItems}</ul>` : ''}`;
}

async function submitBulkImport({ url, fileInput, errorEl, resultEl, noun, refresh }) {
  if (errorEl) errorEl.textContent = '';
  if (resultEl) resultEl.innerHTML = '';
  const file = fileInput?.files?.[0];
  if (!file) {
    if (errorEl) errorEl.textContent = 'Choose an Excel or CSV file.';
    return;
  }
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) {
    if (errorEl) errorEl.textContent = 'Upload an Excel (.xlsx) or CSV file.';
    return;
  }
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    body: fd
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Import failed');
  paintBulkResult(resultEl, data, noun);
  if (data.created && typeof refresh === 'function') refresh();
  return data;
}

function roleSheetLabel(role) {
  const value = String(role || '').toLowerCase();
  if (value === 'teacher') return 'Teacher';
  if (value === 'parent') return 'Parent';
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function printBulkAccountSheet(accounts) {
  const rows = accounts.map((account) => (
    `<tr><td>${escapeHtml(account.name || '')}</td><td>${escapeHtml(roleSheetLabel(account.role))}</td><td>${escapeHtml(account.email || '')}</td><td>${escapeHtml(account.password || '')}</td></tr>`
  )).join('');
  const body = `<h1>ConnectED accounts</h1>
    <p class="meta">Temporary passwords for the accounts just created. Each person signs in with the email and password below, then sets their own password.</p>
    <table><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Temporary password</th></tr></thead><tbody>${rows}</tbody></table>`;
  return openPrintHtmlDocument('ConnectED accounts', body);
}

function finishBulkImport(modalId, data, noun) {
  const failed = Array.isArray(data?.failed) ? data.failed : [];
  const created = Number(data?.created) || 0;
  const clean = created > 0 && failed.length === 0;
  if (modalId === 'bulk-account-modal') {
    const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
    const printed = accounts.length ? printBulkAccountSheet(accounts) : false;
    if (!(clean && printed)) return;
    const emailed = Number(data.emailed) || 0;
    const mailNote = emailed
      ? ` Sign-in details emailed to ${emailed}.`
      : ' The sign-in email was not sent.';
    closeAdminModal(modalId);
    showToast(`${created} ${noun}.${mailNote} Save the account list as a PDF.`);
    return;
  }
  if (!clean) return;
  closeAdminModal(modalId);
  showToast(`${created} ${noun}.`);
}

document.getElementById('bulk-account-template')?.addEventListener('click', () => {
  downloadCsvTemplate(
    'account-import-template.csv',
    'first_name,last_name,email,role,phone,address,emergency_contact,is_class_adviser,class_adviser_grade,class_adviser_section,is_subject_teacher,subject_assignments\n'
  );
});
document.getElementById('bulk-student-template')?.addEventListener('click', () => {
  downloadCsvTemplate(
    'student-import-template.csv',
    'lrn,first_name,middle_name,last_name,grade_level,section,dob,gender,parent_email\n'
  );
});
document.getElementById('bulk-account-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('bulk-account-error');
  try {
    const data = await submitBulkImport({
      url: `${API_URL}/admin/accounts/bulk`,
      fileInput: document.getElementById('bulk-account-file'),
      errorEl,
      resultEl: document.getElementById('bulk-account-result'),
      noun: 'account(s) added',
      refresh: () => loadAccountsTable()
    });
    finishBulkImport('bulk-account-modal', data, 'account(s) added');
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message;
  }
});
document.getElementById('bulk-student-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('bulk-student-error');
  try {
    const data = await submitBulkImport({
      url: `${API_URL}/admin/students/bulk`,
      fileInput: document.getElementById('bulk-student-file'),
      errorEl,
      resultEl: document.getElementById('bulk-student-result'),
      noun: 'student(s) enrolled',
      refresh: () => loadStudentsTable()
    });
    const mailFailed = Array.isArray(data?.mail_failed) ? data.mail_failed : [];
    if (!mailFailed.length) finishBulkImport('bulk-student-modal', data, 'student(s) enrolled');
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message;
  }
});
wireAdminModal('add-subject-modal', 'open-add-subject-modal');
wireAdminModal('compose-announcement-modal', 'open-compose-announcement-modal');
wireSimpleModal('teacher-add-student-modal');
wireSimpleModal('progress-create-modal');
wireSimpleModal('teacher-notice-modal');
wireSimpleModal('upload-material-modal');
wireSimpleModal('ai-generate-count-modal');
wireSimpleModal('qb-exam-modal');
wireSimpleModal('parent-concern-modal');
wireSimpleModal('progress-makeup-modal');
wireSimpleModal('progress-activity-work-modal');
wireSimpleModal('transfer-teacher-modal');

document.getElementById('parent-concern-form')?.addEventListener('submit', submitParentConcern);
document.getElementById('concern-student')?.addEventListener('change', (e) => {
  const studentId = e.target.value;
  const selected = (parentAllChildren || []).find((c) => String(c.id) === String(studentId));
  if (selected) parentCurrentChild = selected;
  loadContactTeachers(studentId);
});

document.getElementById('open-upload-material-modal')?.addEventListener('click', async () => {
  await ensureTeacherAssignedClasses();
  await loadTeacherSubjects(true);
  fillLessonPlanGradeOptions();
  fillTeacherSubjectSelects();
  const msg = document.getElementById('lp-message');
  if (msg) msg.textContent = '';
  const form = document.getElementById('upload-material-form');
  form?.reset();
  fillLessonPlanGradeOptions();
  fillTeacherSubjectSelects();
  await fillLessonPlanQuarterOptions();
  const prefillId = materialsSubjectIdFromKey(materialsCurrentSubjectKey);
  const subjectSel = document.getElementById('lp-subject');
  if (prefillId && subjectSel && [...subjectSel.options].some((o) => o.value === String(prefillId))) {
    subjectSel.value = String(prefillId);
  }
  const modal = document.getElementById('upload-material-modal');
  if (modal) {
    modal.hidden = false;
    modal.removeAttribute('hidden');
  }
});

document.getElementById('open-teacher-notice-modal')?.addEventListener('click', async () => {
  await ensureTeacherAssignedClasses();
  fillTeacherNoticeClasses();
  const msgEl = document.getElementById('teacher-notice-msg');
  if (msgEl) msgEl.textContent = '';
  const modal = document.getElementById('teacher-notice-modal');
  if (modal) {
    modal.hidden = false;
    modal.removeAttribute('hidden');
  }
});

document.getElementById('open-add-student-modal')?.addEventListener('click', () => loadDropdowns());
document.getElementById('open-compose-announcement-modal')?.addEventListener('click', () => updateAnnouncementScopeFields());


let parentInboxFilter = 'unresolved';
let parentInboxSearchQuery = '';
let parentExpandedInboxKey = null;
let parentExpandedConcernId = null;
let parentInboxCache = { announcements: [], messages: [], concerns: [], trash: { announcements: [], concerns: [], messages: [] } };

function parentSelectedChildId() {
  return parentCurrentChild?.id != null ? Number(parentCurrentChild.id) : null;
}

function noticeBelongsToSelectedChild(m) {
  const sid = parentSelectedChildId();
  if (sid == null) return true;
  if (m.student_id == null || m.student_id === '') return true;
  return Number(m.student_id) === sid;
}

function announcementBelongsToSelectedChild(a) {
  const child = parentCurrentChild;
  if (!child) return true;
  const scope = String(a.scope || '');
  if (!scope || scope === 'school_wide') return true;
  if (scope === 'grade_wide') return Number(a.target_grade) === Number(child.grade_level);
  if (scope === 'class_specific') {
    return Number(a.target_grade) === Number(child.grade_level)
      && String(a.target_section || '').trim().toUpperCase() === String(child.section || '').trim().toUpperCase();
  }
  return true;
}

function paintParentInboxList() {
  const contentEl = document.getElementById('parent-content');
  if (!contentEl) return;

  const announcements = (parentInboxCache.announcements || []).filter(announcementBelongsToSelectedChild);
  const notices = (parentInboxCache.messages || []).filter(noticeBelongsToSelectedChild);
  const concerns = (parentInboxCache.concerns || []).filter((c) => {
    const sid = parentSelectedChildId();
    if (sid == null) return true;
    return Number(c.student_id) === sid;
  });
  const isAdminAnnouncement = (a) => String(a.sender_role || 'admin') !== 'teacher';
  const filter = parentInboxFilter || 'unresolved';
  const q = parentInboxSearchQuery;

  const unreadAnn = announcements.filter((a) => isUnread(a)).length;
  const unreadMsg = notices.filter((m) => m.is_read === 0 || m.is_read === false).length;
  const openConcerns = concerns.filter((c) => concernIsOpen(c)).length;
  // Dot = unresolved concerns OR unread admin/teacher items
  const badgeCount = openConcerns + unreadAnn + unreadMsg;

  document.querySelectorAll('[data-parent-inbox-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.parentInboxFilter === filter);
  });

  setInboxFilterCounts(
    document.querySelectorAll('[data-parent-inbox-filter]'),
    {
      unresolved: concerns.filter((c) => concernIsOpen(c)).length,
      // resolved: no count
      admin: announcements.filter((a) => isAdminAnnouncement(a) && isUnread(a)).length,
      teacher:
        notices.filter((m) => m.is_read === 0 || m.is_read === false).length +
        announcements.filter((a) => !isAdminAnnouncement(a) && isUnread(a)).length
    },
    'data-parent-inbox-filter'
  );

  let html = '';
  let emptyLabel = 'messages';

  if (filter === 'trash') {
    const trash = parentInboxCache.trash || {};
    const rows = [
      ...(trash.concerns || []).map((c) => ({ kind: 'concern', t: new Date(c.trashed_at || c.created_at || 0).getTime(), c })),
      ...(trash.announcements || []).map((a) => ({ kind: 'ann', t: new Date(a.trashed_at || a.created_at || 0).getTime(), a })),
      ...(trash.messages || []).map((m) => ({ kind: 'msg', t: new Date(m.trashed_at || m.created_at || 0).getTime(), m }))
    ].sort((x, y) => y.t - x.t);
    const shown = rows.filter((row) => {
      if (row.kind === 'concern') return matchesInboxSearch(row.c, q);
      if (row.kind === 'msg') return matchesInboxSearch({ ...row.m, title: row.m.subject, body: row.m.message }, q);
      return matchesInboxSearch(row.a, q);
    });
    emptyLabel = String(q || '').trim() ? 'matches' : 'items in trash';
    html = shown.map((row) => {
      if (row.kind === 'concern') {
        return renderMailConcernRow(row.c, {
          expandedId: parentExpandedConcernId,
          toggleFn: 'toggleParentConcern',
          badgeLabel: row.c.teacher_name || 'Teacher',
          metaLine: `Student: ${escapeHtml(row.c.student_name || 'N/A')}`,
          canReply: false,
          extraActionsHtml: inboxRestoreAction('concern', row.c.id)
        });
      }
      if (row.kind === 'msg') {
        const m = row.m;
        const key = `msg-${m.id}`;
        const item = { ...m, title: m.subject, body: m.message, is_read: 1 };
        return renderMailAnnouncementRow(item, {
          expanded: parentExpandedInboxKey === key,
          onToggle: `toggleParentInboxItem('${key}')`,
          badgeLabel: 'Teacher notice',
          badgeColor: 'var(--orange)',
          metaLine: `From: ${escapeHtml(m.sender_name || 'Teacher')}`,
          actionsHtml: inboxRestoreAction('message', m.id)
        });
      }
      const a = row.a;
      const key = `ann-${a.id}`;
      const fromTeacher = String(a.sender_role || 'admin') === 'teacher';
      return renderMailAnnouncementRow(a, {
        expanded: parentExpandedInboxKey === key,
        onToggle: `toggleParentInboxItem('${key}')`,
        badgeLabel: fromTeacher ? 'Class notice' : '',
        showTypeBadge: fromTeacher,
        badgeColor: 'var(--orange)',
        metaLine: `From: ${escapeHtml(a.sender_name || 'Admin')}`,
        actionsHtml: inboxRestoreAction('announcement', a.id)
      });
    }).join('');
  } else if (filter === 'unresolved' || filter === 'resolved') {
    let items = concerns.filter((c) =>
      filter === 'resolved' ? !concernIsOpen(c) : concernIsOpen(c)
    );
    items.sort((a, b) => concernActivityTime(b) - concernActivityTime(a));
    items = items.filter((c) => matchesInboxSearch(c, q));
    emptyLabel = String(q || '').trim()
      ? 'matches'
      : filter === 'resolved' ? 'resolved concerns' : 'unresolved concerns';
    html = items.map((c) => renderMailConcernRow(c, {
      expandedId: parentExpandedConcernId,
      toggleFn: 'toggleParentConcern',
      badgeLabel: c.teacher_name || 'Teacher',
      metaLine: `Student: ${escapeHtml(c.student_name || 'N/A')}`,
      canReply: true,
      extraActionsHtml: inboxDeleteAction('concern', c.id)
    })).join('');
  } else if (filter === 'admin') {
    let shownAnn = announcements.filter(isAdminAnnouncement);
    shownAnn = shownAnn.filter((a) => matchesInboxSearch(a, q));
    shownAnn.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    emptyLabel = String(q || '').trim() ? 'matches' : 'admin announcements';
    html = shownAnn.map((a) => {
      const key = `ann-${a.id}`;
      const unread = isUnread(a);
      return renderMailAnnouncementRow(a, {
        expanded: parentExpandedInboxKey === key,
        onToggle: `toggleParentInboxItem('${key}')`,
        showTypeBadge: false,
        metaLine: `From: ${escapeHtml(a.sender_name || 'Admin')} | ${escapeHtml(announcementMeta(a))}`,
        actionsHtml: `<button type="button" class="chip-ghost announcement-read-btn ${unread ? 'primary' : ''}" onclick="toggleAnnouncementRead(${a.id}, ${!unread})">${unread ? 'Mark as Read' : 'Mark as Unread'}</button>${inboxDeleteAction('announcement', a.id)}`
      });
    }).join('');
  } else {
    // teacher notices + teacher-sent announcements (newest first, interleaved)
    let shownAnn = announcements.filter((a) => !isAdminAnnouncement(a));
    let shownNotices = [...notices];
    shownAnn = shownAnn.filter((a) => matchesInboxSearch(a, q));
    shownNotices = shownNotices.filter((m) => matchesInboxSearch({
      ...m,
      title: m.subject,
      body: m.message
    }, q));
    emptyLabel = String(q || '').trim() ? 'matches' : 'teacher notices';

    const merged = [
      ...shownNotices.map((m) => ({
        kind: 'msg',
        t: new Date(m.created_at || 0).getTime() || 0,
        m
      })),
      ...shownAnn.map((a) => ({
        kind: 'ann',
        t: new Date(a.created_at || 0).getTime() || 0,
        a
      }))
    ].sort((x, y) => y.t - x.t);

    html = merged.map((row) => {
      if (row.kind === 'msg') {
        const m = row.m;
        const key = `msg-${m.id}`;
        const unread = m.is_read === 0 || m.is_read === false;
        const item = { ...m, title: m.subject, body: m.message, is_read: unread ? 0 : 1 };
        return renderMailAnnouncementRow(item, {
          expanded: parentExpandedInboxKey === key,
          onToggle: `toggleParentInboxItem('${key}')`,
          badgeLabel: 'Teacher notice',
          badgeColor: 'var(--orange)',
          metaLine: `From: ${escapeHtml(m.sender_name || 'Teacher')}${m.student_name ? ` · Student: ${escapeHtml(m.student_name)}` : ''}`,
          actionsHtml: `<button type="button" class="chip-ghost ${unread ? 'primary' : ''}" onclick="toggleParentMessageRead(${m.id}, ${unread})">${unread ? 'Mark as Read' : 'Mark as Unread'}</button>${inboxDeleteAction('message', m.id)}`
        });
      }
      const a = row.a;
      const key = `ann-${a.id}`;
      const unread = isUnread(a);
      return renderMailAnnouncementRow(a, {
        expanded: parentExpandedInboxKey === key,
        onToggle: `toggleParentInboxItem('${key}')`,
        badgeLabel: 'Class notice',
        badgeColor: 'var(--orange)',
        metaLine: `From: ${escapeHtml(a.sender_name || 'Teacher')} | ${escapeHtml(announcementMeta(a))}`,
        actionsHtml: `<button type="button" class="chip-ghost announcement-read-btn ${unread ? 'primary' : ''}" onclick="toggleAnnouncementRead(${a.id}, ${!unread})">${unread ? 'Mark as Read' : 'Mark as Unread'}</button>${inboxDeleteAction('announcement', a.id)}`
      });
    }).join('');
  }

  const unreadAdmin = announcements.filter((a) => isAdminAnnouncement(a) && isUnread(a)).length;
  const unreadTeacher = notices.filter((m) => m.is_read === 0 || m.is_read === false).length
    + announcements.filter((a) => !isAdminAnnouncement(a) && isUnread(a)).length;
  const markCount = filter === 'admin' ? unreadAdmin : filter === 'teacher' ? unreadTeacher : 0;
  const markAllBtn = markCount > 0 && !String(q || '').trim()
    ? `<div style="margin-bottom:10px;"><button class="chip-ghost primary" onclick="markAllAnnouncementsRead()">Mark All as Read (${markCount})</button></div>`
    : '';
  const trashCount = ((parentInboxCache.trash || {}).concerns || []).length
    + ((parentInboxCache.trash || {}).announcements || []).length
    + ((parentInboxCache.trash || {}).messages || []).length;
  const emptyTrashBtn = filter === 'trash' && trashCount > 0 && !String(q || '').trim()
    ? `<div style="margin-bottom:10px;"><button type="button" class="chip-ghost" style="color:#b71c1c;border-color:#b71c1c;" onclick="emptyInboxTrash()">Empty Trash</button></div>`
    : '';

  const listHost = contentEl.querySelector('#parent-inbox-list');
  const markAllHost = contentEl.querySelector('#parent-inbox-markall');
  if (markAllHost) markAllHost.innerHTML = markAllBtn + emptyTrashBtn;
  if (listHost) {
    listHost.innerHTML = html || `<li class="empty-state"><p>No ${emptyLabel}</p></li>`;
  }

  const badgeEl = document.getElementById('parent-inbox-badge');
  setInboxDotBadge(badgeEl, badgeCount, 'inbox items needing attention');
}

async function renderParentInbox() {
  const contentEl = document.getElementById('parent-content');
  if (!contentEl) return;

  if (parentInboxFilter === 'all' || parentInboxFilter === 'contact') {
    parentInboxFilter = 'unresolved';
  }

  try {
    const [inboxRes, concernsRes, trashRes] = await Promise.all([
      fetch(`${API_URL}/parent/inbox`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/parent/concerns`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/inbox/trash`, { headers: getAuthHeaders() })
    ]);
    const inboxData = await inboxRes.json();
    const concernsData = await concernsRes.json();
    const trashData = await trashRes.json().catch(() => ({}));
    if (!inboxRes.ok) throw new Error(inboxData.error);
    if (!concernsRes.ok) throw new Error(concernsData.error);

    parentInboxCache = {
      announcements: Array.isArray(inboxData.announcements) ? inboxData.announcements : [],
      messages: Array.isArray(inboxData.messages) ? inboxData.messages : [],
      concerns: Array.isArray(concernsData) ? concernsData : [],
      trash: {
        announcements: Array.isArray(trashData.announcements) ? trashData.announcements : [],
        concerns: Array.isArray(trashData.concerns) ? trashData.concerns : [],
        messages: Array.isArray(trashData.messages) ? trashData.messages : []
      }
    };
    parentConcernsCache = parentInboxCache.concerns;

    if (parentExpandedConcernId) {
      const still = parentInboxCache.concerns.some((c) => Number(c.id) === Number(parentExpandedConcernId));
      if (!still) parentExpandedConcernId = null;
    }

    const filter = parentInboxFilter || 'unresolved';
    contentEl.innerHTML = `
      <div class="parent-main">
        <div class="chart-card">
          <div class="teacher-header-row">
            <div>
              <h3 class="page-heading font-heading">Inbox</h3>
              <p class="page-subheading">Concerns, teacher notices, and school announcements.</p>
            </div>
            <button type="button" class="btn-toolbar btn-toolbar--solid" id="open-parent-concern-modal">+ Send Concern</button>
          </div>
          <div class="inbox-filters">
            <button type="button" class="${filter === 'unresolved' ? 'active' : ''}" data-parent-inbox-filter="unresolved">Unresolved</button>
            <button type="button" class="${filter === 'resolved' ? 'active' : ''}" data-parent-inbox-filter="resolved">Resolved</button>
            <button type="button" class="${filter === 'admin' ? 'active' : ''}" data-parent-inbox-filter="admin">Admin</button>
            <button type="button" class="${filter === 'teacher' ? 'active' : ''}" data-parent-inbox-filter="teacher">Teacher</button>
            <button type="button" class="inbox-filter-trash ${filter === 'trash' ? 'active' : ''}" data-parent-inbox-filter="trash">Trash</button>
          </div>
          <div class="inbox-search-bar">
            <input type="search" id="parent-inbox-search" class="inbox-search-input" placeholder="Search messages…" value="${escapeHtml(parentInboxSearchQuery)}" autocomplete="off" />
            <button type="button" class="inbox-search-clear" id="parent-inbox-search-clear" title="Clear search" ${String(parentInboxSearchQuery || '').trim() ? '' : 'hidden'}>×</button>
          </div>
          <div id="parent-inbox-markall"></div>
          <ul id="parent-inbox-list" class="inbox-list" style="list-style:none;padding:0;margin:0;"></ul>
        </div>
      </div>
    `;

    contentEl.querySelectorAll('[data-parent-inbox-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        parentInboxFilter = btn.dataset.parentInboxFilter;
        parentExpandedInboxKey = null;
        parentExpandedConcernId = null;
        paintParentInboxList();
      });
    });

    document.getElementById('open-parent-concern-modal')?.addEventListener('click', () => openParentConcernModal());

    const searchInput = document.getElementById('parent-inbox-search');
    if (searchInput) searchInput.dataset.searchWired = '';
    wireInboxSearch({
      inputId: 'parent-inbox-search',
      clearId: 'parent-inbox-search-clear',
      getValue: () => parentInboxSearchQuery,
      setValue: (v) => { parentInboxSearchQuery = v; },
      onChange: () => paintParentInboxList()
    });

    paintParentInboxList();
  } catch (err) {
    console.error('Load parent inbox error:', err);
    contentEl.innerHTML = `<div class="parent-main"><div class="chart-card"><p style="color:#b71c1c;">Failed to load inbox</p></div></div>`;
  }
}

window.toggleParentInboxItem = async function(key) {
  if (!key) return;
  if (parentExpandedInboxKey === key) {
    parentExpandedInboxKey = null;
  } else {
    parentExpandedInboxKey = key;
    parentExpandedConcernId = null;
    if (String(key).startsWith('msg-')) {
      const id = Number(String(key).slice(4));
      if (id) {
        try {
          await fetch(`${API_URL}/parent/messages/${id}/read`, {
            method: 'POST',
            headers: getAuthHeaders()
          });
          const msg = parentInboxCache.messages.find((m) => Number(m.id) === id);
          if (msg) msg.is_read = 1;
        } catch (_) { /* ignore */ }
      }
    } else if (String(key).startsWith('ann-')) {
      const id = Number(String(key).slice(4));
      if (id) {
        try {
          await fetch(`${API_URL}/admin/announcements/${id}/read`, {
            method: 'POST',
            headers: getAuthHeaders()
          });
          const ann = parentInboxCache.announcements.find((a) => Number(a.id) === id);
          if (ann) ann.is_read = 1;
        } catch (_) { /* ignore */ }
      }
    }
  }
  paintParentInboxList();
};

// ========== TEACHER PANEL SWITCHING ==========
const teacherTabHistory = [];
let isTeacherNavigatingBack = false;
const teacherBackBtn = document.getElementById('teacher-back-btn');
const TEACHER_PANEL_TITLES = {
  classroom: 'Teacher Portal',
  'attendance-sheet': 'Attendance Sheet',
  progress: 'Records',
  'lesson-plans': 'Materials',
  'quiz-bank': 'Classwork',
  inbox: 'Inbox'
};

function updateTeacherBackButton() {
  if (teacherBackBtn) {
    teacherBackBtn.style.display = teacherTabHistory.length > 0 ? 'inline-flex' : 'none';
  }
}

function applyTeacherPanel(panelId) {
  document.querySelectorAll('[data-teacher-panel]').forEach(b => {
    b.classList.toggle('active', b.dataset.teacherPanel === panelId);
  });

  document.querySelectorAll('.teacher-panel').forEach(panel => {
    panel.hidden = panel.id !== `teacher-panel-${panelId}`;
  });

  const classroomSidebar = document.getElementById('teacher-sidebar-classroom');
  // Keep school year + My Classes visible on all teacher panels
  classroomSidebar?.classList.remove('is-hidden');

  const titleEl = document.getElementById('teacher-topbar-title');
  if (titleEl) titleEl.textContent = TEACHER_PANEL_TITLES[panelId] || 'Teacher Portal';

  if (panelId === 'inbox') {
    loadTeacherInbox('unresolved');
    fillTeacherNoticeClasses();
  }
  if (panelId === 'lesson-plans') {
    loadTeacherSubjects();
    ensureTeacherAssignedClasses().then(() => fillLessonPlanGradeOptions());
    loadMaterialsHub();
    loadAiStatusHint();
  }
  if (panelId === 'quiz-bank') {
    Promise.all([ensureTeacherAssignedClasses(), loadTeacherSubjects()]).then(() => {
      fillQuizBankGradeFilter();
      fillQuizBankSubjectFilter();
      loadQuestionBank();
    });
  }
  if (panelId === 'attendance-sheet') {
    if (!attendanceSheetWeekStart) {
      attendanceSheetWeekStart = weekStartMondayClient(localISODate());
    }
    loadAttendanceSheet();
    if (teacherCurrentClass?.grade && teacherCurrentClass?.section) {
      syncClassroomAttendanceChrome();
      loadRoster(teacherCurrentClass.grade, teacherCurrentClass.section);
      refreshClassroomAttendanceStatus();
    }
  }
  if (panelId === 'classroom') {
    loadTeacherTodayInbox();
    if (teacherCurrentClass?.grade && teacherCurrentClass?.section) {
      syncClassroomAttendanceChrome();
      Promise.all([
        loadClassStats(teacherCurrentClass.grade, teacherCurrentClass.section),
        loadRoster(teacherCurrentClass.grade, teacherCurrentClass.section),
        loadTeacherClassProgress(teacherCurrentClass.grade, teacherCurrentClass.section)
      ]);
    }
  }
  if (panelId === 'progress') {
    applyQuarterUnlockUI();
    loadTeacherSubjects();
    loadProgressList();
    const progressMeta = document.getElementById('progress-class-meta');
    if (progressMeta && teacherCurrentClass) {
      progressMeta.textContent = progressSubjectFilter
        ? `Grade ${teacherCurrentClass.grade} – ${teacherCurrentClass.section} · ${progressSubjectFilter} · ${teacherCurrentQuarter}`
        : `Grade ${teacherCurrentClass.grade} – ${teacherCurrentClass.section} · ${teacherCurrentQuarter} · Quizzes, activities, and exams for this class.`;
    }
  }
}

if (teacherBackBtn) {
  teacherBackBtn.addEventListener('click', () => {
    if (teacherTabHistory.length > 0) {
      isTeacherNavigatingBack = true;
      const prevPanel = teacherTabHistory.pop();
      applyTeacherPanel(prevPanel);
        updateTeacherBackButton();
      isTeacherNavigatingBack = false;
    }
  });
}

document.querySelectorAll('[data-teacher-panel]').forEach(btn => {
  btn.addEventListener('click', () => {
    const currentPanel = document.querySelector('[data-teacher-panel].active')?.dataset.teacherPanel;
    const panelId = btn.dataset.teacherPanel;

    if (!isTeacherNavigatingBack && currentPanel && currentPanel !== panelId) {
      resetTeacherPanelState(currentPanel);
      teacherTabHistory.push(currentPanel);
      updateTeacherBackButton();
    }
    isTeacherNavigatingBack = false;

    applyTeacherPanel(panelId);
    scrollPortalMain('view-teacher');
    closeMobileNav();
  });
});

function closeMobileNav(frame) {
  const frames = frame
    ? [frame]
    : document.querySelectorAll('.dash-frame.is-mobile-nav-open');
  frames.forEach((f) => {
    f.classList.remove('is-mobile-nav-open');
    const backdrop = f.querySelector('[data-mobile-backdrop]');
    if (backdrop) backdrop.hidden = true;
  });
}

function openMobileNav(frame) {
  if (!frame) return;
  frame.classList.add('is-mobile-nav-open');
  const backdrop = frame.querySelector('[data-mobile-backdrop]');
  if (backdrop) backdrop.hidden = false;
}

document.querySelectorAll('.mobile-nav-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const portal = btn.dataset.mobileNav;
    const frame = document.querySelector(`.dash-frame[data-portal="${portal}"]`)
      || btn.closest('.dash-frame');
    if (!frame) return;
    if (frame.classList.contains('is-mobile-nav-open')) closeMobileNav(frame);
    else openMobileNav(frame);
  });
});

document.querySelectorAll('[data-mobile-backdrop]').forEach((el) => {
  el.addEventListener('click', () => {
    closeMobileNav(el.closest('.dash-frame'));
  });
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) closeMobileNav();
});

(function syncConnectedLayoutMode() {
  const mq = window.matchMedia('(max-width: 900px)');
  const apply = () => {
    const mobile = mq.matches;
    document.documentElement.classList.toggle('layout-mobile', mobile);
    document.documentElement.classList.toggle('layout-desktop', !mobile);
    document.body?.classList.toggle('layout-mobile', mobile);
    document.body?.classList.toggle('layout-desktop', !mobile);
  };
  apply();
  if (mq.addEventListener) mq.addEventListener('change', apply);
  else if (mq.addListener) mq.addListener(apply);
})();

// Teacher inbox filter buttons
document.querySelectorAll('[data-inbox-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    teacherExpandedConcernId = null;
    teacherExpandedAnnouncementId = null;
    loadTeacherInbox(btn.dataset.inboxFilter);
  });
});

document.querySelectorAll('[data-admin-inbox-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    adminExpandedConcernId = null;
    loadAdminInbox(btn.dataset.adminInboxFilter);
  });
});

document.getElementById('teacher-inbox-list')?.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('[data-action="toggle-concern"]');
  if (!toggleBtn) return;
  e.preventDefault();
  toggleTeacherConcern(toggleBtn.dataset.concernId);
});

// ========== TEACHER CLASSROOM ==========
let teacherCurrentClass = null;
let teacherAssignedClasses = [];
let rosterData = [];
let attendanceSheetData = [];
let attendanceSheetWeekStart = '';
let attendanceSheetRange = 'week';
let attendanceSheetAnchor = '';
let attendanceCurrentSession = currentManilaSessionClient();

function currentManilaSessionClient() {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    hourCycle: 'h23'
  }).format(new Date());
  const hour = Number(String(hourStr).replace(/\D/g, ''));
  return hour < 12 ? 'AM' : 'PM';
}

function isSubjectAttendanceGrade(grade) {
  return Number(grade) >= 4;
}

function weekStartMondayClient(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

function addDaysISOClient(isoDate, days) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function formatAttendanceShortDate(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y || !m || !d) return String(isoDate || '');
  const yy = String(y).slice(-2);
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${yy}`;
}

function formatWeekLabel(weekStart, weekEnd) {
  const end = weekEnd || addDaysISOClient(weekStart, 4);
  return `${formatAttendanceShortDate(weekStart)} – ${formatAttendanceShortDate(end)}`;
}

function attendanceQueryParams() {
  const params = new URLSearchParams();
  if (!teacherCurrentClass) return params;
  if (isSubjectAttendanceGrade(teacherCurrentClass.grade) && teacherCurrentClass.subjectId) {
    params.set('subject_id', String(teacherCurrentClass.subjectId));
  } else {
    params.set('session', attendanceCurrentSession || 'AM');
  }
  return params;
}

function syncClassroomAttendanceChrome() {
  const bar = document.getElementById('attendance-session-bar');
  const hint = document.getElementById('classroom-roster-hint');
  const sessionHint = document.getElementById('attendance-session-hint');
  if (!teacherCurrentClass) {
    if (bar) bar.hidden = true;
    return;
  }
  const subjectMode = isSubjectAttendanceGrade(teacherCurrentClass.grade);
  if (subjectMode) {
    if (bar) bar.hidden = true;
    if (hint) {
      hint.textContent = teacherCurrentClass.subjectName
        ? `Grades 4–6: mark attendance for ${teacherCurrentClass.subjectName} before class starts (P / A / L / E).`
        : 'Grades 4–6: open a subject from My Classes to take attendance before class starts.';
    }
  } else {
    const openSession = currentManilaSessionClient();
    attendanceCurrentSession = openSession;
    if (bar) bar.hidden = false;
    document.querySelectorAll('.session-chip').forEach((chip) => {
      const open = chip.dataset.session === openSession;
      chip.classList.toggle('active', open);
      chip.disabled = !open;
      chip.title = open ? '' : (openSession === 'AM'
        ? 'Afternoon attendance starts at 12:00.'
        : 'Morning attendance is closed after 12:00.');
    });
    if (hint) {
      hint.textContent = openSession === 'AM'
        ? 'Morning attendance is open. Click P, A, L, or E. Afternoon attendance starts at 12:00.'
        : 'Afternoon attendance is open. Click P, A, L, or E. Morning attendance is closed after 12:00.';
    }
    if (sessionHint) {
      sessionHint.textContent = 'Grades 1–3: class-wide morning and afternoon attendance.';
    }
  }
}

let teacherSubjectsLoaded = false;
let teacherSubjectsCache = [];
let teacherCurrentQuarter = 'Q1';
let progressAssessments = [];
let progressEditorMax = 100;
let progressTypeFilter = 'all';
let progressSubjectFilter = null; // subject name string or null for all

function scorePercentDisplay(score, max = progressEditorMax) {
  const m = Number(max);
  const n = Number(score);
  if (!Number.isFinite(n) || !Number.isFinite(m) || m <= 0) return '—';
  return `${Math.min(100, Math.max(0, Math.round((n / m) * 100)))}%`;
}

function rejectNegativeScoreInput(input) {
  if (!input || input.readOnly || input.disabled) return false;
  const raw = String(input.value);
  if (raw === '' || !raw.includes('-')) return false;
  input.value = '';
  if (input.dataset.negToast !== '1') {
    input.dataset.negToast = '1';
    showToast("Scores can't be negative.", 'error');
  }
  return true;
}

function clampProgressTotalInput(input) {
  if (!input || input.readOnly || input.value === '') return;
  if (rejectNegativeScoreInput(input)) {
    const cell = input.closest('tr')?.querySelector('.progress-pct-cell');
    if (cell) cell.textContent = '—';
    return;
  }
  const n = Number(input.value);
  if (!Number.isFinite(n)) return;
  input.dataset.negToast = '';
  const max = Number(progressEditorMax);
  let next = n;
  if (Number.isFinite(max) && n > max) {
    next = max;
    if (input.dataset.overToast !== '1') {
      input.dataset.overToast = '1';
      showToast(`Score can't exceed ${max}.`, 'error');
    }
  } else {
    input.dataset.overToast = '';
  }
  if (String(next) !== String(input.value)) input.value = String(next);
  const cell = input.closest('tr')?.querySelector('.progress-pct-cell');
  if (cell) cell.textContent = scorePercentDisplay(next, max);
}

function typeLabel(type) {
  if (type === 'quiz') return 'Quiz';
  if (type === 'activity') return 'Activity';
  if (type === 'exam') return 'Exam';
  return type || 'Record';
}

function bankItemTypeLabelClient(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'mcq') return 'Multiple choice';
  if (t === 'true_false') return 'True or False';
  if (t === 'fill_blank') return 'Fill in the blank';
  if (t === 'matching') return 'Matching';
  if (t === 'sequencing') return 'Sequencing';
  if (t === 'identification') return 'Identification';
  if (t === 'enumeration') return 'Enumeration';
  if (t === 'short_answer') return 'Short answer';
  if (t === 'activity' || t === 'activity_prompt') return 'Activity';
  return type ? String(type) : 'Multiple choice';
}

const BANK_TYPE_ORDER = [
  'mcq', 'true_false', 'fill_blank', 'matching', 'sequencing',
  'identification', 'enumeration', 'short_answer', 'activity'
];

function isActivityItemType(type) {
  const t = String(type || '').toLowerCase();
  return t === 'activity' || t === 'activity_prompt';
}

function canonicalBankItemType(type) {
  return isActivityItemType(type) ? 'activity' : String(type || 'mcq').toLowerCase();
}

function mcqLetterAt(index) {
  let n = Number(index);
  if (!Number.isFinite(n) || n < 0) n = 0;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function mcqIndexFromToken(token) {
  const t = String(token || '').trim();
  if (!t) return -1;
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (n >= 1) return n - 1;
    if (n === 0) return 0;
    return -1;
  }
  if (!/^[A-Za-z]+$/.test(t)) return -1;
  const u = t.toUpperCase();
  let n = 0;
  for (let i = 0; i < u.length; i++) n = n * 26 + (u.charCodeAt(i) - 64);
  return n - 1;
}

function stripMcqChoicePrefix(text) {
  return String(text || '').replace(/^\s*(?:[A-Za-z]+|\d+)\s*[.)]\s+/, '').trimEnd();
}

function formatMcqAnswerDisplay(answer, choices) {
  const raw = String(answer || '').trim();
  if (!raw) return '';
  const list = Array.isArray(choices) ? choices : [];
  const idxFromToken = mcqIndexFromToken(raw);
  if (idxFromToken >= 0 && idxFromToken < Math.max(list.length, idxFromToken + 1)) {
    return mcqLetterAt(idxFromToken);
  }
  const idxFromText = list.findIndex(
    (c) => stripMcqChoicePrefix(c).trim().toLowerCase() === raw.toLowerCase()
      || String(c).trim().toLowerCase() === raw.toLowerCase()
  );
  if (idxFromText >= 0) return mcqLetterAt(idxFromText);
  return raw.toUpperCase();
}

function quizTakenChoiceIndex(raw, choices) {
  const text = String(raw || '').trim();
  const list = Array.isArray(choices) ? choices : [];
  if (!text || !list.length) return -1;
  const idxFromToken = mcqIndexFromToken(text);
  if (idxFromToken >= 0 && idxFromToken < list.length) return idxFromToken;
  return list.findIndex((c) => {
    const want = text.toLowerCase();
    return stripMcqChoicePrefix(c).trim().toLowerCase() === want
      || String(c).trim().toLowerCase() === want;
  });
}

function formatQuizTakenAnswer(raw, choices) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const list = Array.isArray(choices) ? choices : [];
  const idx = quizTakenChoiceIndex(text, list);
  if (idx < 0) return text;
  const body = stripMcqChoicePrefix(list[idx]) || String(list[idx] || '');
  return `${mcqLetterAt(idx)}. ${body}`;
}

function rubricCategoriesOf(rubric) {
  if (!rubric || typeof rubric !== 'object') return [];
  if (Array.isArray(rubric.categories) && rubric.categories.length) return rubric.categories;
  if (Array.isArray(rubric.criteria) && rubric.criteria.length) return rubric.criteria;
  return [];
}

function groupBankItemsByType(items) {
  const map = new Map();
  for (const item of items || []) {
    const key = String(item.item_type || 'mcq');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  const ordered = [];
  for (const key of BANK_TYPE_ORDER) {
    if (map.has(key)) {
      ordered.push({ item_type: key, label: bankItemTypeLabelClient(key), items: map.get(key) });
      map.delete(key);
    }
  }
  for (const [key, list] of map.entries()) {
    ordered.push({ item_type: key, label: bankItemTypeLabelClient(key), items: list });
  }
  return ordered;
}

function collectSectionTotalsFromWrap(wrapEl) {
  const out = {};
  if (!wrapEl) return out;
  wrapEl.querySelectorAll('input[data-section-type]').forEach((input) => {
    const key = input.dataset.sectionType;
    const n = Number(input.value);
    if (key && Number.isFinite(n) && n >= 0) out[key] = n;
  });
  return out;
}

function sumSectionTotals(sectionTotals) {
  return Object.values(sectionTotals || {}).reduce((s, n) => s + (Number(n) || 0), 0);
}

function renderScoreSections(wrapId, items, { syncMaxInputId = null, resetValues = true } = {}) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return {};
  const groups = groupBankItemsByType(items);
  if (!groups.length) {
    wrap.hidden = true;
    wrap.innerHTML = '';
    return {};
  }
  wrap.hidden = false;
  const prev = resetValues ? {} : collectSectionTotalsFromWrap(wrap);
  wrap.innerHTML = groups.map((g) => {
    const defaultPts = g.items.reduce((s, it) => s + (Number(it.points) || 1), 0);
    const val = prev[g.item_type] != null ? prev[g.item_type] : Math.round(defaultPts * 100) / 100;
    return `
      <div class="qb-score-section-row">
        <span>${escapeHtml(g.label)} · ${g.items.length} item(s)</span>
        <label>
          <span>Part total</span>
          <input type="number" min="0" max="9999" step="0.5" data-section-type="${escapeHtml(g.item_type)}" value="${val}" />
        </label>
      </div>`;
  }).join('');

  const syncMax = () => {
    const totals = collectSectionTotalsFromWrap(wrap);
    const sum = Math.round(sumSectionTotals(totals) * 100) / 100;
    if (syncMaxInputId) {
      const maxInput = document.getElementById(syncMaxInputId);
      if (maxInput) maxInput.value = String(Math.max(1, sum || 1));
    }
  };

  wrap.querySelectorAll('input[data-section-type]').forEach((input) => {
    input.addEventListener('input', syncMax);
    input.addEventListener('change', syncMax);
  });
  syncMax();
  return collectSectionTotalsFromWrap(wrap);
}

function normalizeClassSubjects(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    if (s && typeof s === 'object') {
      return { id: s.id, name: s.name || s.subject_name || '' };
    }
    return { id: null, name: String(s || '') };
  }).filter(s => s.name);
}

function goToTeacherPanel(panelId) {
  const currentPanel = document.querySelector('[data-teacher-panel].active')?.dataset.teacherPanel;
  if (currentPanel && currentPanel !== panelId) {
    teacherTabHistory.push(currentPanel);
    updateTeacherBackButton();
  }
  applyTeacherPanel(panelId);
}

function setMyClassesTriggerLabel(grade, section, subjectName) {
  const el = document.getElementById('my-classes-current');
  if (!el) return;
  if (!grade || !section) {
    el.textContent = 'Choose a class';
    return;
  }
  el.textContent = subjectName
    ? `Grade ${grade} – ${section} · ${subjectName}`
    : `Grade ${grade} – ${section}`;
}

function renderTeacherClassNav(classes) {
  const listEl = document.getElementById('teacher-class-list');
  if (!listEl) return;

  listEl.innerHTML = classes.map((c, i) => {
    const subjects = normalizeClassSubjects(c.subjects);
    const subjectsHtml = subjects.length
      ? subjects.map(s => `
          <button type="button" class="class-nav-subject"
            data-grade="${c.grade_level}"
            data-section="${c.section}"
            data-subject-id="${s.id || ''}"
            data-subject-name="${String(s.name).replace(/"/g, '&quot;')}">
            ${s.name}
          </button>`).join('')
      : `<span class="class-nav-subject">${c.is_assistant ? 'Assistant teacher' : (c.is_class_adviser ? 'Class adviser' : 'No subjects listed')}</span>`;

    return `
      <div class="class-nav-group ${i === 0 ? 'is-expanded' : ''}" data-grade="${c.grade_level}" data-section="${c.section}">
        <button type="button" class="class-nav-item ${i === 0 ? 'active' : ''}"
          data-grade="${c.grade_level}"
          data-section="${c.section}"
          data-action="select-class">
          <span class="pill-icon">🏫</span>
          <span class="pill-class-main">Grade ${c.grade_level} – ${c.section}</span>
          <span class="class-nav-expand" aria-hidden="true">▾</span>
        </button>
        <div class="class-nav-subjects">${subjectsHtml}</div>
      </div>`;
  }).join('');
}

async function loadTeacherClasses() {
  const listEl = document.getElementById('teacher-class-list');
  if (!listEl) return;

  try {
    const res = await fetch(`${API_URL}/teacher/classes`, { headers: getAuthHeaders() });
    const classes = await res.json();
    if (!res.ok) throw new Error(classes.error);

    if (!classes.length) {
      teacherAssignedClasses = [];
      fillTeacherNoticeClasses();
      setMyClassesTriggerLabel();
      listEl.innerHTML = '<div class="class-nav-empty">No classes assigned</div>';
      return;
    }

    teacherAssignedClasses = classes;
    fillTeacherNoticeClasses();
    renderTeacherClassNav(classes);

    const first = classes[0];
    if (first) {
      await selectTeacherClassContext({
        grade: first.grade_level,
        section: first.section,
        subjectName: null,
        subjectId: null,
        goToPanel: null
      });
    }
  } catch (err) {
    console.error('Load classes error:', err);
    listEl.innerHTML = '<div class="class-nav-empty">Failed to load classes</div>';
  }
}

const myClassesTrigger = document.getElementById('my-classes-trigger');
const myClassesFlyout = document.getElementById('my-classes-flyout');
const myClassesPanel = document.getElementById('teacher-class-list');
if (myClassesTrigger && myClassesFlyout) {
  myClassesTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = myClassesFlyout.classList.toggle('is-open');
    myClassesTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  myClassesPanel?.addEventListener('click', async (e) => {
    const subjectBtn = e.target.closest('.class-nav-subject[data-subject-name]');
    const classBtn = e.target.closest('.class-nav-item[data-action="select-class"]');
    if (!subjectBtn && !classBtn) return;
    e.preventDefault();
    e.stopPropagation();

    // My Classes is a context picker — stay on the current tab
    if (subjectBtn) {
      await selectTeacherClassContext({
        grade: subjectBtn.dataset.grade,
        section: subjectBtn.dataset.section,
        subjectName: subjectBtn.dataset.subjectName || null,
        subjectId: subjectBtn.dataset.subjectId || null,
        goToPanel: null,
        expandGroup: true
      });
      return;
    }

    if (classBtn) {
      await selectTeacherClassContext({
        grade: classBtn.dataset.grade,
        section: classBtn.dataset.section,
        subjectName: null,
        subjectId: null,
        goToPanel: null,
        expandGroup: true
      });
    }
  });

  document.addEventListener('click', (e) => {
    if (!myClassesFlyout.contains(e.target)) {
      myClassesFlyout.classList.remove('is-open');
      myClassesTrigger.setAttribute('aria-expanded', 'false');
    }
  });
}

async function selectTeacherClassContext({
  grade,
  section,
  subjectName = null,
  subjectId = null,
  goToPanel = null,
  expandGroup = false
}) {
  if (!grade || !section) return;

  const classInfo = (teacherAssignedClasses || []).find(
    c => String(c.grade_level) === String(grade) && String(c.section) === String(section)
  );
  const subjects = normalizeClassSubjects(classInfo?.subjects);

  teacherCurrentClass = {
    grade,
    section,
    subjects,
    subjectName: subjectName || null,
    subjectId: subjectId || null
  };
  progressSubjectFilter = subjectName || null;
  if (teacherSubjectsCache.length) fillTeacherSubjectSelects();

  document.querySelectorAll('#teacher-class-list .class-nav-group').forEach(g => {
    const match = String(g.dataset.grade) === String(grade) && String(g.dataset.section) === String(section);
    if (expandGroup) g.classList.toggle('is-expanded', match);
  });

  document.querySelectorAll('#teacher-class-list .class-nav-item').forEach(btn => {
    const match = String(btn.dataset.grade) === String(grade) && String(btn.dataset.section) === String(section);
    btn.classList.toggle('active', match);
  });

  document.querySelectorAll('#teacher-class-list .class-nav-subject').forEach(btn => {
    const matchClass = String(btn.dataset.grade) === String(grade) && String(btn.dataset.section) === String(section);
    const matchSub = subjectName && btn.dataset.subjectName === subjectName;
    btn.classList.toggle('active', !!(matchClass && matchSub));
  });

  const titleEl = document.getElementById('teacher-class-title');
  const metaEl = document.getElementById('teacher-session-meta');
  const dateEl = document.getElementById('teacher-session-date');
  const modeBadge = document.getElementById('teacher-mode-badge');

  if (titleEl) {
    titleEl.textContent = subjectName
      ? `Grade ${grade} – ${section} · ${subjectName}`
      : `Grade ${grade} – ${section}`;
  }
  setMyClassesTriggerLabel(grade, section, subjectName);
  if (metaEl) metaEl.style.display = 'flex';
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  if (modeBadge) {
    modeBadge.textContent = subjectName
      || (classInfo?.is_assistant ? 'Assistant Teacher' : (classInfo?.is_class_adviser ? 'Class Adviser' : 'Class'));
  }

  const classroomSearch = document.getElementById('classroom-search-input');
  if (classroomSearch) classroomSearch.value = '';
  const sheetSearch = document.getElementById('attendance-sheet-search-input');
  if (sheetSearch) sheetSearch.value = '';

  const todayMeta = document.getElementById('attendance-today-meta');
  if (todayMeta) {
    todayMeta.textContent = subjectName
      ? `Grade ${grade} – ${section} · ${subjectName}`
      : `Grade ${grade} – ${section}`;
  }

  const progressMeta = document.getElementById('progress-class-meta');
  if (progressMeta) {
    progressMeta.textContent = subjectName
      ? `Grade ${grade} – ${section} · ${subjectName} · ${teacherCurrentQuarter}`
      : `Grade ${grade} – ${section} · ${teacherCurrentQuarter} · Quizzes, activities, and exams for this class.`;
  }

  if (goToPanel === 'classroom') {
    document.getElementById('my-classes-flyout')?.classList.remove('is-open');
    document.getElementById('my-classes-trigger')?.setAttribute('aria-expanded', 'false');
    goToTeacherPanel('classroom');
    syncClassroomAttendanceChrome();
    await Promise.all([
      loadClassStats(grade, section),
      loadRoster(grade, section),
      loadTeacherClassProgress(grade, section)
    ]);
  } else if (goToPanel === 'progress') {
    document.getElementById('my-classes-flyout')?.classList.remove('is-open');
    document.getElementById('my-classes-trigger')?.setAttribute('aria-expanded', 'false');
    goToTeacherPanel('progress');
  } else if (goToPanel === 'attendance-sheet') {
    document.getElementById('my-classes-flyout')?.classList.remove('is-open');
    document.getElementById('my-classes-trigger')?.setAttribute('aria-expanded', 'false');
    goToTeacherPanel('attendance-sheet');
  } else {
    // Stay on current tab; refresh panels that depend on class/subject context
    document.getElementById('my-classes-flyout')?.classList.remove('is-open');
    document.getElementById('my-classes-trigger')?.setAttribute('aria-expanded', 'false');
    const activePanel = document.querySelector('[data-teacher-panel].active')?.dataset.teacherPanel;
    syncClassroomAttendanceChrome();
    if (activePanel === 'classroom' || !activePanel) {
      await Promise.all([
        loadClassStats(grade, section),
        loadRoster(grade, section),
        loadTeacherClassProgress(grade, section)
      ]);
    }
    if (activePanel === 'progress') loadProgressList();
    if (activePanel === 'attendance-sheet') loadAttendanceSheet();
    if (activePanel === 'quiz-bank') {
      fillQuizBankGradeFilter();
      fillQuizBankSubjectFilter();
      loadQuestionBank();
    }
    if (activePanel === 'lesson-plans') {
      fillLessonPlanGradeOptions();
      loadMaterialsHub();
    }
  }
}

window.selectTeacherClass = async function(el) {
  if (!el) return;
  await selectTeacherClassContext({
    grade: el.dataset.grade,
    section: el.dataset.section,
    subjectName: null,
    goToPanel: null,
    expandGroup: true
  });
};

function updateClassStatDisplay(stats, grade, section) {
  const total = Number(stats.total) || 0;
  const present = Number(stats.present) || 0;
  const absent = Number(stats.absent) || 0;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

    const totalEl = document.getElementById('stat-total-students');
  if (totalEl) totalEl.textContent = total;

    const infoEl = document.getElementById('stat-class-info');
    if (infoEl) infoEl.textContent = `Grade ${grade}-${section}`;

  const presentEl = document.getElementById('stat-present-today');
  if (presentEl) presentEl.textContent = present;

  const pctEl = document.getElementById('stat-present-pct');
  if (pctEl) pctEl.textContent = `${pct}%`;

  const absentEl = document.getElementById('stat-absent-count');
  if (absentEl) absentEl.textContent = absent;
}

async function loadClassStats(grade, section) {
  try {
    const qs = attendanceQueryParams().toString();
    const res = await fetch(
      `${API_URL}/teacher/stats/${encodeURIComponent(grade)}/${encodeURIComponent(String(section).trim())}${qs ? `?${qs}` : ''}`,
      { headers: getAuthHeaders() }
    );
    const stats = await res.json();
    if (!res.ok) throw new Error(stats.error);
    updateClassStatDisplay(stats, grade, section);
  } catch (err) {
    console.error('Load stats error:', err);
  }
}

let teacherProgressChart = null;

function teacherProgressName(student) {
  const last = String(student.last_name || '').trim();
  const first = String(student.first_name || '').trim();
  if (last && first) return `${last}, ${first}`;
  return last || first || 'Student';
}

function paintTeacherProgressList(listId, students, emptyText, options = {}) {
  const list = document.getElementById(listId);
  if (!list) return;
  const limit = Number(options.limit) || 0;
  const rows = limit > 0 ? students.slice(0, limit) : students;
  if (!rows.length) {
    list.innerHTML = `<li class="page-subheading" style="list-style:none;">${escapeHtml(emptyText)}</li>`;
    return;
  }
  list.innerHTML = rows.map((student) => teacherProgressPersonHtml(student, !!options.showLesson)).join('');
}

function teacherProgressPersonHtml(student, showLesson) {
  const topicPrefix = student.topic_side === 'strength' ? 'Strength' : 'Weakest';
  const lesson = showLesson && student.weakest_lesson
    ? ` <span class="page-subheading">· ${topicPrefix}: ${escapeHtml(student.weakest_lesson)}</span>`
    : '';
  const pct = student.avg_percent == null ? '' : ` <span class="page-subheading">(${student.avg_percent}%)</span>`;
  return `<li>${escapeHtml(teacherProgressName(student))}${pct}${lesson}</li>`;
}

function renderTeacherProgressGroups(data) {
  const box = document.getElementById('teacher-progress-all');
  if (!box) return;
  const block = (title, students, emptyText) => {
    const body = students.length
      ? `<ul>${students.map((student) => teacherProgressPersonHtml(student, true)).join('')}</ul>`
      : `<p class="page-subheading" style="margin:0;">${escapeHtml(emptyText)}</p>`;
    return `<div><h4>${escapeHtml(title)}</h4>${body}</div>`;
  };
  const unscored = data.unscored || [];
  const none = unscored.length
    ? `<ul>${unscored.map((student) => `<li>${escapeHtml(teacherProgressName(student))}</li>`).join('')}</ul>`
    : '<p class="page-subheading" style="margin:0;">None</p>';
  box.innerHTML = `
    <div class="teacher-progress-lists teacher-progress-all-grid">
      ${block('Excelling', data.excels || [], 'None yet')}
      ${block('On track', data.on_track || [], 'None')}
      ${block('Left behind', data.behind || [], 'None')}
      <div><h4>No scores yet</h4>${none}</div>
    </div>`;
}

const SUBJECT_RECORD_SHEETS = [
  { key: 'quizzes', label: 'Quizzes' },
  { key: 'activities', label: 'Activities' },
  { key: 'exams', label: 'Exams' }
];
const SUBJECT_RECORD_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
let subjectRecordLoadGen = 0;
let subjectRecordData = null;
let subjectRecordKind = 'quizzes';
let subjectRecordQuarter = 'Q1';

function formatRecordScore(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 100) / 100);
}

function recordColumns(grouped, quarter) {
  const items = Array.isArray(grouped?.[quarter]) ? grouped[quarter] : [];
  if (!items.length) return [{ id: null, title: '', scores: {} }];
  return items.map((item) => ({
    id: item.id,
    title: item.title || '',
    scores: item.scores || {}
  }));
}

function renderRecordSheet(spec, grouped, students, quarter) {
  const cols = recordColumns(grouped, quarter);
  const head = cols.map((col) => `<th title="${escapeHtml(col.title)}">${escapeHtml(col.title)}</th>`).join('');
  const body = students.length
    ? students.map((student) => {
      const cells = cols.map((col) => {
        if (!col.id) return '<td></td>';
        const raw = col.scores[student.id] ?? col.scores[String(student.id)];
        return `<td>${escapeHtml(formatRecordScore(raw))}</td>`;
      }).join('');
      return `<tr><th scope="row">${escapeHtml(teacherProgressName(student))}</th>${cells}</tr>`;
    }).join('')
    : `<tr><td colspan="${cols.length + 1}">No students in this class</td></tr>`;
  const kindOptions = SUBJECT_RECORD_SHEETS.map((item) =>
    `<option value="${item.key}"${item.key === spec.key ? ' selected' : ''}>${item.label}</option>`
  ).join('');
  const quarterOptions = SUBJECT_RECORD_QUARTERS.map((item) =>
    `<option value="${item}"${item === quarter ? ' selected' : ''}>${item}</option>`
  ).join('');
  return `<section class="subject-record-sheet">
    <div class="subject-record-sheet-bar">
      <label class="subject-record-quarter">
        <span class="visually-hidden">Quarter</span>
        <select id="teacher-subject-record-quarter">${quarterOptions}</select>
      </label>
      <h4>${spec.label}</h4>
      <label class="subject-record-kind">
        <span class="visually-hidden">Score type</span>
        <select id="teacher-subject-record-kind">${kindOptions}</select>
      </label>
    </div>
    <div class="subject-record-sheet-scroll">
      <table>
        <thead>
          <tr><th>Name</th>${head}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`;
}

function renderSubjectRecord(data) {
  subjectRecordData = data;
  const sectionEl = document.getElementById('teacher-subject-record-section');
  const teacherEl = document.getElementById('teacher-subject-record-teacher');
  if (sectionEl) sectionEl.textContent = data?.section || teacherCurrentClass?.section || '';
  if (teacherEl) teacherEl.textContent = data?.teacher_name || '';
  paintSubjectRecordSheet();
}

function paintSubjectRecordSheet() {
  const sheets = document.getElementById('teacher-subject-record-sheets');
  if (!sheets || !subjectRecordData) return;
  const spec = SUBJECT_RECORD_SHEETS.find((item) => item.key === subjectRecordKind) || SUBJECT_RECORD_SHEETS[0];
  subjectRecordKind = spec.key;
  if (!SUBJECT_RECORD_QUARTERS.includes(subjectRecordQuarter)) subjectRecordQuarter = 'Q1';
  sheets.innerHTML = renderRecordSheet(
    spec,
    subjectRecordData[spec.key],
    subjectRecordData.students || [],
    subjectRecordQuarter
  );
}

async function loadSubjectRecordSheet() {
  const sheets = document.getElementById('teacher-subject-record-sheets');
  const select = document.getElementById('teacher-subject-record-select');
  const grade = teacherCurrentClass?.grade;
  const section = teacherCurrentClass?.section;
  const picked = select?.selectedOptions?.[0];
  const [subjectId, recordTeacherId] = String(picked?.value || '').split(':');
  if (!sheets || !grade || !section || !subjectId || !recordTeacherId) return;
  const generation = ++subjectRecordLoadGen;
  const teacherEl = document.getElementById('teacher-subject-record-teacher');
  if (teacherEl) teacherEl.textContent = picked.dataset.teacherName || '';
  sheets.innerHTML = '<p class="page-subheading">Loading scores…</p>';
  const params = new URLSearchParams({
    subject_id: subjectId,
    teacher_id: recordTeacherId
  });
  try {
    const res = await fetch(
      `${API_URL}/teacher/class-progress/${encodeURIComponent(grade)}/${encodeURIComponent(String(section).trim())}/subject-record?${params}`,
      { headers: getAuthHeaders() }
    );
    const data = await res.json();
    if (generation !== subjectRecordLoadGen) return;
    if (!res.ok) throw new Error(data.error || 'Could not load this subject.');
    renderSubjectRecord(data);
  } catch (err) {
    if (generation !== subjectRecordLoadGen) return;
    console.error('Subject record error:', err);
    sheets.innerHTML = `<p class="page-subheading">${escapeHtml(err.message || 'Could not load this subject.')}</p>`;
  }
}

function renderSubjectTeacherReports(data) {
  const box = document.getElementById('teacher-subject-reports');
  const empty = document.getElementById('teacher-subject-reports-empty');
  const body = document.getElementById('teacher-subject-reports-body');
  const select = document.getElementById('teacher-subject-record-select');
  if (!box) return;
  const rows = data?.subject_teachers || [];
  const show = !teacherCurrentClass?.subjectId && data?.is_home_teacher;
  if (!show) {
    subjectRecordLoadGen += 1;
    subjectRecordData = null;
    box.hidden = true;
    if (select) select.innerHTML = '';
    const sheets = document.getElementById('teacher-subject-record-sheets');
    if (sheets) sheets.innerHTML = '';
    return;
  }
  box.hidden = false;
  const hasRows = rows.length > 0;
  if (empty) empty.hidden = hasRows;
  if (body) body.hidden = !hasRows;
  if (!hasRows || !select) return;
  const previous = select.value || '';
  select.innerHTML = rows.map((row) => `
    <option value="${escapeHtml(row.subject_id)}:${escapeHtml(row.teacher_id)}" data-teacher-name="${escapeHtml(row.teacher_name)}">${escapeHtml(row.subject_name)} — ${escapeHtml(row.teacher_name)}</option>`
  ).join('');
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  const sectionEl = document.getElementById('teacher-subject-record-section');
  if (sectionEl) sectionEl.textContent = teacherCurrentClass?.section || '';
  loadSubjectRecordSheet();
}

document.getElementById('teacher-subject-record-select')?.addEventListener('change', () => {
  loadSubjectRecordSheet();
});

document.getElementById('teacher-subject-record-sheets')?.addEventListener('change', (event) => {
  if (event.target?.id === 'teacher-subject-record-kind') subjectRecordKind = event.target.value;
  else if (event.target?.id === 'teacher-subject-record-quarter') subjectRecordQuarter = event.target.value;
  else return;
  paintSubjectRecordSheet();
});

function paintTeacherProgressChart(counts) {
  const wrap = document.getElementById('teacher-progress-chart-wrap');
  if (!wrap) return;
  if (teacherProgressChart) {
    teacherProgressChart.destroy();
    teacherProgressChart = null;
  }
  const values = [counts.excels || 0, counts.on_track || 0, counts.behind || 0];
  if (!values.some((n) => n > 0)) {
    wrap.innerHTML = '<p class="parent-chart-empty">No scores yet.</p>';
    return;
  }
  const ChartLib = typeof window !== 'undefined' ? window.Chart : null;
  if (!ChartLib) {
    wrap.innerHTML = '<p class="parent-chart-empty">Chart is unavailable right now.</p>';
    return;
  }
  if (!document.getElementById('teacher-progress-chart')?.isConnected) {
    wrap.innerHTML = '<canvas id="teacher-progress-chart" aria-label="Students by progress group" role="img"></canvas>';
  }
  const target = document.getElementById('teacher-progress-chart');
  teacherProgressChart = new ChartLib(target, {
    type: 'doughnut',
    data: {
      labels: ['Excelling', 'On track', 'Most at risk'],
      datasets: [{
        data: values,
        backgroundColor: ['#2e7d32', '#f39c12', '#c62828'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const n = Number(item.raw) || 0;
              const total = values.reduce((sum, v) => sum + v, 0);
              const pct = total ? Math.round((n / total) * 100) : 0;
              return ` ${item.label}: ${n} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

async function loadTeacherClassProgress(grade, section) {
  const summaryEl = document.getElementById('teacher-performance-text');
  const hintEl = document.getElementById('teacher-progress-hint');
  if (!grade || !section) {
    if (summaryEl) summaryEl.textContent = 'Select a class to see how the class is doing.';
    renderSubjectTeacherReports(null);
    return;
  }
  const subjectId = teacherCurrentClass?.subjectId;
  const params = new URLSearchParams();
  if (subjectId) params.set('subject_id', String(subjectId));
  const qs = params.toString();
  try {
    const res = await fetch(
      `${API_URL}/teacher/class-progress/${encodeURIComponent(grade)}/${encodeURIComponent(String(section).trim())}${qs ? `?${qs}` : ''}`,
      { headers: getAuthHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load class progress');
    if (summaryEl) summaryEl.textContent = data.summary || 'No scores yet.';
    const lessonEl = document.getElementById('teacher-lesson-line');
    if (lessonEl) lessonEl.textContent = data.lesson_line || '';
    if (hintEl) {
      const scope = teacherCurrentClass?.subjectName
        ? teacherCurrentClass.subjectName
        : 'this class';
      hintEl.textContent = data.scored_students
        ? `${data.scored_students} of ${data.total_students} students have scores in ${scope}.`
        : `No scores yet for ${scope}.`;
    }
    paintTeacherProgressChart(data.counts || {});
    paintTeacherProgressList('teacher-excels-list', data.excels || [], 'None yet', { limit: 3 });
    paintTeacherProgressList('teacher-behind-list', data.behind || [], 'None', { limit: 3 });
    renderTeacherProgressGroups(data);
    renderSubjectTeacherReports(data);
  } catch (err) {
    console.error('Class progress error:', err);
    if (summaryEl) summaryEl.textContent = 'Could not load class progress.';
    const lessonEl = document.getElementById('teacher-lesson-line');
    if (lessonEl) lessonEl.textContent = '';
    renderSubjectTeacherReports(null);
  }
}

document.getElementById('teacher-progress-see-all')?.addEventListener('click', () => {
  const box = document.getElementById('teacher-progress-all');
  const btn = document.getElementById('teacher-progress-see-all');
  if (!box || !btn) return;
  box.hidden = !box.hidden;
  btn.textContent = box.hidden ? 'See all students' : 'Hide full list';
});

function attendanceActionButtons(studentId, status) {
  const current = String(status || '').toLowerCase();
  const presentActive = current === 'present' ? ' is-att-active att-present' : '';
  const absentActive = current === 'absent' ? ' is-att-active att-absent' : '';
  const lateActive = current === 'late' ? ' is-att-active att-late' : '';
  const excusedActive = current === 'excused' ? ' is-att-active att-excused' : '';
  return `
    <div class="att-actions" data-student-id="${studentId}" style="display:flex;gap:6px;flex-wrap:wrap;">
      <button type="button" class="chip-ghost att-btn att-present${presentActive}" onclick="markAttendance(${studentId}, 'Present')" title="Present">P</button>
      <button type="button" class="chip-ghost att-btn att-absent${absentActive}" onclick="markAttendance(${studentId}, 'Absent')" title="Absent">A</button>
      <button type="button" class="chip-ghost att-btn att-late${lateActive}" onclick="markAttendance(${studentId}, 'Late')" title="Late">L</button>
      <button type="button" class="chip-ghost att-btn att-excused${excusedActive}" onclick="markAttendance(${studentId}, 'Excused')" title="Excused (sick / excuse letter)">E</button>
    </div>`;
}

function syncAttendanceActionButtons(studentId, status) {
  const wrap = document.querySelector(`.att-actions[data-student-id="${studentId}"]`);
  if (!wrap) return;
  const current = String(status || '').toLowerCase();
  wrap.querySelectorAll('.att-btn').forEach(btn => {
    btn.classList.remove('is-att-active', 'primary');
  });
  const map = { present: '.att-present', absent: '.att-absent', late: '.att-late', excused: '.att-excused' };
  const sel = map[current];
  if (sel) wrap.querySelector(sel)?.classList.add('is-att-active');
}

function renderRoster(students) {
  const tbody = document.querySelector('#teacher-roster-table tbody');
  if (!tbody) return;

  if (!students.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No students in this class</td></tr>';
      return;
    }

  const sorted = [...students].sort((a, b) => {
    const ga = a.gender === 'M' ? 0 : a.gender === 'F' ? 1 : 2;
    const gb = b.gender === 'M' ? 0 : b.gender === 'F' ? 1 : 2;
    if (ga !== gb) return ga - gb;
    return compareStudentsByName(a, b);
  });

  tbody.innerHTML = sorted.map(s => `
      <tr data-student-id="${s.id}">
        <td class="att-lrn-cell">${escapeHtml(s.lrn || '-')}</td>
        <td class="att-name-cell"><strong>${formatStudentNameStacked(s)}</strong></td>
        <td>${escapeHtml(s.gender || '-')}</td>
        <td>
          <span class="badge ${s.attendance_status ? s.attendance_status.toLowerCase() : 'unrecorded'}" 
                id="att-status-${s.id}">
            ${s.attendance_status || 'Not recorded'}
          </span>
        </td>
        <td>
          ${attendanceActionButtons(s.id, s.attendance_status)}
        </td>
      </tr>
    `).join('');
}

function filterRoster() {
  const query = (document.getElementById('classroom-search-input')?.value || '').trim().toLowerCase();
  if (!query) {
    renderRoster(rosterData);
    return;
  }
  const filtered = rosterData.filter(s => {
    const name = `${s.last_name || ''} ${s.first_name || ''}`.toLowerCase();
    const lrn = String(s.lrn || '').toLowerCase();
    return name.includes(query) || lrn.includes(query);
  });
  renderRoster(filtered);
}

async function refreshClassroomAttendanceStatus() {
  const el = document.getElementById('classroom-attendance-status');
  if (!el || !teacherCurrentClass) return;
  if (isSubjectAttendanceGrade(teacherCurrentClass.grade) && !teacherCurrentClass.subjectId) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  try {
    const qs = attendanceQueryParams().toString();
    const res = await fetch(
      `${API_URL}/teacher/attendance/${encodeURIComponent(teacherCurrentClass.grade)}/${encodeURIComponent(String(teacherCurrentClass.section).trim())}/completion${qs ? `?${qs}` : ''}`,
      { headers: getAuthHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.complete) {
      el.style.display = 'block';
      el.style.color = '#1b5e20';
      el.textContent = `Attendance complete for today (${data.total} students). You can enable a shared link in Records.`;
    } else {
      const n = Array.isArray(data.unmarked) ? data.unmarked.length : 0;
      el.style.display = 'block';
      el.style.color = '#b71c1c';
      el.textContent = n
        ? `${n} student(s) still unmarked — finish attendance before enabling a shared link.`
        : 'Mark attendance for every student before enabling a shared link.';
    }
  } catch (_) {
    el.style.display = 'none';
    el.textContent = '';
  }
}

async function loadRoster(grade, section) {
  const tbody = document.querySelector('#teacher-roster-table tbody');
  if (!tbody) return;
  syncClassroomAttendanceChrome();

  if (isSubjectAttendanceGrade(grade) && !teacherCurrentClass?.subjectId) {
    rosterData = [];
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Select a subject from My Classes to take attendance.</td></tr>';
    return;
  }

  try {
    const qs = attendanceQueryParams().toString();
    const res = await fetch(
      `${API_URL}/teacher/roster/${encodeURIComponent(grade)}/${encodeURIComponent(String(section).trim())}${qs ? `?${qs}` : ''}`,
      { headers: getAuthHeaders() }
    );
    rosterData = await res.json();
    if (!res.ok) throw new Error(rosterData.error || 'Failed to load roster');
    filterRoster();
    refreshClassroomAttendanceStatus();
  } catch (err) {
    console.error('Load roster error:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${err.message || 'Failed to load roster'}</td></tr>`;
  }
}

window.markAttendance = async function(studentId, status, opts = {}) {
  try {
    const silent = !!opts.silent;
    const fromRoster = rosterData.find(s => s.id === studentId);
    const prevRaw = fromRoster?.attendance_status || '';
    const prevNorm = String(prevRaw || '').toLowerCase();
    const nextNorm = String(status || '').toLowerCase();

    if (prevNorm && prevNorm === nextNorm) return;

    if (!silent && prevNorm && prevNorm !== nextNorm) {
      const label = prevRaw || prevNorm;
      if (!confirm(`Change ${label} → ${status} for this student?`)) return;
    }

    if (!teacherCurrentClass) {
      showToast('Select a class first.', 'error');
      return;
    }

    const subjectMode = isSubjectAttendanceGrade(teacherCurrentClass.grade);
    if (subjectMode && !teacherCurrentClass.subjectId) {
      showToast('Select a subject to mark attendance.', 'error');
      return;
    }
    if (!subjectMode && (attendanceCurrentSession || 'AM') !== currentManilaSessionClient()) {
      const openSession = currentManilaSessionClient();
      showToast(openSession === 'AM'
        ? 'Morning attendance is open. Afternoon attendance starts at 12:00.'
        : 'Afternoon attendance is open. Morning attendance is closed after 12:00.', 'error');
      return;
    }

    const payload = {
      student_id: studentId,
      status,
      date: localISODate()
    };
    if (subjectMode) {
      payload.subject_id = teacherCurrentClass.subjectId;
      payload.session = 'AM';
    } else {
      payload.session = attendanceCurrentSession || 'AM';
    }

    const res = await fetch(`${API_URL}/teacher/attendance`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.details || 'Failed to save');

    if (fromRoster) fromRoster.attendance_status = status;

    const badge = document.getElementById(`att-status-${studentId}`);
    if (badge) {
      badge.textContent = status;
      badge.className = `badge ${status.toLowerCase()}`;
    }
    syncAttendanceActionButtons(studentId, status);

    loadClassStats(teacherCurrentClass.grade, teacherCurrentClass.section);
    refreshClassroomAttendanceStatus();

    const activePanel = document.querySelector('[data-teacher-panel].active')?.dataset.teacherPanel;
    if (activePanel === 'attendance-sheet') loadAttendanceSheet();

    if (!silent) showToast(`Saved: ${status}${subjectMode ? '' : ` (${payload.session})`}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('open-attendance-sheet-btn')?.addEventListener('click', () => {
  goToTeacherPanel('attendance-sheet');
});

function showAttendanceInnerPage(page) {
  const today = document.getElementById('attendance-today-page');
  const week = document.getElementById('attendance-week-page');
  if (today) today.hidden = page !== 'today';
  if (week) week.hidden = page !== 'week';
  if (page === 'week') {
    paintAttendanceRangeFilters();
    loadAttendanceSheet();
  }
}

document.getElementById('attendance-open-week')?.addEventListener('click', () => showAttendanceInnerPage('week'));
document.getElementById('attendance-week-back')?.addEventListener('click', () => showAttendanceInnerPage('today'));

const notifyBtn = document.getElementById('notify-all-btn');
if (notifyBtn) {
  notifyBtn.addEventListener('click', () => {
    if (!teacherCurrentClass) {
      showToast('Select a class first.', 'error');
      return;
    }
    const subtitle = document.getElementById('attendance-update-subtitle');
    if (subtitle) {
      const sess = isSubjectAttendanceGrade(teacherCurrentClass.grade)
        ? (teacherCurrentClass.subjectName || 'subject')
        : (attendanceCurrentSession === 'PM' ? 'afternoon' : 'morning');
      subtitle.textContent = `Notify linked parents about today's ${sess} attendance for Grade ${teacherCurrentClass.grade}-${teacherCurrentClass.section}. One notice per child.`;
    }
    const modal = document.getElementById('attendance-update-modal');
    updateAttendancePreview();
    modal?.removeAttribute('hidden');
  });
}

function attendanceStatusesForScope(scope) {
  if (scope === 'absent') return ['Absent'];
  if (scope === 'all') return ['Present', 'Late', 'Absent'];
  return ['Late', 'Absent'];
}

function updateAttendancePreview() {
  const preview = document.getElementById('attendance-update-preview');
  if (!preview) return;
  const scope = document.getElementById('attendance-update-scope')?.value || 'late_absent';
  const statuses = attendanceStatusesForScope(scope);
  const matches = rosterData.filter(s => statuses.includes(s.attendance_status));
  preview.textContent = matches.length
    ? `${matches.length} student${matches.length === 1 ? '' : 's'} match this filter today. Notices go only to linked parents.`
    : 'No students match this filter for today yet. Mark attendance first.';
}

document.getElementById('attendance-update-scope')?.addEventListener('change', updateAttendancePreview);
document.getElementById('attendance-update-cancel')?.addEventListener('click', () => {
  document.getElementById('attendance-update-modal')?.setAttribute('hidden', '');
});
document.getElementById('attendance-update-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'attendance-update-modal') e.currentTarget.setAttribute('hidden', '');
});
document.getElementById('attendance-update-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!teacherCurrentClass) return;
  const scope = document.getElementById('attendance-update-scope')?.value || 'late_absent';
  const statuses = attendanceStatusesForScope(scope);
  const matches = rosterData.filter(s => statuses.includes(s.attendance_status));
  if (!matches.length) {
    showToast('No students match this filter for today.', 'error');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/teacher/notify-attendance`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        grade: teacherCurrentClass.grade,
        section: teacherCurrentClass.section,
        statuses,
        session: attendanceCurrentSession || 'AM',
        subject_id: isSubjectAttendanceGrade(teacherCurrentClass.grade)
          ? teacherCurrentClass.subjectId
          : null
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('attendance-update-modal')?.setAttribute('hidden', '');
    const smsBit = [
      data.smsQueued != null ? `${data.smsQueued} SMS queued` : null,
      data.smsSentNow ? `${data.smsSentNow} processed` : null,
      data.smsSkippedNoPhone ? `${data.smsSkippedNoPhone} missing phone` : null
    ].filter(Boolean).join(' · ');
    showToast(
      data.message ||
        (smsBit
          ? `Parents notified (${smsBit}).`
          : 'Parents notified in-app.')
    );
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function fillTeacherNoticeClasses() {
  const sel = document.getElementById('teacher-notice-class');
  if (!sel) return;
  const unique = [];
  const seen = new Set();
  (teacherAssignedClasses || []).forEach(c => {
    const key = `${c.grade_level}-${c.section}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push({ grade: c.grade_level, section: c.section });
  });
  const preferred = teacherCurrentClass
    ? `${teacherCurrentClass.grade}-${teacherCurrentClass.section}`
    : sel.value;
  sel.innerHTML = '<option value="">Select a class</option>' + unique.map(c =>
    `<option value="${c.grade}-${c.section}">Grade ${c.grade} – ${c.section}</option>`
  ).join('');
  if (preferred && unique.some(c => `${c.grade}-${c.section}` === preferred)) {
    sel.value = preferred;
  }
}

document.getElementById('teacher-announcement-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('teacher-notice-msg');
  const classVal = document.getElementById('teacher-notice-class')?.value || '';
  const [grade, ...sectionParts] = classVal.split('-');
  const section = sectionParts.join('-');
  const title = document.getElementById('teacher-notice-title')?.value.trim();
  const body = document.getElementById('teacher-notice-body')?.value.trim();
  if (!grade || !section || !title || !body) {
    if (msgEl) { msgEl.textContent = 'Class, title, and message are required.'; msgEl.style.color = '#b71c1c'; }
    else showToast('Class, title, and message are required.', 'error');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/teacher/announcements`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, body, grade, section })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.details || 'Failed to send notice');
    e.target.reset();
    fillTeacherNoticeClasses();
    if (msgEl) { msgEl.textContent = ''; }
    const modal = document.getElementById('teacher-notice-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('hidden', '');
    }
    showToast(data.message || 'Class notice sent to parents.');
  } catch (err) {
    if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = '#b71c1c'; }
    else showToast(err.message, 'error');
  }
});

document.getElementById('classroom-search-input')?.addEventListener('input', () => filterRoster());
document.getElementById('attendance-sheet-search-input')?.addEventListener('input', () => filterAttendanceSheet());

document.getElementById('progress-search-input')?.addEventListener('input', () => {
  filterProgressList();
});

document.querySelectorAll('[data-progress-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    progressTypeFilter = btn.dataset.progressType || 'all';
    document.querySelectorAll('[data-progress-type]').forEach(b => {
      b.classList.toggle('active', b === btn);
    });
    filterProgressList();
  });
});

document.getElementById('attendance-save-all')?.addEventListener('click', async () => {
  const unmarked = rosterData.filter(s => !s.attendance_status);
  if (!unmarked.length) {
    showToast('All students already have attendance recorded.');
    return;
  }
  if (!confirm(`Mark ${unmarked.length} unrecorded student${unmarked.length > 1 ? 's' : ''} as Present?`)) return;
  for (const student of unmarked) {
    await window.markAttendance(student.id, 'Present', { silent: true });
  }
  showToast('Marked remaining students as Present.');
});

/** Calendar date in Asia/Manila (matches server attendance / quiz gates). */
function localISODate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function statusToLetter(status) {
  const st = String(status || '').toLowerCase();
  if (st === 'present') return 'P';
  if (st === 'absent') return 'A';
  if (st === 'late') return 'L';
  if (st === 'excused') return 'E';
  return '';
}

function letterClass(letter) {
  if (letter === 'P') return 'att-mark att-mark-p';
  if (letter === 'A') return 'att-mark att-mark-a';
  if (letter === 'L') return 'att-mark att-mark-l';
  if (letter === 'E') return 'att-mark att-mark-e';
  return 'att-mark att-mark-empty';
}

function attendanceRangeLabel(sheet) {
  const range = sheet?.range || attendanceSheetRange || 'week';
  if (range === 'day') return formatAttendanceShortDate(sheet.weekStart);
  if (range === 'month') {
    const [y, m] = String(sheet.weekStart || '').split('-').map(Number);
    const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${names[(m || 1) - 1] || ''} ${y || ''}`.trim();
  }
  if (range === 'year') return `School Year ${sheet.schoolYear || ''}`.trim();
  return formatWeekLabel(sheet.weekStart, sheet.weekEnd);
}

function updateAttendanceSheetSummary(sheet) {
  const box = document.getElementById('attendance-sheet-summary');
  if (!box || !sheet) return;
  box.hidden = false;
  const totalEl = document.getElementById('att-sheet-total');
  const rangeEl = document.getElementById('att-sheet-week-range');
  const label = attendanceRangeLabel(sheet);
  if (totalEl) totalEl.textContent = (sheet.students || []).length;
  if (rangeEl) rangeEl.textContent = label;
  const weekLabel = document.getElementById('attendance-week-label');
  if (weekLabel) weekLabel.textContent = label;
}

function renderAttendanceSheet(students, sheetMeta) {
  const table = document.getElementById('teacher-attendance-sheet-table');
  if (!table) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  const mode = sheetMeta?.mode || 'class';
  const dates = sheetMeta?.dates || [];
  const hint = document.getElementById('attendance-sheet-hint');
  if (hint) {
    hint.textContent = mode === 'subject'
      ? `${sheetMeta.subject_name || 'Subject'} attendance (Grades 4–6). One mark per day. Marks are saved in Today.`
      : 'Morning (AM) and Afternoon (PM) attendance under each date.';
  }

  if (!dates.length) {
    thead.innerHTML = '';
    tbody.innerHTML = '<tr><td class="empty-cell">No week selected</td></tr>';
    const oldCol = table.querySelector('colgroup');
    if (oldCol) oldCol.remove();
    return;
  }

  const markCols = mode === 'subject' ? dates.length : dates.length * 2;
  let colgroup = table.querySelector('colgroup');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    table.insertBefore(colgroup, thead);
  }
  colgroup.innerHTML =
    '<col class="att-col-lrn">' +
    '<col class="att-col-name">' +
    Array.from({ length: markCols }, () => '<col class="att-col-mark">').join('');

  const dateHeadsTop = dates.map((d) => {
    const label = formatAttendanceShortDate(d);
    if (mode === 'subject') return `<th rowspan="2">${label}</th>`;
    return `<th colspan="2">${label}</th>`;
  }).join('');

  const dateHeadsSub = mode === 'subject'
    ? ''
    : `<tr class="att-session-row">${dates.map(() => '<th>AM</th><th>PM</th>').join('')}</tr>`;

  thead.innerHTML = `
    <tr>
      <th rowspan="${mode === 'subject' ? 1 : 2}">LRN</th>
      <th rowspan="${mode === 'subject' ? 1 : 2}">Student Name</th>
      ${dateHeadsTop}
    </tr>
    ${dateHeadsSub}`;

  if (!students.length) {
    const cols = 2 + markCols;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-cell">No students in this class</td></tr>`;
    return;
  }

  const boys = students.filter((s) => s.gender === 'M').sort(compareStudentsByName);
  const girls = students.filter((s) => s.gender === 'F').sort(compareStudentsByName);
  const other = students.filter((s) => s.gender !== 'M' && s.gender !== 'F').sort(compareStudentsByName);
  const colSpan = 2 + markCols;

  const renderRows = (list, groupLabel) => {
    if (!list.length) return '';
    const groupRow = `<tr class="att-group-row"><td colspan="${colSpan}">${groupLabel}</td></tr>`;
    const rows = list.map((s) => {
      const cells = dates.map((d) => {
        const mark = s.marks?.[d] || {};
        if (mode === 'subject') {
          const letter = statusToLetter(mark.status);
          return `<td class="${letterClass(letter)}">${letter}</td>`;
        }
        const am = statusToLetter(mark.AM);
        const pm = statusToLetter(mark.PM);
        return `<td class="${letterClass(am)}">${am}</td><td class="${letterClass(pm)}">${pm}</td>`;
      }).join('');
      return `<tr data-student-id="${s.id}">
        <td class="att-lrn-cell">${escapeHtml(s.lrn || '-')}</td>
        <td class="att-name-cell"><strong>${formatStudentNameStacked(s)}</strong></td>
        ${cells}
      </tr>`;
    }).join('');
    return groupRow + rows;
  };

  tbody.innerHTML =
    renderRows(boys, 'Boys') +
    renderRows(girls, 'Girls') +
    renderRows(other, 'Other');
}

function filterAttendanceSheet() {
  const query = (document.getElementById('attendance-sheet-search-input')?.value || '').trim().toLowerCase();
  const meta = attendanceSheetData?._meta;
  const students = attendanceSheetData?.students || [];
  if (!query) {
    renderAttendanceSheet(students, meta);
    return;
  }
  const filtered = students.filter((s) => {
    const name = `${s.last_name || ''} ${s.first_name || ''}`.toLowerCase();
    const lrn = String(s.lrn || '').toLowerCase();
    return name.includes(query) || lrn.includes(query);
  });
  renderAttendanceSheet(filtered, meta);
}

async function loadAttendanceSheet() {
  const tbody = document.querySelector('#teacher-attendance-sheet-table tbody');
  const thead = document.querySelector('#teacher-attendance-sheet-table thead');
  const meta = document.getElementById('attendance-sheet-meta');
  const summaryBox = document.getElementById('attendance-sheet-summary');

  if (!attendanceSheetAnchor) attendanceSheetAnchor = localISODate();
  if (!attendanceSheetWeekStart) {
    attendanceSheetWeekStart = weekStartMondayClient(attendanceSheetAnchor);
  }

  if (!teacherCurrentClass) {
    if (meta) meta.textContent = 'Select a class from My Classes to browse attendance.';
    if (summaryBox) summaryBox.hidden = true;
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '<tr><td class="empty-cell">Select a class first</td></tr>';
    attendanceSheetData = { students: [], _meta: null };
    return;
  }

  const { grade, section } = teacherCurrentClass;
  const subjectMode = isSubjectAttendanceGrade(grade);

  if (subjectMode && !teacherCurrentClass.subjectId) {
    if (meta) meta.textContent = `Grade ${grade} – ${section}: select a subject to view the weekly sheet.`;
    if (summaryBox) summaryBox.hidden = true;
    if (thead) thead.innerHTML = '';
    if (tbody) {
      tbody.innerHTML = '<tr><td class="empty-cell">Grades 4–6 take attendance per subject. Open a subject from My Classes.</td></tr>';
    }
    return;
  }

  if (meta) {
    meta.textContent = subjectMode
      ? `Grade ${grade} – ${section} · ${teacherCurrentClass.subjectName || 'Subject'}`
      : `Grade ${grade} – ${section}`;
  }
  const todayMeta = document.getElementById('attendance-today-meta');
  if (todayMeta && meta) todayMeta.textContent = meta.textContent;
  if (tbody) tbody.innerHTML = '<tr><td class="empty-cell">Loading…</td></tr>';

  try {
    const sectionEnc = encodeURIComponent(String(section).trim());
    const params = new URLSearchParams({
      range: attendanceSheetRange || 'week',
      date: attendanceSheetAnchor || attendanceSheetWeekStart
    });
    if (subjectMode && teacherCurrentClass.subjectId) {
      params.set('subject_id', String(teacherCurrentClass.subjectId));
    }
    const res = await fetch(
      `${API_URL}/teacher/attendance/${encodeURIComponent(grade)}/${sectionEnc}/week?${params}`,
      { headers: getAuthHeaders() }
    );
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('Server returned a non-JSON response. Restart the API server and try again.');
    }
    if (!res.ok) throw new Error(data.error || data.details || `Request failed (${res.status})`);

    attendanceSheetWeekStart = data.weekStart || attendanceSheetWeekStart;
    if (data.weekStart) attendanceSheetAnchor = data.weekStart;
    attendanceSheetData = { students: data.students || [], _meta: data };
    updateAttendanceSheetSummary(data);
    filterAttendanceSheet();
  } catch (err) {
    console.error('Load attendance sheet error:', err);
    if (summaryBox) summaryBox.hidden = true;
    if (thead) thead.innerHTML = '';
    if (tbody) {
      tbody.innerHTML = `<tr><td class="empty-cell">${err.message || 'Failed to load attendance sheet'}</td></tr>`;
    }
  }
}

async function exportAttendanceSheet(format) {
  if (!teacherCurrentClass) {
    showToast('Select a class first.', 'error');
    return;
  }
  const { grade, section } = teacherCurrentClass;
  if (isSubjectAttendanceGrade(grade) && !teacherCurrentClass.subjectId) {
    showToast('Select a subject first.', 'error');
    return;
  }
  if (!attendanceSheetAnchor) attendanceSheetAnchor = localISODate();
  if (!attendanceSheetWeekStart) {
    attendanceSheetWeekStart = weekStartMondayClient(attendanceSheetAnchor);
  }

  const sectionEnc = encodeURIComponent(String(section).trim());
  const params = new URLSearchParams({
    range: attendanceSheetRange || 'week',
    date: attendanceSheetAnchor || attendanceSheetWeekStart,
    format: format === 'pdf' ? 'pdf' : 'xlsx'
  });
  if (teacherCurrentClass.subjectId && isSubjectAttendanceGrade(grade)) {
    params.set('subject_id', String(teacherCurrentClass.subjectId));
  }

  const url = `${API_URL}/teacher/attendance/${encodeURIComponent(grade)}/${sectionEnc}/week/export?${params}`;
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';

  try {
    const res = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
        Authorization: getAuthHeaders().Authorization || (token ? `Bearer ${token}` : '')
      }
    });
    if (!res.ok) {
      let errMsg = 'Export failed';
      try {
        const j = await res.json();
        errMsg = j.error || errMsg;
      } catch (_) { /* */ }
      throw new Error(errMsg);
    }

    if (format === 'pdf') {
      const html = await res.text();
      openPrintFullDocument(html);
      return;
    }

    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_G${grade}-${section}_${attendanceSheetWeekStart}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    showToast('Excel file downloaded.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function shiftAttendanceAnchor(dir) {
  if (!attendanceSheetAnchor) attendanceSheetAnchor = localISODate();
  const anchor = attendanceSheetAnchor;
  if (attendanceSheetRange === 'month') {
    const [y, m] = anchor.split('-').map(Number);
    const dt = new Date(Date.UTC(y, (m - 1) + dir, 1));
    attendanceSheetAnchor = dt.toISOString().slice(0, 10);
  } else if (attendanceSheetRange === 'year') {
    const [y, mo] = anchor.split('-').map(Number);
    const startYear = mo >= 6 ? y : y - 1;
    attendanceSheetAnchor = `${startYear + dir}-06-01`;
  } else {
    attendanceSheetAnchor = addDaysISOClient(anchor, dir * 7);
  }
  attendanceSheetWeekStart = attendanceSheetAnchor;
}

function paintAttendanceRangeFilters() {
  if (attendanceSheetRange === 'day') attendanceSheetRange = 'week';
  paintParentChipFilters('attendance-range-filters', [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'School Year' }
  ], attendanceSheetRange, (value) => {
    attendanceSheetRange = value || 'week';
    paintAttendanceRangeFilters();
    loadAttendanceSheet();
  });
}

document.getElementById('attendance-week-prev')?.addEventListener('click', () => {
  shiftAttendanceAnchor(-1);
  loadAttendanceSheet();
});

document.getElementById('attendance-week-next')?.addEventListener('click', () => {
  shiftAttendanceAnchor(1);
  loadAttendanceSheet();
});

document.getElementById('attendance-export-excel')?.addEventListener('click', () => {
  closeAttendanceDownloadMenu();
  exportAttendanceSheet('xlsx');
});
document.getElementById('attendance-export-pdf')?.addEventListener('click', () => {
  closeAttendanceDownloadMenu();
  exportAttendanceSheet('pdf');
});

function closeAttendanceDownloadMenu() {
  closeDownloadMenu(
    document.getElementById('attendance-download-panel'),
    document.getElementById('attendance-download-btn')
  );
}

document.getElementById('attendance-download-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleDownloadMenu(
    document.getElementById('attendance-download-btn'),
    document.getElementById('attendance-download-panel')
  );
});

document.querySelectorAll('.session-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const openSession = currentManilaSessionClient();
    const picked = chip.dataset.session === 'PM' ? 'PM' : 'AM';
    if (picked !== openSession) {
      showToast(openSession === 'AM'
        ? 'Morning attendance is open. Afternoon attendance starts at 12:00.'
        : 'Afternoon attendance is open. Morning attendance is closed after 12:00.', 'error');
      return;
    }
    attendanceCurrentSession = picked;
    document.querySelectorAll('.session-chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.session === attendanceCurrentSession);
    });
    if (teacherCurrentClass) {
      Promise.all([
        loadClassStats(teacherCurrentClass.grade, teacherCurrentClass.section),
        loadRoster(teacherCurrentClass.grade, teacherCurrentClass.section)
      ]);
    }
  });
});

document.getElementById('view-ai-insights-btn')?.addEventListener('click', () => {
  document.querySelector('[data-teacher-panel="progress"]')?.click();
});

document.querySelectorAll('#teacher-quarter-list [data-quarter]').forEach(chip => {
  chip.addEventListener('click', () => {
    const q = normalizeQuarterClient(chip.dataset.quarter);
    if (!(UNLOCKED_QUARTERS || []).includes(q)) {
      showToast(`${q} is still locked. Ask the admin to unlock it.`, 'error');
      return;
    }
    document.querySelectorAll('#teacher-quarter-list [data-quarter]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    teacherCurrentQuarter = q;
    const activePanel = document.querySelector('[data-teacher-panel].active')?.dataset.teacherPanel;
    if (activePanel === 'progress') loadProgressList();
    if (teacherCurrentClass) {
      const progressMeta = document.getElementById('progress-class-meta');
      if (progressMeta) {
        progressMeta.textContent = `Grade ${teacherCurrentClass.grade}-${teacherCurrentClass.section} · ${teacherCurrentQuarter} · Quizzes, activities, and exams for this class.`;
      }
    }
  });
});

document.getElementById('admin-save-quarter-btn')?.addEventListener('click', async () => {
  const select = document.getElementById('admin-current-quarter');
  const msgEl = document.getElementById('admin-quarter-msg');
  const quarter = normalizeQuarterClient(select?.value || 'Q1');
  try {
    const res = await fetch(`${API_URL}/admin/settings/current-quarter`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ current_quarter: quarter })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save quarter');
    CURRENT_QUARTER = normalizeQuarterClient(data.currentQuarter || quarter);
    UNLOCKED_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'].slice(0, ['Q1', 'Q2', 'Q3', 'Q4'].indexOf(CURRENT_QUARTER) + 1);
    applyQuarterUnlockUI();
    if (msgEl) { msgEl.textContent = data.message || `Current quarter set to ${CURRENT_QUARTER}`; msgEl.style.color = '#1b5e20'; }
    showToast(data.message || `Current quarter set to ${CURRENT_QUARTER}`);
    refreshAdminOverview();
  } catch (err) {
    if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = '#b71c1c'; }
    showToast(err.message, 'error');
  }
});

function progressRubricEditorOpts() {
  return {
    listId: 'progress-rubric-list',
    pointsId: 'progress-max',
    keepEmpty: true,
    onSync: syncProgressMaxFromCategories
  };
}

function syncProgressMaxFromCategories() {
  const list = document.getElementById('progress-rubric-list');
  const maxEl = document.getElementById('progress-max');
  if (!list || !maxEl) return;
  if (document.getElementById('progress-type')?.value !== 'activity') return;
  const inputs = [...list.querySelectorAll('.qb-rubric-max')];
  if (!inputs.length) return;
  const sum = inputs.reduce((s, inp) => s + Math.max(1, Number(inp.value) || 1), 0);
  maxEl.value = String(sum);
}

function redistributeProgressRubric(totalPoints) {
  const list = document.getElementById('progress-rubric-list');
  if (!list) return;
  const existing = [...list.querySelectorAll('.qb-rubric-category')].map((card) => ({
    name: card.querySelector('.qb-rubric-name')?.value || '',
    descriptions: [...card.querySelectorAll('.qb-rubric-level-desc')].map((inp) => inp.value)
  }));
  const count = existing.length || 3;
  const total = Math.max(count, Math.round(Number(totalPoints) || count));
  const base = Math.floor(total / count);
  const rem = total - base * count;
  const names = existing.length
    ? existing.map((row) => row.name)
    : ['Participation', 'Correctness', 'Effort'];
  const categories = names.map((name, i) => {
    const max_points = base + (i < rem ? 1 : 0);
    const cat = emptyRubricCategory(name, max_points);
    const descs = existing[i]?.descriptions || [];
    cat.levels = cat.levels.map((lv, li) => ({ ...lv, description: descs[li] || '' }));
    return cat;
  });
  renderRubricEditor({ categories }, progressRubricEditorOpts());
}

function syncProgressCreateRubricVisibility() {
  const wrap = document.getElementById('progress-rubric-wrap');
  if (!wrap) return;
  const isActivity = document.getElementById('progress-type')?.value === 'activity';
  wrap.hidden = !isActivity;
  if (!isActivity) {
    wrap.setAttribute('hidden', '');
    return;
  }
  wrap.removeAttribute('hidden');
  const list = document.getElementById('progress-rubric-list');
  if (list && !list.querySelector('.qb-rubric-category')) {
    renderRubricEditor(
      emptyRubricTemplateClient(Number(document.getElementById('progress-max')?.value) || 20),
      progressRubricEditorOpts()
    );
  }
}

function showProgressCreateForm(show) {
  const modal = document.getElementById('progress-create-modal');
  const listWrap = document.getElementById('progress-list-wrap');
  const editor = document.getElementById('progress-editor');
  if (!modal) return;

  if (show) {
    if (!teacherCurrentClass) {
      showToast('Select a class from My Classes first.', 'error');
      return;
    }
    if (editor) editor.hidden = true;
    if (listWrap) listWrap.hidden = false;
    const msg = document.getElementById('progress-create-msg');
    if (msg) msg.textContent = '';
    const titleEl = document.getElementById('progress-title');
    const maxEl = document.getElementById('progress-max');
    const typeEl = document.getElementById('progress-type');
    if (titleEl) titleEl.value = '';
    if (maxEl) maxEl.value = '0';
    if (typeEl) typeEl.value = 'quiz';
    const rubricList = document.getElementById('progress-rubric-list');
    if (rubricList) rubricList.innerHTML = '';
    syncProgressCreateRubricVisibility();
    modal.hidden = false;
    loadTeacherSubjects(true).then(() => {
      fillTeacherSubjectSelects();
      const progressSelect = document.getElementById('progress-subject');
      if (!progressSelect) return;
      if (teacherCurrentClass?.subjectId) {
        progressSelect.value = String(teacherCurrentClass.subjectId);
      } else if (progressSubjectFilter) {
        const opt = Array.from(progressSelect.options).find(
          (o) => o.textContent.trim().toLowerCase() === String(progressSubjectFilter).toLowerCase()
        );
        if (opt) progressSelect.value = opt.value;
      }
      fillProgressLessonSelect();
    });
  } else {
    modal.hidden = true;
  }
}

let progressLessonPlansCache = null;

/** Populate the optional lesson picker in New Record from the teacher's lesson plans. */
async function fillProgressLessonSelect() {
  const sel = document.getElementById('progress-lesson');
  if (!sel) return;
  const prev = sel.value;
  if (!progressLessonPlansCache) {
    try {
      const res = await fetch(`${API_URL}/teacher/lesson-plans`, { headers: getAuthHeaders() });
      const data = await res.json();
      progressLessonPlansCache = res.ok && Array.isArray(data) ? data : [];
    } catch {
      progressLessonPlansCache = [];
    }
  }
  const grade = Number(teacherCurrentClass?.grade);
  const subjectId = document.getElementById('progress-subject')?.value || '';
  const plans = progressLessonPlansCache.filter((lp) => {
    if (Number.isFinite(grade) && grade > 0 && Number(lp.grade_level) !== grade) return false;
    if (subjectId && lp.subject_id != null && String(lp.subject_id) !== String(subjectId)) return false;
    return true;
  });
  sel.innerHTML = `<option value="">-- No specific lesson --</option>${plans
    .map((lp) => `<option value="${lp.id}">${escapeHtml(lp.title || `Lesson #${lp.id}`)}</option>`)
    .join('')}`;
  if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

document.getElementById('progress-subject')?.addEventListener('change', () => {
  if (!document.getElementById('progress-create-modal')?.hidden) fillProgressLessonSelect();
});

function activitySettingLine(record) {
  if (String(record?.type || '').toLowerCase() !== 'activity') return '';
  const mode = record.activity_mode === 'take_home'
    ? 'Take home'
    : record.activity_mode === 'classroom'
      ? 'Classroom activity'
      : '';
  const when = record.activity_target_at
    ? formatSharePreviewLocal(toDatetimeLocalValue(record.activity_target_at))
    : '';
  const bits = [mode, when].filter(Boolean);
  if (!bits.length) return '';
  return `<p class="page-subheading progress-card-status-line">${escapeHtml(bits.join(' · '))}</p>`;
}

function renderProgressCards(records) {
  const listEl = document.getElementById('progress-list');
  if (!listEl) return;

  if (!records.length) {
    listEl.innerHTML = '<p class="empty-state">No progress records yet. For a live ConnectED link, create from Classwork. Use + New Record for manual scores only.</p>';
    return;
  }

  listEl.innerHTML = records.map(r => {
    const shareActive = Number(r.share_enabled) === 1 && r.share_token;
    const hasQuestions = Number(r.question_count) > 0;
    const shareToken = shareActive ? escapeHtml(String(r.share_token)) : '';
    const shareUrl = shareActive ? escapeHtml(sharedQuizAbsoluteUrl(r.share_token, r.type)) : '';
    const quizLink = r.quiz_link ? escapeHtml(String(r.quiz_link)) : '';
    const shareItems = shareActive
      ? `<button type="button" class="row-menu-item" data-action="copy-share-link" data-share-token="${shareToken}" data-share-type="${escapeHtml(String(r.type || 'quiz'))}">Copy Link</button>
          <button type="button" class="row-menu-item" data-action="open-share-link" data-share-url="${shareUrl}">Open Link</button>
          <button type="button" class="row-menu-item" data-action="disable-link" data-record-id="${r.id}">Disable Link</button>`
      : hasQuestions
        ? `<button type="button" class="row-menu-item" data-action="enable-link" data-record-id="${r.id}">Enable Link</button>`
        : '';
    const onlineItems = quizLink
      ? `<button type="button" class="row-menu-item" data-action="copy-online-link" data-record-id="${r.id}">Copy Online Link</button>
          <button type="button" class="row-menu-item" data-action="open-online-link" data-quiz-link="${quizLink}">Open Online Link</button>`
      : '';
    const statusRow = activitySettingLine(r);
    const portalPosted = Number(r.portal_posted) === 1;
    const portalDue = portalPosted && r.portal_due_at
      ? formatSharePreviewLocal(toDatetimeLocalValue(r.portal_due_at))
      : '';
    const portalRow = portalPosted
      ? `<p class="page-subheading progress-card-status-line">Posted to student portal${portalDue ? ` · Due ${escapeHtml(portalDue)}` : ''}</p>`
      : '';
    return `
    <article class="lesson-plan-card">
      ${statusRow || portalRow ? `<div class="progress-card-status">${statusRow}${portalRow}</div>` : ''}
      <div class="progress-card-top">
        <div class="progress-card-top-left">
          <span class="badge type-${r.type}">${typeLabel(r.type)}</span>
          <h4 style="margin:0;">${escapeHtml(r.title)}</h4>
        </div>
        <div class="row-menu-wrap">
          <button type="button" class="icon-btn row-menu-toggle" title="More actions" aria-label="More actions" aria-expanded="false">⋮</button>
          <div class="row-menu" hidden>
            ${shareItems}
            ${onlineItems}
            <button type="button" class="row-menu-item" data-action="open-portal" data-record-id="${r.id}">Student Portal</button>
            ${(shareItems || onlineItems) ? '<div class="row-menu-divider" role="separator"></div>' : ''}
            <button type="button" class="row-menu-item row-menu-item--danger" data-action="delete-record" data-record-id="${r.id}">Delete</button>
          </div>
        </div>
      </div>
      <p>${escapeHtml(r.subject_name || 'No subject')} · Total score ${r.max_score} · ${r.scored_count || 0} scored · ${new Date(r.created_at).toLocaleDateString()}</p>
      <div class="lesson-plan-card-actions">
        <button type="button" class="chip-ghost primary" onclick="openProgressEditor(${r.id}, 'edit')">Scores</button>
      </div>
    </article>`;
  }).join('');
}

(function setupProgressListDelegation() {
  const listEl = document.getElementById('progress-list');
  if (!listEl) return;

  listEl.addEventListener('click', (e) => {
    const toggle = e.target.closest('.row-menu-toggle');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      toggleRowMenu(toggle, '#progress-list');
      return;
    }

    const btn = e.target.closest('button[data-action]');
    if (!btn || !listEl.contains(btn)) return;

    const action = btn.dataset.action;
    const recordId = Number(btn.dataset.recordId);
    e.preventDefault();
    e.stopPropagation();
    closeAllRowMenus();

    if (action === 'enable-link' && recordId) assignSharedQuizLink(recordId);
    else if (action === 'open-portal' && recordId) openProgressEditor(recordId, 'link');
    else if (action === 'disable-link' && recordId) revokeSharedQuizLink(recordId);
    else if (action === 'copy-share-link' && btn.dataset.shareToken) copySharedQuizLink(btn.dataset.shareToken, btn.dataset.shareType);
    else if (action === 'open-share-link' && btn.dataset.shareUrl) {
      window.open(btn.dataset.shareUrl, '_blank', 'noopener');
    } else if (action === 'copy-online-link' && recordId) copyExternalQuizLink(recordId);
    else if (action === 'open-online-link' && btn.dataset.quizLink) {
      window.open(btn.dataset.quizLink, '_blank', 'noopener');
    } else if (action === 'delete-record' && recordId) deleteProgressRecord(recordId);
  });
})();

function filterProgressList() {
  const query = (document.getElementById('progress-search-input')?.value || '').trim().toLowerCase();
  let filtered = progressAssessments;

  if (progressTypeFilter && progressTypeFilter !== 'all') {
    filtered = filtered.filter(r => String(r.type).toLowerCase() === progressTypeFilter);
  }

  if (progressSubjectFilter) {
    const want = String(progressSubjectFilter).toLowerCase();
    filtered = filtered.filter(r => String(r.subject_name || '').toLowerCase() === want);
  }

  if (query) {
    filtered = filtered.filter(r => {
      const hay = `${r.title} ${r.subject_name || ''} ${r.type}`.toLowerCase();
      return hay.includes(query);
    });
  }

  if (!filtered.length) {
    const listEl = document.getElementById('progress-list');
    if (listEl) {
      const typePart = progressTypeFilter !== 'all' ? typeLabel(progressTypeFilter).toLowerCase() + ' ' : '';
      const subPart = progressSubjectFilter ? `${progressSubjectFilter} ` : '';
      listEl.innerHTML = `<p class="empty-state">No ${subPart}${typePart}records match${query ? ' your search' : ' for this class'}.</p>`;
    }
    return;
  }

  renderProgressCards(filtered);
}

async function loadProgressList() {
  const listEl = document.getElementById('progress-list');
  if (!listEl) return;

  showProgressCreateForm(false);
  const editor = document.getElementById('progress-editor');
  if (editor) {
    editor.hidden = true;
    editor.setAttribute('hidden', '');
  }
  setProgressListChromeVisible(true);
  const listWrap = document.getElementById('progress-list-wrap');
  if (listWrap) {
    listWrap.hidden = false;
    listWrap.removeAttribute('hidden');
  }

  if (!teacherCurrentClass) {
    listEl.innerHTML = '<p class="empty-state">Select a class from the sidebar first.</p>';
    return;
  }

  try {
    const params = new URLSearchParams({
      grade: teacherCurrentClass.grade,
      section: teacherCurrentClass.section,
      quarter: teacherCurrentQuarter
    });
    const res = await fetch(`${API_URL}/teacher/assessments?${params}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    progressAssessments = Array.isArray(data) ? data : [];
    filterProgressList();
  } catch (err) {
    console.error('Load progress error:', err);
    listEl.innerHTML = '<p class="empty-state">Failed to load progress records.</p>';
  }
}

function setProgressListChromeVisible(show) {
  const chrome = document.getElementById('progress-list-chrome');
  if (!chrome) return;
  chrome.hidden = !show;
  if (show) chrome.removeAttribute('hidden');
  else chrome.setAttribute('hidden', '');
}

function groupQuestionsBySection(questions) {
  const groups = [];
  const map = new Map();
  for (const q of questions || []) {
    const key = String(q.item_type || 'mcq');
    if (!map.has(key)) {
      const group = { item_type: key, label: bankItemTypeLabel(key), items: [] };
      map.set(key, group);
      groups.push(group);
    }
    map.get(key).items.push(q);
  }
  return groups;
}

function progressQuestionItemHtml(q, idx) {
  const type = canonicalBankItemType(q.item_type || 'mcq');
  const pts = Number(q.points) || 1;
  const choices = Array.isArray(q.choices) && q.choices.length
    ? `<ul class="progress-choice-list">${q.choices.map((c, i) =>
        `<li><strong>${String.fromCharCode(65 + i)}.</strong> ${escapeHtml(c)}</li>`
      ).join('')}</ul>`
    : '';
  const answer = q.answer
    ? `<div class="progress-q-answer"><strong>Correct:</strong> ${escapeHtml(formatMcqAnswerDisplay(q.answer, q.choices) || String(q.answer))}</div>`
    : '';
  const rubric = isActivityItemType(type) ? rubricPreviewHtml(q.rubric) : '';
  return `<li class="progress-q-item">
    <span class="progress-q-num">${idx + 1}.</span>
    <div class="progress-q-body">
      <div class="progress-q-meta">
        <span class="progress-q-type">${escapeHtml(bankItemTypeLabel(type))}</span>
        <span class="progress-q-pts">${pts} pt${pts === 1 ? '' : 's'}</span>
      </div>
      <div class="progress-q-text">${escapeHtml(q.question || '')}</div>
      ${choices}
      ${answer}
      ${rubric}
    </div>
  </li>`;
}

function renderProgressQuestionSections(questions, assessmentId) {
  const qList = document.getElementById('progress-questions-list');
  if (!qList) return;
  const groups = groupQuestionsBySection(questions);
  let number = 0;
  qList.innerHTML = groups.map((group) => {
    const items = group.items.map((q) => progressQuestionItemHtml(q, number++)).join('');
    return `<li class="progress-q-section" draggable="true" data-section-type="${escapeHtml(group.item_type)}">
      <div class="progress-q-section-head">
        <span class="progress-q-drag" aria-hidden="true">⋮⋮</span>
        <strong>${escapeHtml(group.label)}</strong>
        <span class="page-subheading">${group.items.length} item${group.items.length === 1 ? '' : 's'}</span>
      </div>
      <ol class="progress-questions-list">${items}</ol>
    </li>`;
  }).join('');

  let dragEl = null;
  let startOrder = '';
  qList.querySelectorAll('.progress-q-section').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      dragEl = el;
      startOrder = [...qList.querySelectorAll('.progress-q-section')].map((n) => n.dataset.sectionType).join('|');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', el.dataset.sectionType || '');
      el.classList.add('is-dragging');
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragEl || dragEl === el) return;
      const rect = el.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      qList.insertBefore(dragEl, after ? el.nextSibling : el);
    });
    el.addEventListener('dragend', async () => {
      el.classList.remove('is-dragging');
      const order = [...qList.querySelectorAll('.progress-q-section')].map((n) => n.dataset.sectionType);
      dragEl = null;
      if (!order.length || order.join('|') === startOrder) return;
      try {
        const res = await fetch(`${API_URL}/teacher/assessments/${assessmentId}/section-order`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ section_order: order })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save section order');
        const saved = Array.isArray(data.section_order) ? data.section_order : order;
        const regrouped = [];
        const buckets = new Map(groupQuestionsBySection(questions).map((g) => [g.item_type, g.items]));
        saved.forEach((key) => {
          if (buckets.has(key)) regrouped.push(...buckets.get(key));
        });
        window._progressEditorQuestions = regrouped;
        renderProgressQuestionSections(regrouped, assessmentId);
        showToast('Section order saved');
      } catch (err) {
        showToast(err.message, 'error');
        renderProgressQuestionSections(questions, assessmentId);
      }
    });
  });
}

window.openProgressEditor = async function(id, mode = 'edit') {
  const editor = document.getElementById('progress-editor');
  showProgressCreateForm(false);
  setProgressListChromeVisible(false);
  if (editor) {
    editor.hidden = false;
    editor.removeAttribute('hidden');
  }

  const normalizedMode = mode === 'link' ? 'link' : 'edit';
  if (editor) editor.dataset.mode = normalizedMode;

  try {
    const subjectMode = teacherCurrentClass && isSubjectAttendanceGrade(teacherCurrentClass.grade);
    const sessionQ = subjectMode ? '' : `?session=${encodeURIComponent(currentManilaSessionClient())}`;
    const res = await fetch(`${API_URL}/teacher/assessments/${id}${sessionQ}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const a = data.assessment;
    progressEditorMax = Number(a.max_score) || 100;
    if (editor) editor.dataset.assessmentId = String(a.id);
    window._progressEditorAssessment = a;
    window._progressEditorStudents = data.students || [];
    window._progressEditorMakeupCandidates = data.makeup_candidates || [];

    const questions = Array.isArray(data.questions) ? data.questions : [];
    window._progressEditorQuestions = questions;
    window._progressRubricColumns = buildProgressRubricColumns(questions, a.rubric);
    const rubricCap = rubricCapFromProgressColumns();
    progressEditorMax = rubricCap > 0 ? rubricCap : (Number(a.max_score) || 100);
    if (rubricCap > 0 && Number(a.max_score) !== rubricCap) {
      a.max_score = rubricCap;
      fetch(`${API_URL}/teacher/assessments/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ max_score: rubricCap })
      }).catch(() => {});
    }
    const hasQuestions = questions.length > 0;
    if (editor) editor.dataset.hasQuestions = hasQuestions ? '1' : '0';

    // Manual New Record (no questions): scores only — no Shared link / online enable
    let effectiveMode = normalizedMode;
    if (!hasQuestions && effectiveMode === 'link') {
      effectiveMode = 'edit';
      if (editor) editor.dataset.mode = effectiveMode;
    }

    const titleEl = document.getElementById('progress-editor-title');
    const metaEl = document.getElementById('progress-editor-meta');
    if (titleEl) titleEl.textContent = a.title;
    if (metaEl) {
      const modeLabel = effectiveMode === 'link' ? ' · Shared link' : '';
      metaEl.textContent = `${typeLabel(a.type)} · ${a.subject_name || 'No subject'} · Total score ${progressEditorMax}${modeLabel}`;
    }

    setProgressEditorMode(effectiveMode, hasQuestions);

    const printPaperBtn = document.getElementById('progress-print-paper');
    const printKeyBtn = document.getElementById('progress-print-key');
    const printSheetBtn = document.getElementById('progress-print-scoresheet');
    if (printPaperBtn) {
      printPaperBtn.hidden = !hasQuestions;
      if (hasQuestions) printPaperBtn.removeAttribute('hidden');
      else printPaperBtn.setAttribute('hidden', '');
    }
    if (printKeyBtn) {
      const isActivityRecord = String(a.type || '').toLowerCase() === 'activity'
        || (hasQuestions && questions.every((q) => isActivityItemType(q.item_type)));
      const showAnswerKey = hasQuestions && !isActivityRecord;
      printKeyBtn.hidden = !showAnswerKey;
      if (showAnswerKey) printKeyBtn.removeAttribute('hidden');
      else printKeyBtn.setAttribute('hidden', '');
    }
    if (printSheetBtn) {
      const showSheet = (window._progressRubricColumns || []).length > 0;
      printSheetBtn.hidden = !showSheet;
      if (showSheet) printSheetBtn.removeAttribute('hidden');
      else printSheetBtn.setAttribute('hidden', '');
    }

    const linkInput = document.getElementById('progress-editor-quiz-link');
    const linkOpen = document.getElementById('progress-quiz-link-open');
    if (linkInput) {
      linkInput.value = a.quiz_link || '';
      linkInput.readOnly = effectiveMode !== 'link';
    }
    if (linkOpen) {
      if (a.quiz_link) {
        linkOpen.href = a.quiz_link;
        linkOpen.hidden = false;
      } else {
        linkOpen.removeAttribute('href');
        linkOpen.hidden = true;
      }
    }

    const qWrap = document.getElementById('progress-attached-questions');
    const qList = document.getElementById('progress-questions-list');
    const qCount = document.getElementById('progress-questions-count');
    updateProgressShareUi(a, data.attendance_meta, questions.length);
    if (qWrap && qList) {
      if (effectiveMode === 'link' && questions.length) {
        qWrap.hidden = false;
        qWrap.removeAttribute('hidden');
        if (qCount) qCount.textContent = `(${questions.length})`;
        renderProgressQuestionSections(questions, id);
      } else {
        qWrap.hidden = true;
        qWrap.setAttribute('hidden', '');
        qList.innerHTML = '';
        if (qCount) qCount.textContent = '';
      }
    }

    renderProgressRubricGuide(questions, a);

    if (effectiveMode !== 'link') {
      renderProgressScoresTable(effectiveMode, a, data.students || []);
    }
  } catch (err) {
    showToast(err.message, 'error');
    loadProgressList();
  }
};

function buildProgressRubricColumns(questions, assessmentRubric) {
  const cols = [];
  const activities = (questions || []).filter(
    (q) => isActivityItemType(q.item_type) && normalizeRubricClient(q.rubric)
  );
  const sources = activities.length
    ? activities.map((q) => q.rubric)
    : (normalizeRubricClient(assessmentRubric) ? [assessmentRubric] : []);
  const multi = sources.length > 1;
  sources.forEach((rubric, ai) => {
    const cats = rubricCategoriesOf(normalizeRubricClient(rubric) || rubric);
    cats.forEach((c, ci) => {
      const name = String(c.name || `Category ${ci + 1}`).trim();
      cols.push({
        key: `a${ai}_${ci}`,
        label: multi ? `A${ai + 1}: ${name}` : name,
        shortLabel: name,
        max_points: Math.max(1, Number(c.max_points) || 1),
        activityIndex: ai
      });
    });
  });
  return cols;
}

function rubricCapFromProgressColumns(cols = window._progressRubricColumns) {
  const list = Array.isArray(cols) ? cols : [];
  const sum = list.reduce((s, c) => s + Math.max(0, Number(c.max_points) || 0), 0);
  return sum > 0 ? Math.round(sum * 100) / 100 : 0;
}

function rubricCapFromBankItems(items) {
  let sum = 0;
  let any = false;
  for (const it of items || []) {
    if (!isActivityItemType(it.item_type)) continue;
    const cats = rubricCategoriesOf(normalizeRubricClient(it.rubric) || it.rubric);
    if (!cats.length) continue;
    any = true;
    sum += cats.reduce((s, c) => s + Math.max(1, Number(c.max_points) || 1), 0);
  }
  return any ? Math.round(sum * 100) / 100 : 0;
}

function syncProgressRowRubricTotal(tr) {
  if (!tr) return;
  const totalInput = tr.querySelector('.progress-score-input');
  const pctCell = tr.querySelector('.progress-pct-cell');
  const catInputs = [...tr.querySelectorAll('.progress-rubric-cat-input')];
  if (!totalInput || !catInputs.length) return;
  const values = catInputs.map((inp) => (inp.value === '' ? null : Number(inp.value)));
  if (values.every((v) => v == null)) {
    totalInput.value = '';
    if (pctCell) pctCell.textContent = '—';
    return;
  }
  const sum = values.reduce((s, v) => s + (Number(v) || 0), 0);
  totalInput.value = String(Math.round(sum * 100) / 100);
  if (pctCell) {
    pctCell.textContent = scorePercentDisplay(sum, progressEditorMax);
  }
}

function parseRubricScoresClient(raw) {
  if (raw == null || raw === '') return null;
  let v = raw;
  for (let i = 0; i < 4; i++) {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    if (typeof v !== 'string') break;
    const t = v.trim();
    if (!t || t === '[object Object]') return null;
    try {
      v = JSON.parse(t);
    } catch {
      return null;
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function rubricSavedCategoryValue(saved, col) {
  const bag = parseRubricScoresClient(saved) || saved;
  if (!bag || typeof bag !== 'object' || !col) return null;
  const keys = [col.key, col.shortLabel, col.label];
  for (const k of keys) {
    if (!k) continue;
    const v = bag[k];
    if (v !== null && v !== undefined && v !== '') return v;
  }
  const want = String(col.shortLabel || col.label || '').trim().toLowerCase();
  if (want) {
    for (const [k, v] of Object.entries(bag)) {
      if (String(k).trim().toLowerCase() === want && v !== null && v !== undefined && v !== '') return v;
    }
  }
  return null;
}

function markRubricCategoryOverMax(input) {
  if (!input) return false;
  const max = Number(input.dataset.maxPoints);
  const over = input.value !== '' && Number.isFinite(max) && Number(input.value) > max;
  input.classList.toggle('progress-rubric-over', over);
  const td = input.closest('td');
  if (td) td.classList.toggle('progress-rubric-over-cell', over);
  if (over && input.dataset.overToast !== '1') {
    input.dataset.overToast = '1';
    const label = input.dataset.rubricLabel || 'This category';
    showToast(`${label} can't exceed ${max} pts.`, 'error');
  }
  if (!over) input.dataset.overToast = '';
  return over;
}

function progressRubricHasOverMax(scope = document.getElementById('progress-scores-table')) {
  if (!scope) return false;
  return [...scope.querySelectorAll('.progress-rubric-cat-input')].some((inp) => {
    if (inp.disabled) return false;
    const max = Number(inp.dataset.maxPoints);
    return inp.value !== '' && Number.isFinite(max) && Number(inp.value) > max;
  });
}

function renderProgressScoresTable(mode, assessment, students) {
  const theadRow = document.getElementById('progress-scores-thead-row');
  const tbody = document.querySelector('#progress-scores-table tbody');
  const table = document.getElementById('progress-scores-table');
  const makeupAllBtn = document.getElementById('progress-makeup-all');
  if (!tbody) return;

  const sortedStudents = [...(students || [])].sort(compareStudentsByAttendanceOrder);
  const shareOn = assessment && Number(assessment.share_enabled) === 1;
  const editMode = mode === 'edit';
  const rubricCols = Array.isArray(window._progressRubricColumns) ? window._progressRubricColumns : [];
  const hasRubric = rubricCols.length > 0;
  const editorQs = window._progressEditorQuestions || [];
  const hasActivityQs = editorQs.some((q) => isActivityItemType(q.item_type));
  const hasQuizQs = editorQs.some((q) => !isActivityItemType(q.item_type));
  const anySubmittedWork = sortedStudents.some((row) =>
    (Array.isArray(row.activity_work) && row.activity_work.length)
    || (Array.isArray(row.quiz_taken) && row.quiz_taken.length)
  );
  const showWorkCol = anySubmittedWork || ((hasActivityQs || hasQuizQs) && shareOn);
  const workHead = showWorkCol ? '<th>Work</th>' : '';

  if (table) {
    table.classList.toggle('progress-scores-table--edit', editMode);
    table.classList.toggle('progress-scores-table--rubric', hasRubric);
    table.classList.toggle('progress-scores-table--work', showWorkCol);
  }

  if (theadRow) {
    if (hasRubric) {
      const catHeads = rubricCols
        .map((c) => `<th class="progress-rubric-cat-th">${escapeHtml(c.label)}<br><span class="page-subheading">${c.max_points} pts</span></th>`)
        .join('');
      theadRow.innerHTML = editMode
        ? `<th>Student</th>${workHead}${catHeads}<th>Total</th><th>%</th><th>Attendance</th><th>Access</th>`
        : `<th>Student</th>${workHead}${catHeads}<th>Total</th><th>%</th>`;
    } else {
      theadRow.innerHTML = editMode
        ? `<th>Student</th>${workHead}<th>Score</th><th>%</th><th>Attendance</th><th>Access</th>`
        : `<th>Student</th>${workHead}<th>Score</th><th>%</th>`;
    }
  }

  let makeupEligible = 0;
  tbody.innerHTML = sortedStudents.map((s) => {
    const score = s.score === null || s.score === undefined ? '' : s.score;
    const pct = score === '' ? '—' : scorePercentDisplay(score, progressEditorMax);
    const nameCell = `<td class="att-name-cell"><strong>${formatStudentNameStacked(s)}</strong></td>`;
    const savedRubric = parseRubricScoresClient(s.rubric_scores) || {};
    const stEarly = String(s.attendance_status || '');
    const scoreLocked = !!(shareOn && !s.submitted && (stEarly === 'Absent' || stEarly === 'Excused'));
    const lockAttr = scoreLocked ? 'disabled' : '';
    const lockTitle = scoreLocked
      ? 'title="Absent or excused students can be scored after they submit."'
      : '';
    const workList = Array.isArray(s.activity_work) ? s.activity_work : [];
    const quizTaken = Array.isArray(s.quiz_taken) ? s.quiz_taken : [];
    const workBtns = [];
    if (quizTaken.length) {
      const quizLabel = workList.length ? 'View quiz' : 'View work';
      workBtns.push(`<button type="button" class="chip-ghost" data-view-work="quiz" data-student-id="${Number(s.id)}" onclick="viewProgressQuizTaken(${Number(s.id)})">${quizLabel}</button>`);
    }
    if (workList.length) {
      workBtns.push(`<button type="button" class="chip-ghost" data-view-work="activity" data-student-id="${Number(s.id)}" onclick="viewProgressActivityWork(${Number(s.id)})">View work</button>`);
    }
    const workCell = showWorkCol
      ? `<td class="progress-work-cell">${workBtns.length ? workBtns.join('') : '—'}</td>`
      : '';

    const catCellsView = hasRubric
      ? rubricCols.map((c) => {
          const v = rubricSavedCategoryValue(savedRubric, c);
          if (v === null) return '<td>—</td>';
          const n = Number(v);
          const over = Number.isFinite(n) && n > Number(c.max_points);
          return `<td class="${over ? 'progress-rubric-over-cell' : ''}">${escapeHtml(String(v))}</td>`;
        }).join('')
      : '';

    const catCellsEdit = hasRubric
      ? rubricCols.map((c) => {
          const v = rubricSavedCategoryValue(savedRubric, c);
          const val = v === null ? '' : v;
          const n = Number(val);
          const over = val !== '' && Number.isFinite(n) && n > Number(c.max_points);
          return `<td class="${over ? 'progress-rubric-over-cell' : ''}">
            <input type="number" class="progress-rubric-cat-input${over ? ' progress-rubric-over' : ''}" min="0" step="0.5"
              value="${escapeHtml(String(val))}" data-student-id="${s.id}" data-rubric-key="${escapeHtml(c.key)}"
              data-max-points="${c.max_points}" data-rubric-label="${escapeHtml(c.shortLabel || c.label)}"
              title="${escapeHtml(c.label)} (max ${c.max_points} pts)" ${lockAttr} ${lockTitle} />
          </td>`;
        }).join('')
      : '';

    if (editMode) {
      const st = String(s.attendance_status || '');
      const letter = statusToLetter(st);
      const attHtml = letter
        ? `<span class="${letterClass(letter)}" title="${escapeHtml(st)}">${letter}</span>`
        : '<span class="att-mark att-mark-empty" title="Not recorded">—</span>';

      let accessHtml = '<span class="progress-access-none">—</span>';
      if (s.submitted) {
        accessHtml = '<span class="progress-access-submitted">Submitted</span>';
      } else if (shareOn && (st === 'Absent' || st === 'Excused')) {
        if (s.makeup) {
          accessHtml = `<button type="button" class="chip-ghost" onclick="revokeMakeupForStudent(${s.id})">Unallow</button>`;
        } else {
          makeupEligible += 1;
          accessHtml = `<button type="button" class="chip-ghost primary" onclick="grantMakeupForStudent(${s.id})">Allow Access</button>`;
        }
      }

      const totalReadonly = hasRubric || scoreLocked ? 'readonly' : '';
      const totalDisabled = scoreLocked ? 'disabled' : '';
      const totalTitle = scoreLocked
        ? 'title="Absent or excused students can be scored after they submit."'
        : (hasRubric ? 'title="Sum of rubric categories"' : '');

      return `
        <tr data-student-id="${s.id}" ${scoreLocked ? 'data-score-locked="1"' : ''}>
          ${nameCell}
          ${workCell}
          ${catCellsEdit}
          <td>
            <input type="number" class="progress-score-input" min="0" max="${progressEditorMax}" step="0.01"
                   value="${score}" data-student-id="${s.id}" style="width:90px;" ${totalReadonly} ${totalDisabled} ${totalTitle} />
          </td>
          <td class="progress-pct-cell">${pct}</td>
          <td class="progress-att-cell">${attHtml}</td>
          <td class="progress-access-cell">${accessHtml}</td>
        </tr>`;
    }

    return `
      <tr data-student-id="${s.id}">
        ${nameCell}
        ${workCell}
        ${catCellsView}
        <td>${score === '' ? '—' : escapeHtml(String(score))}</td>
        <td>${pct}</td>
      </tr>`;
  }).join('');

  if (makeupAllBtn) {
    const showAll = editMode && shareOn && makeupEligible > 0;
    makeupAllBtn.hidden = !showAll;
    if (showAll) makeupAllBtn.removeAttribute('hidden');
    else makeupAllBtn.setAttribute('hidden', '');
  }

  bindProgressWorkClicks(table);

  if (editMode) {
    bindProgressScoreCellKeys(tbody);
    tbody.querySelectorAll('.progress-rubric-cat-input').forEach((input) => {
      if (input.disabled) return;
      input.addEventListener('input', () => {
        if (rejectNegativeScoreInput(input)) {
          syncProgressRowRubricTotal(input.closest('tr'));
          return;
        }
        input.dataset.negToast = '';
        markRubricCategoryOverMax(input);
        syncProgressRowRubricTotal(input.closest('tr'));
      });
    });
    tbody.querySelectorAll('.progress-score-input').forEach((input) => {
      if (input.readOnly || input.disabled) return;
      clampProgressTotalInput(input);
      input.addEventListener('input', () => clampProgressTotalInput(input));
      input.addEventListener('change', () => clampProgressTotalInput(input));
    });
  }
}

function bindProgressWorkClicks(root) {
  if (!root || root.dataset.workClicks === '1') return;
  root.dataset.workClicks = '1';
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view-work]');
    if (!btn || !root.contains(btn) || btn.getAttribute('onclick')) return;
    const kind = btn.getAttribute('data-view-work');
    if (kind === 'parent') {
      window.viewParentWork(Number(btn.getAttribute('data-assessment-id')));
      return;
    }
    const studentId = Number(btn.getAttribute('data-student-id'));
    if (kind === 'activity') window.viewProgressActivityWork(studentId);
    else window.viewProgressQuizTaken(studentId);
  });
}

function bindProgressScoreCellKeys(tbody) {
  if (!tbody || tbody.dataset.scoreKeysBound === '1') return;
  tbody.dataset.scoreKeysBound = '1';

  const isScoreInput = (el) =>
    el?.matches?.('.progress-score-input, .progress-rubric-cat-input') && !el.disabled;

  const refreshAfterValueChange = (input) => {
    if (input.classList.contains('progress-rubric-cat-input')) {
      if (!rejectNegativeScoreInput(input)) {
        input.dataset.negToast = '';
        markRubricCategoryOverMax(input);
      }
      syncProgressRowRubricTotal(input.closest('tr'));
      return;
    }
    if (input.readOnly) return;
    if (input.value === '') {
      const cell = input.closest('tr')?.querySelector('.progress-pct-cell');
      if (cell) cell.textContent = '—';
      return;
    }
    clampProgressTotalInput(input);
  };

  tbody.addEventListener('focusin', (e) => {
    const input = isScoreInput(e.target) ? e.target : null;
    if (input) input.dataset.cellDraft = input.value;
  });

  tbody.addEventListener('keydown', (e) => {
    const input = isScoreInput(e.target) ? e.target : null;
    if (!input) return;
    if (e.key === '-' || e.key === 'Subtract') {
      e.preventDefault();
      if (input.dataset.negToast !== '1') {
        input.dataset.negToast = '1';
        showToast("Scores can't be negative.", 'error');
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      refreshAfterValueChange(input);
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.value = input.dataset.cellDraft ?? '';
      refreshAfterValueChange(input);
      input.blur();
    }
  });
}

window.viewProgressActivityWork = function (studentId) {
  openProgressTakenModal(studentId, 'activity');
};

window.viewProgressQuizTaken = function (studentId) {
  openProgressTakenModal(studentId, 'quiz');
};

function isIdentificationTakenItem(item) {
  return String(item?.item_type || '').toLowerCase() === 'identification';
}

function identificationBankFromTaken(items) {
  const ids = (items || []).filter(isIdentificationTakenItem);
  const seen = new Set();
  const answers = [];
  const add = (raw, list) => {
    const text = String(raw || '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(text);
  };
  ids.forEach((item) => add(item.expected, answers));
  if (!answers.length) return [];
  const words = answers.slice();
  ids.forEach((item) => {
    (Array.isArray(item.choices) ? item.choices : []).forEach((word) => add(word, words));
  });
  return words;
}

function identificationAnswerBoxHtml(words) {
  const list = (words || []).map((w) => String(w || '').trim()).filter(Boolean);
  if (!list.length) return '';
  return `<div class="progress-id-box">
    <p class="progress-id-box-label">Answer box</p>
    <div class="progress-id-words">${list.map((w) => `<span>${escapeHtml(w)}</span>`).join('')}</div>
  </div>`;
}

function quizTakenHtmlWithAnswerBox(items, boxHtml, renderItem) {
  let placed = false;
  return (items || []).map((item) => {
    const piece = renderItem(item);
    if (!placed && boxHtml && isIdentificationTakenItem(item)) {
      placed = true;
      return boxHtml + piece;
    }
    return piece;
  }).join('');
}

function openProgressTakenModal(studentId, kind) {
  const students = window._progressEditorStudents || [];
  const s = students.find((row) => Number(row.id) === Number(studentId));
  const isQuiz = kind === 'quiz';
  const work = isQuiz
    ? (Array.isArray(s?.quiz_taken) ? s.quiz_taken : [])
    : (Array.isArray(s?.activity_work) ? s.activity_work : []);
  const titleEl = document.getElementById('progress-activity-work-title');
  const subEl = document.getElementById('progress-activity-work-sub');
  const bodyEl = document.getElementById('progress-activity-work-body');
  if (titleEl) {
    titleEl.textContent = s ? `${s.last_name || ''}, ${s.first_name || ''}`.replace(/^,\s*/, '') : (isQuiz ? 'Quiz taken' : 'Student work');
  }
  if (subEl) {
    subEl.textContent = isQuiz
      ? 'Submitted from the live quiz link.'
      : 'Submitted from the live activity link.';
  }
  if (bodyEl) {
    if (!work.length) {
      bodyEl.innerHTML = `<p class="page-subheading">${isQuiz ? 'No quiz submission.' : 'No submitted work.'}</p>`;
    } else if (isQuiz) {
      const box = identificationAnswerBoxHtml(identificationBankFromTaken(work));
      bodyEl.innerHTML = quizTakenHtmlWithAnswerBox(work, box, renderProgressQuizTakenItem);
    } else {
      bodyEl.innerHTML = work.map((item, i) => {
        const url = String(item.file?.url || '');
        const safeUrl = url.startsWith('/uploads/') ? url : '';
        const fileHtml = safeUrl
          ? `<p style="margin:0;"><a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${escapeHtml(item.file.name || 'Open file')}</a></p>`
          : '';
        const text = String(item.text || '').trim();
        return `<div class="progress-work-item">
          <p class="page-subheading" style="margin:0 0 6px;"><strong>Activity ${i + 1}</strong></p>
          ${item.question ? `<p style="margin:0 0 8px;font-size:0.86rem;">${escapeHtml(item.question)}</p>` : ''}
          ${text ? `<p class="progress-activity-work">${escapeHtml(text)}</p>` : '<p class="page-subheading">No written answer.</p>'}
          ${fileHtml}
        </div>`;
      }).join('');
    }
  }
  openAdminModal('progress-activity-work-modal');
}

function renderProgressQuizTakenItem(item) {
  const n = Number(item.n) || 1;
  const isId = isIdentificationTakenItem(item);
  const choices = isId ? [] : (Array.isArray(item.choices) ? item.choices : []);
  const given = formatQuizTakenAnswer(item.given, choices);
  const expected = formatQuizTakenAnswer(item.expected, choices);
  const mark = item.correct === true ? 'Correct' : item.correct === false ? 'Incorrect' : '';
  const markHtml = mark ? ` <span class="page-subheading">${escapeHtml(mark)}</span>` : '';
  const choiceHtml = choices.length
    ? `<p class="page-subheading" style="margin:0 0 4px;"><strong>Choices:</strong></p>
       <ul class="progress-quiz-choices">${choices.map((c, i) => {
         const body = stripMcqChoicePrefix(c) || String(c || '');
         return `<li>${escapeHtml(mcqLetterAt(i))}. ${escapeHtml(body)}</li>`;
       }).join('')}</ul>`
    : '';
  return `<div class="progress-work-item">
    <p class="page-subheading" style="margin:0 0 8px;"><strong>Item ${n}</strong>${markHtml}</p>
    <p style="margin:0 0 8px;font-size:0.86rem;"><strong>Question:</strong> ${escapeHtml(item.question || '')}</p>
    ${choiceHtml}
    <p class="progress-activity-work"><strong>Student answer:</strong> ${given ? escapeHtml(given) : '—'}</p>
    <p class="progress-activity-work" style="margin-bottom:0;"><strong>Answer key:</strong> ${expected ? escapeHtml(expected) : '—'}</p>
  </div>`;
}

function setProgressEditorMode(mode, hasQuestions = true) {
  const normalized = mode === 'link' ? 'link' : 'edit';
  const saveBtn = document.getElementById('progress-scores-save');
  const editBtn = document.getElementById('progress-mode-edit');
  const linkBtn = document.getElementById('progress-mode-link');
  const linkSave = document.getElementById('progress-quiz-link-save');
  const scoresSection = document.querySelector('#progress-editor .progress-scores-only');
  const allowLink = !!hasQuestions;

  if (saveBtn) {
    const showSave = normalized !== 'link';
    saveBtn.hidden = !showSave;
    if (showSave) saveBtn.removeAttribute('hidden');
    else saveBtn.setAttribute('hidden', '');
  }
  if (linkSave) linkSave.hidden = normalized !== 'link';

  if (editBtn) {
    editBtn.hidden = true;
    editBtn.setAttribute('hidden', '');
  }
  // Shared link only for Classwork-created quizzes (questions attached)
  if (linkBtn) {
    const showLinkBtn = allowLink && normalized !== 'link';
    linkBtn.hidden = !showLinkBtn;
    if (showLinkBtn) linkBtn.removeAttribute('hidden');
    else linkBtn.setAttribute('hidden', '');
  }

  document.querySelectorAll('#progress-editor .progress-link-only').forEach((el) => {
    const show = allowLink && normalized === 'link';
    el.hidden = !show;
    if (show) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  });

  if (scoresSection) {
    const showScores = !allowLink || normalized !== 'link';
    scoresSection.hidden = !showScores;
    if (showScores) scoresSection.removeAttribute('hidden');
    else scoresSection.setAttribute('hidden', '');
  }
}

function progressRubricGuideActivities(questions, assessment) {
  const activities = (questions || []).filter((q) =>
    isActivityItemType(q.item_type) && normalizeRubricClient(q.rubric)
  );
  if (activities.length) return activities;
  if (!normalizeRubricClient(assessment?.rubric)) return [];
  return [{
    question: assessment.title || '',
    points: rubricCategoriesSum(assessment.rubric) || Number(assessment.max_score) || 0,
    rubric: assessment.rubric
  }];
}

function renderProgressRubricGuide(questions, assessment) {
  const wrap = document.getElementById('progress-rubric-guide');
  const body = document.getElementById('progress-rubric-guide-body');
  if (!wrap || !body) return;
  const activities = progressRubricGuideActivities(questions, assessment);
  if (!activities.length) {
    wrap.hidden = true;
    wrap.open = false;
    wrap.setAttribute('hidden', '');
    body.innerHTML = '';
    return;
  }
  body.innerHTML = activities.map((q, i) => `
    <div style="margin-bottom:12px;">
      <p class="page-subheading" style="margin:0 0 6px;"><strong>Activity ${i + 1}</strong> · ${Number(q.points) || 0} pts</p>
      <p style="margin:0 0 6px;font-size:0.86rem;">${escapeHtml(q.question || '')}</p>
      ${rubricPreviewHtml(q.rubric)}
    </div>
  `).join('');
  wrap.hidden = false;
  wrap.open = true;
  wrap.removeAttribute('hidden');
}

function assessmentPaperItemHtml(q, index, { includeAnswers = false } = {}) {
  const type = canonicalBankItemType(q.item_type || 'mcq');
  const pts = Number(q.points) || 1;
  const typeLabelText = bankItemTypeLabel(type);
  let body = `<div class="q-text">${escapeHtml(q.question || '')}</div>`;

  if (type === 'mcq' && Array.isArray(q.choices) && q.choices.length) {
    body += `<ol class="choices" type="A">${q.choices.map((c) => {
      const bodyText = stripMcqChoicePrefix(c) || String(c || '');
      return `<li>${escapeHtml(bodyText)}</li>`;
    }).join('')}</ol>`;
  } else if (isActivityItemType(type)) {
    body += '<div class="write-lines"><em>Performance / activity space — score using the rubric below.</em></div>';
  } else {
    body += '<div class="write-lines">_______________________________________________</div>';
    body += '<div class="write-lines">_______________________________________________</div>';
  }

  let answerBlock = '';
  if (includeAnswers && q.answer) {
    answerBlock = `<div class="answer-key"><strong>Answer:</strong> ${escapeHtml(formatQuizTakenAnswer(q.answer, q.choices) || String(q.answer))}</div>`;
  }

  let rubricBlock = '';
  if (isActivityItemType(type) && q.rubric) {
    const cats = rubricCategoriesOf(q.rubric);
    const rows = cats.map((c) => {
      const levels = (c.levels || []).map((lv) =>
        `<tr><td>${escapeHtml(lv.label || '')}</td><td>${Number(lv.points) || 0}</td><td>${escapeHtml(lv.description || '')}</td></tr>`
      ).join('');
      return `<h3 class="rubric-crit">${escapeHtml(c.name || '')} (${Number(c.max_points) || 0} pts)</h3>
        <table class="rubric-table"><thead><tr><th>Level</th><th>Pts</th><th>Description</th></tr></thead><tbody>${levels}</tbody></table>`;
    }).join('');
    rubricBlock = cats.length ? `<div class="rubric-block"><strong>Rubric</strong>${rows}</div>` : '';
  }

  return `
    <div class="q-block">
      <div class="q-head"><strong>${index + 1}.</strong> <span class="q-type">${escapeHtml(typeLabelText)}</span> <span class="q-pts">(${pts} pt${pts === 1 ? '' : 's'})</span></div>
      ${body}
      ${answerBlock}
      ${rubricBlock}
    </div>`;
}

function printAssessmentItemsPaper({
  questions,
  title,
  type,
  subject_name,
  grade_level,
  section,
  quarter,
  max_score,
  includeAnswers = false,
  reviewCopy = false
} = {}) {
  const items = Array.isArray(questions) ? questions : [];
  if (!items.length) {
    showToast('No items to print.', 'error');
    return;
  }

  const maxScore = Number(max_score) || items.reduce((s, q) => s + (Number(q.points) || 1), 0);
  const heading = includeAnswers
    ? `${escapeHtml(title || 'Assessment')} — ${reviewCopy ? 'For Review' : 'ANSWER KEY (Teacher only)'}`
    : escapeHtml(title || 'Assessment');
  const meta = [
    type ? typeLabel(type) : null,
    subject_name || null,
    grade_level != null && grade_level !== '' ? `Grade ${grade_level}${section ? `-${section}` : ''}` : null,
    quarter || null,
    `${items.length} item(s)`,
    `Total score ${Math.round(maxScore * 100) / 100}`
  ].filter(Boolean).join(' · ');

  const nameBlock = includeAnswers
    ? ''
    : `<div class="name-row"><span>Name: _______________________________</span><span>Score: ______ / ${Math.round(maxScore * 100) / 100}</span></div>`;

  const groups = groupBankItemsByType(items);
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  let qIndex = 0;
  const bodyParts = groups.map((g, gi) => {
    const partPts = g.items.reduce((s, q) => s + (Number(q.points) || 1), 0);
    const partLabel = roman[gi] || String(gi + 1);
    const sectionHead = `<h2 class="section-head">${partLabel}. ${escapeHtml(g.label)} <span class="q-pts">(${Math.round(partPts * 100) / 100} pts)</span></h2>`;
    const itemsHtml = g.items.map((q) => {
      const html = assessmentPaperItemHtml(q, qIndex, { includeAnswers });
      qIndex += 1;
      return html;
    }).join('');
    return `${sectionHead}${itemsHtml}`;
  });

  const notice = includeAnswers && !reviewCopy
    ? '<p class="meta"><strong>Do not distribute to students.</strong></p>'
    : '';

  const bodyHtml = `
    <h1>${heading}</h1>
    <p class="meta">${escapeHtml(meta)}</p>
    ${nameBlock}
    ${notice}
    ${bodyParts.join('')}
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${includeAnswers ? (reviewCopy ? 'For Review' : 'Answer Key') : '\u00A0'}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #222; padding: 20px; font-size: 12px; line-height: 1.45; }
      h1 { font-size: 16px; margin: 0 0 6px; color: #3d0a0a; }
      h2.section-head { font-size: 13px; margin: 18px 0 10px; color: #3d0a0a; page-break-after: avoid; }
      .meta { margin: 0 0 14px; color: #555; font-size: 11px; }
      .name-row { display: flex; justify-content: space-between; gap: 16px; margin: 0 0 18px; font-size: 12px; }
      .q-block { margin: 0 0 16px; page-break-inside: avoid; }
      .q-head { margin-bottom: 4px; }
      .q-type { color: #7a3b12; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
      .q-pts { color: #666; font-size: 11px; }
      .q-text { margin: 0 0 6px; white-space: pre-wrap; }
      ol.choices { margin: 4px 0 0 1.2em; padding: 0; }
      ol.choices li { margin: 2px 0; }
      .write-lines { margin: 6px 0 0; color: #888; }
      .answer-key { margin-top: 6px; padding: 6px 8px; background: #fff6e8; border-left: 3px solid #c47a12; }
      .rubric-block { margin-top: 8px; padding: 8px; border: 1px solid #e0c8b0; border-radius: 6px; background: #fffaf4; }
      .rubric-crit { font-size: 12px; margin: 10px 0 4px; color: #3d0a0a; }
      .rubric-table { width: 100%; border-collapse: collapse; font-size: 11px; }
      .rubric-table th, .rubric-table td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
      .rubric-table th { background: #f5ebe0; }
      @media print {
        body { padding: 0; }
        @page { margin: 12mm; }
      }
    </style>
  </head><body>${bodyHtml}</body></html>`;

  printHtmlInHiddenFrame(html);
  showToast(reviewCopy
    ? 'Opening print dialog…'
    : (includeAnswers ? 'Opening answer key print dialog…' : 'Opening exam paper print dialog (Save as PDF).'));
}

function exportAssessmentPaperPdf({ includeAnswers = false } = {}) {
  const a = window._progressEditorAssessment;
  const questions = Array.isArray(window._progressEditorQuestions) ? window._progressEditorQuestions : [];
  if (!a || !questions.length) {
    showToast('No attached items to print.', 'error');
    return;
  }

  const maxScore = rubricCapFromProgressColumns() || Number(a.max_score) || questions.reduce((s, q) => s + (Number(q.points) || 1), 0);
  printAssessmentItemsPaper({
    questions,
    title: a.title,
    type: a.type,
    subject_name: a.subject_name,
    grade_level: a.grade_level,
    section: a.section,
    quarter: a.quarter,
    max_score: maxScore,
    includeAnswers
  });
}

document.getElementById('progress-print-paper')?.addEventListener('click', () => {
  exportAssessmentPaperPdf({ includeAnswers: false });
});

document.getElementById('progress-print-key')?.addEventListener('click', () => {
  exportAssessmentPaperPdf({ includeAnswers: true });
});

function exportRubricScoreSheet() {
  const a = window._progressEditorAssessment;
  const students = Array.isArray(window._progressEditorStudents) ? window._progressEditorStudents : [];
  const cols = Array.isArray(window._progressRubricColumns) ? window._progressRubricColumns : [];
  const questions = Array.isArray(window._progressEditorQuestions) ? window._progressEditorQuestions : [];
  if (!a || !cols.length) {
    showToast('No activity rubric on this record.', 'error');
    return;
  }

  const sorted = [...students].sort(compareStudentsByAttendanceOrder);
  const activities = progressRubricGuideActivities(questions, a);
  const guideHtml = activities.map((q, i) => {
    const cats = rubricCategoriesOf(normalizeRubricClient(q.rubric) || q.rubric);
    const rows = cats.map((c) => {
      const levels = (c.levels || []).map((lv) =>
        `<tr><td>${escapeHtml(lv.label || '')}</td><td>${Number(lv.points) || 0}</td><td>${escapeHtml(lv.description || '')}</td></tr>`
      ).join('');
      return `<h3>${escapeHtml(c.name || '')} (${Number(c.max_points) || 0} pts)</h3>
        <table class="rubric-table"><thead><tr><th>Level</th><th>Pts</th><th>Description</th></tr></thead><tbody>${levels}</tbody></table>`;
    }).join('');
    return `<section class="act"><h2>Activity ${i + 1}${activities.length === 1 ? '' : ''}</h2>
      <p class="prompt">${escapeHtml(q.question || '')}</p>${rows}</section>`;
  }).join('');

  const headCats = cols.map((c) =>
    `<th>${escapeHtml(c.label)}<br><span class="max">${c.max_points} pts</span></th>`
  ).join('');

  const bodyRows = sorted.map((s, idx) => {
    const saved = s.rubric_scores && typeof s.rubric_scores === 'object' ? s.rubric_scores : {};
    const catTds = cols.map((c) => {
      const v = rubricSavedCategoryValue(saved, c);
      const shown = v === null || v === undefined || v === '' ? '' : String(v);
      return `<td class="score-cell">${escapeHtml(shown)}</td>`;
    }).join('');
    const total = s.score === null || s.score === undefined || s.score === '' ? '' : String(s.score);
    const name = [s.last_name, s.first_name].filter(Boolean).join(', ') || `Student ${s.id}`;
    return `<tr>
      <td class="num">${idx + 1}</td>
      <td class="name">${escapeHtml(name)}</td>
      ${catTds}
      <td class="score-cell total">${escapeHtml(total)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Score Sheet</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #222; margin: 16px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #5c1010; }
  .meta { color: #555; margin: 0 0 12px; }
  .roster { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .roster th, .roster td { border: 1px solid #bbb; padding: 6px 5px; }
  .roster th { background: #f5ebe0; font-size: 11px; vertical-align: bottom; }
  .roster .max { font-weight: normal; color: #666; }
  .roster .num { width: 28px; text-align: center; }
  .roster .name { text-align: left; min-width: 140px; }
  .roster .score-cell { min-width: 48px; height: 28px; text-align: center; }
  .roster .total { font-weight: bold; background: #fffaf4; }
  .act { margin-top: 18px; page-break-inside: avoid; }
  .act h2 { font-size: 14px; margin: 0 0 4px; color: #5c1010; }
  .prompt { margin: 0 0 8px; }
  .rubric-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
  .rubric-table th, .rubric-table td { border: 1px solid #ddd; padding: 3px 5px; text-align: left; }
  .rubric-table th { background: #f5ebe0; }
  @media print { body { margin: 8px; } }
</style></head><body>
  <h1>${escapeHtml(a.title || 'Activity')} — Rubric Score Sheet</h1>
  <p class="meta">${escapeHtml(typeLabel(a.type))} · Grade ${escapeHtml(String(a.grade_level || ''))}-${escapeHtml(String(a.section || ''))}
    · ${escapeHtml(a.subject_name || 'No subject')} · Total ${Math.round(Number(progressEditorMax) * 100) / 100} pts
    · ${new Date().toLocaleDateString()}</p>
  <table class="roster">
    <thead><tr><th>#</th><th>Student</th>${headCats}<th>Total</th></tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  ${guideHtml}
</body></html>`;

  showToast('Opening rubric score sheet…');
  openPrintFullDocument(html);
}

document.getElementById('progress-print-scoresheet')?.addEventListener('click', () => {
  exportRubricScoreSheet();
});

document.getElementById('progress-mode-link')?.addEventListener('click', () => {
  const editor = document.getElementById('progress-editor');
  const id = editor?.dataset.assessmentId;
  if (!id) return;
  if (editor?.dataset.hasQuestions !== '1') {
    showToast('Live shared link is only for records created from Classwork.', 'error');
    return;
  }
  openProgressEditor(id, 'link');
});

window.deleteProgressRecord = async function(id) {
  if (!confirm('Delete this progress record and its scores?')) return;
  try {
    const res = await fetch(`${API_URL}/teacher/assessments/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Progress record deleted.');
    loadProgressList();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('progress-new-btn')?.addEventListener('click', () => {
  showProgressCreateForm(true);
});

document.getElementById('progress-create-cancel')?.addEventListener('click', () => {
  showProgressCreateForm(false);
});

document.getElementById('progress-editor-back')?.addEventListener('click', () => {
  loadProgressList();
});

document.getElementById('progress-type')?.addEventListener('change', () => {
  syncProgressCreateRubricVisibility();
});

document.getElementById('progress-max')?.addEventListener('change', () => {
  if (document.getElementById('progress-type')?.value !== 'activity') return;
  redistributeProgressRubric(document.getElementById('progress-max')?.value);
});

document.getElementById('progress-rubric-add')?.addEventListener('click', () => {
  const list = document.getElementById('progress-rubric-list');
  const current = collectRubricFromList(list, { requireName: false }) || { categories: [] };
  current.categories.push(emptyRubricCategory('', 5));
  renderRubricEditor(current, progressRubricEditorOpts());
});

document.getElementById('progress-create-save')?.addEventListener('click', async () => {
  const msg = document.getElementById('progress-create-msg');
  if (!teacherCurrentClass) {
    if (msg) msg.textContent = 'Select a class first.';
    return;
  }
  const title = document.getElementById('progress-title')?.value.trim();
  const type = document.getElementById('progress-type')?.value;
  const subjectId = document.getElementById('progress-subject')?.value;
  const lessonPlanId = document.getElementById('progress-lesson')?.value || '';
  const maxScore = document.getElementById('progress-max')?.value;
  if (!title) {
    if (msg) msg.textContent = 'Please enter a title.';
    return;
  }
  let rubric = null;
  if (type === 'activity') {
    rubric = collectRubricFromList(document.getElementById('progress-rubric-list'));
    if (!rubric) {
      if (msg) msg.textContent = 'Add at least one named rubric category.';
      return;
    }
  }

  try {
    const res = await fetch(`${API_URL}/teacher/assessments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title,
        type,
        subject_id: subjectId || null,
        grade_level: teacherCurrentClass.grade,
        section: teacherCurrentClass.section,
        max_score: maxScore,
        quarter: teacherCurrentQuarter,
        lesson_plan_id: lessonPlanId ? Number(lessonPlanId) : null,
        rubric
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('progress-title').value = '';
    showToast('Record created. Enter scores below.');
    showProgressCreateForm(false);
    await loadProgressList();
    if (data.id) openProgressEditor(data.id, 'edit');
  } catch (err) {
    if (msg) msg.textContent = err.message;
    showToast(err.message, 'error');
  }
});

document.getElementById('progress-quiz-link-save')?.addEventListener('click', async () => {
  const id = document.getElementById('progress-editor')?.dataset.assessmentId;
  const quizLink = document.getElementById('progress-editor-quiz-link')?.value.trim() || '';
  if (!id) return;
  try {
    const res = await fetch(`${API_URL}/teacher/assessments/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ quiz_link: quizLink || null })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const linkOpen = document.getElementById('progress-quiz-link-open');
    if (linkOpen) {
      if (data.quiz_link) {
        linkOpen.href = data.quiz_link;
        linkOpen.hidden = false;
      } else {
        linkOpen.removeAttribute('href');
        linkOpen.hidden = true;
      }
    }
    showToast(data.quiz_link ? 'Online link saved.' : 'Online link cleared.');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function sharedQuizAbsoluteUrl(token, type) {
  const kind = String(type || 'quiz').toLowerCase();
  const segment = kind === 'activity' || kind === 'exam' ? kind : 'quiz';
  return `${window.location.origin}/${segment}/${token}`;
}

/** Format a Date or SQL datetime as datetime-local value (Asia/Manila wall clock). */
function toDatetimeLocalValue(value) {
  if (value == null || value === '') return '';
  const s = typeof value === 'string' ? value.trim() : '';
  const hasZone = !!s && (/[zZ]\s*$/.test(s) || /[+-]\d{2}:\d{2}\s*$/.test(s));
  if (s && /^\d{4}-\d{2}-\d{2}/.test(s) && !hasZone) {
    const cleaned = s.replace('T', ' ').slice(0, 16);
    const [datePart, timePart = '00:00'] = cleaned.split(' ');
    const [y, m, d] = datePart.split('-');
    const [hh, mm] = timePart.split(':');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function formatAttendanceUsedLabel(assessment) {
  const raw = assessment?.quiz_attendance_date;
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  let iso = '';
  if (/[zZ]|[+-]\d{2}:\d{2}/.test(s) || /T\d{2}:/.test(s)) {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(parsed);
      const get = (type) => parts.find((p) => p.type === type)?.value || '';
      iso = `${get('year')}-${get('month')}-${get('day')}`;
    }
  } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    iso = s.slice(0, 10);
  }
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00+08:00`);
  const dateText = Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
  const session = String(assessment.quiz_attendance_session || '').toUpperCase();
  if (Number(assessment.grade_level) < 4 && (session === 'AM' || session === 'PM')) {
    return `Attendance: ${dateText}, ${session} session`;
  }
  return `Attendance: ${dateText}`;
}

function formatSharePreviewLocal(localValue) {
  if (!localValue) return '';
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return localValue.replace('T', ' ');
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function estimateLiveClosesLocal() {
  const mins = Number(document.getElementById('progress-share-live-duration')?.value);
  if (!Number.isFinite(mins) || mins < 5) return '';
  return toDatetimeLocalValue(new Date(Date.now() + mins * 60 * 1000));
}

function syncProgressShareWindowModeUi() {
  const livePreview = document.getElementById('progress-share-live-preview');
  if (!livePreview) return;
  const draft = estimateLiveClosesLocal();
  const saved = window._progressShareClosesLocal || '';
  const active = !!window._progressShareActive;
  const savedDate = saved ? new Date(saved) : null;
  const savedOk = savedDate && !Number.isNaN(savedDate.getTime());
  const draftDate = draft ? new Date(draft) : null;
  const draftDiffers = !!(savedOk && draftDate && !Number.isNaN(draftDate.getTime())
    && Math.abs(draftDate.getTime() - savedDate.getTime()) > 60 * 1000);

  if (active && savedOk) {
    const pretty = formatSharePreviewLocal(saved);
    const closed = savedDate.getTime() < Date.now();
    const verb = closed ? 'Closed at' : 'Closes at';
    if (draftDiffers && draft) {
      livePreview.textContent = `${verb} ${pretty}. Save Deadline to change to ${formatSharePreviewLocal(draft)}.`;
    } else {
      livePreview.textContent = `${verb} ${pretty}.`;
    }
    return;
  }

  livePreview.textContent = draft
    ? `Closes at ${formatSharePreviewLocal(draft)}.`
    : 'Enter minutes open to see when the link closes.';
}

function fillProgressShareWindowDefaults(_assessment) {
  const liveDuration = document.getElementById('progress-share-live-duration');
  if (liveDuration && !liveDuration.value) liveDuration.value = '60';
  syncProgressShareWindowModeUi();
}

function collectProgressShareWindowBody() {
  const mins = Number(document.getElementById('progress-share-live-duration')?.value);
  if (!Number.isFinite(mins) || mins < 5) {
    throw new Error('Link must stay open at least 5 minutes.');
  }
  return { live_duration_minutes: mins };
}

function isMakeupDeadlineStillOpen(assessment) {
  const raw = assessment?.quiz_makeup_closes_at;
  if (!raw) return false;
  const local = toDatetimeLocalValue(raw);
  if (!local) return false;
  const end = new Date(local);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() > Date.now();
}

function updateProgressPortalUi(assessment, questionCount = 0) {
  const note = document.getElementById('progress-portal-note');
  const dueInput = document.getElementById('progress-portal-due');
  const postBtn = document.getElementById('progress-portal-post');
  const removeBtn = document.getElementById('progress-portal-remove');
  if (!note && !postBtn) return;
  const posted = assessment && Number(assessment.portal_posted) === 1;
  const hasQuestions = Number(questionCount) > 0;
  if (dueInput) {
    dueInput.value = posted && assessment.portal_due_at
      ? toDatetimeLocalValue(assessment.portal_due_at)
      : '';
    dueInput.disabled = !!posted;
  }
  if (postBtn) {
    postBtn.hidden = !!posted;
    postBtn.disabled = !hasQuestions;
  }
  if (removeBtn) removeBtn.hidden = !posted;
  if (note) {
    if (posted) {
      const due = assessment.portal_due_at
        ? formatSharePreviewLocal(toDatetimeLocalValue(assessment.portal_due_at))
        : '';
      note.textContent = due
        ? `Posted to the student portal. Due ${due}.`
        : 'Posted to the student portal.';
    } else if (!hasQuestions) {
      note.textContent = 'Add classwork items before posting to the student portal.';
    } else {
      note.textContent = 'Students in this class see this item after you post it.';
    }
  }
}

async function postClassworkToPortal(id) {
  const dueAt = document.getElementById('progress-portal-due')?.value;
  if (!dueAt) {
    showToast('Set a due date before posting.', 'error');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/teacher/assessments/${id}/portal-post`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ due_at: dueAt })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not post classwork');
    showToast(data.message || 'Posted to the student portal.');
    openProgressEditor(id, 'link');
    loadProgressList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeClassworkFromPortal(id) {
  if (!confirm('Remove this from the student portal? Students who already submitted still keep it under Finished.')) return;
  try {
    const res = await fetch(`${API_URL}/teacher/assessments/${id}/portal-unpost`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not remove the post');
    showToast(data.message || 'Removed from the student portal.');
    openProgressEditor(id, 'link');
    loadProgressList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateProgressShareUi(assessment, attendanceMeta, questionCount = 0) {
  const urlInput = document.getElementById('progress-share-url');
  const assignBtn = document.getElementById('progress-share-assign');
  const saveWindowsBtn = document.getElementById('progress-share-save-windows');
  const copyBtn = document.getElementById('progress-share-copy');
  const revokeBtn = document.getElementById('progress-share-revoke');
  const openBtn = document.getElementById('progress-share-open');
  const noteEl = document.getElementById('progress-share-attendance-note');
  const windows = document.getElementById('progress-share-windows');
  const active = assessment && Number(assessment.share_enabled) === 1 && assessment.share_token;
  const hasQuestions = Number(questionCount) > 0;
  const takeHome = String(assessment?.activity_mode || '') === 'take_home';
  window._progressShareActive = !!active;
  window._progressShareClosesLocal = assessment?.quiz_closes_at
    ? toDatetimeLocalValue(assessment.quiz_closes_at)
    : '';
  if (windows) {
    windows.hidden = takeHome;
    if (takeHome) windows.setAttribute('hidden', '');
    else windows.removeAttribute('hidden');
  }
  fillProgressShareWindowDefaults(assessment);
  if (urlInput) {
    urlInput.value = active ? sharedQuizAbsoluteUrl(assessment.share_token, assessment.type) : '';
  }
  if (assignBtn) {
    assignBtn.hidden = !!active;
    assignBtn.disabled = !active && !hasQuestions;
    assignBtn.title = !hasQuestions && !active
      ? 'Create this record from Classwork with selected items first'
      : '';
  }
  if (saveWindowsBtn) saveWindowsBtn.hidden = takeHome || !active;
  if (copyBtn) copyBtn.hidden = !active;
  if (revokeBtn) revokeBtn.hidden = !active;
  if (openBtn) {
    if (active) {
      openBtn.href = sharedQuizAbsoluteUrl(assessment.share_token, assessment.type);
      openBtn.hidden = false;
    } else {
      openBtn.removeAttribute('href');
      openBtn.hidden = true;
    }
  }
    updateProgressPortalUi(assessment, questionCount);
  if (noteEl) {
    const gateLabel = (meta) => {
      if (!meta?.date) return '';
      const sess = meta.session && Number(assessment?.grade_level) < 4
        ? ` · ${meta.session}`
        : '';
      return `${meta.date}${sess}`;
    };
    const windowNote = (() => {
      if (!assessment?.quiz_makeup_closes_at) return '';
      return `Make-up until ${formatSharePreviewLocal(toDatetimeLocalValue(assessment.quiz_makeup_closes_at))}`;
    })();
    const showNote = (text, color) => {
      noteEl.hidden = false;
      noteEl.removeAttribute('hidden');
      noteEl.textContent = text;
      noteEl.style.color = color;
    };
    const hideNote = () => {
      noteEl.hidden = true;
      noteEl.setAttribute('hidden', '');
      noteEl.textContent = '';
    };
    if (!hasQuestions && !active) {
      showNote('No Classwork items attached. In Classwork, select items then Next: Create Quiz or Create Activity. Enable Link here after that. + New Record is for manual scores only.', '#b71c1c');
    } else if (active) {
      if (takeHome) {
        const when = assessment?.activity_target_at
          ? formatSharePreviewLocal(toDatetimeLocalValue(assessment.activity_target_at))
          : '';
        if (when) showNote(`Deadline: ${when}.`, 'var(--orange-dark)');
        else hideNote();
      } else {
        const attNote = formatAttendanceUsedLabel(assessment);
        const bits = [attNote, windowNote].filter(Boolean);
        if (bits.length) showNote(`${bits.join('. ')}.`, 'var(--text-muted)');
        else hideNote();
      }
    } else if (attendanceMeta) {
      const gate = gateLabel(attendanceMeta);
      if (attendanceMeta.complete && takeHome) {
        const when = assessment?.activity_target_at
          ? formatSharePreviewLocal(toDatetimeLocalValue(assessment.activity_target_at))
          : '';
        showNote(
          when ? `Deadline: ${when}.` : 'Set a target date before enabling the link.',
          'var(--orange-dark)'
        );
      } else if (attendanceMeta.complete) {
        showNote(
          gate
            ? `Attendance complete for ${gate}. Set Minutes Open, then Enable Link.`
            : 'Attendance is complete for today. Set Minutes Open, then Enable Link.',
          '#1b5e20'
        );
      } else {
        const n = attendanceMeta.unmarked_count ?? (attendanceMeta.unmarked?.length || 0);
        showNote(
          gate
            ? `Mark every student for ${gate} in Dashboard before enabling (${n} unmarked). Switch AM/PM to match the class session.`
            : `Mark attendance for every student in Dashboard before enabling the link (${n} unmarked).`,
          '#b71c1c'
        );
      }
    } else {
      showNote('Mark complete attendance in Dashboard before enabling a shared link.', 'var(--text-muted)');
    }
  }
}

function updateProgressMakeupUi(_assessment, _makeupCandidates) {
  // Make-up controls live on the scores table in Edit scores mode.
}

async function grantMakeupForStudent(studentId) {
  await grantMakeupQuiz('selected', [Number(studentId)]);
}

async function revokeMakeupForStudent(studentId) {
  await grantMakeupQuiz('unallow', [Number(studentId)]);
}

let _pendingMakeupGrant = null;

function syncMakeupModalPreview() {
  const hours = Number(document.getElementById('progress-makeup-hours')?.value);
  const preview = document.getElementById('progress-makeup-preview');
  if (!preview) return;
  if (!Number.isFinite(hours) || hours < 1) {
    preview.textContent = 'Enter hours to see when make-up access closes.';
    return;
  }
  const closes = toDatetimeLocalValue(new Date(Date.now() + hours * 60 * 60 * 1000));
  preview.textContent = `Make-up closes at: ${formatSharePreviewLocal(closes)}`;
}

function openMakeupGrantModal(mode, studentIds = null) {
  _pendingMakeupGrant = { mode, studentIds };
  const modal = document.getElementById('progress-makeup-modal');
  const note = document.getElementById('progress-makeup-modal-note');
  const msg = document.getElementById('progress-makeup-modal-msg');
  const hoursInput = document.getElementById('progress-makeup-hours');
  const confirmBtn = document.getElementById('progress-makeup-confirm');
  if (msg) { msg.hidden = true; msg.textContent = ''; }
  if (hoursInput) hoursInput.value = '48';
  if (note) {
    note.textContent = mode === 'all'
      ? 'Set how long make-up access stays open for all absent/excused students who have not submitted.'
      : 'Set how long make-up access stays open for this student.';
  }
  if (confirmBtn) confirmBtn.textContent = mode === 'all' ? 'Allow All' : 'Allow Access';
  syncMakeupModalPreview();
  if (modal) {
    modal.hidden = false;
    modal.removeAttribute('hidden');
  }
}

function closeMakeupGrantModal() {
  const modal = document.getElementById('progress-makeup-modal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('hidden', '');
  }
  _pendingMakeupGrant = null;
}

async function grantMakeupQuiz(mode, studentIds = null) {
  const id = document.getElementById('progress-editor')?.dataset.assessmentId;
  if (!id) return;

  if (mode === 'unallow' || mode === 'revoke') {
    const ids = Array.isArray(studentIds)
      ? studentIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    if (!ids.length) {
      showToast('Select at least one student to unallow.', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/teacher/assessments/${id}/makeup-quiz`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ mode, student_ids: ids })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message || 'Access removed.');
      openProgressEditor(id, 'edit');
    } catch (err) {
      showToast(err.message, 'error');
    }
    return;
  }

  const assessment = window._progressEditorAssessment;
  if (isMakeupDeadlineStillOpen(assessment)) {
    const until = formatSharePreviewLocal(toDatetimeLocalValue(assessment.quiz_makeup_closes_at));
    const ok = confirm(
      mode === 'all'
        ? `Make-up is open until ${until}. Allow all eligible absent/excused students?`
        : `Make-up is open until ${until}. Allow this student?`
    );
    if (!ok) return;
    await submitMakeupGrant({ mode, studentIds, reuseDeadline: true });
    return;
  }

  openMakeupGrantModal(mode, studentIds);
}

async function submitMakeupGrant({ mode, studentIds = null, reuseDeadline = false, makeupHours = null } = {}) {
  const id = document.getElementById('progress-editor')?.dataset.assessmentId;
  if (!id) return;
  const body = { mode };
  if (mode === 'selected') {
    const ids = Array.isArray(studentIds)
      ? studentIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    if (!ids.length) {
      showToast('Select at least one student for make-up.', 'error');
      return;
    }
    body.student_ids = ids;
  }
  if (!reuseDeadline) {
    const hours = Number(makeupHours);
    if (!Number.isFinite(hours) || hours < 1) {
      throw new Error('Make-up must be at least 1 hour.');
    }
    body.makeup_duration_minutes = Math.round(hours * 60);
  }
  const res = await fetch(`${API_URL}/teacher/assessments/${id}/makeup-quiz`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  showToast(data.message || 'Make-up access granted.');
  closeMakeupGrantModal();
  openProgressEditor(id, 'edit');
}

window.grantMakeupForStudent = grantMakeupForStudent;
window.revokeMakeupForStudent = revokeMakeupForStudent;

window.grantMakeupQuiz = grantMakeupQuiz;

window.copySharedQuizLink = async function(token, type) {
  const url = sharedQuizAbsoluteUrl(token, type);
  try {
    await navigator.clipboard.writeText(url);
    showToast('Shared link copied.');
  } catch {
    prompt('Copy this link:', url);
  }
};

window.copyExternalQuizLink = async function(id) {
  const record = (progressAssessments || []).find((r) => Number(r.id) === Number(id));
  const url = record?.quiz_link;
  if (!url) {
    showToast('No online link on this record.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Online link copied.');
  } catch {
    prompt('Copy this online link:', url);
  }
};

window.assignSharedQuizLink = async function(id) {
  try {
    const subjectMode = teacherCurrentClass && isSubjectAttendanceGrade(teacherCurrentClass.grade);
    const loaded = window._progressEditorAssessment;
    const takeHome = loaded
      && String(loaded.id) === String(id)
      && String(loaded.activity_mode || '') === 'take_home';
    const windowBody = takeHome
      ? { live_closes_at: loaded.activity_target_at || null }
      : collectProgressShareWindowBody();
    const body = subjectMode
      ? { ...windowBody }
      : { session: currentManilaSessionClient(), ...windowBody };
    const res = await fetch(`${API_URL}/teacher/assessments/${id}/assign-link`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const sess = data.attendance_session ? ` · ${data.attendance_session}` : '';
    const day = data.attendance_date ? ` (${data.attendance_date}${sess})` : '';
    showToast((data.message || 'Shared link ready.') + day);
    if (data.share_token) {
      await copySharedQuizLink(data.share_token, data.type);
    }
    const editor = document.getElementById('progress-editor');
    if (editor && !editor.hidden && editor.dataset.assessmentId === String(id)) {
      openProgressEditor(id, 'link');
    } else {
      loadProgressList();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.saveSharedQuizWindows = async function(id) {
  try {
    const body = collectProgressShareWindowBody();
    const res = await fetch(`${API_URL}/teacher/assessments/${id}/quiz-windows`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save windows');
    showToast(data.message || 'Deadlines updated.');
    openProgressEditor(id, 'link');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.revokeSharedQuizLink = async function(id) {
  if (!confirm('Disable the shared link? Students will no longer be able to open it.')) return;
  try {
    const res = await fetch(`${API_URL}/teacher/assessments/${id}/revoke-link`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(data.message || 'Link disabled.');
    const editor = document.getElementById('progress-editor');
    if (editor && !editor.hidden && editor.dataset.assessmentId === String(id)) {
      openProgressEditor(id, 'link');
    } else {
      loadProgressList();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('progress-portal-post')?.addEventListener('click', () => {
  const id = document.getElementById('progress-editor')?.dataset.assessmentId;
  if (id) postClassworkToPortal(id);
});
document.getElementById('progress-portal-remove')?.addEventListener('click', () => {
  const id = document.getElementById('progress-editor')?.dataset.assessmentId;
  if (id) removeClassworkFromPortal(id);
});

document.getElementById('progress-share-assign')?.addEventListener('click', () => {
  const id = document.getElementById('progress-editor')?.dataset.assessmentId;
  if (id) assignSharedQuizLink(id);
});

document.getElementById('progress-share-save-windows')?.addEventListener('click', () => {
  const id = document.getElementById('progress-editor')?.dataset.assessmentId;
  if (id) saveSharedQuizWindows(id);
});

['progress-share-live-duration']
  .forEach((id) => {
    document.getElementById(id)?.addEventListener('input', syncProgressShareWindowModeUi);
    document.getElementById(id)?.addEventListener('change', syncProgressShareWindowModeUi);
  });

document.getElementById('progress-makeup-hours')?.addEventListener('input', syncMakeupModalPreview);
document.getElementById('progress-makeup-hours')?.addEventListener('change', syncMakeupModalPreview);

document.getElementById('progress-makeup-confirm')?.addEventListener('click', async () => {
  const pending = _pendingMakeupGrant;
  const msg = document.getElementById('progress-makeup-modal-msg');
  if (!pending) return;
  try {
    const hours = Number(document.getElementById('progress-makeup-hours')?.value);
    await submitMakeupGrant({
      mode: pending.mode,
      studentIds: pending.studentIds,
      reuseDeadline: false,
      makeupHours: hours
    });
  } catch (err) {
    if (msg) { msg.hidden = false; msg.textContent = err.message; }
    else showToast(err.message, 'error');
  }
});

document.getElementById('progress-share-copy')?.addEventListener('click', async () => {
  const url = document.getElementById('progress-share-url')?.value;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Shared link copied.');
  } catch {
    prompt('Copy this link:', url);
  }
});

document.getElementById('progress-share-revoke')?.addEventListener('click', () => {
  const id = document.getElementById('progress-editor')?.dataset.assessmentId;
  if (id) revokeSharedQuizLink(id);
});

document.getElementById('progress-makeup-all')?.addEventListener('click', () => grantMakeupQuiz('all'));

document.getElementById('progress-scores-save')?.addEventListener('click', async () => {
  const id = document.getElementById('progress-editor')?.dataset.assessmentId;
  const rows = document.querySelectorAll('#progress-scores-table tbody tr[data-student-id]');
  const rubricCols = Array.isArray(window._progressRubricColumns) ? window._progressRubricColumns : [];

  if (!id) {
    showToast('Could not determine which record to save.', 'error');
    return;
  }

  if (progressRubricHasOverMax()) {
    showToast('A category score is over its max points. Fix the red cells before saving.', 'error');
    return;
  }

  const hasNegative = [...rows].some((tr) =>
    [...tr.querySelectorAll('.progress-score-input, .progress-rubric-cat-input')].some((inp) =>
      inp.value !== '' && (String(inp.value).includes('-') || Number(inp.value) < 0)
    )
  );
  if (hasNegative) {
    showToast("Scores can't be negative.", 'error');
    return;
  }

  const overMax = [...rows].some((tr) => {
    const inp = tr.querySelector('.progress-score-input');
    if (!inp || inp.readOnly || inp.value === '') return false;
    return Number(inp.value) > Number(progressEditorMax);
  });
  if (overMax) {
    showToast(`Score can't exceed ${progressEditorMax}.`, 'error');
    return;
  }

  const scores = Array.from(rows).filter((tr) => tr.dataset.scoreLocked !== '1').map((tr) => {
    const studentId = Number(tr.dataset.studentId);
    const totalInput = tr.querySelector('.progress-score-input');
    const rubric_scores = {};
    let hasAnyCat = false;
    tr.querySelectorAll('.progress-rubric-cat-input').forEach((inp) => {
      const key = inp.dataset.rubricKey;
      if (!key) return;
      if (inp.value === '') return;
      hasAnyCat = true;
      const n = Number(inp.value);
      rubric_scores[key] = n;
      const label = inp.dataset.rubricLabel;
      if (label) rubric_scores[label] = n;
    });
    if (rubricCols.length && hasAnyCat) syncProgressRowRubricTotal(tr);
    return {
      student_id: studentId,
      score: totalInput?.value === ''
        ? ''
        : Math.min(Number(progressEditorMax), Math.max(0, Number(totalInput.value))),
      rubric_scores: hasAnyCat ? rubric_scores : null
    };
  }).filter((row) => row.score !== '' || (row.rubric_scores && Object.keys(row.rubric_scores).length));

  try {
    const res = await fetch(`${API_URL}/teacher/assessments/${id}/scores`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ scores })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Scores saved. Parents can see them in Records.');
    loadProgressList();
    const openFn = window.openProgressEditor || window.loadProgressEditor;
    if (typeof openFn === 'function') {
      const mode = document.getElementById('progress-editor')?.dataset.mode || 'edit';
      await openFn(Number(id), mode);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function loadTeacherSubjects(forceReload = false) {
  try {
    const res = await fetch(`${API_URL}/teacher/subjects`, { headers: getAuthHeaders() });
    const subjects = await res.json();
    if (!res.ok) throw new Error(subjects.error);

    teacherSubjectsCache = Array.isArray(subjects) ? subjects : [];
    fillTeacherSubjectSelects();
    teacherSubjectsLoaded = true;
  } catch (err) {
    console.error('Load teacher subjects error:', err);
  }
}

/** Assigned subjects only; optionally limited to a grade. */
function getAssignedSubjectsForGrade(grade) {
  const list = Array.isArray(teacherSubjectsCache) ? teacherSubjectsCache : [];
  const g = Number(grade);
  if (!g) return list.slice();
  return list.filter((s) => {
    const grades = Array.isArray(s.grade_levels) ? s.grade_levels.map(Number) : [];
    // Older payloads without grade_levels: keep visible (should be rare after API update)
    if (!grades.length) return true;
    return grades.includes(g);
  });
}

function subjectSelectOptionsHtml(subjects, { emptyLabel = '-- Select --', includeEmpty = true } = {}) {
  const opts = (subjects || []).map(
    (s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`
  ).join('');
  return (includeEmpty ? `<option value="">${escapeHtml(emptyLabel)}</option>` : '') + opts;
}

function fillTeacherSubjectSelects() {
  const lpGrade = document.getElementById('lp-grade')?.value;
  const progressGrade = teacherCurrentClass?.grade;
  const lpSubjects = getAssignedSubjectsForGrade(lpGrade);
  const progressSubjects = getAssignedSubjectsForGrade(progressGrade);

  const lpSelect = document.getElementById('lp-subject');
  const progressSelect = document.getElementById('progress-subject');

  if (lpSelect) {
    const prev = lpSelect.value;
    lpSelect.innerHTML = subjectSelectOptionsHtml(lpSubjects);
    if (prev && [...lpSelect.options].some((o) => o.value === prev)) lpSelect.value = prev;
  }

  if (progressSelect) {
    const prev = progressSelect.value;
    progressSelect.innerHTML = subjectSelectOptionsHtml(progressSubjects, {
      emptyLabel: '-- Select Subject --'
    });
    if (teacherCurrentClass?.subjectId &&
      [...progressSelect.options].some((o) => o.value === String(teacherCurrentClass.subjectId))) {
      progressSelect.value = String(teacherCurrentClass.subjectId);
    } else if (progressSubjectFilter) {
      const opt = Array.from(progressSelect.options).find(
        (o) => o.textContent.trim().toLowerCase() === String(progressSubjectFilter).toLowerCase()
      );
      if (opt) progressSelect.value = opt.value;
      else if (prev && [...progressSelect.options].some((o) => o.value === prev)) progressSelect.value = prev;
    } else if (prev && [...progressSelect.options].some((o) => o.value === prev)) {
      progressSelect.value = prev;
    }
  }

  fillQuizBankSubjectFilter();
  fillAddQuizSubjectOptions();
}

let materialsPlansCache = [];
let materialsDraftsCache = [];
let materialsCurrentSubjectKey = null; // 'id:12' | 'none' | null (landing)
let aiDraftExpandId = null;

function materialsSubjectKey(subjectId) {
  const n = Number(subjectId);
  return Number.isFinite(n) && n > 0 ? `id:${n}` : 'none';
}

function materialsSubjectIdFromKey(key) {
  if (!key || key === 'none') return null;
  const n = Number(String(key).replace(/^id:/, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function showMaterialsLanding() {
  const listEl = document.getElementById('lp-subjects-list');
  const detailEl = document.getElementById('lp-subject-detail');
  if (listEl) {
    listEl.hidden = false;
    listEl.removeAttribute('hidden');
  }
  if (detailEl) {
    detailEl.hidden = true;
    detailEl.setAttribute('hidden', '');
  }
  const titleEl = document.getElementById('lp-page-title');
  const metaEl = document.getElementById('lp-page-meta');
  if (titleEl) titleEl.textContent = 'Materials';
  if (metaEl) metaEl.textContent = 'Open a subject to view files and AI drafts.';
}

function showMaterialsSubjectDetail() {
  const listEl = document.getElementById('lp-subjects-list');
  const detailEl = document.getElementById('lp-subject-detail');
  if (listEl) {
    listEl.hidden = true;
    listEl.setAttribute('hidden', '');
  }
  if (detailEl) {
    detailEl.hidden = false;
    detailEl.removeAttribute('hidden');
  }
}

function collectMaterialsSubjects() {
  const map = new Map();
  const add = (id, name) => {
    const key = materialsSubjectKey(id);
    if (!map.has(key)) {
      map.set(key, {
        key,
        subject_id: materialsSubjectIdFromKey(key),
        name: key === 'none' ? 'Unassigned' : (name || 'Subject'),
        plans: 0,
        drafts: 0
      });
    } else if (name && key !== 'none' && map.get(key).name === 'Subject') {
      map.get(key).name = name;
    }
  };

  (getAssignedSubjectsForGrade() || []).forEach((s) => add(s.id, s.name));
  (materialsPlansCache || []).forEach((p) => add(p.subject_id, p.subject_name));
  (materialsDraftsCache || []).forEach((r) => add(r.subject_id, r.subject_name));

  (materialsPlansCache || []).forEach((p) => {
    const row = map.get(materialsSubjectKey(p.subject_id));
    if (row) row.plans += 1;
  });
  (materialsDraftsCache || []).forEach((r) => {
    const row = map.get(materialsSubjectKey(r.subject_id));
    if (row) row.drafts += 1;
  });

  return [...map.values()].sort((a, b) => {
    if (a.key === 'none') return 1;
    if (b.key === 'none') return -1;
    return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });
  });
}

function renderMaterialsSubjectCards() {
  const listEl = document.getElementById('lp-subjects-list');
  if (!listEl) return;
  const subjects = collectMaterialsSubjects();
  if (!subjects.length) {
    listEl.innerHTML = '<p class="empty-state">No subjects assigned yet. Ask admin to assign subjects, or upload a material.</p>';
    return;
  }
  listEl.innerHTML = subjects.map((s) => `
    <article class="lesson-plan-card qb-set-card lp-subject-card" data-subject-key="${escapeHtml(s.key)}" role="button" tabindex="0">
      <h3 class="page-heading font-heading">${escapeHtml(s.name)}</h3>
      <p class="page-subheading">
        ${s.plans} material${s.plans === 1 ? '' : 's'} · ${s.drafts} AI draft${s.drafts === 1 ? '' : 's'}
      </p>
      <span class="chip-ghost">Open →</span>
    </article>
  `).join('');

  listEl.querySelectorAll('.qb-set-card').forEach((card) => {
    const open = () => openMaterialsSubject(card.dataset.subjectKey);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}

function materialCardHtml(p) {
  const filePath = p.file_path ? escapeHtml(String(p.file_path)) : '';
  return `
      <article class="lesson-plan-card">
        <div class="progress-card-top">
          <div class="progress-card-top-left">
            <h4 style="margin:0;">${escapeHtml(p.title)}</h4>
          </div>
          <div class="row-menu-wrap">
            <button type="button" class="icon-btn row-menu-toggle" title="More actions" aria-label="More actions" aria-expanded="false">⋮</button>
            <div class="row-menu" hidden>
              ${filePath ? `<button type="button" class="row-menu-item" data-action="open-file" data-file-path="${filePath}">Open File</button>` : ''}
              <button type="button" class="row-menu-item row-menu-item--danger" data-action="delete-material" data-plan-id="${p.id}">Delete</button>
            </div>
          </div>
        </div>
        <p>Grade ${p.grade_level}${p.subject_name ? ' · ' + escapeHtml(p.subject_name) : ''} · ${escapeHtml(p.quarter || 'Q1')} · ${new Date(p.created_at).toLocaleDateString()}</p>
        ${p.objectives ? `<p style="margin-top:8px;color:var(--text-dark);">${escapeHtml(p.objectives)}</p>` : ''}
        <div class="lesson-plan-card-actions">
          <button type="button" class="chip-ghost primary" data-action="generate-ai" data-plan-id="${p.id}">Generate AI</button>
        </div>
      </article>`;
}

function aiDraftCardHtml(r, expandId) {
  const c = r.content || {};
  const inClasswork = !!r.classwork_set_id;
  const statusClass = r.status === 'rejected' ? 'ai-status-rejected'
    : inClasswork || r.status === 'approved' ? 'ai-status-approved' : 'ai-status-pending';
  const statusLabel = r.status === 'rejected' ? 'REJECTED'
    : inClasswork ? 'IN CLASSWORK'
      : r.status === 'approved' ? 'IN RECORDS'
        : 'PENDING';
  const isOpen = expandId != null && Number(r.id) === expandId;
  const meta = `Grade ${r.grade_level}${r.subject_name ? ' · ' + escapeHtml(r.subject_name) : ''} · ${new Date(r.created_at).toLocaleDateString()}`;
  return `
      <article class="lesson-plan-card ai-rec-card" data-rec-id="${r.id}" data-grade="${r.grade_level}">
        <details class="ai-rec-fold"${isOpen ? ' open' : ''}>
          <summary>
            <div class="ai-rec-fold-summary">
              <div>
                <h4><span class="ai-rec-fold-chevron" aria-hidden="true">▸</span>${escapeHtml(r.lesson_title || 'Lesson')}</h4>
                <p class="ai-rec-fold-meta">${meta}</p>
              </div>
              <div class="ai-rec-fold-summary-right">
                <span class="ai-status-badge ${statusClass}">${statusLabel} · ${escapeHtml(r.provider)}</span>
                <div class="row-menu-wrap">
                  <button type="button" class="icon-btn row-menu-toggle" title="More actions" aria-label="More actions" aria-expanded="false">⋮</button>
                  <div class="row-menu" hidden>
                    ${r.status === 'pending' ? `
                      <button type="button" class="row-menu-item" data-action="regenerate-draft" data-rec-id="${r.id}">Regenerate</button>
                      <div class="row-menu-divider" role="separator"></div>
                    ` : ''}
                    <button type="button" class="row-menu-item row-menu-item--danger" data-action="delete-draft" data-rec-id="${r.id}">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </summary>
          <div class="ai-rec-fold-body">
            ${c.quiz ? `<details class="ai-draft-details" open>
              <summary>Quiz — ${escapeHtml(c.quiz?.title || 'Quiz')}</summary>
              ${formatAiItemsPreview(c.quiz, 'quiz')}
            </details>` : ''}
            ${c.activity ? `<details class="ai-draft-details"${c.quiz ? '' : ' open'}>
              <summary>Activity — ${escapeHtml(c.activity?.title || 'Activity')}</summary>
              ${formatAiItemsPreview(c.activity, 'activity')}
            </details>` : ''}
            ${r.status === 'pending' && !inClasswork ? `
            <div class="lesson-plan-card-actions">
              <button type="button" class="chip-ghost primary" data-action="save-draft-classwork" data-rec-id="${r.id}">Save to Classwork</button>
            </div>` : inClasswork ? `<p class="page-subheading" style="margin-top:10px;">Saved to Classwork. Create a Quiz or Activity from Classwork to add it to Records and enable a student link.</p>` : r.assessment_id ? `<p class="page-subheading" style="margin-top:10px;">Saved to Records${r.approved_type ? ` as ${escapeHtml(typeLabel(r.approved_type))}` : ''}</p>` : ''}
          </div>
        </details>
      </article>`;
}

function renderMaterialsSubjectDetail() {
  const key = materialsCurrentSubjectKey;
  const subjects = collectMaterialsSubjects();
  const subject = subjects.find((s) => s.key === key);
  const pageTitle = document.getElementById('lp-page-title');
  const pageMeta = document.getElementById('lp-page-meta');
  const name = subject?.name || 'Subject';
  if (pageTitle) pageTitle.textContent = name;
  if (pageMeta) pageMeta.textContent = 'Upload a file, then generate AI drafts for Classwork.';

  const plansEl = document.getElementById('lesson-plans-list');
  const draftsEl = document.getElementById('ai-recommendations-list');
  const plans = (materialsPlansCache || []).filter((p) => materialsSubjectKey(p.subject_id) === key);
  const drafts = (materialsDraftsCache || []).filter((r) => materialsSubjectKey(r.subject_id) === key);

  if (plansEl) {
    plansEl.innerHTML = plans.length
      ? plans.map(materialCardHtml).join('')
      : '<p class="empty-state">No materials in this subject yet. Click + Upload Material to add one.</p>';
  }

  const expandId = aiDraftExpandId != null ? Number(aiDraftExpandId) : null;
  aiDraftExpandId = null;
  if (draftsEl) {
    draftsEl.innerHTML = drafts.length
      ? drafts.map((r) => aiDraftCardHtml(r, expandId)).join('')
      : '<p class="empty-state">No AI drafts for this subject yet.</p>';
    if (expandId != null) {
      const opened = draftsEl.querySelector(`.ai-rec-card[data-rec-id="${expandId}"]`);
      if (opened) opened.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

function openMaterialsSubject(key) {
  materialsCurrentSubjectKey = key || 'none';
  showMaterialsSubjectDetail();
  renderMaterialsSubjectDetail();
}

function renderMaterialsHub() {
  if (materialsCurrentSubjectKey) {
    showMaterialsSubjectDetail();
    renderMaterialsSubjectDetail();
  } else {
    showMaterialsLanding();
    renderMaterialsSubjectCards();
  }
}

async function loadMaterialsHub() {
  await Promise.all([loadLessonPlans(), loadAiRecommendations()]);
}

(function setupMaterialsCardDelegation() {
  const panel = document.getElementById('teacher-panel-lesson-plans');
  if (!panel) return;

  panel.addEventListener('click', (e) => {
    const toggle = e.target.closest('.row-menu-toggle');
    if (toggle && panel.contains(toggle)) {
      e.preventDefault();
      e.stopPropagation();
      toggleRowMenu(toggle, '#teacher-panel-lesson-plans');
      return;
    }

    const btn = e.target.closest('button[data-action]');
    if (!btn || !panel.contains(btn)) return;

    const action = btn.dataset.action;
    const planId = Number(btn.dataset.planId);
    const recId = Number(btn.dataset.recId);
    e.preventDefault();
    e.stopPropagation();
    closeAllRowMenus();

    if (action === 'generate-ai' && planId) generateAiForLesson(planId);
    else if (action === 'open-file' && btn.dataset.filePath) {
      window.open(btn.dataset.filePath, '_blank', 'noopener');
    }     else if (action === 'delete-material' && planId) deleteLessonPlan(planId);
    else if (action === 'save-draft-classwork' && recId) saveAiDraftToBank(recId);
    else if (action === 'regenerate-draft' && recId) regenerateAiRecommendation(recId);
    else if (action === 'delete-draft' && recId) deleteAiRecommendation(recId);
  });
})();

async function loadLessonPlans() {
  const listEl = document.getElementById('lesson-plans-list');
  try {
    const res = await fetch(`${API_URL}/teacher/lesson-plans`, { headers: getAuthHeaders() });
    const plans = await res.json();
    if (!res.ok) throw new Error(plans.error);
    materialsPlansCache = Array.isArray(plans) ? plans : [];
    renderMaterialsHub();
  } catch (err) {
    console.error('Load materials error:', err);
    materialsPlansCache = [];
    if (listEl && materialsCurrentSubjectKey) {
      listEl.innerHTML = '<p class="empty-state">Failed to load materials.</p>';
    } else {
      const landing = document.getElementById('lp-subjects-list');
      if (landing) landing.innerHTML = '<p class="empty-state">Failed to load materials.</p>';
    }
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Alphabetical by last name, then first name (case-insensitive). */
function compareStudentsByName(a, b) {
  const ln = String(a?.last_name || '').localeCompare(String(b?.last_name || ''), undefined, { sensitivity: 'base' });
  if (ln !== 0) return ln;
  return String(a?.first_name || '').localeCompare(String(b?.first_name || ''), undefined, { sensitivity: 'base' });
}

/** Same as Classroom: boys A–Z, then girls A–Z. */
function compareStudentsByAttendanceOrder(a, b) {
  const ga = a?.gender === 'M' ? 0 : a?.gender === 'F' ? 1 : 2;
  const gb = b?.gender === 'M' ? 0 : b?.gender === 'F' ? 1 : 2;
  if (ga !== gb) return ga - gb;
  return compareStudentsByName(a, b);
}

/**
 * Last name on first line, first (+ middle) on second — wraps on mobile without cutting.
 */
function formatStudentNameStacked(s, { escape = true } = {}) {
  const enc = (v) => (escape ? escapeHtml(v) : String(v ?? ''));
  const last = enc(s?.last_name || '') || '—';
  const firstParts = [s?.first_name, s?.middle_name].filter(Boolean).map(enc);
  const first = firstParts.join(' ') || '—';
  return `<span class="student-name-stack"><span class="student-name-last">${last}</span><span class="student-name-first">${first}</span></span>`;
}

async function loadAiStatusHint() {
  const hint = document.getElementById('ai-mode-hint');
  if (!hint) return;
  try {
    const res = await fetch(`${API_URL}/teacher/ai/status`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.mode === 'groq') {
      hint.textContent = `AI: Groq${data.model ? ` · ${data.model}` : ''}`;
    } else {
      hint.textContent = 'AI: mock (set GROQ_API_KEY for live)';
    }
  } catch {
    hint.textContent = '';
  }
}

function formatAiItemsPreview(part, type) {
  if (!part) return '<p class="empty-state">No content.</p>';
  if (type === 'activity') {
    const rubricHtml = rubricPreviewHtml(part.rubric);
    return `<p>${escapeHtml(part.description || '')}</p>${rubricHtml}`;
  }
  const items = Array.isArray(part.items) ? part.items : [];
  if (!items.length) return `<p>${escapeHtml(part.notes || '')}</p>`;
  const order = BANK_TYPE_ORDER.filter((t) => t !== 'activity');
  const groups = new Map();
  items.forEach((it) => {
    let t = String(it.type || it.item_type || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (!order.includes(t)) t = Array.isArray(it.choices) && it.choices.length ? 'mcq' : 'short_answer';
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(it);
  });
  return order.filter((t) => (groups.get(t) || []).length).map((t) => {
    const list = groups.get(t);
    const lis = list.map((it) => `<li>${escapeHtml(it.question || '')}</li>`).join('');
    return `<div class="ai-draft-type"><p class="ai-draft-type-title">${escapeHtml(bankItemTypeLabel(t))} <span class="page-subheading">${list.length}</span></p><ol class="ai-draft-items">${lis}</ol></div>`;
  }).join('');
}

async function loadAiRecommendations() {
  const listEl = document.getElementById('ai-recommendations-list');
  try {
    const res = await fetch(`${API_URL}/teacher/ai/recommendations`, { headers: getAuthHeaders() });
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error);
    materialsDraftsCache = Array.isArray(rows) ? rows : [];
    renderMaterialsHub();
  } catch (err) {
    console.error('Load AI recommendations error:', err);
    materialsDraftsCache = [];
    if (listEl && materialsCurrentSubjectKey) {
      listEl.innerHTML = '<p class="empty-state">Failed to load AI drafts.</p>';
    }
  }
}

window.generateAiForLesson = async function(lessonPlanId) {
  openAiGenerateOptionsModal({ mode: 'generate', lessonPlanId });
};

function setHiddenEl(el, hidden) {
  if (!el) return;
  el.hidden = hidden;
  if (hidden) el.setAttribute('hidden', '');
  else el.removeAttribute('hidden');
}

function teacherFocusValue() {
  return String(document.getElementById('ai-generate-focus')?.value || '').trim().slice(0, 500);
}

function getAiGenerateKind() {
  return document.getElementById('ai-generate-kind-activity')?.classList.contains('btn-solid') ? 'activity' : 'quiz';
}

function setAiGenerateKind(kind) {
  const locked = !!examAiIntent;
  const next = locked || kind !== 'activity' ? 'quiz' : 'activity';
  const quizBtn = document.getElementById('ai-generate-kind-quiz');
  const activityBtn = document.getElementById('ai-generate-kind-activity');
  const choice = document.getElementById('ai-generate-kind');
  const lead = document.getElementById('ai-generate-lead');
  setHiddenEl(choice, locked);
  if (quizBtn) {
    quizBtn.classList.toggle('btn-solid', next === 'quiz');
    quizBtn.classList.toggle('btn-outline', next !== 'quiz');
  }
  if (activityBtn) {
    activityBtn.classList.toggle('btn-solid', next === 'activity');
    activityBtn.classList.toggle('btn-outline', next !== 'activity');
  }
  setHiddenEl(document.getElementById('ai-generate-quiz-fields'), next !== 'quiz');
  setHiddenEl(document.getElementById('ai-generate-activity-note'), next !== 'activity');
  if (lead) {
    lead.textContent = locked
      ? 'Choose the quiz types and how many items of each.'
      : 'Choose a quiz or an activity.';
  }
  syncAiGenerateGoEnabled();
}

function syncAiGenerateGoEnabled() {
  const goBtn = document.getElementById('ai-generate-count-go');
  if (!goBtn) return;
  if (getAiGenerateKind() === 'activity') {
    goBtn.disabled = false;
    return;
  }
  const picked = getSelectedAiGenerateCounts();
  goBtn.disabled = picked.types.length === 0 || picked.missing;
}

function resetAiGenerateTypeChecks() {
  document.querySelectorAll('input[name="ai-quiz-type"]').forEach((el) => {
    el.checked = false;
  });
  document.querySelectorAll('input[name="ai-quiz-type-count"]').forEach((el) => {
    el.value = '';
    el.hidden = true;
    el.setAttribute('hidden', '');
  });
  syncAiGenerateGoEnabled();
}

function syncAiTypeCountFields() {
  document.querySelectorAll('input[name="ai-quiz-type"]').forEach((box) => {
    const count = document.querySelector(`input[name="ai-quiz-type-count"][data-type="${box.value}"]`);
    if (!count) return;
    if (box.checked) {
      count.hidden = false;
      count.removeAttribute('hidden');
    } else {
      count.value = '';
      count.hidden = true;
      count.setAttribute('hidden', '');
    }
  });
  syncAiGenerateGoEnabled();
}

document.querySelectorAll('input[name="ai-quiz-type"]').forEach((el) => {
  el.addEventListener('change', syncAiTypeCountFields);
});
document.querySelectorAll('input[name="ai-quiz-type-count"]').forEach((el) => {
  el.addEventListener('input', syncAiGenerateGoEnabled);
});
document.getElementById('ai-generate-kind-quiz')?.addEventListener('click', () => setAiGenerateKind('quiz'));
document.getElementById('ai-generate-kind-activity')?.addEventListener('click', () => setAiGenerateKind('activity'));

function openAiGenerateOptionsModal({ mode = 'generate', lessonPlanId = null, recommendationId = null } = {}) {
  const modal = document.getElementById('ai-generate-count-modal');
  const idInput = document.getElementById('ai-generate-lesson-id');
  const modeInput = document.getElementById('ai-generate-mode');
  const recInput = document.getElementById('ai-generate-rec-id');
  const titleEl = document.getElementById('ai-generate-modal-title');
  const goBtn = document.getElementById('ai-generate-count-go');
  if (idInput) idInput.value = lessonPlanId != null ? String(lessonPlanId) : '';
  if (modeInput) modeInput.value = mode === 'regenerate' ? 'regenerate' : 'generate';
  if (recInput) recInput.value = recommendationId != null ? String(recommendationId) : '';
  if (titleEl) titleEl.textContent = mode === 'regenerate' ? 'Regenerate AI Draft' : 'Generate AI Draft';
  if (goBtn) goBtn.textContent = mode === 'regenerate' ? 'Regenerate' : 'Generate';
  resetAiGenerateTypeChecks();
  setAiGenerateKind('quiz');
  const focusEl = document.getElementById('ai-generate-focus');
  if (focusEl) focusEl.value = '';
  if (modal) {
    modal.hidden = false;
    modal.removeAttribute('hidden');
  }
}

function paintAiGeneratingProgress(progress) {
  const msgEl = document.getElementById('ai-generating-message');
  const fill = document.getElementById('ai-generating-fill');
  const step = Number(progress?.step) || 1;
  const total = Number(progress?.total) || 3;
  const label = progress?.label || 'Reading the lesson';
  if (msgEl) msgEl.textContent = label;
  if (fill) fill.style.width = `${Math.min(100, Math.round((step / total) * 100))}%`;
}

function showAiGeneratingModal(title = 'Generating AI Draft') {
  const modal = document.getElementById('ai-generating-modal');
  const titleEl = document.getElementById('ai-generating-title');
  if (titleEl) titleEl.textContent = title;
  paintAiGeneratingProgress({ step: 1, total: 3, label: 'Reading the lesson' });
  if (modal) {
    modal.hidden = false;
    modal.removeAttribute('hidden');
  }
}

function hideAiGeneratingModal() {
  const modal = document.getElementById('ai-generating-modal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('hidden', '');
  }
}

function getSelectedAiGenerateTypes() {
  return [...document.querySelectorAll('input[name="ai-quiz-type"]:checked')]
    .map((el) => el.value)
    .filter((v) => BANK_TYPE_ORDER.includes(v) && v !== 'activity');
}

async function parseAiJsonResponse(res) {
  const text = await res.text();
  try {
    return { ok: res.ok, data: text ? JSON.parse(text) : {}, parseError: false };
  } catch {
    return { ok: false, data: {}, parseError: true };
  }
}

async function pollAiJob(jobId) {
  const deadline = Date.now() + 20 * 60 * 1000;
  let badResponses = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    let res;
    try {
      res = await fetch(`${API_URL}/teacher/ai/jobs/${jobId}`, { headers: getAuthHeaders() });
    } catch {
      badResponses += 1;
      if (badResponses >= 8) throw new Error('Lost connection while generating. Keep this tab open and try again.');
      continue;
    }
    const { ok, data, parseError } = await parseAiJsonResponse(res);
    if (parseError) {
      badResponses += 1;
      if (badResponses >= 8) throw new Error('Generation timed out. Keep this tab open and try again.');
      continue;
    }
    badResponses = 0;
    if (!ok) {
      if (res.status === 404) continue;
      throw new Error(data.error || 'Could not check generation status');
    }
    if (data.progress) paintAiGeneratingProgress(data.progress);
    if (data.status === 'done') return data;
    if (data.status === 'error') throw new Error(data.error || 'Generation failed');
  }
  throw new Error('Generation is taking too long. Check the Gemini connection and try again.');
}

let aiDraftJobRunning = false;

function aiDraftAlreadyRunning() {
  if (!aiDraftJobRunning) return false;
  showToast('A draft is already being generated.', 'error');
  return true;
}

async function runAiGenerateWithCount(lessonPlanId, quizItemCount, quizItemTypes, opts = {}) {
  if (aiDraftAlreadyRunning()) return;
  aiDraftJobRunning = true;
  showAiGeneratingModal(opts.asExam ? 'Generating exam' : 'Generating AI Draft');
  try {
    const examIds = opts.asExam && Array.isArray(opts.lessonIds) ? opts.lessonIds.filter((id) => Number(id) > 0) : [];
    const examGenerate = examIds.length > 0;
    const payload = {
      quiz_item_count: quizItemCount,
      quiz_item_types: quizItemTypes,
      quiz_item_counts: opts.quizItemCounts || null,
      draft_kind: opts.draftKind === 'activity' ? 'activity' : 'quiz',
      teacher_focus: opts.teacherFocus || ''
    };
    const res = await fetch(
      examGenerate
        ? `${API_URL}/teacher/ai/generate-exam`
        : `${API_URL}/teacher/lesson-plans/${lessonPlanId}/generate`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(examGenerate
          ? { ...payload, lesson_plan_ids: examIds }
          : payload)
      }
    );
    const { ok, data, parseError } = await parseAiJsonResponse(res);
    if (parseError) throw new Error('Could not start generation. Try again.');
    if (!ok) throw new Error(data.error || data.details || 'Generation failed');
    const done = data.jobId ? await pollAiJob(data.jobId) : data;
    showToast(done.message || 'AI draft created.');
    if (opts.asExam && done.id) {
      examAiDraftId = done.id;
      openExamAiSaveModal();
      return;
    }
    aiDraftExpandId = done.id;
    await loadAiRecommendations();
    const materials = document.getElementById('teacher-panel-lesson-plans');
    const draftsHeading = document.getElementById('lp-ai-drafts-heading');
    if (materials && !materials.hasAttribute('hidden') && draftsHeading) {
      draftsHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    showToast(err.message, 'error');
    await loadAiRecommendations();
  } finally {
    aiDraftJobRunning = false;
    hideAiGeneratingModal();
  }
}

async function runAiRegenerateWithOptions(recommendationId, quizItemCount, quizItemTypes, quizItemCounts = null, draftKind = 'quiz', teacherFocus = '') {
  if (aiDraftAlreadyRunning()) return;
  aiDraftJobRunning = true;
  showAiGeneratingModal('Regenerating AI Draft');
  try {
    const res = await fetch(`${API_URL}/teacher/ai/recommendations/${recommendationId}/regenerate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        quiz_item_count: quizItemCount,
        quiz_item_types: quizItemTypes,
        quiz_item_counts: quizItemCounts,
        draft_kind: draftKind === 'activity' ? 'activity' : 'quiz',
        teacher_focus: teacherFocus || ''
      })
    });
    const { ok, data, parseError } = await parseAiJsonResponse(res);
    if (parseError) throw new Error('Could not start regenerate. Try again.');
    if (!ok) throw new Error(data.error || data.details || 'Regenerate failed');
    const done = data.jobId ? await pollAiJob(data.jobId) : data;
    showToast(done.message || 'Draft regenerated.');
    aiDraftExpandId = done.id || recommendationId;
    await loadAiRecommendations();
  } catch (err) {
    showToast(err.message, 'error');
    await loadAiRecommendations();
  } finally {
    aiDraftJobRunning = false;
    hideAiGeneratingModal();
  }
}

function getSelectedAiGenerateCounts() {
  const types = getSelectedAiGenerateTypes();
  const counts = {};
  let total = 0;
  let missing = false;
  types.forEach((type) => {
    const el = document.querySelector(`input[name="ai-quiz-type-count"][data-type="${type}"]`);
    const n = Number(el?.value);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      missing = true;
      return;
    }
    counts[type] = n;
    total += n;
  });
  return { types, counts, total, missing };
}

document.getElementById('ai-generate-count-go')?.addEventListener('click', async () => {
  const mode = document.getElementById('ai-generate-mode')?.value || 'generate';
  const lessonId = Number(document.getElementById('ai-generate-lesson-id')?.value);
  const recId = Number(document.getElementById('ai-generate-rec-id')?.value);
  const kind = getAiGenerateKind();
  const picked = getSelectedAiGenerateCounts();
  const focus = teacherFocusValue();
  const modal = document.getElementById('ai-generate-count-modal');
  if (kind === 'quiz') {
    if (!picked.types.length) {
      showToast('Select at least one quiz item type.', 'error');
      return;
    }
    if (picked.missing) {
      showToast('Enter 1 to 20 items for each selected type.', 'error');
      return;
    }
    const itemCap = examAiIntent ? 50 : 30;
    if (picked.total > itemCap) {
      showToast(`The total can be at most ${itemCap} items.`, 'error');
      return;
    }
  }
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('hidden', '');
  }
  if (mode === 'regenerate') {
    if (!recId) return;
    await runAiRegenerateWithOptions(
      recId,
      kind === 'activity' ? null : picked.total,
      kind === 'activity' ? [] : picked.types,
      kind === 'activity' ? null : picked.counts,
      kind,
      focus
    );
    return;
  }
  if (!lessonId) return;
  const asExam = examAiIntent;
  examAiIntent = false;
  await runAiGenerateWithCount(lessonId, kind === 'activity' ? null : picked.total, kind === 'activity' ? [] : picked.types, {
    asExam,
    lessonIds: asExam ? examAiLessonIds.slice() : [],
    quizItemCounts: kind === 'activity' ? null : picked.counts,
    draftKind: asExam ? 'quiz' : kind,
    teacherFocus: focus
  });
});

document.getElementById('ai-generate-count-cancel')?.addEventListener('click', () => {
  examAiIntent = false;
  const modal = document.getElementById('ai-generate-count-modal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('hidden', '');
  }
});

window.regenerateAiRecommendation = async function(id) {
  if (!confirm('Replace this draft with a new AI generation?')) return;
  openAiGenerateOptionsModal({ mode: 'regenerate', recommendationId: id });
};

window.rejectAiRecommendation = async function(id) {
  if (!confirm('Reject this AI draft?')) return;
  try {
    const res = await fetch(`${API_URL}/teacher/ai/recommendations/${id}/reject`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Draft rejected.');
    loadAiRecommendations();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteAiRecommendation = async function(id) {
  if (!confirm('Delete this AI draft?')) return;
  try {
    const res = await fetch(`${API_URL}/teacher/ai/recommendations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Draft deleted.');
    loadAiRecommendations();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.saveAiDraftToBank = async function(id) {
  try {
    showToast('Saving to Classwork…');
    const res = await fetch(`${API_URL}/teacher/classwork/from-ai/${id}`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ types: ['quiz', 'activity'] })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.details || 'Save failed');
    showToast(data.message || 'Saved to Classwork.');
    const savedKind = data.kind || (Array.isArray(data.sets) && data.sets[0]?.kind) || null;
    if (data.quiz_set_id && savedKind) {
      questionBankCurrentSetId = data.quiz_set_id;
      questionBankCurrentCategory = savedKind;
      questionBankOpenedFromKind = true;
      applyTeacherPanel('quiz-bank');
    } else if (typeof loadQuestionBank === 'function') {
      questionBankCurrentSetId = null;
      questionBankCurrentSet = null;
      await loadQuestionBank();
    }
    await loadAiRecommendations();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('progress-copy-questions')?.addEventListener('click', async () => {
  const questions = window._progressEditorQuestions || [];
  if (!questions.length) {
    showToast('No attached items.', 'error');
    return;
  }
  const text = questions.map((q, i) => {
    const type = bankItemTypeLabel(q.item_type || 'mcq');
    const pts = Number(q.points) || 1;
    let block = `${i + 1}. [${type} · ${pts} pt${pts === 1 ? '' : 's'}] ${q.question || ''}`;
    if (Array.isArray(q.choices) && q.choices.length) {
      block += '\n' + q.choices.map((c, j) => `   ${String.fromCharCode(65 + j)}. ${c}`).join('\n');
    }
    if (q.answer) block += `\n   Correct: ${formatMcqAnswerDisplay(q.answer, q.choices) || q.answer}`;
    return block;
  }).join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
    showToast('Attached items copied.');
  } catch {
    showToast('Could not copy to clipboard.', 'error');
  }
});

// ========== QUIZ BANK ==========
let questionBankSets = [];
let questionBankItems = [];
let questionBankCategories = [];
let questionBankCurrentSetId = null;
let questionBankCurrentSet = null;
let questionBankCurrentCategory = null; // 'quizzes' | 'activity' | 'exam' | null
let questionBankOpenedFromKind = false;
let examWriteMode = false;
let examWriteQuestions = [];
let examWriteGrade = null;
let examWriteSubjectId = null;
let examAiIntent = false;
let examAiDraftId = null;
let examAiPlan = null;
let examAiLessonIds = [];
let examAiSource = 'lessons';
const questionBankSelected = new Set();
let qbFilterGrade = '';
let qbFilterSubjectId = '';
let qbFilterKind = '';
let qbGradeMenuApi = null;
let qbSubjectMenuApi = null;

async function ensureTeacherAssignedClasses(force = false) {
  if (!force && teacherAssignedClasses.length) return teacherAssignedClasses;
  try {
    const res = await fetch(`${API_URL}/teacher/classes`, { headers: getAuthHeaders() });
    const classes = await res.json();
    if (res.ok) teacherAssignedClasses = Array.isArray(classes) ? classes : [];
  } catch { /* ignore */ }
  return teacherAssignedClasses;
}

function getTeacherAssignedClassPairs() {
  const map = new Map();
  (teacherAssignedClasses || []).forEach((c) => {
    const grade = Number(c.grade_level);
    const section = String(c.section || '').trim();
    if (!grade || !section) return;
    const key = `${grade}|${section.toUpperCase()}`;
    if (!map.has(key)) map.set(key, { grade_level: grade, section });
  });
  return [...map.values()].sort((a, b) =>
    a.grade_level - b.grade_level || a.section.localeCompare(b.section)
  );
}

function getTeacherAssignedGrades() {
  return [...new Set(getTeacherAssignedClassPairs().map((p) => p.grade_level))];
}

function fillQuizBankGradeFilter() {
  const grades = getTeacherAssignedGrades();
  if (qbFilterGrade && !grades.some((g) => String(g) === String(qbFilterGrade))) {
    qbFilterGrade = '';
  }
  qbGradeMenuApi?.setOptions([
    { value: '', label: 'All my grades' },
    ...grades.map((g) => ({ value: String(g), label: `Grade ${g}` }))
  ]);
}

async function fillLessonPlanQuarterOptions() {
  const sel = document.getElementById('lp-quarter');
  if (!sel) return;
  let quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  try {
    const res = await fetch(`${API_URL}/config`);
    const data = await res.json();
    if (Array.isArray(data.unlockedQuarters) && data.unlockedQuarters.length) {
      quarters = data.unlockedQuarters;
    }
  } catch {
    /* keep the full quarter list */
  }
  const current = sel.value;
  sel.innerHTML = quarters.map((q) => {
    const n = String(q).replace(/^Q/i, '');
    return `<option value="${escapeHtml(q)}">Quarter ${escapeHtml(n)}</option>`;
  }).join('');
  if (current && quarters.includes(current)) sel.value = current;
  else sel.value = quarters[quarters.length - 1] || 'Q1';
}

function fillLessonPlanGradeOptions() {
  const sel = document.getElementById('lp-grade');
  if (!sel) return;
  const grades = getTeacherAssignedGrades();
  if (!grades.length) {
    sel.innerHTML = '<option value="">No assigned grades</option>';
    return;
  }
  const current = sel.value;
  sel.innerHTML = grades.map((g) => `<option value="${g}">Grade ${g}</option>`).join('');
  if (current && grades.some((g) => String(g) === String(current))) sel.value = current;
  else sel.value = String(grades[0]);
  fillTeacherSubjectSelects();
}

document.getElementById('lp-grade')?.addEventListener('change', () => {
  fillTeacherSubjectSelects();
});

function fillQuizBankSubjectFilter() {
  const subjects = getAssignedSubjectsForGrade(qbFilterGrade);
  if (qbFilterSubjectId && !subjects.some((s) => String(s.id) === String(qbFilterSubjectId))) {
    qbFilterSubjectId = '';
  }
  qbSubjectMenuApi?.setOptions([
    { value: '', label: 'All subjects' },
    ...subjects.map((s) => ({ value: String(s.id), label: s.name }))
  ]);
}

function fillAddQuizSubjectOptions() {
  const subjectSel = document.getElementById('qb-add-subject');
  if (!subjectSel) return;
  const prev = subjectSel.value;
  const grade = document.getElementById('qb-add-grade')?.value;
  const subjects = getAssignedSubjectsForGrade(grade);
  subjectSel.innerHTML = subjectSelectOptionsHtml(subjects, {
    emptyLabel: subjects.length ? '-- Select Subject --' : 'No assigned subject for this grade'
  });
  if (!subjects.length) {
    subjectSel.removeAttribute('required');
  } else {
    subjectSel.setAttribute('required', 'required');
  }
  if (teacherCurrentClass?.subjectId &&
    String(teacherCurrentClass.grade) === String(grade) &&
    [...subjectSel.options].some((o) => o.value === String(teacherCurrentClass.subjectId))) {
    subjectSel.value = String(teacherCurrentClass.subjectId);
  } else if (prev && [...subjectSel.options].some((o) => o.value === prev)) {
    subjectSel.value = prev;
  }
}

function bankItemTypeLabel(type) {
  return bankItemTypeLabelClient(type);
}

function syncQuizBankLandingChrome() {
  const onLanding = !questionBankCurrentSetId;
  const addQuizBtn = document.getElementById('qb-add-quiz-btn');
  const filterToolbar = document.getElementById('qb-filter-toolbar');
  if (addQuizBtn) {
    addQuizBtn.hidden = !onLanding;
    if (onLanding) addQuizBtn.removeAttribute('hidden');
    else addQuizBtn.setAttribute('hidden', '');
  }
  if (filterToolbar) {
    filterToolbar.hidden = !onLanding;
    if (onLanding) filterToolbar.removeAttribute('hidden');
    else filterToolbar.setAttribute('hidden', '');
  }
}

function classworkCreateKind(typeOverride) {
  const t = String(typeOverride || '').toLowerCase();
  if (t === 'activity' || t === 'quiz' || t === 'exam') return t;
  if (questionBankCurrentCategory === 'activity') return 'activity';
  if (questionBankCurrentCategory === 'exam') return 'exam';
  return 'quiz';
}

function classworkCreateKindLabel(typeOverride) {
  return typeLabel(classworkCreateKind(typeOverride));
}

function classworkCreateKindPhrase(typeOverride) {
  const label = classworkCreateKindLabel(typeOverride);
  return (/^[aeiou]/i.test(label) ? 'an ' : 'a ') + label;
}

function syncClassworkCreateModalLabels() {
  const kind = classworkCreateKind(document.getElementById('qb-create-type')?.value);
  const label = typeLabel(kind);
  const titleEl = document.getElementById('qb-create-modal-title');
  const confirmBtn = document.getElementById('qb-create-confirm');
  if (titleEl) titleEl.textContent = `Create ${label} from Classwork`;
  if (confirmBtn) confirmBtn.textContent = `Create ${label}`;
  const activityFields = document.getElementById('qb-create-activity-fields');
  const typeField = document.getElementById('qb-create-type-field');
  if (activityFields) {
    const show = kind === 'activity';
    activityFields.hidden = !show;
    if (show) activityFields.removeAttribute('hidden');
    else activityFields.setAttribute('hidden', '');
  }
  if (typeField) {
    const showType = kind === 'quiz';
    typeField.hidden = !showType;
    if (showType) typeField.removeAttribute('hidden');
    else typeField.setAttribute('hidden', '');
  }
}

function updateQuizBankSelectionMeta() {
  const meta = document.getElementById('qb-selection-meta');
  const titleEl = document.getElementById('qb-page-title');
  const headerBtn = document.getElementById('qb-create-progress-btn');
  const nextBar = document.getElementById('qb-next-step-bar');
  const nextBtn = document.getElementById('qb-create-progress-next');
  const nextMeta = document.getElementById('qb-next-step-meta');
  const n = questionBankSelected.size;
  const pickingItems = !!questionBankCurrentCategory;

  if (titleEl) {
    if (questionBankCurrentCategory) {
    if (questionBankCurrentCategory === 'activity') titleEl.textContent = 'Activity';
    else if (questionBankCurrentCategory === 'exam') titleEl.textContent = 'Exam';
    else titleEl.textContent = 'Quizzes';
    } else if (questionBankCurrentSetId) {
      titleEl.textContent = questionBankCurrentSet?.title || 'Classwork set';
    } else {
      titleEl.textContent = 'Classwork';
    }
  }
  if (meta) {
    if (questionBankCurrentCategory) {
      meta.textContent = n ? `${n} selected` : `Select items to create ${classworkCreateKindPhrase()}`;
    } else if (questionBankCurrentSetId) {
      meta.textContent = 'Open Quizzes, Activity, or Exam';
    } else {
      meta.textContent = 'Open a set to pick items, or Create Exam to generate or type an exam';
    }
  }

  // Create stays off the landing header; bottom next-step appears when items are selected
  if (headerBtn) {
    headerBtn.hidden = true;
    headerBtn.disabled = true;
  }
  if (nextBar) {
    const showNext = pickingItems && n > 0;
    nextBar.hidden = !showNext;
    if (showNext) nextBar.removeAttribute('hidden');
    else nextBar.setAttribute('hidden', '');
  }
  if (nextBtn) {
    nextBtn.disabled = n === 0;
    nextBtn.textContent = 'Next';
  }
  if (headerBtn) headerBtn.textContent = 'Next';
  if (nextMeta) {
    nextMeta.textContent = n
      ? `${n} item(s) selected`
      : 'Select items to continue';
  }
  syncQuizBankSelectAllButton();
  syncQuizBankLandingChrome();
}

function showQuizBankListView() {
  const listEl = document.getElementById('qb-list');
  const detailEl = document.getElementById('qb-set-detail');
  if (listEl) {
    listEl.hidden = false;
    listEl.removeAttribute('hidden');
  }
  if (detailEl) {
    detailEl.hidden = true;
    detailEl.setAttribute('hidden', '');
  }
  syncQuizBankLandingChrome();
}

function showQuizBankDetailView() {
  const listEl = document.getElementById('qb-list');
  const detailEl = document.getElementById('qb-set-detail');
  if (listEl) {
    listEl.hidden = true;
    listEl.setAttribute('hidden', '');
    listEl.innerHTML = '';
  }
  if (detailEl) {
    detailEl.hidden = false;
    detailEl.removeAttribute('hidden');
  }
  syncQuizBankLandingChrome();
}

function renderQuizBankSets() {
  const listEl = document.getElementById('qb-list');
  if (!listEl) return;
  questionBankCurrentSetId = null;
  questionBankCurrentSet = null;
  questionBankCurrentCategory = null;
  questionBankOpenedFromKind = false;
  questionBankCategories = [];
  showQuizBankListView();

  if (!questionBankSets.length) {
    listEl.innerHTML = '<p class="empty-state">No classwork sets yet. Click + Add Classwork or save an AI draft.</p>';
    updateQuizBankSelectionMeta();
    return;
  }

  const cards = [];
  questionBankSets.forEach((set) => {
    const kindSpecs = [
      { key: 'quizzes', label: 'Quiz', count: Number(set.quiz_count) || 0 },
      { key: 'activity', label: 'Activity', count: Number(set.activity_count) || 0 },
      { key: 'exam', label: 'Exam', count: Number(set.exam_count) || 0 }
    ];
    const owned = kindSpecs.find((kind) => kind.key === set.kind);
    const kinds = owned
      ? [{ ...owned, count: owned.count }]
      : kindSpecs.filter((kind) => kind.count > 0);
    const visible = qbFilterKind ? kinds.filter((kind) => kind.key === qbFilterKind) : kinds;
    if (!visible.length) {
      if (!qbFilterKind && !kinds.length && !owned) {
        cards.push({ set, key: '', label: '', count: Number(set.item_count) || 0 });
      }
      return;
    }
    visible.forEach((kind) => cards.push({ set, ...kind }));
  });
  if (!cards.length) {
    const emptyLabel = qbFilterKind === 'quizzes' ? 'quizzes' : qbFilterKind === 'activity' ? 'activities' : 'exams';
    listEl.innerHTML = `<p class="empty-state">No ${emptyLabel} yet.</p>`;
    updateQuizBankSelectionMeta();
    return;
  }

  listEl.innerHTML = cards.map(({ set, key, label, count }) => `
    <article class="lesson-plan-card qb-set-card" data-set-id="${set.id}" data-qb-kind="${escapeHtml(key)}" role="button" tabindex="0">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div>
          ${label ? `<p class="page-subheading" style="margin:0 0 4px;">${escapeHtml(label)}</p>` : ''}
          <h3 class="page-heading font-heading" style="margin:0;">${escapeHtml(set.title || 'Classwork set')}</h3>
          <p class="page-subheading">
            Grade ${set.grade_level}${set.subject_name ? ' · ' + escapeHtml(set.subject_name) : ''}
            · ${count} item(s)
            ${set.source === 'ai' ? ' · AI' : ''}
          </p>
        </div>
        <span class="chip-ghost" style="pointer-events:none;">Open →</span>
      </div>
    </article>
  `).join('');

  listEl.querySelectorAll('.qb-set-card').forEach((card) => {
    const open = () => {
      const kind = card.dataset.qbKind;
      openQuizBankSet(Number(card.dataset.setId), kind ? { keepCategory: kind, fromKindList: true } : {});
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
  updateQuizBankSelectionMeta();
}

function syncQuizBankCheckboxes() {
  document.querySelectorAll('#qb-set-groups .qb-select').forEach((cb) => {
    cb.checked = questionBankSelected.has(Number(cb.dataset.id));
  });
  updateQuizBankSelectionMeta();
}

function currentCategoryItemIds() {
  const cat = questionBankCategories.find((c) => c.category === questionBankCurrentCategory);
  if (!cat) return [];
  return (cat.groups || []).flatMap((g) => (g.items || []).map((i) => i.id));
}

function allCurrentCategorySelected() {
  const ids = currentCategoryItemIds();
  return ids.length > 0 && ids.every((id) => questionBankSelected.has(id));
}

function syncQuizBankSelectAllButton() {
  const btn = document.getElementById('qb-select-all');
  if (!btn) return;
  const ids = currentCategoryItemIds();
  btn.disabled = ids.length === 0;
  btn.textContent = allCurrentCategorySelected() ? 'Unselect All' : 'Select All';
}

function toggleQuizBankSelectAll() {
  const ids = currentCategoryItemIds();
  if (!ids.length) return;
  if (allCurrentCategorySelected()) {
    ids.forEach((id) => questionBankSelected.delete(id));
  } else {
    ids.forEach((id) => questionBankSelected.add(id));
  }
  syncQuizBankCheckboxes();
}

function setQuizBankBulkBarVisible(visible) {
  const bar = document.getElementById('qb-bulk-bar');
  const del = document.getElementById('qb-set-delete');
  const addBtn = document.getElementById('qb-add-question-btn');
  if (bar) {
    bar.hidden = !visible;
    if (visible) bar.removeAttribute('hidden');
    else bar.setAttribute('hidden', '');
  }
  if (del) {
    const showDelete = !visible || questionBankOpenedFromKind;
    del.hidden = !showDelete;
    if (showDelete) del.removeAttribute('hidden');
    else del.setAttribute('hidden', '');
  }
  if (addBtn) {
    // Add question/activity only inside Quizzes/Activity questions view
    addBtn.hidden = !visible;
    if (visible) {
      addBtn.removeAttribute('hidden');
      addBtn.textContent = questionBankCurrentCategory === 'activity'
        ? '+ Add Activity'
        : questionBankCurrentCategory === 'exam'
          ? '+ Add Exam Question'
          : '+ Add Quiz Question';
    } else {
      addBtn.setAttribute('hidden', '');
    }
  }
}

function relabelQbChoiceRows() {
  const list = document.getElementById('qb-edit-choices-list');
  if (!list) return;
  [...list.querySelectorAll('.qb-choice-row')].forEach((row, i) => {
    const letter = row.querySelector('.qb-choice-letter');
    if (letter) letter.textContent = mcqLetterAt(i);
    const remove = row.querySelector('.qb-choice-remove');
    if (remove) remove.hidden = list.querySelectorAll('.qb-choice-row').length <= 2;
  });
}

function collectQbChoices() {
  const list = document.getElementById('qb-edit-choices-list');
  if (!list) return [];
  return [...list.querySelectorAll('.qb-choice-input')]
    .map((el) => stripMcqChoicePrefix(el.value).trim())
    .filter(Boolean);
}

function addQbChoiceRow(text = '', focus = false) {
  const list = document.getElementById('qb-edit-choices-list');
  if (!list) return null;
  const row = document.createElement('div');
  row.className = 'qb-choice-row';
  row.innerHTML = `
    <span class="qb-choice-letter"></span>
    <textarea class="qb-choice-input" rows="1" aria-label="Choice"></textarea>
    <button type="button" class="icon-btn qb-choice-remove" title="Remove choice" aria-label="Remove choice">×</button>
  `;
  const input = row.querySelector('.qb-choice-input');
  input.value = text;
  list.appendChild(row);
  relabelQbChoiceRows();
  if (focus) input.focus();
  return row;
}

function setQbChoiceValues(choices) {
  const list = document.getElementById('qb-edit-choices-list');
  if (!list) return;
  list.innerHTML = '';
  const items = Array.isArray(choices) && choices.length
    ? choices.map((c) => stripMcqChoicePrefix(String(c)))
    : ['', ''];
  if (items.length < 2) items.push('');
  items.forEach((t) => addQbChoiceRow(t, false));
}

function bindQbChoicesListOnce() {
  const list = document.getElementById('qb-edit-choices-list');
  if (!list || list.dataset.bound === '1') return;
  list.dataset.bound = '1';
  list.addEventListener('keydown', (e) => {
    const input = e.target.closest('.qb-choice-input');
    if (!input || !list.contains(input)) return;
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const row = input.closest('.qb-choice-row');
    const next = addQbChoiceRow('', false);
    if (row && next) row.after(next);
    relabelQbChoiceRows();
    next?.querySelector('.qb-choice-input')?.focus();
  });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.qb-choice-remove');
    if (!btn || !list.contains(btn)) return;
    const rows = list.querySelectorAll('.qb-choice-row');
    if (rows.length <= 2) return;
    btn.closest('.qb-choice-row')?.remove();
    relabelQbChoiceRows();
  });
}

function syncQuizBankChoicesVisibility() {
  const type = document.getElementById('qb-edit-type')?.value || 'mcq';
  const wrap = document.getElementById('qb-edit-choices-wrap');
  const answerWrap = document.getElementById('qb-edit-answer-wrap');
  const rubricWrap = document.getElementById('qb-edit-rubric-wrap');
  const qLabel = document.getElementById('qb-edit-question-label');
  const qInput = document.getElementById('qb-edit-question');
  const choiceLabel = document.getElementById('qb-edit-choices-label');
  const choiceHint = document.getElementById('qb-edit-choices-hint');
  const answerLabel = document.getElementById('qb-edit-answer-label');
  const answerInput = document.getElementById('qb-edit-answer');
  const answerTf = document.getElementById('qb-edit-answer-tf');
  const answerLong = document.getElementById('qb-edit-answer-long');
  const isActivity = type === 'activity';
  const showChoices = quizTypeStoresChoices(type);
  const derivedAnswer = type === 'matching' || type === 'sequencing';

  if (qLabel) qLabel.textContent = isActivity ? 'Description' : 'Question';
  if (qInput) {
    qInput.placeholder = isActivity
      ? 'Describe what students will do…'
      : (type === 'fill_blank' ? 'Use _____ for each blank.' : 'e.g. What is…?');
  }
  if (choiceLabel) {
    choiceLabel.textContent = type === 'fill_blank' ? 'Word bank'
      : type === 'matching' ? 'Pairs'
      : type === 'sequencing' ? 'Steps in order'
      : type === 'identification' ? 'Extra words'
      : 'Choices';
  }
  if (choiceHint) {
    choiceHint.textContent = type === 'fill_blank'
      ? 'One word or phrase per line. Include the correct words and a few extras.'
      : type === 'matching'
        ? 'Each line is left | right. Example: Sun | star. Each right side can be used only once.'
        : type === 'sequencing'
          ? 'One step per line, already in the correct order.'
          : type === 'identification'
            ? 'Optional. These words join the shared answer box and are not the correct answer.'
            : 'Enter adds the next letter (A, B, C…). Long text wraps in the same box.';
  }

  if (wrap) {
    wrap.hidden = !showChoices;
    if (showChoices) {
      wrap.removeAttribute('hidden');
      bindQbChoicesListOnce();
      const list = document.getElementById('qb-edit-choices-list');
      if (list && !list.querySelector('.qb-choice-row')) {
        const blanks = (type === 'matching' || type === 'sequencing') ? ['', '', '']
          : type === 'identification' ? ['']
          : ['', ''];
        setQbChoiceValues(blanks);
      }
    } else wrap.setAttribute('hidden', '');
  }
  if (answerWrap) {
    const showAns = !isActivity && !derivedAnswer;
    answerWrap.hidden = !showAns;
    if (showAns) answerWrap.removeAttribute('hidden');
    else answerWrap.setAttribute('hidden', '');
  }
  if (answerLabel) {
    answerLabel.textContent = type === 'short_answer' ? 'Model answer' : 'Correct Answer';
  }
  if (answerInput) {
    answerInput.hidden = type === 'true_false' || type === 'short_answer';
    answerInput.placeholder = type === 'fill_blank' ? 'Correct word, or words in blank order' : 'A';
  }
  if (answerTf) answerTf.hidden = type !== 'true_false';
  if (answerLong) answerLong.hidden = type !== 'short_answer';
  if (rubricWrap) {
    rubricWrap.hidden = !isActivity;
    if (isActivity) rubricWrap.removeAttribute('hidden');
    else rubricWrap.setAttribute('hidden', '');
  }
}

const QB_RUBRIC_LEVELS = ['Excellent', 'Good', 'Fair', 'Needs Improvement'];

function defaultRubricLevelPoints(maxPoints) {
  const max = Math.max(1, Number(maxPoints) || 5);
  return [
    max,
    Math.max(1, Math.ceil(max * 0.75)),
    Math.max(1, Math.ceil(max * 0.5)),
    Math.max(1, Math.ceil(max * 0.25))
  ];
}

function emptyRubricCategory(name = '', maxPoints = 5) {
  const pts = defaultRubricLevelPoints(maxPoints);
  return {
    name,
    max_points: maxPoints,
    levels: QB_RUBRIC_LEVELS.map((label, i) => ({
      label,
      points: pts[i],
      description: ''
    }))
  };
}

function emptyRubricTemplateClient(totalPoints = 20) {
  const total = Math.max(3, Number(totalPoints) || 20);
  const n = 3;
  const base = Math.floor(total / n);
  const rem = total - base * n;
  const shares = Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
  return {
    categories: ['Participation', 'Correctness', 'Effort'].map((name, i) =>
      emptyRubricCategory(name, shares[i])
    )
  };
}

function normalizeRubricClient(raw, fallbackMax = 20) {
  if (!raw || typeof raw !== 'object') return null;
  const list = rubricCategoriesOf(raw);
  const categories = list
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const name = String(c.name || '').trim();
      if (!name) return null;
      const max_points = Math.max(1, Number(c.max_points) || 5);
      const pts = defaultRubricLevelPoints(max_points);
      let levels = Array.isArray(c.levels) ? c.levels : [];
      levels = QB_RUBRIC_LEVELS.map((label, i) => {
        const lv = levels[i] || {};
        return {
          label: String(lv.label || label),
          points: Math.max(0, Number(lv.points) || pts[i]),
          description: String(lv.description || '').trim()
        };
      });
      return { name, max_points, levels };
    })
    .filter(Boolean)
    .slice(0, 8);
  return categories.length ? { categories } : null;
}

function rubricCategoriesSum(rubric) {
  const data = normalizeRubricClient(rubric);
  if (!data) return 0;
  return data.categories.reduce((s, c) => s + (Number(c.max_points) || 0), 0);
}

function syncRubricSumWarning() {
  const note = document.getElementById('qb-edit-rubric-sum-note');
  if (!note) return;
  const total = Math.max(1, Number(document.getElementById('qb-edit-points')?.value) || 0);
  note.textContent = `Total Points: ${total}`;
  note.className = 'page-subheading';
}

function renderRubricEditor(rubric, opts = {}) {
  const list = document.getElementById(opts.listId || 'qb-edit-rubric-list');
  if (!list) return;
  const pointsValue = () => Number(document.getElementById(opts.pointsId || 'qb-edit-points')?.value) || 20;
  const onSync = typeof opts.onSync === 'function' ? opts.onSync : syncRubricSumWarning;
  let data = null;
  if (opts.keepEmpty && rubric?.categories?.length) {
    data = {
      categories: rubric.categories.slice(0, 8).map((c) => {
        const max_points = Math.max(1, Number(c.max_points) || 5);
        const pts = defaultRubricLevelPoints(max_points);
        const levels = QB_RUBRIC_LEVELS.map((label, i) => {
          const lv = (c.levels || [])[i] || {};
          return {
            label: String(lv.label || label),
            points: Math.max(0, Number(lv.points) || pts[i]),
            description: String(lv.description || '')
          };
        });
        return { name: String(c.name || ''), max_points, levels };
      })
    };
  }
  if (!data?.categories?.length) {
    data = normalizeRubricClient(rubric) || emptyRubricTemplateClient(pointsValue());
  }
  list.innerHTML = data.categories.map((c, idx) => `
    <div class="qb-rubric-category" data-rubric-idx="${idx}">
      <div class="form-row admin-edit-form-row-2" style="margin-bottom:6px;">
        <div class="field-small">
          <label>Category</label>
          <input type="text" class="qb-rubric-name" value="${escapeHtml(c.name)}" placeholder="e.g. Participation" />
        </div>
        <div class="field-small">
          <label>Max Points</label>
          <input type="number" class="qb-rubric-max" min="1" step="1" value="${Number(c.max_points) || 5}" />
        </div>
      </div>
      <div class="qb-rubric-levels">
        ${(c.levels || []).map((lv, li) => `
          <div class="field-small">
            <label>${escapeHtml(lv.label || QB_RUBRIC_LEVELS[li] || 'Level')} (${Number(lv.points) || 0} pts)</label>
            <input type="text" class="qb-rubric-level-desc" data-level-idx="${li}" value="${escapeHtml(lv.description || '')}" placeholder="Description for this level" />
          </div>
        `).join('')}
      </div>
      <button type="button" class="chip-ghost chip-danger qb-rubric-remove" style="margin-top:6px;">Remove Category</button>
    </div>
  `).join('');

  list.querySelectorAll('.qb-rubric-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.qb-rubric-category');
      if (!card) return;
      card.remove();
      if (!list.querySelector('.qb-rubric-category')) {
        renderRubricEditor(emptyRubricTemplateClient(pointsValue()), opts);
      }
      onSync();
    });
  });

  list.querySelectorAll('.qb-rubric-max, .qb-rubric-name').forEach((input) => {
    input.addEventListener('input', onSync);
    input.addEventListener('change', () => {
      if (input.classList.contains('qb-rubric-max')) {
        const card = input.closest('.qb-rubric-category');
        if (!card) return;
        const max = Math.max(1, Number(input.value) || 5);
        const pts = defaultRubricLevelPoints(max);
        card.querySelectorAll('.qb-rubric-level-desc').forEach((descInput, li) => {
          const label = descInput.closest('.field-small')?.querySelector('label');
          if (label) {
            label.textContent = `${QB_RUBRIC_LEVELS[li] || 'Level'} (${pts[li]} pts)`;
          }
        });
      }
      onSync();
    });
  });

  onSync();
}

function collectRubricFromList(list, { requireName = true } = {}) {
  if (!list) return null;
  const categories = [...list.querySelectorAll('.qb-rubric-category')].map((card) => {
    const name = card.querySelector('.qb-rubric-name')?.value?.trim() || '';
    const max_points = Math.max(1, Number(card.querySelector('.qb-rubric-max')?.value) || 5);
    const pts = defaultRubricLevelPoints(max_points);
    const levels = [...card.querySelectorAll('.qb-rubric-level-desc')].map((inp, li) => ({
      label: QB_RUBRIC_LEVELS[li] || `Level ${li + 1}`,
      points: pts[li],
      description: inp.value.trim()
    }));
    return { name, max_points, levels };
  }).filter((c) => !requireName || c.name);
  return categories.length ? { categories } : null;
}

function collectRubricFromEditor() {
  return collectRubricFromList(document.getElementById('qb-edit-rubric-list'));
}

function rubricPreviewHtml(rubric) {
  const data = normalizeRubricClient(rubric);
  if (!data) return '';
  const rows = data.categories.map((c) => {
    const levels = (c.levels || [])
      .map((lv) => `<li><strong>${escapeHtml(lv.label)}</strong> (${Number(lv.points) || 0}): ${escapeHtml(lv.description || '—')}</li>`)
      .join('');
    return `<div class="progress-q-answer qb-rubric-preview-block">
      <strong>${escapeHtml(c.name)}</strong> · ${Number(c.max_points) || 0} pts
      <ul class="progress-choice-list">${levels}</ul>
    </div>`;
  }).join('');
  return `<div class="qb-rubric-preview"><p class="progress-q-type" style="margin:6px 0 4px;">Rubric</p>${rows}</div>`;
}

const QB_QUIZ_TYPE_OPTIONS = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'true_false', label: 'True or False' },
  { value: 'fill_blank', label: 'Fill in the blank' },
  { value: 'matching', label: 'Matching' },
  { value: 'sequencing', label: 'Sequencing' },
  { value: 'identification', label: 'Identification' },
  { value: 'enumeration', label: 'Enumeration' },
  { value: 'short_answer', label: 'Short answer' }
];

function quizTypeStoresChoices(type) {
  return ['mcq', 'fill_blank', 'matching', 'sequencing', 'identification'].includes(type);
}

const QB_ACTIVITY_TYPE_OPTIONS = [
  { value: 'activity', label: 'Activity' }
];

/** Quizzes folder = quiz types only; Activity folder = activity only. */
function fillQuizBankTypeOptions(preferredValue, categoryOverride = null) {
  const typeSel = document.getElementById('qb-edit-type');
  if (!typeSel) return null;
  const cat = categoryOverride != null ? categoryOverride : questionBankCurrentCategory;
  const inActivity = cat === 'activity';
  const options = inActivity ? QB_ACTIVITY_TYPE_OPTIONS : QB_QUIZ_TYPE_OPTIONS;
  typeSel.innerHTML = options
    .map((o) => `<option value="${o.value}">${o.label}</option>`)
    .join('');
  let type = preferredValue;
  if (type === 'quizzes') type = 'mcq';
  if (!options.some((o) => o.value === type)) {
    type = inActivity ? 'activity' : 'mcq';
  }
  typeSel.value = type;
  return type;
}

window.openQuizBankAdd = function(preferredType) {
  const writingExam = examWriteMode;
  if (!writingExam && (!questionBankCurrentSetId || !questionBankCurrentSet)) {
    showToast('Open a Classwork set first.', 'error');
    return;
  }
  const modal = document.getElementById('qb-edit-modal');
  if (!modal) return;
  const titleEl = document.getElementById('qb-edit-modal-title');
  if (titleEl) {
    titleEl.textContent = writingExam || questionBankCurrentCategory === 'exam'
      ? 'Add Exam Question'
      : questionBankCurrentCategory === 'activity' ? 'Add Activity' : 'Add Quiz Question';
  }
  const subEl = document.getElementById('qb-edit-modal-subtitle');
  if (subEl) {
    subEl.textContent = writingExam || questionBankCurrentCategory === 'exam'
      ? 'Add an exam question to this Classwork set.'
      : questionBankCurrentCategory === 'activity'
        ? 'Add an activity to this Classwork set.'
        : 'Add a quiz question to this classwork set.';
  }
  document.getElementById('qb-edit-id').value = '';
  document.getElementById('qb-edit-question').value = '';
  bindQbChoicesListOnce();
  setQbChoiceValues(['', '']);
  document.getElementById('qb-edit-answer').value = '';
  const tfAdd = document.getElementById('qb-edit-answer-tf');
  const longAdd = document.getElementById('qb-edit-answer-long');
  if (tfAdd) tfAdd.value = 'True';
  if (longAdd) longAdd.value = '';
  document.getElementById('qb-edit-points').value = preferredType === 'activity' || questionBankCurrentCategory === 'activity' ? '20' : '1';
  const preferred = writingExam
    ? 'mcq'
    : (preferredType || (questionBankCurrentCategory === 'activity' ? 'activity' : 'mcq'));
  fillQuizBankTypeOptions(preferred, writingExam ? 'quizzes' : null);
  const gradeSel = document.getElementById('qb-edit-grade');
  const grades = getTeacherAssignedGrades();
  const setGrade = writingExam
    ? Number(examWriteGrade)
    : Number(questionBankCurrentSet?.grade_level);
  if (gradeSel) {
    gradeSel.innerHTML = grades.length
      ? grades.map((g) => `<option value="${g}">Grade ${g}</option>`).join('')
      : '<option value="">No assigned grades</option>';
    if (grades.includes(setGrade)) gradeSel.value = String(setGrade);
    else if (grades[0]) gradeSel.value = String(grades[0]);
    gradeSel.disabled = true;
  }
  syncQuizBankChoicesVisibility();
  if ((document.getElementById('qb-edit-type')?.value || '') === 'activity') {
    renderRubricEditor(emptyRubricTemplateClient(Number(document.getElementById('qb-edit-points')?.value) || 20));
  }
  modal.hidden = false;
  modal.removeAttribute('hidden');
};

window.openQuizBankEdit = function(id) {
  const item = questionBankItems.find((i) => i.id === id);
  const modal = document.getElementById('qb-edit-modal');
  if (!item || !modal) return;
  const isActivity = isActivityItemType(item.item_type);
  const titleEl = document.getElementById('qb-edit-modal-title');
  if (titleEl) titleEl.textContent = isActivity ? 'Edit Activity' : 'Edit Quiz Question';
  const subEl = document.getElementById('qb-edit-modal-subtitle');
  if (subEl) subEl.textContent = isActivity ? 'Update this activity.' : 'Update this quiz question.';
  document.getElementById('qb-edit-id').value = String(item.id);
  document.getElementById('qb-edit-question').value = item.question || '';
  bindQbChoicesListOnce();
  setQbChoiceValues(Array.isArray(item.choices) ? item.choices : ['', '']);
  const answerText = document.getElementById('qb-edit-answer');
  const answerTf = document.getElementById('qb-edit-answer-tf');
  const answerLong = document.getElementById('qb-edit-answer-long');
  const itemType = String(item.item_type || 'mcq');
  if (answerText) {
    answerText.value = itemType === 'mcq' && Array.isArray(item.choices) && item.choices.length
      ? (formatMcqAnswerDisplay(item.answer, item.choices) || item.answer || '')
      : (item.answer || '');
  }
  if (answerTf) answerTf.value = /false/i.test(String(item.answer || '')) ? 'False' : 'True';
  if (answerLong) answerLong.value = itemType === 'short_answer' ? (item.answer || '') : '';
  document.getElementById('qb-edit-points').value = String(Number(item.points) || 1);
  // Prefer folder category; fall back to item type when editing
  const editCat = questionBankCurrentCategory
    || (isActivity ? 'activity' : 'quizzes');
  fillQuizBankTypeOptions(item.item_type || (isActivity ? 'activity' : 'mcq'), editCat);
  const gradeSel = document.getElementById('qb-edit-grade');
  const grades = getTeacherAssignedGrades();
  if (gradeSel) {
    gradeSel.disabled = false;
    gradeSel.innerHTML = grades.length
      ? grades.map((g) => `<option value="${g}">Grade ${g}</option>`).join('')
      : '<option value="">No assigned grades</option>';
    if (grades.includes(Number(item.grade_level))) gradeSel.value = String(item.grade_level);
    else if (grades[0]) gradeSel.value = String(grades[0]);
  }
  syncQuizBankChoicesVisibility();
  if (isActivity || String(item.item_type || '') === 'activity') {
    renderRubricEditor(item.rubric || emptyRubricTemplateClient(Number(item.points) || 20));
  }
  modal.hidden = false;
  modal.removeAttribute('hidden');
};


function renderQuizBankCategoryFolders() {
  showQuizBankDetailView();
  questionBankCurrentCategory = null;
  setQuizBankBulkBarVisible(false);

  const groupsEl = document.getElementById('qb-set-groups');
  const backBtn = document.getElementById('qb-set-back');

  if (backBtn) backBtn.textContent = '← Classwork';
  if (!groupsEl) return;

  groupsEl.innerHTML = questionBankCategories.map((cat) => `
    <article class="lesson-plan-card qb-category-card" data-category="${escapeHtml(cat.category)}" role="button" tabindex="0">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
        <div>
          <h3 class="page-heading font-heading" style="margin:0;">${escapeHtml(cat.label)}</h3>
          <p class="page-subheading">${Number(cat.item_count) || 0} item(s)</p>
        </div>
        <span class="chip-ghost" style="pointer-events:none;">Open →</span>
      </div>
    </article>
  `).join('');

  if (!questionBankItems.length) {
    groupsEl.insertAdjacentHTML('beforeend', `
      <p class="page-subheading" style="margin:12px 0 0;">
        No items yet. Open <strong>Quizzes</strong>, <strong>Activity</strong>, or <strong>Exam</strong> to add items, or generate an AI draft in <strong>Materials</strong> and use <strong>Save to Classwork</strong>.
      </p>`);
  }

  groupsEl.querySelectorAll('.qb-category-card').forEach((card) => {
    const open = () => openQuizBankCategory(card.dataset.category);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
  updateQuizBankSelectionMeta();
}

function renderQuizBankItemRow(item) {
  const checked = questionBankSelected.has(item.id) ? 'checked' : '';
  const choices = Array.isArray(item.choices) && item.choices.length
    ? `<ul class="progress-quiz-choices">${item.choices.map((c, i) => {
        const body = stripMcqChoicePrefix(c) || String(c || '');
        return `<li><strong>${escapeHtml(mcqLetterAt(i))}.</strong> ${escapeHtml(body)}</li>`;
      }).join('')}</ul>`
    : '';
  const ans = item.answer
    ? `<p class="page-subheading">Answer: ${escapeHtml(formatQuizTakenAnswer(item.answer, item.choices) || String(item.answer))}</p>`
    : '';
  const rubricCount = rubricCategoriesOf(item.rubric).length;
  const rubricNote = rubricCount
    ? `<p class="page-subheading" style="margin:4px 0 0;">Rubric · ${rubricCount} categor${rubricCount === 1 ? 'y' : 'ies'}</p>`
    : (isActivityItemType(item.item_type)
      ? '<p class="page-subheading" style="margin:4px 0 0;">No rubric yet — edit to add categories</p>'
      : '');
  return `
    <div class="qb-set-item" data-qb-id="${item.id}">
      <input type="checkbox" class="qb-select" data-id="${item.id}" ${checked} />
      <div style="flex:1;">
        <p style="margin:0;color:var(--text-dark);">${escapeHtml(item.question)}</p>
        ${choices}${ans}${rubricNote}
        <p class="page-subheading" style="margin:4px 0 0;">${Number(item.points) || 1} pts</p>
        <div class="lesson-plan-card-actions">
          <button type="button" class="chip-ghost" onclick="openQuizBankEdit(${item.id})">Edit</button>
          <button type="button" class="chip-ghost" onclick="copyQuizBankItem(${item.id})">Copy</button>
          <button type="button" class="chip-ghost" onclick="deleteQuizBankItem(${item.id})">Remove</button>
        </div>
      </div>
    </div>`;
}

function renderQuizBankCategoryDetail(categoryKey) {
  showQuizBankDetailView();
  questionBankCurrentCategory = categoryKey;
  setQuizBankBulkBarVisible(true);

  const cat = questionBankCategories.find((c) => c.category === categoryKey);
  const groupsEl = document.getElementById('qb-set-groups');
  const backBtn = document.getElementById('qb-set-back');
  const set = questionBankCurrentSet || {};

  if (backBtn) {
    if (questionBankOpenedFromKind) {
      backBtn.textContent = '← Classwork';
    } else {
      const setTitle = (set.title || '').trim();
      backBtn.textContent = setTitle ? `← ${setTitle}` : '← Back to set';
    }
  }
  if (!groupsEl) return;

  const groups = cat?.groups || [];
  if (!groups.length) {
    groupsEl.innerHTML = `
      <p class="empty-state" style="margin-bottom:12px;">No items in this folder yet. Use <strong>${questionBankCurrentCategory === 'activity' ? '+ Add Activity' : questionBankCurrentCategory === 'exam' ? '+ Add Exam Question' : '+ Add Quiz Question'}</strong> above to create one.</p>`;
    updateQuizBankSelectionMeta();
    return;
  }

  if (categoryKey === 'activity') {
    const items = groups.flatMap((g) => g.items || []);
    groupsEl.innerHTML = `
      <div class="qb-type-section-body" style="padding:8px 4px;">
        ${items.map((item) => renderQuizBankItemRow(item)).join('')}
      </div>`;
  } else {
    groupsEl.innerHTML = groups.map((group) => {
      return `
        <details class="qb-type-section" open>
          <summary>
            <span>${escapeHtml(group.label || bankItemTypeLabel(group.item_type))}</span>
            <span class="page-subheading">${group.items.length}</span>
          </summary>
          <div class="qb-type-section-body">${group.items.map((item) => renderQuizBankItemRow(item)).join('')}</div>
        </details>`;
    }).join('');
  }

  groupsEl.querySelectorAll('.qb-select').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = Number(cb.dataset.id);
      if (cb.checked) questionBankSelected.add(id);
      else questionBankSelected.delete(id);
      updateQuizBankSelectionMeta();
    });
  });
  updateQuizBankSelectionMeta();
}

function openQuizBankCategory(categoryKey) {
  if (!categoryKey) return;
  const allowed = new Set(
    (questionBankCategories.find((c) => c.category === categoryKey)?.groups || [])
      .flatMap((g) => (g.items || []).map((i) => i.id))
  );
  [...questionBankSelected].forEach((id) => {
    if (!allowed.has(id)) questionBankSelected.delete(id);
  });
  renderQuizBankCategoryDetail(categoryKey);
}

function buildCategoriesClientSide(items) {
  const quizItems = [];
  const activityItems = [];
  const examItems = [];
  (items || []).forEach((item) => {
    if (isActivityItemType(item.item_type)) activityItems.push(item);
    else if (String(item.folder || '').toLowerCase() === 'exam') examItems.push(item);
    else quizItems.push(item);
  });
  const byType = (list) => {
    const map = new Map();
    list.forEach((item) => {
      const key = item.item_type || 'mcq';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return [...map.entries()].map(([item_type, groupItems]) => ({
      item_type,
      label: bankItemTypeLabel(item_type),
      items: groupItems
    }));
  };
  return [
    { category: 'quizzes', label: 'Quizzes', item_count: quizItems.length, groups: byType(quizItems) },
    { category: 'activity', label: 'Activity', item_count: activityItems.length, groups: byType(activityItems) },
    { category: 'exam', label: 'Exam', item_count: examItems.length, groups: byType(examItems) }
  ];
}

function ensureQuizBankFolders(categories, items) {
  const built = buildCategoriesClientSide(items || []);
  if (!Array.isArray(categories) || !categories.length) return built;
  const byKey = new Map(categories.map((c) => [c.category, c]));
  return built.map((fallback) => {
    const existing = byKey.get(fallback.category);
    if (!existing) return fallback;
    return {
      ...fallback,
      ...existing,
      label: existing.label || fallback.label,
      item_count: Number(existing.item_count) || fallback.item_count,
      groups: Array.isArray(existing.groups) ? existing.groups : fallback.groups
    };
  });
}

async function loadQuestionBank() {
  const listEl = document.getElementById('qb-list');
  if (!listEl) return;
  fillQuizBankGradeFilter();
  fillQuizBankSubjectFilter();

  if (questionBankCurrentSetId) {
    await openQuizBankSet(questionBankCurrentSetId, { keepCategory: questionBankCurrentCategory });
    return;
  }

  const params = new URLSearchParams();
  const grade = qbFilterGrade;
  const subjectId = qbFilterSubjectId;
  if (grade) params.set('grade', grade);
  if (subjectId) params.set('subject_id', subjectId);

  try {
    const res = await fetch(`${API_URL}/teacher/classwork/sets?${params}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    questionBankSets = Array.isArray(data) ? data : [];
    questionBankItems = [];
    questionBankCategories = [];
    questionBankCurrentSet = null;
    questionBankCurrentCategory = null;
    questionBankSelected.clear();
    renderQuizBankSets();
  } catch (err) {
    console.error('Load quiz sets error:', err);
    listEl.innerHTML = `<p class="empty-state">Failed to load Classwork.${err?.message ? ` (${escapeHtml(err.message)})` : ''}</p>`;
  }
}

async function openQuizBankSet(setId, opts = {}) {
  if (!setId) return;
  try {
    const res = await fetch(`${API_URL}/teacher/classwork/sets/${setId}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    questionBankCurrentSetId = setId;
    questionBankCurrentSet = data.set || null;
    if (opts.fromKindList) questionBankOpenedFromKind = true;
    else if (!opts.keepCategory) questionBankOpenedFromKind = false;
    questionBankItems = Array.isArray(data.items) ? data.items : [];
    questionBankCategories = ensureQuizBankFolders(
      Array.isArray(data.categories) ? data.categories : [],
      questionBankItems
    );
    const valid = new Set(questionBankItems.map((i) => i.id));
    [...questionBankSelected].forEach((id) => {
      if (!valid.has(id)) questionBankSelected.delete(id);
    });
    if (opts.keepCategory && questionBankCategories.some((c) => c.category === opts.keepCategory)) {
      renderQuizBankCategoryDetail(opts.keepCategory);
    } else {
      questionBankCurrentCategory = null;
      renderQuizBankCategoryFolders();
    }
  } catch (err) {
    showToast(err.message || 'Could not open set.', 'error');
    questionBankCurrentSetId = null;
    questionBankCurrentSet = null;
    questionBankCurrentCategory = null;
    loadQuestionBank();
  }
}





window.copyQuizBankItem = async function(id) {
  const item = questionBankItems.find((i) => i.id === id);
  if (!item) return;
  let text = item.question || '';
  if (Array.isArray(item.choices) && item.choices.length) {
    text += '\n' + item.choices.map((c, j) => `${String.fromCharCode(65 + j)}. ${c}`).join('\n');
  }
  if (item.answer) text += `\nAnswer: ${formatMcqAnswerDisplay(item.answer, item.choices) || item.answer}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied.');
  } catch {
    showToast('Could not copy.', 'error');
  }
};

window.deleteQuizBankItem = async function(id) {
  const delItem = questionBankItems.find((i) => i.id === id);
  const delLabel = isActivityItemType(delItem?.item_type) ? 'activity' : 'quiz question';
  if (!confirm(`Remove this ${delLabel} from Classwork?`)) return;
  try {
    const res = await fetch(`${API_URL}/teacher/classwork/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    questionBankSelected.delete(id);
    showToast('Removed.');
    if (questionBankCurrentSetId) {
      await openQuizBankSet(questionBankCurrentSetId, { keepCategory: questionBankCurrentCategory });
    } else loadQuestionBank();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

qbGradeMenuApi = wireDownloadSelectMenu({
  menuId: 'qb-filter-grade-menu',
  btnId: 'qb-filter-grade-btn',
  panelId: 'qb-filter-grade-panel',
  options: [{ value: '', label: 'All my grades' }],
  getValue: () => qbFilterGrade,
  setValue: (v) => { qbFilterGrade = v || ''; },
  onPick: () => {
    questionBankCurrentSetId = null;
    questionBankCurrentCategory = null;
    questionBankSelected.clear();
    fillQuizBankSubjectFilter();
    loadQuestionBank();
  }
});

qbSubjectMenuApi = wireDownloadSelectMenu({
  menuId: 'qb-filter-subject-menu',
  btnId: 'qb-filter-subject-btn',
  panelId: 'qb-filter-subject-panel',
  options: [{ value: '', label: 'All subjects' }],
  getValue: () => qbFilterSubjectId,
  setValue: (v) => { qbFilterSubjectId = v || ''; },
  onPick: () => {
    questionBankCurrentSetId = null;
    questionBankCurrentCategory = null;
    questionBankSelected.clear();
    loadQuestionBank();
  }
});

wireDownloadSelectMenu({
  menuId: 'qb-filter-kind-menu',
  btnId: 'qb-filter-kind-btn',
  panelId: 'qb-filter-kind-panel',
  options: [
    { value: '', label: 'All types' },
    { value: 'quizzes', label: 'Quiz' },
    { value: 'activity', label: 'Activity' },
    { value: 'exam', label: 'Exam' }
  ],
  getValue: () => qbFilterKind,
  setValue: (v) => { qbFilterKind = v || ''; },
  onPick: () => {
    questionBankCurrentSetId = null;
    questionBankCurrentCategory = null;
    questionBankSelected.clear();
    renderQuizBankSets();
  }
});

document.getElementById('qb-set-back')?.addEventListener('click', () => {
  if (questionBankCurrentCategory && !questionBankOpenedFromKind) {
    questionBankSelected.clear();
    renderQuizBankCategoryFolders();
    return;
  }
  questionBankCurrentSetId = null;
  questionBankCurrentSet = null;
  questionBankCurrentCategory = null;
  questionBankOpenedFromKind = false;
  questionBankSelected.clear();
  loadQuestionBank();
});

document.getElementById('lp-subject-back')?.addEventListener('click', () => {
  materialsCurrentSubjectKey = null;
  renderMaterialsHub();
});

document.getElementById('qb-select-all')?.addEventListener('click', () => toggleQuizBankSelectAll());

document.getElementById('qb-set-delete')?.addEventListener('click', async () => {
  if (!questionBankCurrentSetId) return;
  if (!confirm('Delete this entire Classwork set and its items?')) return;
  try {
    const res = await fetch(`${API_URL}/teacher/classwork/sets/${questionBankCurrentSetId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    questionBankCurrentSetId = null;
    questionBankCurrentSet = null;
    questionBankCurrentCategory = null;
    questionBankSelected.clear();
    showToast('Set removed.');
    loadQuestionBank();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('qb-edit-cancel')?.addEventListener('click', () => {
  const modal = document.getElementById('qb-edit-modal');
  if (modal) modal.hidden = true;
});

document.getElementById('qb-edit-type')?.addEventListener('change', () => {
  syncQuizBankChoicesVisibility();
  if ((document.getElementById('qb-edit-type')?.value || '') === 'activity') {
    const list = document.getElementById('qb-edit-rubric-list');
    if (list && !list.querySelector('.qb-rubric-category')) {
      renderRubricEditor(emptyRubricTemplateClient(Number(document.getElementById('qb-edit-points')?.value) || 20));
    }
  }
});

document.getElementById('qb-edit-rubric-add')?.addEventListener('click', () => {
  const current = collectRubricFromEditor() || { categories: [] };
  current.categories.push(emptyRubricCategory('', 5));
  renderRubricEditor(current);
});

document.getElementById('qb-edit-points')?.addEventListener('input', syncRubricSumWarning);
document.getElementById('qb-edit-points')?.addEventListener('change', syncRubricSumWarning);

document.getElementById('qb-edit-rubric-generate')?.addEventListener('click', async () => {
  const description = document.getElementById('qb-edit-question')?.value?.trim() || '';
  const totalPoints = Number(document.getElementById('qb-edit-points')?.value) || 20;
  const gradeLevel = Number(document.getElementById('qb-edit-grade')?.value) || questionBankCurrentSet?.grade_level;
  const btn = document.getElementById('qb-edit-rubric-generate');
  if (!description) {
    showToast('Enter a description first, then Generate Rubric.', 'error');
    return;
  }
  const existing = collectRubricFromEditor();
  const hasContent = existing?.categories?.some((c) =>
    c.name || (c.levels || []).some((lv) => lv.description)
  );
  if (hasContent && !confirm('Replace the current rubric with a generated one?')) return;

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating…';
  }
  try {
    const res = await fetch(`${API_URL}/teacher/ai/generate-rubric`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        total_points: totalPoints,
        grade_level: gradeLevel,
        subject_name: questionBankCurrentSet?.subject_name || null
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not generate rubric');
    renderRubricEditor(data.rubric);
    showToast(data.provider === 'mock' ? 'Rubric drafted (mock AI). Edit as needed.' : 'Rubric generated. Edit as needed.');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Generate Rubric';
    }
  }
});

document.getElementById('qb-add-question-btn')?.addEventListener('click', () => {
  openQuizBankAdd(questionBankCurrentCategory === 'activity' ? 'activity' : 'mcq');
});
document.getElementById('qb-add-question-btn-bulk')?.addEventListener('click', () => {
  openQuizBankAdd(questionBankCurrentCategory === 'activity' ? 'activity' : 'mcq');
});

document.getElementById('qb-edit-save')?.addEventListener('click', async () => {
  const id = document.getElementById('qb-edit-id')?.value;
  const question = document.getElementById('qb-edit-question')?.value?.trim();
  const choices = collectQbChoices();
  const points = document.getElementById('qb-edit-points')?.value;
  const grade_level = document.getElementById('qb-edit-grade')?.value;
  const item_type = document.getElementById('qb-edit-type')?.value || 'mcq';
  let answerRaw = document.getElementById('qb-edit-answer')?.value?.trim() || null;
  if (item_type === 'true_false') {
    answerRaw = document.getElementById('qb-edit-answer-tf')?.value || 'True';
  } else if (item_type === 'short_answer') {
    answerRaw = document.getElementById('qb-edit-answer-long')?.value?.trim() || null;
  }
  if (!question) {
    showToast(
      (document.getElementById('qb-edit-type')?.value || '') === 'activity'
        ? 'Enter a description.'
        : 'Enter a question.',
      'error'
    );
    return;
  }
  if (!grade_level) {
    showToast('Select an assigned grade.', 'error');
    return;
  }
  if (item_type === 'mcq' && choices.length < 2) {
    showToast('Multiple choice needs at least 2 choices.', 'error');
    return;
  }
  if (item_type === 'fill_blank' && (choices.length < 2 || !answerRaw || !/_{3,}/.test(question))) {
    showToast('Fill in the blank needs _____ in the question, a word bank, and the correct word.', 'error');
    return;
  }
  if (item_type === 'matching' && choices.filter((c) => c.includes('|')).length < 3) {
    showToast('Matching needs at least 3 pairs written as left | right.', 'error');
    return;
  }
  if (item_type === 'matching') {
    const seenRights = new Set();
    const repeated = choices.some((c) => {
      if (!String(c).includes('|')) return false;
      const right = String(c).split('|').slice(1).join('|').trim().toLowerCase();
      if (!right) return false;
      if (seenRights.has(right)) return true;
      seenRights.add(right);
      return false;
    });
    if (repeated) {
      showToast('Each matching answer can be used only once.', 'error');
      return;
    }
  }
  if (item_type === 'sequencing' && choices.length < 3) {
    showToast('Sequencing needs at least 3 steps.', 'error');
    return;
  }
  if (item_type === 'short_answer' && !answerRaw) {
    showToast('Enter a model answer for this short answer.', 'error');
    return;
  }
  if (item_type === 'identification' && !answerRaw) {
    showToast('Enter the correct answer for this identification item.', 'error');
    return;
  }
  let answer = answerRaw;
  let choicePayload = null;
  if (item_type === 'mcq') {
    choicePayload = choices;
    answer = formatMcqAnswerDisplay(answerRaw, choices) || answerRaw;
  } else if (item_type === 'true_false') {
    choicePayload = ['True', 'False'];
    answer = /false/i.test(String(answerRaw || '')) ? 'False' : 'True';
  } else if (item_type === 'fill_blank') {
    choicePayload = choices;
  } else if (item_type === 'matching') {
    choicePayload = choices.filter((c) => c.includes('|'));
    answer = choicePayload.join('; ');
  } else if (item_type === 'sequencing') {
    choicePayload = choices;
    answer = choicePayload.join(' | ');
  } else if (item_type === 'identification') {
    const key = String(answerRaw || '').trim().toLowerCase();
    choicePayload = choices.filter((c) => c.trim().toLowerCase() !== key);
    if (!choicePayload.length) choicePayload = null;
  }

  const payload = {
    question,
    choices: choicePayload,
    answer: item_type === 'activity' ? null : answer,
    points,
    grade_level: Number(grade_level),
    item_type,
    subject_id: questionBankCurrentSet?.subject_id || null,
    quiz_set_id: questionBankCurrentSetId || null,
    lesson_title: questionBankCurrentSet?.title || null,
    rubric: item_type === 'activity' ? collectRubricFromEditor() : null,
    folder: (examWriteMode || questionBankCurrentCategory === 'exam') ? 'exam' : 'quiz'
  };

  if (item_type === 'activity' && !payload.rubric) {
    showToast('Add at least one rubric category with a name.', 'error');
    return;
  }

  if (examWriteMode && !id) {
    examWriteQuestions.push({
      ...payload,
      subject_id: examWriteSubjectId || payload.subject_id,
      folder: 'exam'
    });
    renderExamWriteList();
    showToast('Question added. Type the next one, or close this form to create the exam.');
    openQuizBankAdd('mcq');
    return;
  }

  try {
    const isNew = !id;
    const res = await fetch(
      isNew ? `${API_URL}/teacher/classwork` : `${API_URL}/teacher/classwork/${id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('qb-edit-modal').hidden = true;
    showToast(
      isActivityItemType(item_type)
        ? (isNew ? 'Activity added.' : 'Activity updated.')
        : (isNew ? 'Quiz question added.' : 'Quiz question updated.')
    );
    if (questionBankCurrentSetId) {
      const keepCat = questionBankCurrentCategory
        || (item_type === 'activity' ? 'activity' : 'quizzes');
      await openQuizBankSet(questionBankCurrentSetId, { keepCategory: keepCat });
    } else loadQuestionBank();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function openCreateProgressFromBank() {
  const modal = document.getElementById('qb-create-modal');
  if (!modal || !questionBankSelected.size) return;

  await ensureTeacherAssignedClasses();

  const selectedItems = questionBankItems.filter((i) => questionBankSelected.has(i.id));
  const gradesInSelection = [...new Set(selectedItems.map((i) => Number(i.grade_level)))];
  if (gradesInSelection.length > 1) {
    showToast(`Select items from one grade only, then create ${classworkCreateKindPhrase()}.`, 'error');
    return;
  }
  const targetGrade = gradesInSelection[0];

  const classSel = document.getElementById('qb-create-class');
  const pairs = getTeacherAssignedClassPairs().filter((p) =>
    targetGrade ? Number(p.grade_level) === Number(targetGrade) : true
  );
  if (classSel) {
    classSel.innerHTML = pairs.length
      ? '<option value="">-- Select your class --</option>' +
        pairs.map((p) =>
          `<option value="${p.grade_level}|${escapeHtml(p.section)}">Grade ${p.grade_level} – ${escapeHtml(p.section)}</option>`
        ).join('')
      : '<option value="">No assigned class for this grade</option>';
    if (teacherCurrentClass && pairs.some((p) =>
      Number(p.grade_level) === Number(teacherCurrentClass.grade) &&
      String(p.section).toUpperCase() === String(teacherCurrentClass.section).toUpperCase()
    )) {
      classSel.value = `${teacherCurrentClass.grade}|${teacherCurrentClass.section}`;
    }
  }

  const countEl = document.getElementById('qb-create-count');
  if (countEl) {
    countEl.textContent = `${questionBankSelected.size} item(s) selected · Grade ${targetGrade || '?'}`;
  }

  renderScoreSections('qb-create-sections', selectedItems, { syncMaxInputId: 'qb-create-max', resetValues: true });

  const titleEl = document.getElementById('qb-create-title');
  if (titleEl) {
    const set = questionBankCurrentSet || questionBankSets.find((s) => s.id === questionBankCurrentSetId);
    const lesson = selectedItems.find((i) => i.lesson_title)?.lesson_title;
    if (questionBankCurrentCategory === 'activity') {
      titleEl.value = lesson ? `Activity — ${lesson}` : (set?.title ? `Activity — ${set.title}` : 'Activity from Classwork');
    } else if (questionBankCurrentCategory === 'exam') {
      titleEl.value = set?.title ? `Exam — ${set.title}` : (lesson ? `Exam — ${lesson}` : 'Exam from Classwork');
    } else {
      titleEl.value = (set && set.title) || (lesson ? `Quiz — ${lesson}` : 'Quiz from Classwork');
    }
  }

  const typeSel = document.getElementById('qb-create-type');
  if (typeSel) {
    typeSel.value = questionBankCurrentCategory === 'activity'
      ? 'activity'
      : questionBankCurrentCategory === 'exam'
        ? 'exam'
        : 'quiz';
  }
  document.querySelectorAll('input[name="qb-create-activity-mode"]').forEach((input) => {
    input.checked = false;
  });
  const targetInput = document.getElementById('qb-create-target');
  if (targetInput) targetInput.value = '';
  syncClassworkCreateModalLabels();
  const rubricCap = rubricCapFromBankItems(selectedItems);
  if ((typeSel?.value === 'activity' || questionBankCurrentCategory === 'activity') && rubricCap > 0) {
    const maxInput = document.getElementById('qb-create-max');
    if (maxInput) maxInput.value = String(rubricCap);
  }

  const qtrSel = document.getElementById('qb-create-quarter');
  fillUnlockedQuarterSelect(qtrSel, teacherCurrentQuarter);

  modal.hidden = false;
}

document.getElementById('qb-create-progress-btn')?.addEventListener('click', () => openCreateProgressFromBank());
document.getElementById('qb-create-progress-next')?.addEventListener('click', () => openCreateProgressFromBank());

async function openAddQuizModal() {
  const modal = document.getElementById('qb-add-quiz-modal');
  if (!modal) return;
  await ensureTeacherAssignedClasses();
  await loadTeacherSubjects(true);

  const gradeSel = document.getElementById('qb-add-grade');
  const grades = getTeacherAssignedGrades();
  if (gradeSel) {
    gradeSel.innerHTML = grades.length
      ? '<option value="">Select grade</option>' + grades.map((g) => `<option value="${g}">Grade ${g}</option>`).join('')
      : '<option value="">No assigned grades</option>';
    if (teacherCurrentClass?.grade && grades.includes(Number(teacherCurrentClass.grade))) {
      gradeSel.value = String(teacherCurrentClass.grade);
    } else if (grades[0]) {
      gradeSel.value = String(grades[0]);
    }
  }
  fillAddQuizSubjectOptions();
  const titleInput = document.getElementById('qb-add-title');
  if (titleInput) titleInput.value = '';
  const kindSel = document.getElementById('qb-add-kind');
  if (kindSel) kindSel.value = 'quizzes';
  titleInput?.setAttribute('placeholder', 'e.g., Fractions Week 2');
  syncAddClassworkKindFields();
  modal.hidden = false;
}

function syncAddClassworkKindFields() {
  const exam = document.getElementById('qb-add-kind')?.value === 'exam';
  const details = document.getElementById('qb-add-details');
  const submit = document.getElementById('qb-add-submit');
  if (details) {
    details.hidden = exam;
    if (exam) details.setAttribute('hidden', '');
    else details.removeAttribute('hidden');
  }
  document.getElementById('qb-add-title')?.toggleAttribute('required', !exam);
  document.getElementById('qb-add-grade')?.toggleAttribute('required', !exam);
  document.getElementById('qb-add-subject')?.toggleAttribute('required', !exam);
  if (submit) submit.textContent = exam ? 'Continue' : 'Create';
}

document.getElementById('qb-add-kind')?.addEventListener('change', () => syncAddClassworkKindFields());

document.getElementById('qb-add-quiz-btn')?.addEventListener('click', () => openAddQuizModal());

/** Selected Classwork set ids / Material (lesson plan) ids in the Create Exam modal */
let examComposerSelectedSets = new Set();
let examComposerSelectedMaterials = new Set();
let examComposerSetsCache = [];
let examComposerMaterialsCache = [];
let examComposerItemsCache = [];
let examComposerSource = 'classwork';

function parseExamClassValue(val) {
  const [gradePart, ...sectionParts] = String(val || '').split('|');
  return {
    grade_level: Number(gradePart) || 0,
    section: sectionParts.join('|').trim()
  };
}

function setExamComposerSource(source) {
  examComposerSource = source === 'materials' ? 'materials' : 'classwork';
  document.querySelectorAll('#qb-exam-source-tabs [data-exam-source]').forEach((btn) => {
    btn.classList.toggle('primary', btn.dataset.examSource === examComposerSource);
  });
  const cw = document.getElementById('qb-exam-source-classwork');
  const mat = document.getElementById('qb-exam-source-materials');
  if (cw) cw.hidden = examComposerSource !== 'classwork';
  if (mat) mat.hidden = examComposerSource !== 'materials';
}

function fillExamSubjectOptions(grade) {
  const subjectSel = document.getElementById('qb-exam-subject');
  if (!subjectSel) return;
  const prev = subjectSel.value;
  const subjects = getAssignedSubjectsForGrade(grade);
  subjectSel.innerHTML =
    '<option value="">All subjects</option>' +
    subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  if (prev && [...subjectSel.options].some((o) => o.value === prev)) {
    subjectSel.value = prev;
  } else if (
    teacherCurrentClass?.subjectId &&
    String(teacherCurrentClass.grade) === String(grade) &&
    [...subjectSel.options].some((o) => o.value === String(teacherCurrentClass.subjectId))
  ) {
    subjectSel.value = String(teacherCurrentClass.subjectId);
  }
}

async function loadExamComposerSets() {
  const listEl = document.getElementById('qb-exam-sets-list');
  const emptyEl = document.getElementById('qb-exam-sets-empty');
  if (!listEl) return;

  const { grade_level } = parseExamClassValue(document.getElementById('qb-exam-class')?.value);
  const subjectId = document.getElementById('qb-exam-subject')?.value || '';

  if (!grade_level) {
    examComposerSetsCache = [];
    examComposerSelectedSets.clear();
    listEl.innerHTML = '';
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = 'Select a class to load Classwork sets.';
    }
    await refreshExamComposerItems();
    return;
  }

  const params = new URLSearchParams({ grade: String(grade_level) });
  if (subjectId) params.set('subject_id', subjectId);

  try {
    const res = await fetch(`${API_URL}/teacher/classwork/sets?${params}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load sets');
    examComposerSetsCache = Array.isArray(data) ? data.filter((s) => Number(s.item_count) > 0) : [];
    const valid = new Set(examComposerSetsCache.map((s) => s.id));
    [...examComposerSelectedSets].forEach((id) => {
      if (!valid.has(id)) examComposerSelectedSets.delete(id);
    });

    if (!examComposerSetsCache.length) {
      listEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'No Classwork sets with items for this class/subject yet. Upload materials, generate AI drafts, or add Classwork first.';
      }
    } else {
      if (emptyEl) emptyEl.hidden = true;
      listEl.innerHTML = examComposerSetsCache.map((s) => {
        const checked = examComposerSelectedSets.has(s.id) ? 'checked' : '';
        const subj = s.subject_name ? escapeHtml(s.subject_name) : 'No subject';
        const count = Number(s.item_count) || 0;
        const name = escapeHtml(s.title || 'Untitled set');
        return `
          <label class="qb-exam-set-row">
            <input type="checkbox" data-exam-set-id="${s.id}" ${checked} />
            <span>${name} · ${subj} · ${count} item(s)</span>
          </label>`;
      }).join('');
      listEl.querySelectorAll('input[data-exam-set-id]').forEach((input) => {
        input.addEventListener('change', () => {
          const id = Number(input.dataset.examSetId);
          if (input.checked) examComposerSelectedSets.add(id);
          else examComposerSelectedSets.delete(id);
          refreshExamComposerItems();
        });
      });
    }
    await refreshExamComposerItems();
  } catch (err) {
    listEl.innerHTML = '';
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = err.message || 'Failed to load Classwork sets.';
    }
    updateExamComposerPreview();
  }
}

async function loadExamComposerMaterials() {
  const listEl = document.getElementById('qb-exam-materials-list');
  const emptyEl = document.getElementById('qb-exam-materials-empty');
  if (!listEl) return;

  const { grade_level } = parseExamClassValue(document.getElementById('qb-exam-class')?.value);
  const subjectId = document.getElementById('qb-exam-subject')?.value || '';

  if (!grade_level) {
    examComposerMaterialsCache = [];
    examComposerSelectedMaterials.clear();
    listEl.innerHTML = '';
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = 'Select a class to load Materials.';
    }
    await refreshExamComposerItems();
    return;
  }

  try {
    const params = new URLSearchParams({ grade: String(grade_level) });
    if (subjectId) params.set('subject_id', subjectId);
    const [plansRes, setsRes] = await Promise.all([
      fetch(`${API_URL}/teacher/lesson-plans`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/teacher/classwork/sets?${params}`, { headers: getAuthHeaders() })
    ]);
    const plansData = await plansRes.json();
    const setsData = await setsRes.json();
    if (!plansRes.ok) throw new Error(plansData.error || 'Failed to load materials');
    if (!setsRes.ok) throw new Error(setsData.error || 'Failed to load Classwork sets');

    const sets = Array.isArray(setsData) ? setsData : [];
    const countByLesson = new Map();
    sets.forEach((s) => {
      const lp = Number(s.lesson_plan_id);
      if (!lp) return;
      const prev = countByLesson.get(lp) || { item_count: 0, set_ids: [] };
      prev.item_count += Number(s.item_count) || 0;
      prev.set_ids.push(s.id);
      countByLesson.set(lp, prev);
    });

    const plans = Array.isArray(plansData) ? plansData : [];
    examComposerMaterialsCache = plans
      .filter((p) => Number(p.grade_level) === Number(grade_level))
      .filter((p) => !subjectId || String(p.subject_id) === String(subjectId))
      .map((p) => {
        const meta = countByLesson.get(Number(p.id)) || { item_count: 0, set_ids: [] };
        return {
          id: Number(p.id),
          title: p.title || 'Untitled material',
          subject_name: p.subject_name || '',
          item_count: meta.item_count,
          set_ids: meta.set_ids
        };
      })
      .filter((p) => p.item_count > 0);

    const valid = new Set(examComposerMaterialsCache.map((m) => m.id));
    [...examComposerSelectedMaterials].forEach((id) => {
      if (!valid.has(id)) examComposerSelectedMaterials.delete(id);
    });

    if (!examComposerMaterialsCache.length) {
      listEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'No materials with Classwork items for this class/subject yet. Upload a material, generate drafts, and save to Classwork first.';
      }
    } else {
      if (emptyEl) emptyEl.hidden = true;
      listEl.innerHTML = examComposerMaterialsCache.map((m) => {
        const checked = examComposerSelectedMaterials.has(m.id) ? 'checked' : '';
        const subj = m.subject_name ? escapeHtml(m.subject_name) : 'No subject';
        const name = escapeHtml(m.title);
        return `
          <label class="qb-exam-set-row">
            <input type="checkbox" data-exam-material-id="${m.id}" ${checked} />
            <span>${name} · ${subj} · ${m.item_count} item(s)</span>
          </label>`;
      }).join('');
      listEl.querySelectorAll('input[data-exam-material-id]').forEach((input) => {
        input.addEventListener('change', () => {
          const id = Number(input.dataset.examMaterialId);
          if (input.checked) examComposerSelectedMaterials.add(id);
          else examComposerSelectedMaterials.delete(id);
          refreshExamComposerItems();
        });
      });
    }
    await refreshExamComposerItems();
  } catch (err) {
    listEl.innerHTML = '';
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = err.message || 'Failed to load materials.';
    }
    updateExamComposerPreview();
  }
}

async function refreshExamComposerItems() {
  examComposerItemsCache = [];
  const setIds = new Set([...examComposerSelectedSets]);
  examComposerMaterialsCache.forEach((m) => {
    if (!examComposerSelectedMaterials.has(m.id)) return;
    (m.set_ids || []).forEach((sid) => setIds.add(sid));
  });
  const ids = [...setIds];
  if (!ids.length) {
    updateExamComposerPreview();
    return;
  }

  try {
    const results = await Promise.all(
      ids.map(async (setId) => {
        const res = await fetch(`${API_URL}/teacher/classwork/sets/${setId}`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load set items');
        return Array.isArray(data.items) ? data.items : [];
      })
    );
    const seen = new Set();
    examComposerItemsCache = [];
    results.flat().forEach((item) => {
      if (!item?.id || seen.has(item.id)) return;
      seen.add(item.id);
      examComposerItemsCache.push(item);
    });
  } catch (err) {
    showToast(err.message || 'Could not load exam items.', 'error');
    examComposerItemsCache = [];
  }
  updateExamComposerPreview();
}

function getExamComposerFilteredItems() {
  // Activities live under Classwork; only include when a Classwork set is selected + checkbox on.
  const includeActivity = !!document.getElementById('qb-exam-include-activity')?.checked
    && examComposerSelectedSets.size > 0;
  return examComposerItemsCache.filter((it) => {
    if (isActivityItemType(it.item_type)) return includeActivity;
    return true;
  });
}

function updateExamComposerPreview() {
  const preview = document.getElementById('qb-exam-preview');
  const confirmBtn = document.getElementById('qb-exam-confirm');
  const maxWrap = document.getElementById('qb-exam-max-wrap');
  const items = getExamComposerFilteredItems();
  const quizCount = items.filter((i) => !isActivityItemType(i.item_type)).length;
  const activityCount = items.filter((i) => isActivityItemType(i.item_type)).length;
  const hasSource = examComposerSelectedSets.size > 0 || examComposerSelectedMaterials.size > 0;

  if (items.length) {
    renderScoreSections('qb-exam-sections', items, { syncMaxInputId: 'qb-exam-max', resetValues: true });
    if (maxWrap) maxWrap.hidden = false;
  } else {
    const sec = document.getElementById('qb-exam-sections');
    if (sec) {
      sec.hidden = true;
      sec.innerHTML = '';
    }
    if (maxWrap) maxWrap.hidden = true;
  }

  const maxVal = Number(document.getElementById('qb-exam-max')?.value) || 0;

  if (preview) {
    if (!hasSource) {
      preview.textContent = 'Select a classwork set or material.';
    } else if (!items.length) {
      preview.textContent = examComposerSelectedSets.size
        ? 'Selected sources have no matching items (try including Activities).'
        : 'Selected sources have no matching quiz items.';
    } else {
      const parts = [`${items.length} item(s)`];
      if (quizCount) parts.push(`${quizCount} quiz`);
      if (activityCount) parts.push(`${activityCount} activities`);
      if (maxVal) parts.push(`Total ${maxVal}`);
      preview.textContent = `${parts.join(' · ')} — set part totals above; editable later in Records.`;
    }
  }
  if (confirmBtn) confirmBtn.disabled = items.length === 0;
}

function hideOverlay(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('hidden', '');
}

function showOverlay(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = false;
  modal.removeAttribute('hidden');
}

function fillExamClassSelect(selectEl, gradeLimit) {
  if (!selectEl) return;
  const pairs = getTeacherAssignedClassPairs().filter((p) =>
    gradeLimit ? Number(p.grade_level) === Number(gradeLimit) : true
  );
  selectEl.innerHTML = pairs.length
    ? pairs.map((p) =>
      `<option value="${p.grade_level}|${escapeHtml(p.section)}">Grade ${p.grade_level} – ${escapeHtml(p.section)}</option>`
    ).join('')
    : '<option value="">No assigned class</option>';
  if (teacherCurrentClass && pairs.some((p) =>
    Number(p.grade_level) === Number(teacherCurrentClass.grade) &&
    String(p.section).toUpperCase() === String(teacherCurrentClass.section).toUpperCase()
  )) {
    selectEl.value = `${teacherCurrentClass.grade}|${teacherCurrentClass.section}`;
  }
}

function renderExamWriteList() {
  const list = document.getElementById('qb-exam-write-list');
  const count = document.getElementById('qb-exam-write-count');
  const createBtn = document.getElementById('qb-exam-write-create');
  const n = examWriteQuestions.length;
  if (count) count.textContent = n ? `${n} question${n === 1 ? '' : 's'} added.` : 'No questions yet.';
  if (createBtn) createBtn.disabled = n === 0;
  if (!list) return;
  list.innerHTML = examWriteQuestions.map((item, i) => {
    const label = bankItemTypeLabel(item.item_type);
    const text = String(item.question || '').trim();
    return `<li><strong>${i + 1}. ${escapeHtml(label)}</strong> ${escapeHtml(text)}</li>`;
  }).join('');
}

function openExamChoiceModal() {
  showOverlay('qb-exam-choice-modal');
}

async function openExamWriteModal() {
  hideOverlay('qb-exam-choice-modal');
  examWriteMode = true;
  examWriteQuestions = [];
  renderExamWriteList();
  showOverlay('qb-exam-write-modal');
  await ensureTeacherAssignedClasses();
  await loadTeacherSubjects(true);
  fillExamClassSelect(document.getElementById('qb-exam-write-class'));
  fillUnlockedQuarterSelect(
    document.getElementById('qb-exam-write-quarter'),
    teacherCurrentQuarter || CURRENT_QUARTER
  );
  const titleEl = document.getElementById('qb-exam-write-title');
  if (titleEl) titleEl.value = '';
  syncExamWriteSubject();
  renderExamWriteList();
}

function syncExamWriteSubject() {
  const classVal = document.getElementById('qb-exam-write-class')?.value || '';
  const grade = Number(String(classVal).split('|')[0]);
  const subjectSel = document.getElementById('qb-exam-write-subject');
  if (!subjectSel) return;
  const subjects = getAssignedSubjectsForGrade(grade);
  subjectSel.innerHTML = subjectSelectOptionsHtml(subjects, {
    emptyLabel: subjects.length ? '-- Select Subject --' : 'No assigned subject for this grade'
  });
  if (teacherCurrentClass?.subjectId &&
    String(teacherCurrentClass.grade) === String(grade) &&
    [...subjectSel.options].some((o) => o.value === String(teacherCurrentClass.subjectId))) {
    subjectSel.value = String(teacherCurrentClass.subjectId);
  }
}

function openExamQuestionForm() {
  const title = document.getElementById('qb-exam-write-title')?.value?.trim();
  const classVal = document.getElementById('qb-exam-write-class')?.value || '';
  const subjectId = document.getElementById('qb-exam-write-subject')?.value;
  const { grade_level } = parseExamClassValue(classVal);
  if (!title) {
    showToast('Enter an exam title first.', 'error');
    return;
  }
  if (!grade_level) {
    showToast('Select a class first.', 'error');
    return;
  }
  if (!subjectId) {
    showToast('Select a subject first.', 'error');
    return;
  }
  examWriteMode = true;
  examWriteGrade = grade_level;
  examWriteSubjectId = Number(subjectId);
  openQuizBankAdd('mcq');
}

async function createTypedExam() {
  const title = document.getElementById('qb-exam-write-title')?.value?.trim();
  const classVal = document.getElementById('qb-exam-write-class')?.value || '';
  const subjectId = document.getElementById('qb-exam-write-subject')?.value;
  const quarter = document.getElementById('qb-exam-write-quarter')?.value;
  const { grade_level, section } = parseExamClassValue(classVal);
  if (!title) {
    showToast('Enter an exam title.', 'error');
    return;
  }
  if (!grade_level || !section) {
    showToast('Select a class.', 'error');
    return;
  }
  if (!subjectId) {
    showToast('Select a subject.', 'error');
    return;
  }
  if (!examWriteQuestions.length) {
    showToast('Add at least one question.', 'error');
    return;
  }
  const btn = document.getElementById('qb-exam-write-create');
  if (btn) btn.disabled = true;
  try {
    const setRes = await fetch(`${API_URL}/teacher/classwork/sets`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        grade_level,
        subject_id: Number(subjectId),
        kind: 'exam'
      })
    });
    const setData = await setRes.json();
    if (!setRes.ok) throw new Error(setData.error || 'Could not start the exam.');
    const ids = [];
    for (const item of examWriteQuestions) {
      const itemRes = await fetch(`${API_URL}/teacher/classwork`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          grade_level,
          subject_id: Number(subjectId),
          quiz_set_id: setData.id,
          lesson_title: title
        })
      });
      const itemData = await itemRes.json();
      if (!itemRes.ok) throw new Error(itemData.error || 'Could not save a question.');
      ids.push(itemData.id);
    }
    const examRes = await fetch(`${API_URL}/teacher/assessments/from-bank`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        type: 'exam',
        grade_level,
        section,
        subject_id: Number(subjectId),
        quarter,
        question_ids: ids
      })
    });
    const examData = await examRes.json();
    if (!examRes.ok) throw new Error(examData.error || 'Could not create the exam.');
    examWriteMode = false;
    examWriteQuestions = [];
    hideOverlay('qb-exam-write-modal');
    showToast(examData.message || 'Exam created.');
    applyTeacherPanel('progress');
    if (examData.id) setTimeout(() => openProgressEditor(examData.id, 'edit'), 200);
  } catch (err) {
    showToast(err.message || 'Could not create the exam.', 'error');
    if (btn) btn.disabled = examWriteQuestions.length === 0;
  }
}

async function openExamAiModal() {
  hideOverlay('qb-exam-choice-modal');
  examAiSource = 'lessons';
  examAiLessonIds = [];
  const list = document.getElementById('qb-exam-ai-lesson-list');
  const empty = document.getElementById('qb-exam-ai-lesson-empty');
  if (list) list.innerHTML = '<p class="page-subheading">Loading lessons…</p>';
  if (empty) empty.hidden = true;
  const fileInput = document.getElementById('qb-exam-ai-files');
  if (fileInput) fileInput.value = '';
  setExamAiSource('lessons');
  showOverlay('qb-exam-ai-modal');
  try {
    await Promise.all([
      loadLessonPlans(),
      ensureTeacherAssignedClasses(),
      loadTeacherSubjects(true)
    ]);
  } catch {
    materialsPlansCache = materialsPlansCache || [];
  }
  renderExamAiLessonList();
  fillExamAiGradeOptions();
  syncExamAiContinue();
}

function setExamAiSource(source) {
  examAiSource = source === 'files' ? 'files' : 'lessons';
  const lessonsPanel = document.getElementById('qb-exam-ai-lessons-panel');
  const filesPanel = document.getElementById('qb-exam-ai-files-panel');
  const lessonsBtn = document.getElementById('qb-exam-ai-mode-lessons');
  const filesBtn = document.getElementById('qb-exam-ai-mode-files');
  if (lessonsPanel) {
    lessonsPanel.hidden = examAiSource !== 'lessons';
    if (examAiSource === 'lessons') lessonsPanel.removeAttribute('hidden');
    else lessonsPanel.setAttribute('hidden', '');
  }
  if (filesPanel) {
    filesPanel.hidden = examAiSource !== 'files';
    if (examAiSource === 'files') filesPanel.removeAttribute('hidden');
    else filesPanel.setAttribute('hidden', '');
  }
  if (lessonsBtn) {
    lessonsBtn.classList.toggle('btn-solid', examAiSource === 'lessons');
    lessonsBtn.classList.toggle('btn-outline', examAiSource !== 'lessons');
  }
  if (filesBtn) {
    filesBtn.classList.toggle('btn-solid', examAiSource === 'files');
    filesBtn.classList.toggle('btn-outline', examAiSource !== 'files');
  }
  syncExamAiContinue();
}

function examAiLessonSubjectKey(plan) {
  return plan?.subject_id ? String(plan.subject_id) : 'none';
}

function examAiLessonSubjects(plans) {
  const groups = new Map();
  plans.forEach((plan) => {
    const key = examAiLessonSubjectKey(plan);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: key === 'none' ? 'No subject' : (plan.subject_name || 'Subject')
      });
    }
  });
  return [...groups.values()].sort((a, b) => {
    if (a.key === 'none') return 1;
    if (b.key === 'none') return -1;
    return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });
  });
}

function setExamAiLessonEmpty(message, show) {
  const empty = document.getElementById('qb-exam-ai-lesson-empty');
  if (!empty) return;
  empty.textContent = message;
  empty.hidden = !show;
  if (show) empty.removeAttribute('hidden');
  else empty.setAttribute('hidden', '');
}

function renderExamAiLessonList() {
  const list = document.getElementById('qb-exam-ai-lesson-list');
  const subjectSel = document.getElementById('qb-exam-ai-lesson-subject');
  const plans = Array.isArray(materialsPlansCache) ? materialsPlansCache : [];
  const subjects = examAiLessonSubjects(plans);
  if (subjectSel) {
    const current = subjectSel.value;
    subjectSel.innerHTML = `<option value="">-- Select Subject --</option>${subjects.map((subject) =>
      `<option value="${escapeHtml(subject.key)}">${escapeHtml(subject.name)}</option>`
    ).join('')}`;
    subjectSel.value = current && [...subjectSel.options].some((option) => option.value === current) ? current : '';
  }
  const key = subjectSel?.value || '';
  if (!list) return;
  if (!key) {
    list.innerHTML = '';
    list.hidden = true;
    list.setAttribute('hidden', '');
    setExamAiLessonEmpty('No lesson files yet. Upload files instead, or add one in Materials.', plans.length === 0);
    syncExamAiContinue();
    return;
  }
  const matched = plans.filter((plan) => examAiLessonSubjectKey(plan) === key);
  if (!matched.length) {
    list.innerHTML = '';
    list.hidden = true;
    list.setAttribute('hidden', '');
    setExamAiLessonEmpty('No materials for this subject.', true);
    syncExamAiContinue();
    return;
  }
  setExamAiLessonEmpty('', false);
  list.hidden = false;
  list.removeAttribute('hidden');
  list.innerHTML = matched.map((plan) => `
    <label class="qb-exam-ai-lesson-row">
      <input type="checkbox" name="qb-exam-ai-lesson" value="${plan.id}" />
      <span>${escapeHtml(plan.title || 'Lesson')} · Grade ${escapeHtml(String(plan.grade_level || ''))}</span>
    </label>
  `).join('');
  list.querySelectorAll('input').forEach((input) => {
    input.addEventListener('change', syncExamAiContinue);
  });
  syncExamAiContinue();
}

function fillExamAiGradeOptions() {
  const gradeSel = document.getElementById('qb-exam-ai-grade');
  if (!gradeSel) return;
  const grades = getTeacherAssignedGrades();
  gradeSel.innerHTML = grades.length
    ? grades.map((grade) => `<option value="${grade}">Grade ${grade}</option>`).join('')
    : '<option value="">No assigned grades</option>';
  if (teacherCurrentClass?.grade && grades.includes(Number(teacherCurrentClass.grade))) {
    gradeSel.value = String(teacherCurrentClass.grade);
  }
  fillExamAiSubjectOptions();
}

function fillExamAiSubjectOptions() {
  const subjectSel = document.getElementById('qb-exam-ai-subject');
  if (!subjectSel) return;
  const grade = document.getElementById('qb-exam-ai-grade')?.value;
  const subjects = getAssignedSubjectsForGrade(grade);
  subjectSel.innerHTML = subjectSelectOptionsHtml(subjects, {
    emptyLabel: subjects.length ? '-- Select Subject --' : 'No assigned subject for this grade'
  });
  if (teacherCurrentClass?.subjectId &&
    String(teacherCurrentClass.grade) === String(grade) &&
    [...subjectSel.options].some((option) => option.value === String(teacherCurrentClass.subjectId))) {
    subjectSel.value = String(teacherCurrentClass.subjectId);
  }
}

function selectedExamAiLessons() {
  return [...document.querySelectorAll('input[name="qb-exam-ai-lesson"]:checked')]
    .map((input) => (materialsPlansCache || []).find((plan) => Number(plan.id) === Number(input.value)))
    .filter(Boolean);
}

function syncExamAiContinue() {
  const btn = document.getElementById('qb-exam-ai-go');
  if (!btn) return;
  if (examAiSource === 'files') {
    const files = document.getElementById('qb-exam-ai-files')?.files;
    btn.disabled = !files || files.length === 0;
    return;
  }
  btn.disabled = selectedExamAiLessons().length === 0;
}

function openExamGenerateOptions(plan, lessonIds) {
  examAiPlan = plan;
  examAiLessonIds = lessonIds;
  examAiIntent = true;
  hideOverlay('qb-exam-ai-modal');
  openAiGenerateOptionsModal({ mode: 'generate', lessonPlanId: lessonIds[0] });
  const titleEl = document.getElementById('ai-generate-modal-title');
  if (titleEl) titleEl.textContent = 'Generate exam';
  const goBtn = document.getElementById('ai-generate-count-go');
  if (goBtn) goBtn.textContent = 'Generate exam';
}

async function uploadExamSourceFiles() {
  const grade = document.getElementById('qb-exam-ai-grade')?.value;
  const subjectId = document.getElementById('qb-exam-ai-subject')?.value;
  const files = [...(document.getElementById('qb-exam-ai-files')?.files || [])];
  if (!grade) throw new Error('Select a grade.');
  if (!subjectId) throw new Error('Select a subject.');
  if (!files.length) throw new Error('Choose at least one file.');
  const created = [];
  for (const file of files) {
    const title = String(file.name || 'Lesson').replace(/\.[^.]+$/, '').trim().slice(0, 255) || 'Lesson';
    const body = new FormData();
    body.append('file', file);
    body.append('title', title);
    body.append('grade_level', grade);
    body.append('subject_id', subjectId);
    const headers = {};
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/teacher/lesson-plans`, { method: 'POST', headers, body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Could not upload ${file.name}.`);
    created.push({
      id: data.id,
      title,
      grade_level: Number(grade),
      subject_id: Number(subjectId)
    });
  }
  return created;
}

async function continueExamAiGenerate() {
  const btn = document.getElementById('qb-exam-ai-go');
  if (examAiSource === 'files') {
    if (btn) btn.disabled = true;
    try {
      const created = await uploadExamSourceFiles();
      const subjectName = document.getElementById('qb-exam-ai-subject')?.selectedOptions?.[0]?.textContent?.trim() || '';
      openExamGenerateOptions({
        title: created.map((plan) => plan.title).join(', '),
        grade_level: created[0].grade_level,
        subject_id: created[0].subject_id,
        subject_name: subjectName
      }, created.map((plan) => plan.id));
    } catch (err) {
      showToast(err.message || 'Could not upload the files.', 'error');
      if (btn) btn.disabled = false;
    }
    return;
  }
  const plans = selectedExamAiLessons();
  if (!plans.length) {
    showToast('Choose at least one lesson.', 'error');
    return;
  }
  const grades = new Set(plans.map((plan) => Number(plan.grade_level)));
  if (grades.size > 1) {
    showToast('Choose lessons from the same grade.', 'error');
    return;
  }
  const subjects = new Set(plans.map((plan) => Number(plan.subject_id) || 0));
  if (subjects.size > 1) {
    showToast('Choose materials from the same subject.', 'error');
    return;
  }
  const title = plans.map((plan) => plan.title).filter(Boolean).join(', ');
  openExamGenerateOptions({
    title,
    grade_level: plans[0].grade_level,
    subject_id: plans[0].subject_id,
    subject_name: plans[0].subject_name || ''
  }, plans.map((plan) => plan.id));
}

function openExamAiSaveModal() {
  const plan = examAiPlan || {};
  const titleEl = document.getElementById('qb-exam-ai-save-title');
  if (titleEl) titleEl.value = plan.title ? `Exam — ${plan.title}` : 'Exam';
  const note = document.getElementById('qb-exam-ai-save-note');
  if (note) {
    const subjectBit = plan.subject_name ? ` Subject: ${plan.subject_name}.` : '';
    note.textContent = plan.title
      ? `The draft for “${plan.title}” is ready.${subjectBit} Save it in Classwork so you can check and edit the questions.`
      : `The draft is ready.${subjectBit} Save it in Classwork so you can check and edit the questions.`;
  }
  showOverlay('qb-exam-ai-save-modal');
}

async function saveGeneratedExam() {
  const title = document.getElementById('qb-exam-ai-save-title')?.value?.trim();
  if (!examAiDraftId) {
    showToast('Generate a draft first.', 'error');
    return;
  }
  if (!title) {
    showToast('Enter an exam title.', 'error');
    return;
  }
  const btn = document.getElementById('qb-exam-ai-save-go');
  if (btn) btn.disabled = true;
  try {
    const saveRes = await fetch(`${API_URL}/teacher/classwork/from-ai/${examAiDraftId}`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ types: ['quiz'], folder: 'exam', title })
    });
    const saveData = await saveRes.json();
    if (!saveRes.ok) throw new Error(saveData.error || 'Could not save the draft.');
    if (!saveData.quiz_set_id) throw new Error('The draft has no questions to save.');
    hideOverlay('qb-exam-ai-save-modal');
    examAiDraftId = null;
    examAiPlan = null;
    showToast(saveData.message || 'Saved to Classwork.');
    questionBankCurrentSetId = saveData.quiz_set_id;
    questionBankCurrentCategory = 'exam';
    questionBankOpenedFromKind = true;
    applyTeacherPanel('quiz-bank');
  } catch (err) {
    showToast(err.message || 'Could not save the exam.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.getElementById('qb-exam-choice-cancel')?.addEventListener('click', () => hideOverlay('qb-exam-choice-modal'));
document.getElementById('qb-exam-choice-type')?.addEventListener('click', () => openExamWriteModal());
document.getElementById('qb-exam-choice-ai')?.addEventListener('click', () => openExamAiModal());
document.getElementById('qb-exam-ai-cancel')?.addEventListener('click', () => hideOverlay('qb-exam-ai-modal'));
document.getElementById('qb-exam-ai-mode-lessons')?.addEventListener('click', () => setExamAiSource('lessons'));
document.getElementById('qb-exam-ai-mode-files')?.addEventListener('click', () => setExamAiSource('files'));
document.getElementById('qb-exam-ai-lesson-subject')?.addEventListener('change', () => renderExamAiLessonList());
document.getElementById('qb-exam-ai-files')?.addEventListener('change', () => syncExamAiContinue());
document.getElementById('qb-exam-ai-grade')?.addEventListener('change', () => fillExamAiSubjectOptions());
document.getElementById('qb-exam-ai-go')?.addEventListener('click', () => continueExamAiGenerate());
document.getElementById('qb-exam-ai-save-cancel')?.addEventListener('click', () => hideOverlay('qb-exam-ai-save-modal'));
document.getElementById('qb-exam-ai-save-go')?.addEventListener('click', () => saveGeneratedExam());
document.getElementById('qb-exam-write-class')?.addEventListener('change', () => syncExamWriteSubject());
document.getElementById('qb-exam-write-cancel')?.addEventListener('click', () => {
  examWriteMode = false;
  hideOverlay('qb-exam-write-modal');
});
document.getElementById('qb-exam-write-add')?.addEventListener('click', () => openExamQuestionForm());
document.getElementById('qb-exam-write-create')?.addEventListener('click', () => createTypedExam());

async function openCreateExamModal() {
  const modal = document.getElementById('qb-exam-modal');
  if (!modal) return;

  await ensureTeacherAssignedClasses();
  await loadTeacherSubjects(true);

  examComposerSelectedSets.clear();
  examComposerSelectedMaterials.clear();
  examComposerSetsCache = [];
  examComposerMaterialsCache = [];
  examComposerItemsCache = [];
  setExamComposerSource('classwork');

  const pairs = getTeacherAssignedClassPairs();
  const classSel = document.getElementById('qb-exam-class');
  if (classSel) {
    classSel.innerHTML = pairs.length
      ? '<option value="">-- Select your class --</option>' +
        pairs.map((p) =>
          `<option value="${p.grade_level}|${escapeHtml(p.section)}">Grade ${p.grade_level} – ${escapeHtml(p.section)}</option>`
        ).join('')
      : '<option value="">No assigned classes</option>';
    if (teacherCurrentClass && pairs.some((p) =>
      Number(p.grade_level) === Number(teacherCurrentClass.grade) &&
      String(p.section).toUpperCase() === String(teacherCurrentClass.section).toUpperCase()
    )) {
      classSel.value = `${teacherCurrentClass.grade}|${teacherCurrentClass.section}`;
    }
  }

  const qtrSel = document.getElementById('qb-exam-quarter');
  const selectedQ = fillUnlockedQuarterSelect(qtrSel, teacherCurrentQuarter || CURRENT_QUARTER);

  const { grade_level } = parseExamClassValue(classSel?.value);
  fillExamSubjectOptions(grade_level);

  const titleEl = document.getElementById('qb-exam-title');
  if (titleEl) {
    const q = selectedQ || teacherCurrentQuarter || 'Q1';
    titleEl.value = `${q} Periodical Exam`;
  }

  const includeAct = document.getElementById('qb-exam-include-activity');
  if (includeAct) includeAct.checked = false;

  modal.hidden = false;
  await Promise.all([loadExamComposerSets(), loadExamComposerMaterials()]);
}

document.getElementById('qb-exam-cancel')?.addEventListener('click', () => {
  const modal = document.getElementById('qb-exam-modal');
  if (modal) modal.hidden = true;
});

document.getElementById('qb-exam-print')?.addEventListener('click', () => {
  const items = getExamComposerFilteredItems();
  const { grade_level, section } = parseExamClassValue(document.getElementById('qb-exam-class')?.value);
  const subjSel = document.getElementById('qb-exam-subject');
  const subjLabel = String(subjSel?.selectedOptions?.[0]?.textContent || '').trim();
  printAssessmentItemsPaper({
    questions: items,
    title: document.getElementById('qb-exam-title')?.value?.trim() || 'Exam',
    type: 'exam',
    subject_name: subjLabel && subjLabel !== 'All subjects'
      ? subjLabel
      : (items.find((i) => i.subject_name)?.subject_name || null),
    grade_level: grade_level || null,
    section: section || null,
    quarter: document.getElementById('qb-exam-quarter')?.value,
    max_score: Number(document.getElementById('qb-exam-max')?.value),
    includeAnswers: true,
    reviewCopy: true
  });
});

document.getElementById('qb-exam-source-tabs')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-exam-source]');
  if (!btn) return;
  setExamComposerSource(btn.dataset.examSource);
});

document.getElementById('qb-exam-class')?.addEventListener('change', () => {
  const { grade_level } = parseExamClassValue(document.getElementById('qb-exam-class')?.value);
  fillExamSubjectOptions(grade_level);
  examComposerSelectedSets.clear();
  examComposerSelectedMaterials.clear();
  loadExamComposerSets();
  loadExamComposerMaterials();
});

document.getElementById('qb-exam-subject')?.addEventListener('change', () => {
  examComposerSelectedSets.clear();
  examComposerSelectedMaterials.clear();
  loadExamComposerSets();
  loadExamComposerMaterials();
});

document.getElementById('qb-exam-quarter')?.addEventListener('change', () => {
  const titleEl = document.getElementById('qb-exam-title');
  const q = document.getElementById('qb-exam-quarter')?.value;
  if (titleEl && q && (!titleEl.value || /Periodical Exam$/i.test(titleEl.value))) {
    titleEl.value = `${q} Periodical Exam`;
  }
});

document.getElementById('qb-exam-include-activity')?.addEventListener('change', () => {
  updateExamComposerPreview();
});
document.getElementById('qb-exam-confirm')?.addEventListener('click', async () => {
  const title = document.getElementById('qb-exam-title')?.value?.trim();
  const { grade_level, section } = parseExamClassValue(document.getElementById('qb-exam-class')?.value);
  const quarter = normalizeQuarterClient(document.getElementById('qb-exam-quarter')?.value || CURRENT_QUARTER || 'Q1');
  const subjectRaw = document.getElementById('qb-exam-subject')?.value;
  const items = getExamComposerFilteredItems();
  const question_ids = items.map((i) => i.id);

  if (!(UNLOCKED_QUARTERS || []).map(normalizeQuarterClient).includes(quarter)) {
    showToast(`${quarter} is locked. Admin has unlocked through ${CURRENT_QUARTER} only.`, 'error');
    fillUnlockedQuarterSelect(document.getElementById('qb-exam-quarter'), CURRENT_QUARTER);
    return;
  }

  if (!grade_level || !section) {
    showToast('Select one of your assigned classes.', 'error');
    return;
  }
  if (!question_ids.length) {
    showToast('Select Classwork sets or Materials with at least one item.', 'error');
    return;
  }

  const subject_id = subjectRaw
    ? Number(subjectRaw)
    : items.find((i) => i.subject_id)?.subject_id || null;

  const section_totals = collectSectionTotalsFromWrap(document.getElementById('qb-exam-sections'));
  const max_score = Number(document.getElementById('qb-exam-max')?.value) || sumSectionTotals(section_totals) || items.length;

  const confirmBtn = document.getElementById('qb-exam-confirm');
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/teacher/assessments/from-bank`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || `${quarter} Periodical Exam`,
        type: 'exam',
        section,
        grade_level,
        quarter,
        subject_id,
        question_ids,
        max_score,
        section_totals
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create exam');
    document.getElementById('qb-exam-modal').hidden = true;
    showToast(data.message || 'Exam created. Find it in Records → Exam.');
    applyTeacherPanel('progress');
    if (data.id) {
      setTimeout(() => openProgressEditor(data.id, 'edit'), 200);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    updateExamComposerPreview();
  }
});

document.getElementById('qb-add-grade')?.addEventListener('change', () => {
  fillAddQuizSubjectOptions();
});

document.getElementById('qb-add-quiz-cancel')?.addEventListener('click', () => {
  const modal = document.getElementById('qb-add-quiz-modal');
  if (modal) modal.hidden = true;
});

document.getElementById('qb-add-quiz-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('qb-add-title')?.value?.trim();
  const grade_level = Number(document.getElementById('qb-add-grade')?.value);
  const subjectRaw = document.getElementById('qb-add-subject')?.value;
  const subject_id = subjectRaw ? Number(subjectRaw) : null;
  const kind = document.getElementById('qb-add-kind')?.value || 'quizzes';
  if (kind === 'exam') {
    const modal = document.getElementById('qb-add-quiz-modal');
    if (modal) modal.hidden = true;
    openExamChoiceModal();
    return;
  }
  if (!title) {
    showToast('Enter a title.', 'error');
    return;
  }
  if (!grade_level) {
    showToast('Select a grade.', 'error');
    return;
  }
  if (!subject_id) {
    showToast('Select a subject.', 'error');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/teacher/classwork/sets`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, grade_level, subject_id, kind })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const modal = document.getElementById('qb-add-quiz-modal');
    if (modal) modal.hidden = true;
    showToast(data.message || 'Classwork created.');
    questionBankCurrentSetId = data.id;
    questionBankCurrentCategory = data.kind || kind;
    questionBankOpenedFromKind = true;
    questionBankSelected.clear();
    await openQuizBankSet(data.id, { keepCategory: data.kind || kind, fromKindList: true });
  } catch (err) {
    showToast(err.message || 'Could not create set.', 'error');
  }
});

document.getElementById('qb-create-cancel')?.addEventListener('click', () => {
  const modal = document.getElementById('qb-create-modal');
  if (modal) modal.hidden = true;
});

document.getElementById('qb-create-print')?.addEventListener('click', () => {
  const items = questionBankItems.filter((i) => questionBankSelected.has(i.id));
  const classVal = document.getElementById('qb-create-class')?.value || '';
  const [gradePart, ...sectionParts] = classVal.split('|');
  printAssessmentItemsPaper({
    questions: items,
    title: document.getElementById('qb-create-title')?.value?.trim() || 'Classwork',
    type: document.getElementById('qb-create-type')?.value || 'quiz',
    subject_name: items.find((i) => i.subject_name)?.subject_name || null,
    grade_level: Number(gradePart) || null,
    section: sectionParts.join('|').trim() || null,
    quarter: document.getElementById('qb-create-quarter')?.value,
    max_score: Number(document.getElementById('qb-create-max')?.value),
    includeAnswers: true,
    reviewCopy: true
  });
});

document.getElementById('qb-create-type')?.addEventListener('change', () => {
  syncClassworkCreateModalLabels();
  const selectedItems = questionBankItems.filter((i) => questionBankSelected.has(i.id));
  const cap = rubricCapFromBankItems(selectedItems);
  const maxInput = document.getElementById('qb-create-max');
  if (document.getElementById('qb-create-type')?.value === 'activity' && cap > 0 && maxInput) {
    maxInput.value = String(cap);
  }
});

document.getElementById('qb-create-confirm')?.addEventListener('click', async () => {
  const title = document.getElementById('qb-create-title')?.value?.trim();
  const type = document.getElementById('qb-create-type')?.value || 'quiz';
  const classVal = document.getElementById('qb-create-class')?.value || '';
  const quarter = normalizeQuarterClient(document.getElementById('qb-create-quarter')?.value || CURRENT_QUARTER || 'Q1');
  const question_ids = [...questionBankSelected];

  if (!(UNLOCKED_QUARTERS || []).map(normalizeQuarterClient).includes(quarter)) {
    showToast(`${quarter} is locked. Admin has unlocked through ${CURRENT_QUARTER} only.`, 'error');
    fillUnlockedQuarterSelect(document.getElementById('qb-create-quarter'), CURRENT_QUARTER);
    return;
  }

  const [gradePart, ...sectionParts] = classVal.split('|');
  const grade_level = Number(gradePart);
  const section = sectionParts.join('|').trim();
  if (!grade_level || !section) {
    showToast('Select one of your assigned classes.', 'error');
    return;
  }
  if (!question_ids.length) {
    showToast('Select at least one bank item.', 'error');
    return;
  }

  const selectedItems = questionBankItems.filter((i) => questionBankSelected.has(i.id));
  const subject_id = selectedItems.find((i) => i.subject_id)?.subject_id || null;
  const section_totals = collectSectionTotalsFromWrap(document.getElementById('qb-create-sections'));
  let max_score = Number(document.getElementById('qb-create-max')?.value) || sumSectionTotals(section_totals) || selectedItems.length;
  if (type === 'activity') {
    const cap = rubricCapFromBankItems(selectedItems);
    if (cap > 0) max_score = cap;
  }
  let activity_mode = null;
  let activity_target_at = null;
  if (type === 'activity') {
    activity_mode = document.querySelector('input[name="qb-create-activity-mode"]:checked')?.value || '';
    activity_target_at = document.getElementById('qb-create-target')?.value || '';
    if (activity_mode !== 'classroom' && activity_mode !== 'take_home') {
      showToast('Choose Classroom activity or Take home.', 'error');
      return;
    }
    if (!activity_target_at) {
      showToast('Set a target date.', 'error');
      return;
    }
  }

  try {
    const res = await fetch(`${API_URL}/teacher/assessments/from-bank`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        type,
        section,
        grade_level,
        quarter,
        subject_id,
        question_ids,
        max_score,
        section_totals,
        activity_mode,
        activity_target_at
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('qb-create-modal').hidden = true;
    questionBankSelected.clear();
    updateQuizBankSelectionMeta();
    showToast(data.message || `${classworkCreateKindLabel(type)} created. Find it in Records → ${classworkCreateKindLabel(type)}.`);
    applyTeacherPanel('progress');
    if (data.id) {
      setTimeout(() => openProgressEditor(data.id, 'edit'), 200);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

window.deleteLessonPlan = async function(id) {
  if (!confirm('Delete this material?')) return;
  try {
    const res = await fetch(`${API_URL}/teacher/lesson-plans/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Material deleted.');
    loadLessonPlans();
    loadAiRecommendations();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('upload-material-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('lp-message');
  const title = document.getElementById('lp-title')?.value.trim();
  const subjectId = document.getElementById('lp-subject')?.value;
  const grade = document.getElementById('lp-grade')?.value;
  const objectives = document.getElementById('lp-objectives')?.value.trim();
  const quarter = document.getElementById('lp-quarter')?.value || 'Q1';
  const fileInput = document.getElementById('lp-file');

  if (!title) {
    if (msg) msg.textContent = 'Please enter a title.';
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('subject_id', subjectId || '');
  formData.append('grade_level', grade);
  formData.append('objectives', objectives);
  formData.append('quarter', quarter);
  if (fileInput?.files?.[0]) formData.append('file', fileInput.files[0]);

  try {
    const token = getAuthToken();
    const res = await fetch(`${API_URL}/teacher/lesson-plans`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (msg) msg.textContent = '';
    e.target.reset();
    progressLessonPlansCache = null;
    fillLessonPlanGradeOptions();
    fillTeacherSubjectSelects();
    const modal = document.getElementById('upload-material-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('hidden', '');
    }
    showToast(data.message || 'Material uploaded.');
    if (subjectId) materialsCurrentSubjectKey = materialsSubjectKey(subjectId);
    loadLessonPlans();
  } catch (err) {
    if (msg) { msg.textContent = err.message; msg.style.color = '#b71c1c'; }
    showToast(err.message, 'error');
  }
});

const teacherObserver = new MutationObserver((mutations) => {
  mutations.forEach((m) => {
    if (m.type === 'attributes' && m.attributeName === 'hidden') {
      const view = m.target;
      if (!view.hidden && view.dataset.view === 'teacher') {
        console.log('[Teacher] View activated');
        applyTeacherPanel('classroom');
        loadTeacherClasses();
        loadTeacherInbox();
      }
    }
  });
});

const teacherView = document.getElementById('view-teacher');
if (teacherView) {
  teacherObserver.observe(teacherView, { attributes: true });
}

// ========== PARENT PORTAL ==========
let parentCurrentChild = null;
let parentAllChildren = [];
let parentProfile = null;

// Parent tab history & back button
const parentTabHistory = [];
let isParentNavigatingBack = false;
const parentBackBtn = document.getElementById('parent-back-btn');

function updateParentBackButton() {
  if (parentBackBtn) {
    parentBackBtn.style.display = parentTabHistory.length > 0 ? 'inline-flex' : 'none';
  }
}

if (parentBackBtn) {
  parentBackBtn.addEventListener('click', () => {
    if (parentTabHistory.length > 0) {
      isParentNavigatingBack = true;
      const prevTab = parentTabHistory.pop();
      document.querySelector(`[data-parent-tab="${prevTab}"]`)?.click();
      updateParentBackButton();
    }
  });
}

async function loadParentProfile() {
  try {
    const res = await fetch(`${API_URL}/parent/me`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok) {
      parentProfile = data;
      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = `${data.first_name} ${data.last_name}`;
      });
      const avatarImg = document.getElementById('parent-topbar-avatar-img') || document.getElementById('parent-avatar-img');
      if (avatarImg && data.avatar_url) {
        avatarImg.src = data.avatar_url;
        avatarImg.style.display = 'block';
        const initial = avatarImg.nextElementSibling;
        if (initial) initial.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Load profile error:', err);
  }
}

function updateParentChildName(text) {
  const childNameEl = document.getElementById('parent-child-name');
  if (!childNameEl) return;

  if (!parentAllChildren || parentAllChildren.length <= 1) {
    childNameEl.textContent = text || 'No linked children';
    childNameEl.style.display = '';
    return;
  }

  childNameEl.innerHTML = '';
  childNameEl.style.display = 'flex';
  childNameEl.style.alignItems = 'center';
  childNameEl.style.gap = '6px';
  childNameEl.style.flexWrap = 'nowrap';
  childNameEl.style.minWidth = '0';
  childNameEl.style.maxWidth = '100%';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'parent-child-name-text';
  nameSpan.textContent = text || 'No linked children';
  childNameEl.appendChild(nameSpan);

  const menu = document.createElement('div');
  menu.className = 'download-menu';
  menu.id = 'parent-child-switch-menu';
  menu.innerHTML = `
    <button type="button" class="chip-ghost parent-child-switch-btn" id="parent-child-switch-btn" aria-haspopup="true" aria-expanded="false" aria-label="Switch child" title="Switch child">▾</button>
    <div class="download-menu-panel download-menu-panel--scroll" id="parent-child-switch-panel" hidden></div>
  `;
  childNameEl.appendChild(menu);

  wireDownloadSelectMenu({
    menuId: 'parent-child-switch-menu',
    btnId: 'parent-child-switch-btn',
    panelId: 'parent-child-switch-panel',
    options: parentAllChildren.map((child) => ({
      value: String(child.id),
      label: `${child.last_name}, ${child.first_name} (Grade ${child.grade_level}-${child.section})`
    })),
    getValue: () => String(parentCurrentChild?.id || ''),
    setValue: (v) => {
      const selected = parentAllChildren.find((c) => String(c.id) === String(v));
      if (selected) parentCurrentChild = selected;
    },
    formatButtonLabel: () => '▾',
    onPick: () => {
      const selected = parentCurrentChild;
      if (!selected) return;
      parentProgressCache = null;
      parentAttendanceCache = [];
      parentAttPage = 1;
      parentProgressPage = 1;
      updateParentChildName(`${selected.first_name} ${selected.last_name}`);
      const activeTab = document.querySelector('[data-parent-tab].active')?.dataset.parentTab;
      if (activeTab === 'overview') renderParentOverview(selected);
      else if (activeTab === 'attendance') renderParentAttendance(selected);
      else if (activeTab === 'progress') renderParentProgress(selected);
      else if (activeTab === 'inbox' || activeTab === 'contact') paintParentInboxList();
    }
  });
}

async function loadParentDashboard() {
  const contentEl = document.getElementById('parent-content');
  if (!contentEl) return;

  await loadParentProfile();

  try {
    const res = await fetch(`${API_URL}/parent/children`, { headers: getAuthHeaders() });
    const children = await res.json();
    if (!res.ok) throw new Error(children.error);

    if (!children.length) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"></div>
          <p>No children linked to your account yet.</p>
          <p style="font-size:0.78rem;">Contact the school admin if you believe this is an error.</p>
        </div>`;
      updateParentChildName('No linked children');
      parentAllChildren = [];
      parentCurrentChild = null;
      return;
    }

    parentAllChildren = children;
    parentCurrentChild = children[0];
    updateParentChildName(`${parentCurrentChild.first_name} ${parentCurrentChild.last_name}`);

    renderParentOverview(parentCurrentChild);

  } catch (err) {
    console.error('Load parent dashboard error:', err);
    contentEl.innerHTML = `<div class="empty-state"><p>Failed to load dashboard</p></div>`;
  }
}

function parentReportStudentHeading(student) {
  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
  const grade = student.grade_level != null
    ? `Grade ${student.grade_level}-${student.section || ''}`
    : '';
  const lrn = student.lrn ? `LRN ${student.lrn}` : '';
  const bits = [grade, lrn].filter(Boolean).join(' · ');
  return { name, bits };
}

async function buildParentReportHtml(student, tab) {
  // No top identity header — section titles + tables are enough (same as Overview).
  if (tab === 'attendance') {
    let records = parentAttendanceCache;
    if (!Array.isArray(records) || !records.length) {
      records = await fetchParentAttendance(student.id);
      parentAttendanceCache = records;
    }
    if (!parentAttPeriodInitialized) {
      parentAttPeriod = parentPeriodKey(new Date(), parentAttPeriodMode || 'month');
      parentAttPeriodInitialized = true;
    }
    if (!parentAttendanceStatus) parentAttendanceStatus = 'all';
    const filtered = filterParentAttendanceRecords(records, {
      mode: parentAttPeriodMode,
      period: parentAttPeriod,
      status: parentAttendanceStatus
    });
    const statusBit = parentAttendanceStatus === 'all' ? 'All statuses' : parentAttendanceStatus;
    const monthBit = parentPeriodLabel(parentAttPeriod, parentAttPeriodMode);
    const rows = filtered.map((r) => {
      const when = parentAttendanceWhenLabel(r);
      const dateStr = parentAttendanceDisplayDate(r.date);
      return `<tr>
        <td>${escapeHtml(dateStr)}</td>
        <td>${escapeHtml(when)}</td>
        <td>${escapeHtml(r.status || '-')}</td>
      </tr>`;
    }).join('');
    return `
      <h2>Attendance Records</h2>
      <p>${escapeHtml(monthBit)} · ${escapeHtml(statusBit)} · ${filtered.length} record(s)</p>
      ${filtered.length ? `<table>
        <thead><tr><th>Date</th><th>Session / Subject</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<p>No attendance records for this filter.</p>'}`;
  }

  if (tab === 'progress') {
    let all = parentProgressCache;
    let overallAvg = parentProgressAverageAll;
    if (!Array.isArray(all)) {
      const res = await fetch(`${API_URL}/parent/child/${student.id}/progress`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load progress');
      all = data.records || [];
      overallAvg = Number(data.average) || 0;
      parentProgressCache = all;
      parentProgressAverageAll = overallAvg;
    }
    const records = filterParentProgressRecords(all, {
      subject: parentProgressSubject,
      type: parentProgressType,
      mode: parentProgressPeriodMode,
      period: parentProgressPeriod
    });
    const filterBits = [
      parentProgressSubject === 'all' ? 'All subjects' : (parentProgressSubject === '__none__' ? 'No subject' : parentProgressSubject),
      parentProgressType === 'all' ? 'All types' : parentProgressTypeLabel(parentProgressType),
      parentPeriodLabel(parentProgressPeriod, parentProgressPeriodMode)
    ];
    const shownAvg = parentProgressAverage(records);
    const rows = records.map((r) => {
      const typeLabel = r.type === 'quiz' ? 'Quiz' : r.type === 'activity' ? 'Activity' : 'Exam';
      const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString() : '-';
      return `<tr>
        <td>${escapeHtml(dateStr)}</td>
        <td>${escapeHtml(typeLabel)}</td>
        <td>${escapeHtml(r.title || '')}</td>
        <td>${escapeHtml(r.subject_name || '—')}</td>
        <td>${escapeHtml(`${r.score} / ${r.max_score}`)}</td>
        <td>${escapeHtml(`${r.percent}%`)}</td>
      </tr>`;
    }).join('');
    return `
      <h2>Records</h2>
      <p>${escapeHtml(filterBits.join(' · '))}</p>
      <p>${records.length
        ? `Average across shown items: ${escapeHtml(String(shownAvg))}% · ${records.length} item(s)${records.length !== all.length ? ` · Overall average ${escapeHtml(String(overallAvg))}% across ${all.length} item(s)` : ''}`
        : (all.length ? 'No items match the selected filters.' : 'No quiz, activity, or exam scores yet.')}</p>
      ${records.length ? `<table>
        <thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Subject</th><th>Score</th><th>%</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : ''}`;
  }

  // Default: overview report
  let stats = { attendanceRate: 0, present: 0, absent: 0, late: 0, todayStatus: 'Not recorded' };
  try {
    const res = await fetch(`${API_URL}/parent/child/${student.id}/stats`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok) stats = data;
  } catch { /* keep defaults */ }

  let recent = [];
  try {
    const records = await fetchParentAttendance(student.id);
    parentAttendanceCache = records;
    recent = recentParentAttendance(records);
  } catch { /* ignore */ }

  const gender = student.gender === 'M' ? 'Male' : student.gender === 'F' ? 'Female' : 'N/A';
  const attRows = recent.map((r) => {
    const when = parentAttendanceWhenLabel(r);
    const dateStr = parentAttendanceDisplayDate(r.date);
    return `<tr>
      <td>${escapeHtml(dateStr)}</td>
      <td>${escapeHtml(when)}</td>
      <td>${escapeHtml(r.status || '-')}</td>
    </tr>`;
  }).join('');

  const analyticsHtml = await buildParentAnalyticsReportHtml(student);

  return `
    <h2>Student Information</h2>
    <table>
      <tbody>
        <tr><th>Name</th><td>${escapeHtml(`${student.last_name || ''}, ${student.first_name || ''}`)}</td></tr>
        <tr><th>LRN</th><td>${escapeHtml(student.lrn || 'N/A')}</td></tr>
        <tr><th>Grade &amp; Section</th><td>${escapeHtml(`Grade ${student.grade_level}-${student.section || ''}`)}</td></tr>
        <tr><th>Gender</th><td>${escapeHtml(gender)}</td></tr>
      </tbody>
    </table>
    <h2>Attendance Summary</h2>
    <table>
      <tbody class="kpi-row">
        <tr><th>Attendance Rate (30 days)</th><td>${escapeHtml(String(stats.attendanceRate))}%</td></tr>
        <tr><th>Days Present (this month)</th><td>${escapeHtml(String(stats.present))}</td></tr>
        <tr><th>Days Absent (this month)</th><td>${escapeHtml(String(stats.absent))}</td></tr>
        <tr><th>Today's Status</th><td>${escapeHtml(stats.todayStatus || 'Not recorded')}</td></tr>
      </tbody>
    </table>
    ${analyticsHtml}
    <h2>Recent Attendance</h2>
    ${recent.length ? `<table>
      <thead><tr><th>Date</th><th>Session / Subject</th><th>Status</th></tr></thead>
      <tbody>${attRows}</tbody>
    </table>` : '<p>No attendance records yet.</p>'}`;
}

function parentChartImageHtml(chartKey, alt) {
  const chart = parentCharts[chartKey];
  if (!chart || !chart.canvas) return '';
  try {
    const src = chart.toBase64Image('image/png', 1);
    if (!src) return '';
    return `<img src="${src}" alt="${escapeHtml(alt)}" style="display:block;max-width:100%;max-height:320px;margin:6px 0 10px;">`;
  } catch {
    return '';
  }
}

/** Analytics section of the Overview print report: tables + chart snapshots (when rendered). */
async function buildParentAnalyticsReportHtml(student) {
  const headers = getAuthHeaders();
  const parts = [];

  // Lesson performance
  let lessonData = parentLessonData;
  if (!lessonData) {
    try {
      const res = await fetch(`${API_URL}/parent/child/${student.id}/analytics/lessons`, { headers });
      const data = await res.json();
      if (res.ok) lessonData = data;
    } catch { /* ignore */ }
  }
  const lessons = lessonData?.lessons || [];
  const subjName = lessonData?.subjects?.find((s) => String(s.id) === String(parentLessonSubject))?.name;
  const filteredLessons = parentLessonSubject === 'all'
    ? lessons
    : lessons.filter((l) => String(l.subject_id) === String(parentLessonSubject));
  const statusLabel = (st) => st === 'excels' ? 'Excels' : st === 'on_track' ? 'On track' : 'Needs improvement';
  parts.push(`
    <h2>Lesson Performance</h2>
    <p>${escapeHtml(subjName ? `Subject: ${subjName}` : 'All subjects')} · ${filteredLessons.length} lesson(s)</p>
    ${parentChartImageHtml('lessons', 'Lesson performance chart')}
    ${filteredLessons.length ? `<table>
      <thead><tr><th>Subject</th><th>Lesson</th><th>Items</th><th>Average</th><th>Status</th></tr></thead>
      <tbody>${filteredLessons.map((l) => `<tr>
        <td>${escapeHtml(l.subject_name)}</td>
        <td>${escapeHtml(l.lesson)}</td>
        <td>${l.items}</td>
        <td>${l.avg_percent}%</td>
        <td>${statusLabel(l.status)}</td>
      </tr>`).join('')}</tbody>
    </table>` : '<p>No quiz, activity, or exam scores recorded yet.</p>'}`);

  // Weekly classwork
  let weekData = parentClassworkData;
  if (!weekData) {
    try {
      const res = await fetch(
        `${API_URL}/parent/child/${student.id}/analytics/classwork?week=${encodeURIComponent(parentClassworkWeek || parentTodayISO())}`,
        { headers }
      );
      const data = await res.json();
      if (res.ok) weekData = data;
    } catch { /* ignore */ }
  }
  const items = weekData?.items || [];
  parts.push(`
    <h2>Weekly Classwork Results</h2>
    <p>${escapeHtml(weekData ? parentFmtRangeLabel(weekData.weekStart, weekData.weekEnd) : 'This week')}${items.length ? ` · Average ${weekData.average}% · ${items.length} item(s)` : ''}</p>
    ${parentChartImageHtml('classwork', 'Weekly classwork chart')}
    ${items.length ? `<table>
      <thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Subject</th><th>Score</th><th>%</th></tr></thead>
      <tbody>${items.map((it) => `<tr>
        <td>${escapeHtml(it.date ? parentFmtShortDate(it.date) : '-')}</td>
        <td>${escapeHtml(it.title)}</td>
        <td>${it.type === 'quiz' ? 'Quiz' : it.type === 'activity' ? 'Activity' : 'Exam'}</td>
        <td>${escapeHtml(it.subject_name || '—')}</td>
        <td>${it.score} / ${it.max_score}</td>
        <td>${it.percent}%</td>
      </tr>`).join('')}</tbody>
    </table>` : '<p>No classwork recorded this week.</p>'}`);

  // Attendance summary
  let attData = parentAttSummaryData;
  if (!attData) {
    try {
      const res = await fetch(
        `${API_URL}/parent/child/${student.id}/analytics/attendance?range=${encodeURIComponent(parentAttRange)}&date=${encodeURIComponent(parentTodayISO())}`,
        { headers }
      );
      const data = await res.json();
      if (res.ok) attData = data;
    } catch { /* ignore */ }
  }
  if (attData) {
    const rangeLabel = attData.range === 'year'
      ? `School Year ${attData.schoolYear || ''}`.trim()
      : parentFmtRangeLabel(attData.from, attData.to);
    parts.push(`
      <h2>Attendance Summary</h2>
      <p>${escapeHtml(rangeLabel)}</p>
      ${parentChartImageHtml('attendance', 'Attendance summary chart')}
      <table>
        <tbody class="kpi-row">
          <tr><th>Present</th><td>${attData.present}</td></tr>
          <tr><th>Late</th><td>${attData.late}</td></tr>
          <tr><th>Absent</th><td>${attData.absent}</td></tr>
          <tr><th>Excused</th><td>${attData.excused}</td></tr>
          <tr><th>Total school days</th><td>${attData.totalSchoolDays}</td></tr>
          <tr><th>Attendance rate</th><td>${attData.attendanceRate}%</td></tr>
        </tbody>
      </table>`);
  }

  return parts.join('');
}

async function printParentReport() {
  if (!parentCurrentChild) {
    showToast('No child selected to print.', 'error');
    return;
  }

  const tab = document.querySelector('[data-parent-tab].active')?.dataset.parentTab || 'overview';
  if (tab === 'inbox' || tab === 'contact') {
    showToast('Open Overview, Attendance, or Progress to print a report.', 'error');
    return;
  }

  try {
    const bodyHtml = await buildParentReportHtml(parentCurrentChild, tab);
    // Blank title → no student name in browser print header
    openPrintHtmlDocument('', bodyHtml);
  } catch (err) {
    showToast(err.message || 'Failed to prepare report.', 'error');
  }
}

document.getElementById('parent-print-btn')?.addEventListener('click', () => {
  printParentReport();
});

const avatarUploadInput = document.getElementById('parent-avatar-upload');
if (avatarUploadInput) {
  avatarUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch(`${API_URL}/upload/avatar`, {
        method: 'POST',
        headers: { 'Authorization': getAuthHeaders().Authorization },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const avatarImg = document.getElementById('parent-avatar-img');
      if (avatarImg) avatarImg.src = data.avatarUrl + '?t=' + Date.now();
      alert('Profile picture updated!');

    } catch (err) {
      alert(err.message);
    }
  });
}

async function renderParentOverview(student) {
  const contentEl = document.getElementById('parent-content');
  if (!contentEl) return;

  let stats = { attendanceRate: 0, present: 0, absent: 0, late: 0, todayStatus: 'Not recorded' };
  try {
    const res = await fetch(`${API_URL}/parent/child/${student.id}/stats`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok) stats = data;
  } catch (e) { console.error('Stats error:', e); }

  contentEl.innerHTML = `
    <div class="parent-main">
      <div id="parent-child-selector" style="margin-bottom:12px;"></div>

      <div class="parent-kpis">
        <div class="kpi-card">
          <div class="kpi-title">Attendance Rate</div>
          <div class="kpi-value"><span>${stats.attendanceRate}%</span></div>
          <div class="kpi-sub">Last 30 days</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Days Present</div>
          <div class="kpi-value"><span>${stats.present}</span></div>
          <div class="kpi-sub">This month</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Days Absent</div>
          <div class="kpi-value"><span>${stats.absent}</span></div>
          <div class="kpi-sub">This month</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Today's Status</div>
          <div class="kpi-value"><span style="color:${stats.todayStatus === 'Present' ? '#1b5e20' : stats.todayStatus === 'Absent' ? '#b71c1c' : '#666'}">${stats.todayStatus}</span></div>
          <div class="kpi-sub">${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div class="chart-card" id="parent-lesson-card">
        <div class="teacher-header-row" style="align-items:center;">
          <div>
            <h3 style="font-size:1rem;color:var(--maroon-deep);margin:0;">Lesson Performance</h3>
            <p class="page-subheading" style="margin:2px 0 0;">Where ${escapeHtml(student.first_name || 'your child')} excels or needs improvement, per lesson.</p>
          </div>
        </div>
        <div class="parent-chart-filters" id="parent-lesson-filters" role="group" aria-label="Filter by subject"></div>
        <div class="parent-chart-wrap parent-chart-wrap--lessons" id="parent-lesson-chart-wrap">
          <canvas id="parent-lesson-chart" aria-label="Average score per lesson" role="img"></canvas>
        </div>
        <div class="parent-lesson-lists" id="parent-lesson-lists"></div>
      </div>

      <div class="parent-analytics-row">
        <div class="chart-card">
          <div class="teacher-header-row" style="align-items:center;">
            <h3 style="font-size:1rem;color:var(--maroon-deep);margin:0;">Recent Attendance</h3>
            <button type="button" class="chip-ghost" id="parent-attendance-see-more" style="font-size:0.78rem;">See More →</button>
          </div>
          <div id="parent-attendance-table-wrap">
            <p style="color:var(--text-muted);font-size:0.84rem;">Loading...</p>
          </div>
        </div>

        <div class="parent-analytics-col">
          <div class="chart-card" id="parent-att-summary-card">
            <div class="teacher-header-row" style="align-items:center;">
              <h3 style="font-size:1rem;color:var(--maroon-deep);margin:0;">Attendance Summary</h3>
            </div>
            <div class="parent-chart-filters" id="parent-att-range-filters" role="group" aria-label="Attendance range"></div>
            <div class="parent-att-summary">
              <div class="parent-chart-wrap parent-chart-wrap--pie" id="parent-att-pie-wrap">
                <canvas id="parent-attendance-pie" aria-label="Attendance breakdown" role="img"></canvas>
              </div>
              <div class="parent-att-stats" id="parent-att-stats"></div>
            </div>
          </div>

          <div class="chart-card">
            <h3 style="font-size:1rem;color:var(--maroon-deep);margin-bottom:12px;">Student Information</h3>
            <div class="parent-student-info">
              <div><strong>Name:</strong> ${escapeHtml(student.last_name)}, ${escapeHtml(student.first_name)}</div>
              <div><strong>LRN:</strong> ${student.lrn || 'N/A'}</div>
              <div><strong>Grade & Section:</strong> Grade ${student.grade_level}-${student.section}</div>
              <div><strong>Gender:</strong> ${student.gender === 'M' ? 'Male' : student.gender === 'F' ? 'Female' : 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-card" id="parent-classwork-card">
        <div class="teacher-header-row" style="align-items:center;">
          <h3 style="font-size:1rem;color:var(--maroon-deep);margin:0;">Weekly Classwork Results</h3>
          <div class="parent-week-nav">
            <button type="button" class="chip-ghost chip-icon" id="parent-week-prev" aria-label="Previous week">◀</button>
            <span class="parent-week-label" id="parent-week-label">…</span>
            <button type="button" class="chip-ghost chip-icon" id="parent-week-next" aria-label="Next week">▶</button>
          </div>
        </div>
        <div class="parent-chart-wrap" id="parent-classwork-chart-wrap">
          <canvas id="parent-classwork-chart" aria-label="Classwork results this week" role="img"></canvas>
        </div>
        <div id="parent-classwork-table" style="margin-top:10px;"></div>
      </div>

      <div class="chart-card" style="background:var(--peach-soft);border-color:rgba(243,156,18,0.35);">
        <h3 style="font-size:1rem;color:var(--maroon-deep);margin-bottom:8px;">Progress Summary</h3>
        <div class="page-subheading" id="parent-ai-summary" style="margin:0;font-size:0.85rem;color:var(--text-dark);line-height:1.6;">
          Loading summary…
        </div>
      </div>
    </div>
  `;

  destroyParentCharts();
  loadParentAttendanceTable(student.id);
  loadParentAiSummary(student.id);
  loadParentLessonAnalytics(student.id);
  wireParentWeekNav(student.id);
  loadParentWeeklyClasswork(student.id);
  loadParentAttendanceSummary(student.id);
  document.getElementById('parent-attendance-see-more')?.addEventListener('click', () => {
    document.querySelector('[data-parent-tab="attendance"]')?.click();
  });
}

/* ---------- Parent dashboard analytics (Chart.js) ---------- */

const parentCharts = {};
let parentLessonData = null;      // { subjects, lessons }
let parentLessonSubject = 'all';  // 'all' | subject_id string
let parentClassworkWeek = '';     // YYYY-MM-DD (Monday)
let parentClassworkData = null;
let parentAttRange = 'month';     // day | week | month | year
let parentAttSummaryData = null;

const PARENT_STATUS_COLORS = {
  excels: '#2e7d32',
  on_track: '#f39c12',
  needs_improvement: '#c62828'
};
const PARENT_ATT_COLORS = {
  present: '#2e7d32',
  late: '#f39c12',
  absent: '#c62828',
  excused: '#1565c0'
};

function destroyParentCharts() {
  for (const key of Object.keys(parentCharts)) {
    try { parentCharts[key]?.destroy(); } catch { /* ignore */ }
    delete parentCharts[key];
  }
}

function parentChartLib() {
  return typeof window !== 'undefined' ? window.Chart : null;
}

function parentChartUnavailable(wrapId, text = 'Charts are unavailable right now.') {
  const wrap = document.getElementById(wrapId);
  if (wrap) wrap.innerHTML = `<p class="parent-chart-empty">${escapeHtml(text)}</p>`;
}

function parentFmtShortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function parentFmtRangeLabel(from, to) {
  if (!from) return '';
  if (from === to) {
    const [y, m, d] = from.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  const yr = to ? to.slice(0, 4) : from.slice(0, 4);
  return `${parentFmtShortDate(from)} – ${parentFmtShortDate(to)}, ${yr}`;
}

function parentTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parentShiftISO(iso, days) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function paintParentChipFilters(containerId, options, current, onPick) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = options.map((o) =>
    `<button type="button" class="chip-ghost${String(o.value) === String(current) ? ' is-pressed' : ''}" data-value="${escapeHtml(String(o.value))}" aria-pressed="${String(o.value) === String(current)}">${escapeHtml(o.label)}</button>`
  ).join('');
  wrap.querySelectorAll('button[data-value]').forEach((btn) => {
    btn.addEventListener('click', () => onPick(btn.dataset.value));
  });
}

/* --- Lesson performance --- */

async function loadParentLessonAnalytics(studentId) {
  const wrapId = 'parent-lesson-chart-wrap';
  try {
    const res = await fetch(`${API_URL}/parent/child/${studentId}/analytics/lessons`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load lesson analytics');
    parentLessonData = data;
    const subjectIds = (data.subjects || []).map((s) => String(s.id));
    if (parentLessonSubject !== 'all' && !subjectIds.includes(String(parentLessonSubject))) {
      parentLessonSubject = 'all';
    }
    paintParentLessonFilters();
    paintParentLessonChart();
  } catch (err) {
    console.error('Lesson analytics error:', err);
    parentLessonData = null;
    parentChartUnavailable(wrapId, 'Could not load lesson performance.');
    const lists = document.getElementById('parent-lesson-lists');
    if (lists) lists.innerHTML = '';
  }
}

function paintParentLessonFilters() {
  const subjects = parentLessonData?.subjects || [];
  const options = [{ value: 'all', label: 'All subjects' }, ...subjects.map((s) => ({ value: String(s.id), label: s.name }))];
  paintParentChipFilters('parent-lesson-filters', options, parentLessonSubject, (v) => {
    parentLessonSubject = v || 'all';
    paintParentLessonFilters();
    paintParentLessonChart();
  });
  const wrap = document.getElementById('parent-lesson-filters');
  if (wrap && !subjects.length) wrap.hidden = true;
  else if (wrap) wrap.hidden = false;
}

function parentFilteredLessons() {
  const lessons = parentLessonData?.lessons || [];
  if (parentLessonSubject === 'all') return lessons;
  return lessons.filter((l) => String(l.subject_id) === String(parentLessonSubject));
}

function paintParentLessonChart() {
  const wrap = document.getElementById('parent-lesson-chart-wrap');
  const lists = document.getElementById('parent-lesson-lists');
  if (!wrap) return;

  const lessons = parentFilteredLessons();
  const showSubject = parentLessonSubject === 'all';
  const kindSource = !showSubject && lessons.length === 1 && Array.isArray(lessons[0].kinds) && lessons[0].kinds.length
    ? lessons[0]
    : null;
  const rows = kindSource
    ? kindSource.kinds.map((kind) => ({
      label: kind.name,
      percent: kind.percent,
      status: kind.status,
      subject_name: kindSource.subject_name,
      items: kind.items,
      quiz_parts: kind.kind === 'quiz' ? kindSource.quiz_parts : null,
      activity_parts: kind.kind === 'activity' ? kindSource.activity_parts : null,
      exam_parts: kind.kind === 'exam' ? kindSource.exam_parts : null
    }))
    : lessons.map((lesson) => ({
      label: lesson.subject_name,
      percent: lesson.avg_percent,
      status: lesson.status,
      subject_name: lesson.subject_name,
      items: lesson.items,
      quiz_parts: lesson.quiz_parts,
      activity_parts: lesson.activity_parts,
      exam_parts: lesson.exam_parts
    }));

  if (!lessons.length) {
    if (parentCharts.lessons) { parentCharts.lessons.destroy(); delete parentCharts.lessons; }
    wrap.style.height = '';
    wrap.innerHTML = '<p class="parent-chart-empty">No quiz, activity, or exam scores recorded yet.</p>';
    if (lists) lists.innerHTML = '';
    return;
  }

  const Chart = parentChartLib();
  if (!Chart) {
    parentChartUnavailable('parent-lesson-chart-wrap');
  } else {
    if (!document.getElementById('parent-lesson-chart')) {
      wrap.innerHTML = '<canvas id="parent-lesson-chart" aria-label="Average score per lesson" role="img"></canvas>';
    }
    // Horizontal bars: one row per lesson, grow card height with the list
    wrap.style.height = `${Math.max(180, Math.min(520, 44 * rows.length + 60))}px`;
    const canvas = document.getElementById('parent-lesson-chart');
    const labels = rows.map((row) => row.label);
    const values = rows.map((row) => row.percent);
    const colors = rows.map((row) => PARENT_STATUS_COLORS[row.status] || '#8a726b');

    if (parentCharts.lessons) { parentCharts.lessons.destroy(); delete parentCharts.lessons; }
    parentCharts.lessons = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Average %',
          data: values,
          backgroundColor: colors,
          borderRadius: 6,
          maxBarThickness: 26
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` }, grid: { color: 'rgba(93,17,13,0.08)' } },
          y: { ticks: { autoSkip: false, font: { size: 11 } }, grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => rows[items[0].dataIndex]?.label || '',
              label: (item) => {
                const row = rows[item.dataIndex];
                const st = row.status === 'excels' ? 'Excels' : row.status === 'on_track' ? 'On track' : 'Needs improvement';
                const score = row.items == null
                  ? `${row.percent}%`
                  : `${row.percent}% (${row.items} item${row.items === 1 ? '' : 's'})`;
                return [`${row.subject_name}`, score, st];
              }
            }
          }
        }
      }
    });
  }

  if (lists) {
    const excels = rows.filter((row) => row.status === 'excels');
    const needs = rows.filter((row) => row.status === 'needs_improvement');
    const partLine = (label, parts) => {
      const list = Array.isArray(parts)
        ? parts.filter((part) => part && part.name)
        : [parts?.strong_part, parts?.weak_part].filter((part) => part && part.name);
      if (!list.length) return '';
      const text = `${label}: ${list.map((part) => `${part.name} ${part.avg_percent}%`).join(', ')}`;
      return `<span class="page-subheading parent-lesson-parts">${escapeHtml(text)}</span>`;
    };
    const partBits = (row) => `${partLine('Quiz', row.quiz_parts)}${partLine('Activity', row.activity_parts)}${partLine('Exam', row.exam_parts)}`;
    const li = (row) => `<li><span class="parent-lesson-subject">${escapeHtml(row.label)}</span> <strong>${row.percent}%</strong>${partBits(row)}</li>`;
    lists.innerHTML = `
      <div class="parent-lesson-list parent-lesson-list--good">
        <h4>Excels</h4>
        ${excels.length ? `<ul>${excels.map(li).join('')}</ul>` : '<p class="parent-chart-empty">No lessons at 85% or higher yet.</p>'}
      </div>
      <div class="parent-lesson-list parent-lesson-list--bad">
        <h4>Needs improvement</h4>
        ${needs.length ? `<ul>${needs.map(li).join('')}</ul>` : '<p class="parent-chart-empty">No lessons below 75%. Keep it up!</p>'}
      </div>`;
  }
}

/* --- Weekly classwork --- */

function wireParentWeekNav(studentId) {
  if (!parentClassworkWeek) parentClassworkWeek = parentTodayISO();
  document.getElementById('parent-week-prev')?.addEventListener('click', () => {
    parentClassworkWeek = parentShiftISO(parentClassworkData?.weekStart || parentClassworkWeek, -7);
    loadParentWeeklyClasswork(studentId);
  });
  document.getElementById('parent-week-next')?.addEventListener('click', () => {
    parentClassworkWeek = parentShiftISO(parentClassworkData?.weekStart || parentClassworkWeek, 7);
    loadParentWeeklyClasswork(studentId);
  });
}

async function loadParentWeeklyClasswork(studentId) {
  const label = document.getElementById('parent-week-label');
  const tableWrap = document.getElementById('parent-classwork-table');
  if (label) label.textContent = 'Loading…';
  try {
    const res = await fetch(
      `${API_URL}/parent/child/${studentId}/analytics/classwork?week=${encodeURIComponent(parentClassworkWeek || parentTodayISO())}`,
      { headers: getAuthHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load weekly classwork');
    parentClassworkData = data;
    parentClassworkWeek = data.weekStart;
    if (label) label.textContent = parentFmtRangeLabel(data.weekStart, data.weekEnd);
    paintParentClassworkChart();
  } catch (err) {
    console.error('Weekly classwork error:', err);
    if (label) label.textContent = parentFmtRangeLabel(parentClassworkWeek, parentShiftISO(parentClassworkWeek, 6));
    parentChartUnavailable('parent-classwork-chart-wrap', 'Could not load classwork results.');
    if (tableWrap) tableWrap.innerHTML = '';
  }
}

function paintParentClassworkChart() {
  const wrap = document.getElementById('parent-classwork-chart-wrap');
  const tableWrap = document.getElementById('parent-classwork-table');
  if (!wrap) return;
  const items = parentClassworkData?.items || [];

  if (!items.length) {
    if (parentCharts.classwork) { parentCharts.classwork.destroy(); delete parentCharts.classwork; }
    wrap.innerHTML = '<p class="parent-chart-empty">No classwork recorded this week.</p>';
    if (tableWrap) tableWrap.innerHTML = '';
    return;
  }

  const Chart = parentChartLib();
  if (!Chart) {
    parentChartUnavailable('parent-classwork-chart-wrap');
  } else {
    if (!document.getElementById('parent-classwork-chart')) {
      wrap.innerHTML = '<canvas id="parent-classwork-chart" aria-label="Classwork results this week" role="img"></canvas>';
    }
    const canvas = document.getElementById('parent-classwork-chart');
    const typeColor = { quiz: '#2e7d32', activity: '#e67e22', exam: '#60100b' };
    if (parentCharts.classwork) { parentCharts.classwork.destroy(); delete parentCharts.classwork; }
    parentCharts.classwork = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: items.map((it) => it.title),
        datasets: [{
          label: 'Score %',
          data: items.map((it) => it.percent),
          backgroundColor: items.map((it) => typeColor[it.type] || '#8a726b'),
          borderRadius: 6,
          maxBarThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` }, grid: { color: 'rgba(93,17,13,0.08)' } },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11 },
              callback(value) {
                const s = String(this.getLabelForValue(value));
                return s.length > 18 ? `${s.slice(0, 17)}…` : s;
              }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const it = items[item.dataIndex];
                const type = it.type === 'quiz' ? 'Quiz' : it.type === 'activity' ? 'Activity' : 'Exam';
                return [`${type}${it.subject_name ? ` · ${it.subject_name}` : ''}`, `Score: ${it.score} / ${it.max_score} (${it.percent}%)`];
              }
            }
          }
        }
      }
    });
  }

  if (tableWrap) {
    tableWrap.innerHTML = `
      <p class="page-subheading" style="margin:0 0 6px;">Average this week: <strong>${parentClassworkData.average}%</strong> · ${items.length} item${items.length === 1 ? '' : 's'}</p>
      <table class="parent-mini-table">
        <thead><tr><th>Name</th><th>Type</th><th>Subject</th><th>Score</th><th>%</th></tr></thead>
        <tbody>
          ${items.map((it) => `
            <tr>
              <td>${escapeHtml(it.title)}</td>
              <td><span class="badge type-${escapeHtml(it.type)}">${it.type === 'quiz' ? 'Quiz' : it.type === 'activity' ? 'Activity' : 'Exam'}</span></td>
              <td>${escapeHtml(it.subject_name || '—')}</td>
              <td>${it.score} / ${it.max_score}</td>
              <td>${it.percent}%</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }
}

/* --- Attendance summary (pie) --- */

const PARENT_ATT_RANGE_OPTS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'School Year' }
];

function paintParentAttRangeFilters(studentId) {
  paintParentChipFilters('parent-att-range-filters', PARENT_ATT_RANGE_OPTS, parentAttRange, (v) => {
    parentAttRange = v || 'month';
    paintParentAttRangeFilters(studentId);
    loadParentAttendanceSummary(studentId);
  });
}

async function loadParentAttendanceSummary(studentId) {
  paintParentAttRangeFilters(studentId);
  const stats = document.getElementById('parent-att-stats');
  try {
    const res = await fetch(
      `${API_URL}/parent/child/${studentId}/analytics/attendance?range=${encodeURIComponent(parentAttRange)}&date=${encodeURIComponent(parentTodayISO())}`,
      { headers: getAuthHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load attendance summary');
    parentAttSummaryData = data;
    paintParentAttendancePie();
  } catch (err) {
    console.error('Attendance summary error:', err);
    parentAttSummaryData = null;
    if (parentCharts.attendance) { parentCharts.attendance.destroy(); delete parentCharts.attendance; }
    parentChartUnavailable('parent-att-pie-wrap', 'Could not load attendance summary.');
    if (stats) stats.innerHTML = '';
  }
}

function paintParentAttendancePie() {
  const data = parentAttSummaryData;
  const stats = document.getElementById('parent-att-stats');
  const wrap = document.getElementById('parent-att-pie-wrap');
  if (!data || !wrap) return;

  const rangeLabel = data.range === 'year'
    ? `School Year ${data.schoolYear || ''}`.trim()
    : parentFmtRangeLabel(data.from, data.to);

  if (!data.totalMarks) {
    if (parentCharts.attendance) { parentCharts.attendance.destroy(); delete parentCharts.attendance; }
    wrap.innerHTML = '<p class="parent-chart-empty">No attendance recorded for this period.</p>';
    if (stats) {
      stats.innerHTML = `
        <div class="parent-att-range">${escapeHtml(rangeLabel)}</div>
        <div class="parent-att-stat"><span>Total school days</span><strong>0</strong></div>`;
    }
    return;
  }

  const Chart = parentChartLib();
  if (!Chart) {
    wrap.innerHTML = '<p class="parent-chart-empty">Charts are unavailable right now.</p>';
  } else {
    if (!document.getElementById('parent-attendance-pie')) {
      wrap.innerHTML = '<canvas id="parent-attendance-pie" aria-label="Attendance breakdown" role="img"></canvas>';
    }
    const canvas = document.getElementById('parent-attendance-pie');
    if (parentCharts.attendance) { parentCharts.attendance.destroy(); delete parentCharts.attendance; }
    parentCharts.attendance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Present', 'Late', 'Absent', 'Excused'],
        datasets: [{
          data: [data.present, data.late, data.absent, data.excused],
          backgroundColor: [PARENT_ATT_COLORS.present, PARENT_ATT_COLORS.late, PARENT_ATT_COLORS.absent, PARENT_ATT_COLORS.excused],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const n = Number(item.raw) || 0;
                const pct = data.totalMarks ? Math.round((n / data.totalMarks) * 100) : 0;
                return ` ${item.label}: ${n} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  if (stats) {
    const row = (key, label) => `
      <div class="parent-att-stat">
        <span><i class="parent-att-dot" style="background:${PARENT_ATT_COLORS[key]}"></i>${label}</span>
        <strong>${Number(data[key]) || 0}</strong>
      </div>`;
    stats.innerHTML = `
      <div class="parent-att-range">${escapeHtml(rangeLabel)}</div>
      ${row('present', 'Present')}
      ${row('late', 'Late')}
      ${row('absent', 'Absent')}
      ${row('excused', 'Excused')}
      <div class="parent-att-stat parent-att-stat--total"><span>Total school days</span><strong>${data.totalSchoolDays}</strong></div>
      <div class="parent-att-stat"><span>Attendance rate</span><strong>${data.attendanceRate}%</strong></div>`;
  }
}

async function loadParentAiSummary(studentId) {
  const el = document.getElementById('parent-ai-summary');
  if (!el) return;
  try {
    const res = await fetch(`${API_URL}/parent/child/${studentId}/insights`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load summary');
    const bullets = Array.isArray(data.bullets) ? data.bullets.filter(Boolean) : [];
    if (bullets.length) {
      el.innerHTML = `<ul class="parent-insight-list">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
    } else {
      el.textContent = data.text || 'Insights will appear here once attendance or scores are recorded.';
    }
  } catch {
    el.textContent = 'Could not load the progress summary right now.';
  }
}

let parentAttendanceCache = [];
let parentAttPeriodMode = 'month';   // week | month | year
let parentAttPeriod = '';            // period key for the mode, '' = all
let parentAttPeriodInitialized = false;
let parentAttPage = 1;

// Records tab state
let parentProgressCache = null;      // records from /progress (null = not loaded)
let parentProgressAverageAll = 0;
let parentProgressSubject = 'all';   // 'all' | subject name
let parentProgressType = 'all';      // all | quiz | activity | exam
let parentProgressPeriodMode = 'month';
let parentProgressPeriod = '';       // '' = all
let parentProgressPage = 1;
let parentProgressSubjectMenuApi = null;
let parentProgressTypeMenuApi = null;
let parentProgressPeriodFilterApi = null;
let parentAttendanceStatus = 'all'; // all | Late | Absent | Present
let parentAttStatusMenuApi = null;
let parentAttPeriodFilterApi = null;

const PARENT_PAGE_SIZE = 10;

/* ---------- Shared period / pagination helpers (parent tabs) ---------- */

function parentDateFromAny(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value);
  // Plain YYYY-MM-DD: build local date (avoid UTC day shift)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parentLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Bucket key for a date: week -> Monday ISO, month -> YYYY-MM, year -> school year 'YYYY-YYYY' (Jun–May). */
function parentPeriodKey(value, mode) {
  const d = parentDateFromAny(value);
  if (!d) return '';
  if (mode === 'week') {
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    const offset = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
    return parentLocalISO(mon);
  }
  if (mode === 'year') {
    const y1 = d.getMonth() + 1 >= 6 ? d.getFullYear() : d.getFullYear() - 1;
    return `${y1}-${y1 + 1}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parentPeriodModeLabel(mode, plural = false) {
  if (mode === 'week') return plural ? 'weeks' : 'week';
  if (mode === 'year') return plural ? 'school years' : 'school year';
  return plural ? 'months' : 'month';
}

function parentPeriodLabel(key, mode) {
  if (!key) return `All ${parentPeriodModeLabel(mode, true)}`;
  if (mode === 'week') {
    const start = parentDateFromAny(key);
    if (!start) return key;
    const endD = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(endD)}, ${endD.getFullYear()}`;
  }
  if (mode === 'year') return `SY ${key}`;
  return parentAttendanceMonthLabel(key);
}

/** Dropdown options for a mode: 'All' first, then periods found in records (plus the current one), newest first. */
function parentPeriodOptions(records, mode, dateGetter) {
  const keys = new Set();
  (records || []).forEach((r) => {
    const k = parentPeriodKey(dateGetter(r), mode);
    if (k) keys.add(k);
  });
  keys.add(parentPeriodKey(new Date(), mode));
  const sorted = [...keys].sort((a, b) => b.localeCompare(a));
  return [
    { value: '', label: parentPeriodLabel('', mode) },
    ...sorted.map((k) => ({ value: k, label: parentPeriodLabel(k, mode) }))
  ];
}

const PARENT_PERIOD_MODES = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'School Year' }
];

/**
 * Week / Month / School Year chips + one dropdown of periods for the active mode.
 * Picking a mode jumps to the current period of that mode.
 */
function wireParentPeriodFilter({ chipsId, menuId, btnId, panelId, getMode, setMode, getPeriod, setPeriod, onChange }) {
  const chips = document.getElementById(chipsId);
  const menuApi = wireDownloadSelectMenu({
    menuId,
    btnId,
    panelId,
    options: [],
    getValue: () => getPeriod(),
    setValue: (v) => setPeriod(v || ''),
    emptyLabel: 'No periods',
    onPick: () => onChange()
  });

  function paintChips() {
    if (!chips) return;
    chips.innerHTML = PARENT_PERIOD_MODES.map((m) => {
      const active = m.value === getMode();
      return `<button type="button" class="chip-ghost${active ? ' is-pressed' : ''}" data-mode="${m.value}" aria-pressed="${active}">${m.label}</button>`;
    }).join('');
    chips.querySelectorAll('button[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.mode === getMode()) return;
        setMode(btn.dataset.mode);
        setPeriod(parentPeriodKey(new Date(), btn.dataset.mode));
        paintChips();
        onChange();
      });
    });
  }

  paintChips();
  return {
    setOptions(opts) {
      if (menuApi) menuApi.setOptions(opts);
    },
    sync() {
      paintChips();
      if (menuApi) menuApi.sync();
    }
  };
}

function paginate(list, page, size = PARENT_PAGE_SIZE) {
  const arr = Array.isArray(list) ? list : [];
  const total = arr.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (p - 1) * size;
  return {
    rows: arr.slice(start, start + size),
    page: p,
    pages,
    total,
    from: total ? start + 1 : 0,
    to: Math.min(total, start + size)
  };
}

function parentPagerHtml(id, pager) {
  if (!pager || pager.pages <= 1) return '';
  const nums = [];
  const win = 2;
  for (let i = 1; i <= pager.pages; i += 1) {
    if (i === 1 || i === pager.pages || Math.abs(i - pager.page) <= win) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  const btn = (label, page, { disabled = false, active = false, aria = '' } = {}) =>
    `<button type="button" class="chip-ghost parent-pager-btn${active ? ' is-pressed' : ''}" data-page="${page}"${disabled ? ' disabled' : ''}${aria ? ` aria-label="${aria}"` : ''}${active ? ' aria-current="page"' : ''}>${label}</button>`;
  return `
    <div class="parent-pager" id="${id}">
      <span class="parent-pager-info">Showing ${pager.from}–${pager.to} of ${pager.total}</span>
      <div class="parent-pager-btns">
        ${btn('‹', pager.page - 1, { disabled: pager.page <= 1, aria: 'Previous page' })}
        ${nums.map((n) => (n === '…'
          ? '<span class="parent-pager-ellipsis">…</span>'
          : btn(String(n), n, { active: n === pager.page }))).join('')}
        ${btn('›', pager.page + 1, { disabled: pager.page >= pager.pages, aria: 'Next page' })}
      </div>
    </div>`;
}

function wireParentPager(id, onPage) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelectorAll('button[data-page]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.disabled) return;
      onPage(Number(b.dataset.page));
    });
  });
}

function parentAttendanceWhenLabel(r) {
  return r.subject_name
    ? r.subject_name
    : (r.session === 'PM' ? 'Afternoon' : 'Morning');
}

function parentAttendanceMonthKey(r) {
  if (!r?.date) return '';
  const d = new Date(r.date);
  if (Number.isNaN(d.getTime())) {
    const s = String(r.date).slice(0, 7);
    return /^\d{4}-\d{2}$/.test(s) ? s : '';
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function parentAttendanceMonthOptions(records) {
  const keys = new Set();
  (records || []).forEach((r) => {
    const k = parentAttendanceMonthKey(r);
    if (k) keys.add(k);
  });
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  keys.add(current);
  return [...keys].sort((a, b) => b.localeCompare(a));
}

function parentAttendanceMonthLabel(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || '';
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function parentAttendanceISO(value) {
  const d = parentDateFromAny(value);
  return d ? parentLocalISO(d) : '';
}

function parentAttendanceIsWeekday(value) {
  const iso = parentAttendanceISO(value);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay();
  return day >= 1 && day <= 5;
}

function parentAttendanceDisplayDate(value) {
  const iso = parentAttendanceISO(value);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '-';
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString();
}

function filterParentAttendanceRecords(records, { month = '', mode = '', period = '', status = 'all', weekdaysOnly = false, limit = null } = {}) {
  let list = Array.isArray(records) ? [...records] : [];
  list.sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    if (db !== da) return db - da; // newest date first
    // Same day: PM (later) above AM
    const sa = String(a.session || '').toUpperCase() === 'PM' ? 0
      : String(a.session || '').toUpperCase() === 'AM' ? 1 : 2;
    const sb = String(b.session || '').toUpperCase() === 'PM' ? 0
      : String(b.session || '').toUpperCase() === 'AM' ? 1 : 2;
    if (sa !== sb) return sa - sb;
    const subA = String(a.subject_name || '').toLowerCase();
    const subB = String(b.subject_name || '').toLowerCase();
    return subA.localeCompare(subB);
  });
  if (month) list = list.filter((r) => parentAttendanceMonthKey(r) === month);
  if (mode && period) list = list.filter((r) => parentPeriodKey(r.date, mode) === period);
  if (status && status !== 'all') {
    list = list.filter((r) => String(r.status || '').toLowerCase() === String(status).toLowerCase());
  }
  if (weekdaysOnly) list = list.filter((r) => parentAttendanceIsWeekday(r.date));
  if (limit != null) list = list.slice(0, limit);
  return list;
}


function recentParentAttendance(records) {
  const weekdays = (Array.isArray(records) ? records : []).filter((row) => parentAttendanceIsWeekday(row.date));
  let newest = '';
  for (const row of weekdays) {
    const iso = parentAttendanceISO(row.date);
    if (iso > newest) newest = iso;
  }
  if (!newest) return [];
  const monday = parentPeriodKey(newest, 'week');
  const friday = parentShiftISO(monday, 4);
  const week = weekdays.filter((row) => {
    const iso = parentAttendanceISO(row.date);
    return iso >= monday && iso <= friday;
  });
  return filterParentAttendanceRecords(week, { limit: 10 });
}

function parentAttendanceRowsHtml(records) {
  return records.map((r) => {
    const when = escapeHtml(parentAttendanceWhenLabel(r));
    const dateStr = parentAttendanceDisplayDate(r.date);
    const status = r.status || '-';
    const rowTint = status === 'Absent'
      ? 'background:rgba(183,28,28,0.08);'
      : status === 'Late'
        ? 'background:rgba(230,126,34,0.08);'
        : status === 'Excused'
          ? 'background:rgba(100,116,139,0.1);'
          : '';
    return `
      <tr style="${rowTint}">
        <td>${dateStr}</td>
        <td>${when}</td>
        <td><span class="badge ${(status || '').toLowerCase()}">${escapeHtml(status)}</span></td>
      </tr>`;
  }).join('');
}

function parentAttendanceTableHtml(records, { emptyText = 'No attendance records yet.' } = {}) {
  if (!records.length) {
    return `<p style="color:var(--text-muted);font-size:0.84rem;margin:0;">${escapeHtml(emptyText)}</p>`;
  }
  return `
    <table style="width:100%;font-size:0.82rem;">
      <thead style="background:var(--maroon-header);color:#fff;">
        <tr><th>Date</th><th>Session / Subject</th><th>Status</th></tr>
      </thead>
      <tbody>${parentAttendanceRowsHtml(records)}</tbody>
    </table>`;
}

async function fetchParentAttendance(studentId) {
  const res = await fetch(`${API_URL}/parent/child/${studentId}/attendance`, { headers: getAuthHeaders() });
  const records = await res.json();
  if (!res.ok) throw new Error(records.error);
  return Array.isArray(records) ? records : [];
}

async function loadParentAttendanceTable(studentId) {
  const wrap = document.getElementById('parent-attendance-table-wrap');
  if (!wrap) return;

  try {
    const records = await fetchParentAttendance(studentId);
    parentAttendanceCache = records;
    const recent = recentParentAttendance(records);
    wrap.innerHTML = parentAttendanceTableHtml(recent, {
      emptyText: 'No attendance records yet.'
    });
    const seeMore = document.getElementById('parent-attendance-see-more');
    if (seeMore) seeMore.hidden = records.length === 0;
  } catch (err) {
    wrap.innerHTML = '<p style="color:#b71c1c;font-size:0.84rem;">Failed to load attendance</p>';
  }
}

function syncParentPrintButton(tabId) {
  const btn = document.getElementById('parent-print-btn');
  if (!btn) return;
  const hide = tabId === 'inbox' || tabId === 'contact';
  btn.hidden = hide;
  if (hide) btn.setAttribute('hidden', '');
  else btn.removeAttribute('hidden');
}

document.querySelectorAll('[data-parent-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const currentTab = document.querySelector('[data-parent-tab].active')?.dataset.parentTab;
    const tabId = btn.dataset.parentTab;
    syncParentPrintButton(tabId);

    if (!isParentNavigatingBack && currentTab && currentTab !== tabId) {
      resetParentTabState(currentTab);
      parentTabHistory.push(currentTab);
      updateParentBackButton();
    }
    isParentNavigatingBack = false;

    document.querySelectorAll('[data-parent-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const contentEl = document.getElementById('parent-content');
    if (!contentEl || !parentCurrentChild) return;

    if (tabId === 'overview') renderParentOverview(parentCurrentChild);
    else if (tabId === 'attendance') renderParentAttendance(parentCurrentChild);
    else if (tabId === 'progress') renderParentProgress(parentCurrentChild);
    else if (tabId === 'inbox' || tabId === 'contact') renderParentInbox();
    else {
      contentEl.innerHTML = `
        <div class="empty-state">
          <p>${tabId.charAt(0).toUpperCase() + tabId.slice(1)} coming soon.</p>
        </div>`;
    }
    scrollPortalMain('view-parent');
    closeMobileNav();
  });
});

function renderParentAttendance(student) {
  const contentEl = document.getElementById('parent-content');
  if (!contentEl) return;

  if (!parentAttPeriodMode) parentAttPeriodMode = 'month';
  if (!parentAttPeriodInitialized) {
    // First visit: show the current period (matches the old "current month" default)
    parentAttPeriod = parentPeriodKey(new Date(), parentAttPeriodMode);
    parentAttPeriodInitialized = true;
  }
  if (!parentAttendanceStatus) parentAttendanceStatus = 'all';

  const statusOpts = [
    { value: 'all', label: 'All statuses' },
    { value: 'Late', label: 'Late' },
    { value: 'Absent', label: 'Absent' },
    { value: 'Excused', label: 'Excused' },
    { value: 'Present', label: 'Present' }
  ];

  contentEl.innerHTML = `
    <div class="parent-main">
      <div class="chart-card">
        <div class="teacher-header-row">
          <div>
            <h3 class="page-heading font-heading">Attendance Records</h3>
            <p class="page-subheading">Newest first. Filter by status, week, month, or school year.</p>
          </div>
        </div>
        <div class="parent-att-toolbar">
          <div class="download-menu" id="parent-att-status-menu">
            <button type="button" class="chip-ghost" id="parent-att-status-btn" aria-haspopup="true" aria-expanded="false">All Statuses ▾</button>
            <div class="download-menu-panel" id="parent-att-status-panel" hidden></div>
          </div>
          <div class="parent-period-filter parent-att-menu--right">
            <div class="parent-period-chips" id="parent-att-period-chips" role="group" aria-label="Period type"></div>
            <div class="download-menu" id="parent-att-period-menu">
              <button type="button" class="chip-ghost" id="parent-att-period-btn" aria-haspopup="true" aria-expanded="false">Period ▾</button>
              <div class="download-menu-panel download-menu-panel--scroll" id="parent-att-period-panel" hidden></div>
            </div>
          </div>
        </div>
        <div id="parent-attendance-full" style="margin-top:8px;">
          <p style="color:var(--text-muted);">Loading…</p>
        </div>
        <div id="parent-attendance-pager-wrap"></div>
      </div>
    </div>`;

  parentAttStatusMenuApi = wireDownloadSelectMenu({
    menuId: 'parent-att-status-menu',
    btnId: 'parent-att-status-btn',
    panelId: 'parent-att-status-panel',
    options: statusOpts,
    getValue: () => parentAttendanceStatus,
    setValue: (v) => { parentAttendanceStatus = v || 'all'; },
    onPick: () => { parentAttPage = 1; paintParentAttendanceFull(); }
  });

  parentAttPeriodFilterApi = wireParentPeriodFilter({
    chipsId: 'parent-att-period-chips',
    menuId: 'parent-att-period-menu',
    btnId: 'parent-att-period-btn',
    panelId: 'parent-att-period-panel',
    getMode: () => parentAttPeriodMode,
    setMode: (m) => { parentAttPeriodMode = m; },
    getPeriod: () => parentAttPeriod,
    setPeriod: (p) => { parentAttPeriod = p; },
    onChange: () => { parentAttPage = 1; paintParentAttendanceFull(); }
  });

  loadParentAttendanceFull(student.id);
}

function paintParentAttendanceFull() {
  const wrap = document.getElementById('parent-attendance-full');
  const pagerWrap = document.getElementById('parent-attendance-pager-wrap');
  if (!wrap) return;

  const options = parentPeriodOptions(parentAttendanceCache, parentAttPeriodMode, (r) => r.date);
  if (parentAttPeriod && !options.some((o) => o.value === parentAttPeriod)) parentAttPeriod = '';
  if (parentAttPeriodFilterApi) {
    parentAttPeriodFilterApi.setOptions(options);
    parentAttPeriodFilterApi.sync();
  }

  const filtered = filterParentAttendanceRecords(parentAttendanceCache, {
    mode: parentAttPeriodMode,
    period: parentAttPeriod,
    status: parentAttendanceStatus
  });

  const pager = paginate(filtered, parentAttPage);
  parentAttPage = pager.page;

  const statusBit = parentAttendanceStatus === 'all' ? '' : ` ${parentAttendanceStatus.toLowerCase()}`;
  const periodBit = parentAttPeriod
    ? `for ${parentPeriodLabel(parentAttPeriod, parentAttPeriodMode)}`
    : 'yet';
  wrap.innerHTML = parentAttendanceTableHtml(pager.rows, {
    emptyText: `No${statusBit} attendance records ${periodBit}.`
  });
  if (pagerWrap) {
    pagerWrap.innerHTML = parentPagerHtml('parent-attendance-pager', pager);
    wireParentPager('parent-attendance-pager', (p) => { parentAttPage = p; paintParentAttendanceFull(); });
  }
}

async function loadParentAttendanceFull(studentId) {
  const wrap = document.getElementById('parent-attendance-full');
  if (!wrap) return;
  try {
    parentAttendanceCache = await fetchParentAttendance(studentId);
    paintParentAttendanceFull();
  } catch (err) {
    wrap.innerHTML = '<p style="color:#b71c1c;">Failed to load</p>';
  }
}

function renderParentProgress(student) {
  const contentEl = document.getElementById('parent-content');
  if (!contentEl) return;
  contentEl.innerHTML = `
    <div class="parent-main">
      <div class="chart-card">
        <div class="teacher-header-row">
          <div>
            <h3 class="page-heading font-heading">Records</h3>
            <p class="page-subheading" id="parent-progress-avg">Loading scores…</p>
          </div>
        </div>
        <div class="parent-att-toolbar">
          <div class="download-menu" id="parent-progress-subject-menu">
            <button type="button" class="chip-ghost" id="parent-progress-subject-btn" aria-haspopup="true" aria-expanded="false">All subjects ▾</button>
            <div class="download-menu-panel download-menu-panel--scroll" id="parent-progress-subject-panel" hidden></div>
          </div>
          <div class="download-menu" id="parent-progress-type-menu">
            <button type="button" class="chip-ghost" id="parent-progress-type-btn" aria-haspopup="true" aria-expanded="false">All types ▾</button>
            <div class="download-menu-panel" id="parent-progress-type-panel" hidden></div>
          </div>
          <div class="parent-period-filter parent-att-menu--right">
            <div class="parent-period-chips" id="parent-progress-period-chips" role="group" aria-label="Date taken"></div>
            <div class="download-menu" id="parent-progress-period-menu">
              <button type="button" class="chip-ghost" id="parent-progress-period-btn" aria-haspopup="true" aria-expanded="false">Period ▾</button>
              <div class="download-menu-panel download-menu-panel--scroll" id="parent-progress-period-panel" hidden></div>
            </div>
          </div>
        </div>
        <div id="parent-progress-table-wrap" class="records-table-wrapper" style="margin-top:8px;padding-left:0;padding-right:0;"></div>
        <div id="parent-progress-pager-wrap"></div>
      </div>
    </div>`;

  parentProgressSubjectMenuApi = wireDownloadSelectMenu({
    menuId: 'parent-progress-subject-menu',
    btnId: 'parent-progress-subject-btn',
    panelId: 'parent-progress-subject-panel',
    options: [{ value: 'all', label: 'All subjects' }],
    getValue: () => parentProgressSubject,
    setValue: (v) => { parentProgressSubject = v || 'all'; },
    onPick: () => { parentProgressPage = 1; paintParentProgress(); }
  });

  parentProgressTypeMenuApi = wireDownloadSelectMenu({
    menuId: 'parent-progress-type-menu',
    btnId: 'parent-progress-type-btn',
    panelId: 'parent-progress-type-panel',
    options: [
      { value: 'all', label: 'All types' },
      { value: 'quiz', label: 'Quiz' },
      { value: 'activity', label: 'Activity' },
      { value: 'exam', label: 'Exam' }
    ],
    getValue: () => parentProgressType,
    setValue: (v) => { parentProgressType = v || 'all'; },
    onPick: () => { parentProgressPage = 1; paintParentProgress(); }
  });

  parentProgressPeriodFilterApi = wireParentPeriodFilter({
    chipsId: 'parent-progress-period-chips',
    menuId: 'parent-progress-period-menu',
    btnId: 'parent-progress-period-btn',
    panelId: 'parent-progress-period-panel',
    getMode: () => parentProgressPeriodMode,
    setMode: (m) => { parentProgressPeriodMode = m; },
    getPeriod: () => parentProgressPeriod,
    setPeriod: (p) => { parentProgressPeriod = p; },
    onChange: () => { parentProgressPage = 1; paintParentProgress(); }
  });

  loadParentProgress(student.id);
}

function renderParentQuizTakenItem(item) {
  const n = Number(item.n) || 1;
  const isId = isIdentificationTakenItem(item);
  const choices = isId ? [] : (Array.isArray(item.choices) ? item.choices : []);
  const given = formatQuizTakenAnswer(item.given, choices);
  const expected = formatQuizTakenAnswer(item.expected, choices);
  const mark = item.correct === true ? 'Correct' : item.correct === false ? 'Incorrect' : '';
  const markHtml = mark ? ` <span class="page-subheading">${escapeHtml(mark)}</span>` : '';
  const choiceHtml = choices.length
    ? `<p class="page-subheading" style="margin:0 0 4px;"><strong>Choices:</strong></p>
       <ul class="progress-quiz-choices">${choices.map((c, i) => {
         const body = stripMcqChoicePrefix(c) || String(c || '');
         return `<li>${escapeHtml(mcqLetterAt(i))}. ${escapeHtml(body)}</li>`;
       }).join('')}</ul>`
    : '';
  return `<div class="progress-work-item">
    <p class="page-subheading" style="margin:0 0 8px;"><strong>Item ${n}</strong>${markHtml}</p>
    <p style="margin:0 0 8px;font-size:0.86rem;"><strong>Question:</strong> ${escapeHtml(item.question || '')}</p>
    ${choiceHtml}
    <p class="progress-activity-work"><strong>Your child's answer:</strong> ${given ? escapeHtml(given) : '—'}</p>
    <p class="progress-activity-work" style="margin-bottom:0;"><strong>Correct answer:</strong> ${expected ? escapeHtml(expected) : '—'}</p>
  </div>`;
}

function renderParentActivityWorkItem(item, index) {
  const url = String(item.file?.url || '');
  const safeUrl = url.startsWith('/uploads/') ? url : '';
  const fileHtml = safeUrl
    ? `<p style="margin:0;"><a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${escapeHtml(item.file.name || 'Open file')}</a></p>`
    : '';
  const text = String(item.text || '').trim();
  return `<div class="progress-work-item">
    <p class="page-subheading" style="margin:0 0 6px;"><strong>Activity ${index + 1}</strong></p>
    ${item.question ? `<p style="margin:0 0 8px;font-size:0.86rem;">${escapeHtml(item.question)}</p>` : ''}
    ${text ? `<p class="progress-activity-work">${escapeHtml(text)}</p>` : '<p class="page-subheading">No written answer.</p>'}
    ${fileHtml}
  </div>`;
}

window.viewParentWork = async function (assessmentId) {
  const student = parentCurrentChild;
  if (!student?.id) return;
  const titleEl = document.getElementById('progress-activity-work-title');
  const subEl = document.getElementById('progress-activity-work-sub');
  const bodyEl = document.getElementById('progress-activity-work-body');
  if (titleEl) titleEl.textContent = 'Submitted work';
  if (subEl) subEl.textContent = 'Loading…';
  if (bodyEl) bodyEl.innerHTML = '';
  openAdminModal('progress-activity-work-modal');
  try {
    const res = await fetch(
      `${API_URL}/parent/child/${student.id}/progress/${assessmentId}/work`,
      { headers: getAuthHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load submitted work');
    const kind = String(data.type || '').toLowerCase();
    const quiz = Array.isArray(data.quiz_taken) ? data.quiz_taken : [];
    const work = Array.isArray(data.activity_work) ? data.activity_work : [];
    if (titleEl) {
      const child = parentCurrentChild;
      const childName = child
        ? `${child.last_name || ''}, ${child.first_name || ''}`.replace(/^,\s*/, '').trim()
        : '';
      titleEl.textContent = childName || data.title || 'Submitted work';
    }
    if (subEl) {
      const submitted = kind === 'activity'
        ? 'Submitted from the live activity link.'
        : kind === 'exam'
          ? 'Submitted from the live exam link.'
          : 'Submitted from the live quiz link.';
      const quizTitle = String(data.title || '').trim();
      subEl.textContent = quizTitle ? `${quizTitle}. ${submitted}` : submitted;
    }
    if (!bodyEl) return;
    const parts = [];
    const box = identificationAnswerBoxHtml(data.identification_bank);
    if (quiz.length) parts.push(quizTakenHtmlWithAnswerBox(quiz, box, renderParentQuizTakenItem));
    if (work.length) parts.push(work.map((item, i) => renderParentActivityWorkItem(item, i)).join(''));
    bodyEl.innerHTML = parts.join('') || '<p class="page-subheading">No submitted work.</p>';
  } catch (err) {
    if (subEl) subEl.textContent = '';
    if (bodyEl) bodyEl.innerHTML = `<p class="page-subheading">${escapeHtml(err.message || 'Could not load submitted work')}</p>`;
  }
};

function parentProgressTypeLabel(type) {
  return type === 'quiz' ? 'Quiz' : type === 'activity' ? 'Activity' : 'Exam';
}

function parentProgressSubjectOptions(records) {
  const names = new Set();
  (records || []).forEach((r) => {
    const n = String(r.subject_name || '').trim();
    if (n) names.add(n);
  });
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  const opts = [{ value: 'all', label: 'All subjects' }, ...sorted.map((n) => ({ value: n, label: n }))];
  if ((records || []).some((r) => !String(r.subject_name || '').trim())) {
    opts.push({ value: '__none__', label: 'No subject' });
  }
  return opts;
}

function filterParentProgressRecords(records, { subject = 'all', type = 'all', mode = '', period = '' } = {}) {
  let list = Array.isArray(records) ? [...records] : [];
  list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  if (subject && subject !== 'all') {
    list = subject === '__none__'
      ? list.filter((r) => !String(r.subject_name || '').trim())
      : list.filter((r) => String(r.subject_name || '').trim() === subject);
  }
  if (type && type !== 'all') list = list.filter((r) => String(r.type || '').toLowerCase() === type);
  if (mode && period) list = list.filter((r) => parentPeriodKey(r.created_at, mode) === period);
  return list;
}

function parentProgressAverage(records) {
  if (!records.length) return 0;
  return Math.round(records.reduce((s, r) => s + (Number(r.percent) || 0), 0) / records.length);
}

async function loadParentProgress(studentId) {
  const wrap = document.getElementById('parent-progress-table-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<p style="color:var(--text-muted);">Loading…</p>';
  try {
    const res = await fetch(`${API_URL}/parent/child/${studentId}/progress`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    parentProgressCache = data.records || [];
    parentProgressAverageAll = Number(data.average) || 0;
    paintParentProgress();
  } catch (err) {
    wrap.innerHTML = '<p style="color:#b71c1c;">Failed to load progress</p>';
    const avgEl = document.getElementById('parent-progress-avg');
    if (avgEl) avgEl.textContent = 'Could not load scores.';
  }
}

function paintParentProgress() {
  const wrap = document.getElementById('parent-progress-table-wrap');
  const pagerWrap = document.getElementById('parent-progress-pager-wrap');
  const avgEl = document.getElementById('parent-progress-avg');
  if (!wrap) return;
  const records = parentProgressCache || [];

  // Refresh filter options from the data
  const subjectOpts = parentProgressSubjectOptions(records);
  if (parentProgressSubject !== 'all' && !subjectOpts.some((o) => o.value === parentProgressSubject)) {
    parentProgressSubject = 'all';
  }
  if (parentProgressSubjectMenuApi) parentProgressSubjectMenuApi.setOptions(subjectOpts);

  const periodOpts = parentPeriodOptions(records, parentProgressPeriodMode, (r) => r.created_at);
  if (parentProgressPeriod && !periodOpts.some((o) => o.value === parentProgressPeriod)) parentProgressPeriod = '';
  if (parentProgressPeriodFilterApi) {
    parentProgressPeriodFilterApi.setOptions(periodOpts);
    parentProgressPeriodFilterApi.sync();
  }

  if (!records.length) {
    if (avgEl) avgEl.textContent = 'No quiz, activity, or exam scores yet.';
    wrap.innerHTML = '<p style="color:var(--text-muted);">Teachers have not published scores for this student yet.</p>';
    if (pagerWrap) pagerWrap.innerHTML = '';
    return;
  }

  const filtered = filterParentProgressRecords(records, {
    subject: parentProgressSubject,
    type: parentProgressType,
    mode: parentProgressPeriodMode,
    period: parentProgressPeriod
  });
  const isFiltered = parentProgressSubject !== 'all' || parentProgressType !== 'all' || !!parentProgressPeriod;

  if (avgEl) {
    if (!filtered.length) {
      avgEl.textContent = `No items match these filters. Overall average: ${parentProgressAverageAll}% across ${records.length} item${records.length === 1 ? '' : 's'}.`;
    } else if (isFiltered) {
      avgEl.textContent = `Average across ${filtered.length} shown item${filtered.length === 1 ? '' : 's'}: ${parentProgressAverage(filtered)}% (overall ${parentProgressAverageAll}%)`;
    } else {
      avgEl.textContent = `Average across ${records.length} recorded item${records.length === 1 ? '' : 's'}: ${parentProgressAverageAll}%`;
    }
  }

  if (!filtered.length) {
    wrap.innerHTML = '<p style="color:var(--text-muted);">No quiz, activity, or exam matches the selected subject, type, or period.</p>';
    if (pagerWrap) pagerWrap.innerHTML = '';
    return;
  }

  const pager = paginate(filtered, parentProgressPage);
  parentProgressPage = pager.page;

  wrap.innerHTML = `
    <table style="width:100%;font-size:0.85rem;">
      <thead style="background:var(--maroon-header);color:#fff;">
        <tr><th>Date</th><th>Type</th><th>Title</th><th>Subject</th><th>Score</th><th>%</th><th>Work</th></tr>
      </thead>
      <tbody>
        ${pager.rows.map(r => `
          <tr>
            <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>
            <td><span class="badge type-${escapeHtml(r.type)}">${parentProgressTypeLabel(r.type)}</span></td>
            <td>${escapeHtml(r.title || '')}</td>
            <td>${escapeHtml(r.subject_name || '—')}</td>
            <td>${r.score} / ${r.max_score}</td>
            <td>${r.percent}%</td>
            <td class="progress-work-cell">${r.has_submission
              ? `<button type="button" class="chip-ghost" data-view-work="parent" data-assessment-id="${Number(r.id)}" onclick="viewParentWork(${Number(r.id)})">View Work</button>`
              : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  bindProgressWorkClicks(wrap);
  if (pagerWrap) {
    pagerWrap.innerHTML = parentPagerHtml('parent-progress-pager', pager);
    wireParentPager('parent-progress-pager', (p) => { parentProgressPage = p; paintParentProgress(); });
  }
}

function renderParentContact() {
  // Contact Teachers merged into Inbox
  renderParentInbox();
}

async function openParentConcernModal() {
  const modal = document.getElementById('parent-concern-modal');
  const form = document.getElementById('parent-concern-form');
  const msg = document.getElementById('parent-concern-msg');
  const studentSelect = document.getElementById('concern-student');
  if (!modal || !studentSelect) return;

  const children = parentAllChildren || [];
  const selectedId = parentCurrentChild?.id || children[0]?.id || '';
  studentSelect.innerHTML = children.length
    ? children.map((c) =>
      `<option value="${c.id}" ${String(c.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(c.last_name)}, ${escapeHtml(c.first_name)} (Grade ${c.grade_level}-${escapeHtml(c.section)})</option>`
    ).join('')
    : '<option value="">No linked students</option>';

  if (form) form.reset();
  // restore student after reset
  if (selectedId) studentSelect.value = String(selectedId);
  if (msg) {
    msg.hidden = true;
    msg.textContent = '';
  }
  document.getElementById('concern-subject').value = '';
  document.getElementById('concern-message').value = '';

  await loadContactTeachers(studentSelect.value);
  modal.hidden = false;
  modal.removeAttribute('hidden');
}

function closeParentConcernModal() {
  const modal = document.getElementById('parent-concern-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('hidden', '');
}

async function loadContactTeachers(studentId) {
  const select = document.getElementById('concern-teacher');
  if (!select) return;
  if (!studentId) {
    select.innerHTML = '<option value="">Select student first</option>';
    return;
  }
  select.innerHTML = '<option value="">Loading…</option>';
  try {
    const res = await fetch(`${API_URL}/parent/child/${studentId}/teachers`, { headers: getAuthHeaders() });
    const teachers = await res.json();
    if (!res.ok) throw new Error(teachers.error);
    if (!teachers.length) {
      select.innerHTML = '<option value="">No teachers assigned yet</option>';
      return;
    }
    select.innerHTML = teachers.map((t) =>
      `<option value="${t.id}">${escapeHtml(t.last_name)}, ${escapeHtml(t.first_name)} (${escapeHtml(t.role_label || 'Teacher')})</option>`
    ).join('');
  } catch (err) {
    select.innerHTML = '<option value="">Failed to load teachers</option>';
  }
}

async function submitParentConcern(e) {
  e.preventDefault();
  const msg = document.getElementById('parent-concern-msg');
  const payload = {
    student_id: document.getElementById('concern-student')?.value,
    teacher_id: document.getElementById('concern-teacher')?.value,
    subject: document.getElementById('concern-subject')?.value.trim(),
    message: document.getElementById('concern-message')?.value.trim()
  };
  if (!payload.student_id || !payload.teacher_id || !payload.message) {
    if (msg) {
      msg.hidden = false;
      msg.textContent = 'Please choose a student and teacher, then write a message.';
    }
    return;
  }
  try {
    const res = await fetch(`${API_URL}/parent/concerns`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    closeParentConcernModal();
    showToast('Concern sent to the teacher.');
    parentInboxFilter = 'unresolved';
    parentExpandedConcernId = data.id || null;
    renderParentInbox();
  } catch (err) {
    if (msg) {
      msg.hidden = false;
      msg.textContent = err.message;
    }
    showToast(err.message, 'error');
  }
}

let parentConcernFilter = 'unresolved';
let parentConcernSearchQuery = '';
let parentConcernsCache = [];

async function loadParentConcerns() {
  // Concerns now load with the unified Inbox
  if (document.querySelector('[data-parent-tab].active')?.dataset.parentTab === 'inbox') {
    renderParentInbox();
  }
}

function paintParentConcernsList() {
  paintParentInboxList();
}

window.toggleParentConcern = async function(id) {
  const concernId = Number(id);
  if (!concernId) return;
  if (Number(parentExpandedConcernId) === concernId) {
    parentExpandedConcernId = null;
    paintParentInboxList();
    return;
  }
  parentExpandedConcernId = concernId;
  parentExpandedInboxKey = null;
  await markConcernReadForRole(concernId);
  const cached = (parentInboxCache.concerns || parentConcernsCache || []).find((c) => Number(c.id) === concernId);
  if (cached) {
    cached.is_read = 1;
    cached.read_at = new Date().toISOString();
  }
  paintParentInboxList();
};

const parentObserver = new MutationObserver((mutations) => {
  mutations.forEach((m) => {
    if (m.type === 'attributes' && m.attributeName === 'hidden') {
      const view = m.target;
      if (!view.hidden && view.dataset.view === 'parent') {
        console.log('[Parent] View activated');
        loadParentDashboard();
        refreshParentInboxBadge();
      }
    }
  });
});

const parentView = document.getElementById('view-parent');
if (parentView) {
  parentObserver.observe(parentView, { attributes: true });
}

// ========== ADMIN VIEW OBSERVER ==========
const adminObserver = new MutationObserver((mutations) => {
  mutations.forEach((m) => {
    if (m.type === 'attributes' && m.attributeName === 'hidden') {
      const view = m.target;
      if (!view.hidden && view.dataset.view === 'admin') {
        console.log('[Admin] View activated');
        const activeTab = document.querySelector('[data-admin-tab].active')?.dataset.adminTab;
        if (activeTab === 'overview' || !activeTab) { loadOverviewStats(); loadActivityLog(); }
        else if (activeTab === 'accounts') loadAccountsTable();
        else if (activeTab === 'students') { loadDropdowns(); loadStudentsTable(); }
        else if (activeTab === 'subjects') loadSubjectsTable();
        else if (activeTab === 'inbox') loadAdminInbox();
        else if (activeTab === 'announcements') loadAdminAnnouncements();
      }
    }
  });
});

// ========== ADMIN EDIT PROFILE MODAL ==========
const adminEditProfileBtn = document.getElementById('admin-edit-profile-btn');
const adminProfileModal = document.getElementById('admin-profile-modal');
const adminProfileCancel = document.getElementById('admin-profile-cancel');
const adminProfileForm = document.getElementById('admin-profile-form');

if (adminEditProfileBtn && adminProfileModal) {
  adminEditProfileBtn.addEventListener('click', () => {
    adminProfileModal.removeAttribute('hidden');
    adminSettingsDropdown?.setAttribute('hidden', '');
  });
}

if (adminProfileCancel && adminProfileModal) {
  adminProfileCancel.addEventListener('click', () => {
    adminProfileModal.setAttribute('hidden', '');
  });
}

if (adminProfileForm) {
  adminProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const avatarFile = document.getElementById('admin-profile-avatar').files[0];
    let avatarUrl = null;
    let uploadErr = null;

    // Step 1: Upload avatar independently
    if (avatarFile) {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      try {
        const avatarRes = await fetch(`${API_URL}/upload/avatar`, {
          method: 'POST',
          headers: { 'Authorization': getAuthHeaders().Authorization },
          body: formData
        });

        const contentType = avatarRes.headers.get('content-type') || '';
        let avatarData;
        if (contentType.includes('application/json')) {
          avatarData = await avatarRes.json();
        } else {
          const text = await avatarRes.text();
          throw new Error(`Avatar upload returned HTML (status ${avatarRes.status})`);
        }

        if (avatarRes.ok && (avatarData.avatarUrl || avatarData.avatar_url)) {
          avatarUrl = avatarData.avatarUrl || avatarData.avatar_url;
        } else {
          uploadErr = avatarData.error || `Avatar upload failed (status ${avatarRes.status})`;
        }
      } catch (err) {
        uploadErr = err.message;
      }
    }

    // Step 2: Try to update profile info (backend may not have this endpoint yet)
    const payload = {
      first_name: document.getElementById('admin-profile-first').value.trim(),
      last_name: document.getElementById('admin-profile-last').value.trim(),
      email: document.getElementById('admin-profile-email').value.trim()
    };

    let profileSaved = false;
    let profileErr = null;

    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error('HTML_RESPONSE');
      }

      if (!res.ok) throw new Error(data.error || `Profile update failed`);
      profileSaved = true;

    } catch (err) {
      // If endpoint doesn't exist, we just skip it and update localStorage only
      if (err.message === 'HTML_RESPONSE' || err.message.includes('Failed to fetch')) {
        profileErr = 'Backend endpoint not found — saved locally only';
      } else {
        profileErr = err.message;
      }
    }

    // Step 3: Always update localStorage and UI regardless of backend availability
    const user = getAuthUser() || {};
    user.first_name = payload.first_name;
    user.last_name = payload.last_name;
    user.name = `${payload.first_name} ${payload.last_name}`;
    user.email = payload.email;
    if (avatarUrl) user.avatar_url = avatarUrl;
    persistAuthUser(user);

    // Update UI
    document.querySelectorAll('[data-user-name]').forEach(el => {
      el.textContent = user.name;
    });
    document.querySelectorAll('[data-user-initial]').forEach(el => {
      el.textContent = user.name.charAt(0).toUpperCase();
    });

    // Update avatar image immediately
    const avatarImg = document.getElementById('admin-topbar-avatar-img');
    if (avatarImg && avatarUrl) {
      avatarImg.src = avatarUrl + '?t=' + Date.now();
      avatarImg.style.display = 'block';
      const initialSpan = avatarImg.nextElementSibling;
      if (initialSpan) initialSpan.style.display = 'none';
    }

    // Clear file input
    document.getElementById('admin-profile-avatar').value = '';

    // Refresh from server to ensure avatar persists
    loadUserProfile();

    // Build status message
    let msg = 'Profile updated';
    if (avatarUrl && !uploadErr) msg += ' • Avatar saved';
    if (uploadErr) msg += ` • Avatar failed: ${uploadErr}`;
    if (!profileSaved && profileErr) msg += ` • ${profileErr}`;

    alert(msg);
    adminProfileModal.setAttribute('hidden', '');
  });
}

const adminView = document.getElementById('view-admin');
if (adminView) {
  adminObserver.observe(adminView, { attributes: true });
}

// ========== ADMIN: SUBJECTS ==========
const subjectForm = document.getElementById('admin-subject-form');
if (subjectForm) {
  subjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      code: document.getElementById('subject-code').value.trim().toUpperCase(),
      name: document.getElementById('subject-name').value.trim(),
      description: document.getElementById('subject-desc').value.trim(),
      applicable_grades: document.getElementById('subject-grades').value.trim()
    };
    try {
      const res = await fetch(`${API_URL}/subjects`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      e.target.reset();
      closeAdminModal('add-subject-modal', { reset: false });
      await refreshSchoolData({ subjects: true, teachers: true, overview: true });
    } catch (err) {
      alert(err.message);
    }
  });
}

let lastSubjectsData = [];
let currentSubjectGradeFilter = '';
let currentSubjectSearch = '';

function subjectDisplayName(s) {
  return s.name || s.subject_name || s.Name || 'Subject';
}

function subjectCoversGrade(applicableGrades, gradeLevel) {
  if (!gradeLevel) return true;
  if (!applicableGrades) return false;
  const grade = parseInt(gradeLevel, 10);
  if (Number.isNaN(grade)) return false;
  const str = String(applicableGrades).trim();
  const rangeMatch = str.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    return grade >= Math.min(start, end) && grade <= Math.max(start, end);
  }
  if (str.includes(',')) {
    return str.split(',').map((part) => parseInt(part.trim(), 10)).filter((n) => !Number.isNaN(n)).includes(grade);
  }
  return parseInt(str, 10) === grade;
}

function getFilteredSubjects() {
  const q = currentSubjectSearch.trim().toLowerCase();
  return lastSubjectsData.filter((s) => {
    if (!subjectCoversGrade(s.applicable_grades, currentSubjectGradeFilter)) return false;
    if (!q) return true;
    const name = subjectDisplayName(s).toLowerCase();
    const code = String(s.code || s.subject_code || s.Code || '').toLowerCase();
    return name.includes(q) || code.includes(q);
  });
}

function renderSubjectsTable() {
  const tbody = document.getElementById('admin-subjects-tbody');
  if (!tbody) return;

  if (!lastSubjectsData.length) {
    selectedSubjectIds.clear();
    updateSubjectsBulkBar();
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No subjects yet</td></tr>';
    paintAdminPager('admin-subjects-pager', null, () => {});
    return;
  }

  const filtered = getFilteredSubjects();
  if (!filtered.length) {
    selectedSubjectIds.clear();
    updateSubjectsBulkBar();
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No subjects match this filter</td></tr>';
    paintAdminPager('admin-subjects-pager', null, () => {});
    return;
  }

  const visibleIds = new Set(filtered.map((s) => Number(s.id)));
  [...selectedSubjectIds].forEach((id) => {
    if (!visibleIds.has(id)) selectedSubjectIds.delete(id);
  });

  const subjectPager = paginate(filtered, subjectPage, ADMIN_PAGE_SIZE);
  subjectPage = subjectPager.page;
  tbody.innerHTML = subjectPager.rows.map((s) => {
    const checked = selectedSubjectIds.has(Number(s.id)) ? 'checked' : '';
    return `
      <tr data-subject-id="${s.id || ''}">
        <td class="col-check">
          <input type="checkbox" class="admin-subject-check" data-subject-id="${s.id}" ${checked} aria-label="Select subject" />
        </td>
        <td class="sub-code">${escapeHtml(s.code || s.subject_code || s.Code || '—')}</td>
        <td class="sub-name">${escapeHtml(subjectDisplayName(s))}</td>
        <td class="sub-desc">${escapeHtml(s.description || '')}</td>
        <td class="sub-grades">${escapeHtml(s.applicable_grades || '')}</td>
        <td class="row-actions">
          <div class="row-menu-wrap">
            <button type="button" class="icon-btn row-menu-toggle" title="More actions" aria-label="More actions" aria-expanded="false">⋮</button>
            <div class="row-menu" hidden>
              <button type="button" class="row-menu-item" data-action="edit-subject" data-subject-id="${s.id}">Edit</button>
              <button type="button" class="row-menu-item row-menu-item--danger" data-action="delete-subject" data-subject-id="${s.id}">Delete</button>
            </div>
          </div>
        </td>
      </tr>`;
  }).join('');
  paintAdminPager('admin-subjects-pager', subjectPager, (p) => {
    subjectPage = p;
    renderSubjectsTable();
  });
  updateSubjectsBulkBar();
}

async function loadSubjectsTable() {
  const tbody = document.getElementById('admin-subjects-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_URL}/subjects`, { headers: getAuthHeaders() });
    const subjects = await res.json();
    if (!res.ok) throw new Error(subjects.error);
    if (!Array.isArray(subjects)) throw new Error('Invalid data format');
    lastSubjectsData = subjects;
    renderSubjectsTable();
  } catch (err) {
    console.error('Load subjects error:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">Failed to load subjects: ${escapeHtml(err.message)}</td></tr>`;
    paintAdminPager('admin-subjects-pager', null, () => {});
  }
}

function subjectExportRows() {
  return getFilteredSubjects();
}

function exportSubjectsExcel() {
  const rows = subjectExportRows();
  if (!rows.length) {
    showToast('No subjects to export for the current filter.', 'error');
    return;
  }
  const esc = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [['Code', 'Name', 'Description', 'Grades'].join(',')];
  rows.forEach((s) => {
    lines.push([
      s.code || s.subject_code || '',
      subjectDisplayName(s),
      s.description || '',
      s.applicable_grades || ''
    ].map(esc).join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `subjects-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${rows.length} subject(s) to Excel.`);
}

function exportSubjectsPdf() {
  const rows = subjectExportRows();
  if (!rows.length) {
    showToast('No subjects to export for the current filter.', 'error');
    return;
  }
  const bodyRows = rows.map((s) => `<tr>
      <td>${escapeHtml(s.code || s.subject_code || '')}</td>
      <td>${escapeHtml(subjectDisplayName(s))}</td>
      <td>${escapeHtml(s.description || '')}</td>
      <td>${escapeHtml(s.applicable_grades || '')}</td>
    </tr>`).join('');
  openPrintHtmlDocument('', `
    <h1>Subject List</h1>
    <p>Exported ${rows.length} subject(s) · ${escapeHtml(new Date().toLocaleString())}</p>
    <table>
      <thead><tr><th>Code</th><th>Name</th><th>Description</th><th>Grades</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`);
}

document.getElementById('admin-subject-search')?.addEventListener('input', (e) => {
  currentSubjectSearch = e.target.value || '';
  subjectPage = 1;
  renderSubjectsTable();
});

wireDownloadSelectMenu({
  menuId: 'admin-subject-grade-menu',
  btnId: 'admin-subject-grade-btn',
  panelId: 'admin-subject-grade-panel',
  options: STUDENT_GRADE_FILTER_OPTS,
  getValue: () => currentSubjectGradeFilter,
  setValue: (v) => { currentSubjectGradeFilter = v || ''; },
  onPick: () => {
    subjectPage = 1;
    renderSubjectsTable();
  }
});

function closeSubjectsExportMenu() {
  closeDownloadMenu(
    document.getElementById('admin-subjects-export-panel'),
    document.getElementById('admin-subjects-export-btn')
  );
}

document.getElementById('admin-subjects-export-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleDownloadMenu(
    document.getElementById('admin-subjects-export-btn'),
    document.getElementById('admin-subjects-export-panel')
  );
});
document.getElementById('admin-subjects-export-excel')?.addEventListener('click', () => {
  closeSubjectsExportMenu();
  exportSubjectsExcel();
});
document.getElementById('admin-subjects-export-pdf')?.addEventListener('click', () => {
  closeSubjectsExportMenu();
  exportSubjectsPdf();
});

function updateSubjectsBulkBar() {
  const bar = document.getElementById('admin-subjects-bulk-bar');
  const countEl = document.getElementById('admin-subjects-bulk-count');
  const selectAll = document.getElementById('admin-subjects-select-all');
  const n = selectedSubjectIds.size;
  if (countEl) countEl.textContent = `${n} selected`;
  if (bar) {
    bar.hidden = n === 0;
    if (n === 0) bar.setAttribute('hidden', '');
    else bar.removeAttribute('hidden');
  }
  const checks = [...document.querySelectorAll('#admin-subjects-table .admin-subject-check')];
  if (selectAll) {
    const anyChecked = checks.some((c) => c.checked);
    const allChecked = checks.length > 0 && checks.every((c) => c.checked);
    selectAll.indeterminate = false;
    selectAll.checked = allChecked;
    selectAll.indeterminate = anyChecked && !allChecked;
  }
}

(function setupSubjectsTableDelegation() {
  const tbody = document.getElementById('admin-subjects-tbody');
  if (!tbody) return;

  tbody.addEventListener('click', (e) => {
    const toggle = e.target.closest('.row-menu-toggle');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      toggleRowMenu(toggle, '#admin-subjects-table');
      return;
    }
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    closeAllRowMenus();
    const id = Number(btn.dataset.subjectId);
    if (!id) return;
    if (btn.dataset.action === 'edit-subject') startEditSubject(id);
    else if (btn.dataset.action === 'delete-subject') deleteSubject(id);
  });

  tbody.addEventListener('change', (e) => {
    const check = e.target.closest('.admin-subject-check');
    if (!check) return;
    const id = Number(check.dataset.subjectId);
    if (!id) return;
    if (check.checked) selectedSubjectIds.add(id);
    else selectedSubjectIds.delete(id);
    updateSubjectsBulkBar();
  });
})();

(function wireSubjectsSelectAll() {
  const selectAll = document.getElementById('admin-subjects-select-all');
  if (!selectAll) return;
  let wasIndeterminate = false;

  const captureState = () => {
    wasIndeterminate = !!selectAll.indeterminate;
  };
  selectAll.addEventListener('pointerdown', captureState);
  selectAll.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') captureState();
  });

  selectAll.addEventListener('click', () => {
    const checks = [...document.querySelectorAll('#admin-subjects-table .admin-subject-check')];
    const shouldSelectAll = !wasIndeterminate && selectAll.checked;

    checks.forEach((cb) => {
      cb.checked = shouldSelectAll;
      const id = Number(cb.dataset.subjectId);
      if (!id) return;
      if (shouldSelectAll) selectedSubjectIds.add(id);
      else selectedSubjectIds.delete(id);
    });

    selectAll.indeterminate = false;
    selectAll.checked = shouldSelectAll;
    wasIndeterminate = false;
    updateSubjectsBulkBar();
  });
})();

document.getElementById('admin-subjects-bulk-delete')?.addEventListener('click', async () => {
  const ids = [...selectedSubjectIds];
  if (!ids.length) return;
  if (!confirm(`Delete ${ids.length} selected subject(s)?`)) return;
  try {
    for (const id of ids) {
      const res = await fetch(`${API_URL}/subjects/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to delete subject #${id}`);
    }
    selectedSubjectIds.clear();
    showToast('Selected subjects deleted.');
    await refreshSchoolData({ subjects: true, teachers: true, overview: true });
  } catch (err) {
    alert(err.message);
  }
});

window.startEditSubject = function(id) {
  const row = document.querySelector(`tr[data-subject-id="${id}"]`);
  if (!row) return;

  const code = row.querySelector('.sub-code').textContent.trim();
  const name = row.querySelector('.sub-name').textContent.trim();
  const desc = row.querySelector('.sub-desc').textContent.trim();
  const grades = row.querySelector('.sub-grades').textContent.trim();

  row.innerHTML = `
    <td class="col-check"></td>
    <td><input type="text" class="sub-input" value="${code.replace(/"/g, '&quot;')}" disabled style="background:#f0f0f0;color:#666;"></td>
    <td><input type="text" class="sub-input sub-input-name" value="${name.replace(/"/g, '&quot;')}" style="width:100%;padding:6px;font-size:0.82rem;border:1px solid var(--border-maroon);border-radius:6px;"></td>
    <td><input type="text" class="sub-input sub-input-desc" value="${desc.replace(/"/g, '&quot;')}" style="width:100%;padding:6px;font-size:0.82rem;border:1px solid var(--border-maroon);border-radius:6px;"></td>
    <td><input type="text" class="sub-input sub-input-grades" value="${grades.replace(/"/g, '&quot;')}" style="width:100%;padding:6px;font-size:0.82rem;border:1px solid var(--border-maroon);border-radius:6px;"></td>
    <td style="white-space:nowrap;">
      <button class="chip-ghost primary" onclick="saveSubjectEdit(${id})">Save</button>
      <button class="chip-ghost" onclick="cancelSubjectEdit()">Cancel</button>
    </td>
  `;
};

window.cancelSubjectEdit = function() {
  loadSubjectsTable();
};

window.saveSubjectEdit = async function(id) {
  const row = document.querySelector(`tr[data-subject-id="${id}"]`);
  if (!row) return;

  const payload = {
    name: row.querySelector('.sub-input-name').value.trim(),
    description: row.querySelector('.sub-input-desc').value.trim(),
    applicable_grades: row.querySelector('.sub-input-grades').value.trim()
  };

  if (!payload.name) {
    alert('Subject name is required');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/subjects/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    await refreshSchoolData({ subjects: true, teachers: true, overview: true });

  } catch (err) {
    alert(err.message);
  }
};

// FIX #5: Add confirmation before deleting subject
window.deleteSubject = async function(id) {
  if (!confirm('Delete this subject?')) return;
  try {
    const res = await fetch(`${API_URL}/subjects/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await refreshSchoolData({ subjects: true, teachers: true, overview: true });
  } catch (err) {
    alert(err.message);
  }
};

// ========== CHANGE PASSWORD ==========
const changePasswordModal = document.getElementById('change-password-modal');
const changePasswordForm = document.getElementById('change-password-form');
const changePasswordCancel = document.getElementById('change-password-cancel');
let forcePasswordChange = false;

function openChangePasswordModal(forced) {
  forcePasswordChange = !!forced;
  const hint = document.getElementById('change-password-hint');
  const title = document.getElementById('change-password-title');
  const errEl = document.getElementById('change-password-error');
  if (hint) hint.hidden = !forcePasswordChange;
  if (title) title.textContent = forcePasswordChange ? 'Set a New Password' : 'Change Password';
  if (changePasswordCancel) changePasswordCancel.hidden = forcePasswordChange;
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  changePasswordForm?.reset();
  resetChangePasswordFields();
  changePasswordModal?.classList.toggle('is-forced', forcePasswordChange);
  changePasswordModal?.removeAttribute('hidden');
}

function maybeForcePasswordChange(user) {
  if (!user?.must_change_password) return;
  openChangePasswordModal(true);
}

document.getElementById('admin-change-password-btn')?.addEventListener('click', () => {
  openChangePasswordModal(false);
  adminSettingsDropdown?.setAttribute('hidden', '');
});
document.getElementById('teacher-change-password-btn')?.addEventListener('click', () => {
  openChangePasswordModal(false);
  teacherSettingsDropdown?.setAttribute('hidden', '');
});
document.getElementById('parent-change-password-btn')?.addEventListener('click', () => {
  openChangePasswordModal(false);
  parentSettingsDropdown?.setAttribute('hidden', '');
});
document.getElementById('student-change-password-btn')?.addEventListener('click', () => {
  openChangePasswordModal(false);
  document.getElementById('student-settings-dropdown')?.setAttribute('hidden', '');
});
document.getElementById('teacher-edit-profile-btn')?.addEventListener('click', () => {
  document.getElementById('admin-profile-modal')?.removeAttribute('hidden');
  teacherSettingsDropdown?.setAttribute('hidden', '');
});
document.getElementById('parent-edit-profile-btn')?.addEventListener('click', () => {
  document.getElementById('admin-profile-modal')?.removeAttribute('hidden');
  parentSettingsDropdown?.setAttribute('hidden', '');
});

changePasswordCancel?.addEventListener('click', () => {
  if (forcePasswordChange) return;
  changePasswordModal?.setAttribute('hidden', '');
});
changePasswordModal?.addEventListener('click', (e) => {
  if (e.target.id !== 'change-password-modal') return;
  if (forcePasswordChange) return;
  changePasswordModal.setAttribute('hidden', '');
});

if (changePasswordForm) {
  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('change-password-error');
    const current = document.getElementById('cp-current').value;
    const newPass = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;

    if (newPass !== confirm) {
      if (errEl) { errEl.hidden = false; errEl.textContent = 'New passwords do not match.'; }
      else showToast('New passwords do not match', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ current_password: current, new_password: newPass })
      });

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error('Server returned non-JSON response. The change-password endpoint may not exist yet.');
      }

      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      const user = getAuthUser() || {};
      user.must_change_password = false;
      persistAuthUser(user);
      forcePasswordChange = false;
      if (changePasswordCancel) changePasswordCancel.hidden = false;
      changePasswordModal?.classList.remove('is-forced');
      showToast('Password changed successfully');
      e.target.reset();
      resetChangePasswordFields();
      changePasswordModal?.setAttribute('hidden', '');

    } catch (err) {
      if (errEl) { errEl.hidden = false; errEl.textContent = err.message; }
      else showToast(err.message, 'error');
    }
  });
}

document.getElementById('admin-account-password-regen')?.addEventListener('click', () => {
  fillTempPasswordInput('admin-account-password');
});
document.getElementById('admin-account-password-copy')?.addEventListener('click', async () => {
  const el = document.getElementById('admin-account-password');
  const pw = el?.value?.trim() || '';
  if (!pw) return;
  try {
    await navigator.clipboard.writeText(pw);
    showToast('Temporary password copied.');
  } catch {
    el?.select?.();
    showToast('Select and copy the password manually.');
  }
});
document.getElementById('reset-password-regen')?.addEventListener('click', () => {
  fillTempPasswordInput('reset-password-temp');
});

document.getElementById('reset-password-cancel')?.addEventListener('click', () => {
  document.getElementById('reset-password-modal')?.setAttribute('hidden', '');
});
document.getElementById('reset-password-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'reset-password-modal') e.currentTarget.setAttribute('hidden', '');
});
document.getElementById('reset-password-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('reset-password-user-id').value;
  const temp = document.getElementById('reset-password-temp').value.trim();
  const errEl = document.getElementById('reset-password-error');
  const user = lastAccountsData.find(u => String(u.id) === String(id));
  const label = user ? `${user.first_name} ${user.last_name}` : 'this account';
  if (temp.length < 6) {
    if (errEl) { errEl.hidden = false; errEl.textContent = 'Temporary password must be at least 6 characters.'; }
    return;
  }
  try {
    const res = await fetch(`${API_URL}/admin/accounts/${id}/reset-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ password: temp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('reset-password-modal')?.setAttribute('hidden', '');
    showToast(`Temporary password set for ${label}. Tell them to sign in and change it.`);
    refreshAdminOverview();
  } catch (err) {
    if (errEl) { errEl.hidden = false; errEl.textContent = err.message; }
    else showToast(err.message, 'error');
  }
});

function updateAnnouncementScopeFields() {
  const scopeEl = document.getElementById('announcement-scope');
  if (!scopeEl) return;
  const scope = scopeEl.value;
  const gradeWrap = document.getElementById('announcement-grade-wrap');
  const sectionWrap = document.getElementById('announcement-section-wrap');
  const gradeSelect = document.getElementById('announcement-grade');
  const sectionInput = document.getElementById('announcement-section');

  if (scope === 'school_wide') {
    if (gradeWrap) { gradeWrap.hidden = true; gradeWrap.style.display = 'none'; }
    if (sectionWrap) { sectionWrap.hidden = true; sectionWrap.style.display = 'none'; }
    if (gradeSelect) gradeSelect.value = '';
    if (sectionInput) sectionInput.value = '';
  } else if (scope === 'grade_wide') {
    if (gradeWrap) { gradeWrap.hidden = false; gradeWrap.style.display = ''; }
    if (sectionWrap) { sectionWrap.hidden = true; sectionWrap.style.display = 'none'; }
    if (sectionInput) sectionInput.value = '';
  } else if (scope === 'class_specific') {
    if (gradeWrap) { gradeWrap.hidden = false; gradeWrap.style.display = ''; }
    if (sectionWrap) { sectionWrap.hidden = false; sectionWrap.style.display = ''; }
  }
}

document.getElementById('announcement-scope')?.addEventListener('change', updateAnnouncementScopeFields);

// Force correct visibility whenever Announcements tab is opened
const _origLoadAdminAnnouncements = loadAdminAnnouncements;
loadAdminAnnouncements = function() {
  updateAnnouncementScopeFields();
  return _origLoadAdminAnnouncements.apply(this, arguments);
};
// Student table search & filters
document.getElementById('admin-student-search')?.addEventListener('input', (e) => {
  currentStudentFilter = e.target.value.trim();
  studentPage = 1;
  filterStudentsTable();
});

studentGradeMenuApi = wireDownloadSelectMenu({
  menuId: 'admin-student-grade-menu',
  btnId: 'admin-student-grade-btn',
  panelId: 'admin-student-grade-panel',
  options: STUDENT_GRADE_FILTER_OPTS,
  getValue: () => currentStudentGradeFilter,
  setValue: (v) => { currentStudentGradeFilter = v || ''; },
  onPick: async () => {
    currentStudentSectionFilter = '';
    await loadStudentFilterSections(currentStudentGradeFilter);
    studentPage = 1;
    filterStudentsTable();
  }
});

studentSectionMenuApi = wireDownloadSelectMenu({
  menuId: 'admin-student-section-menu',
  btnId: 'admin-student-section-btn',
  panelId: 'admin-student-section-panel',
  options: [{ value: '', label: 'All sections' }],
  getValue: () => currentStudentSectionFilter,
  setValue: (v) => { currentStudentSectionFilter = v || ''; },
  disabled: true,
  onPick: () => { studentPage = 1; filterStudentsTable(); }
});

document.getElementById('admin-student-filter-clear')?.addEventListener('click', clearStudentFilters);

// Announcements form
function buildAnnouncementPayload(prefix) {
  const scope = document.getElementById(`${prefix}-scope`).value;
  const audienceEl = document.getElementById(`${prefix}-audience`);
  const payload = {
    title: document.getElementById(`${prefix}-title`).value.trim(),
    body: document.getElementById(`${prefix}-body`).value.trim(),
    scope,
    priority: document.getElementById(`${prefix}-priority`).value,
    audience: audienceEl ? audienceEl.value : 'everyone'
  };

  if (!payload.title || !payload.body) {
    throw new Error('Title and message are required');
  }

  if (scope === 'grade_wide' || scope === 'class_specific') {
    const gradeVal = document.getElementById(`${prefix}-grade`).value;
    if (!gradeVal) throw new Error('Select a grade for this scope');
    payload.target_grade = parseInt(gradeVal, 10);
  }
  if (scope === 'class_specific') {
    const sectionVal = document.getElementById(`${prefix}-section`).value.trim();
    if (!sectionVal) throw new Error('Enter a section for class-specific announcements');
    payload.target_section = sectionVal;
  }
  return payload;
}

document.getElementById('admin-announcement-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('admin-announcement-message');

  let payload;
  try {
    payload = buildAnnouncementPayload('announcement');
  } catch (err) {
    if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = '#b71c1c'; }
    else showToast(err.message, 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/announcements`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const responseText = await res.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Server returned ${res.status}: ${responseText.substring(0, 200)}`);
    }

    if (!res.ok) {
      const err = new Error(data.error || `Server error ${res.status}`);
      err.details = data.details || null;
      throw err;
    }

    showToast('Announcement sent successfully');
    e.target.reset();
    document.getElementById('announcement-grade-wrap').hidden = true;
    document.getElementById('announcement-section-wrap').hidden = true;
    closeAdminModal('compose-announcement-modal', { reset: false });
    await refreshSchoolData({ announcements: true, overview: true });
  } catch (err) {
    console.error('[Announcements] Error:', err);
    let displayMsg = err.message;
    if (err.details) displayMsg += ' • ' + err.details;
    showToast(displayMsg, 'error');
  }
});

function getCurrentUserId() {
  const user = getAuthUser() || {};
  return user.id || user.userId;
}

window.updateEditAnnouncementScopeFields = function() {
  const scopeEl = document.getElementById('edit-announcement-scope');
  if (!scopeEl) return;
  const scope = scopeEl.value;
  const gradeWrap = document.getElementById('edit-announcement-grade-wrap');
  const sectionWrap = document.getElementById('edit-announcement-section-wrap');
  const gradeSelect = document.getElementById('edit-announcement-grade');
  const sectionInput = document.getElementById('edit-announcement-section');

  if (scope === 'school_wide') {
    if (gradeWrap) { gradeWrap.hidden = true; gradeWrap.style.display = 'none'; }
    if (sectionWrap) { sectionWrap.hidden = true; sectionWrap.style.display = 'none'; }
    if (gradeSelect) gradeSelect.value = '';
    if (sectionInput) sectionInput.value = '';
  } else if (scope === 'grade_wide') {
    if (gradeWrap) { gradeWrap.hidden = false; gradeWrap.style.display = ''; }
    if (sectionWrap) { sectionWrap.hidden = true; sectionWrap.style.display = 'none'; }
    if (sectionInput) sectionInput.value = '';
  } else if (scope === 'class_specific') {
    if (gradeWrap) { gradeWrap.hidden = false; gradeWrap.style.display = ''; }
    if (sectionWrap) { sectionWrap.hidden = false; sectionWrap.style.display = ''; }
  }
};

window.startEditAnnouncement = async function(id) {
  try {
    const res = await fetch(`${API_URL}/admin/inbox`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const announcement = (data.announcements || []).find(a => a.id === id);
    if (!announcement) throw new Error('Announcement not found');

    document.getElementById('edit-announcement-id').value = id;
    document.getElementById('edit-announcement-title').value = announcement.title;
    document.getElementById('edit-announcement-body').value = announcement.body || '';
    document.getElementById('edit-announcement-scope').value = announcement.scope || 'school_wide';
    document.getElementById('edit-announcement-priority').value = announcement.priority || 'normal';
    const audienceEl = document.getElementById('edit-announcement-audience');
    if (audienceEl) audienceEl.value = announcement.audience || 'everyone';
    document.getElementById('edit-announcement-grade').value = announcement.target_grade || '';
    document.getElementById('edit-announcement-section').value = announcement.target_section || '';

    updateEditAnnouncementScopeFields();
    document.getElementById('edit-announcement-modal').removeAttribute('hidden');
  } catch (err) {
    alert(err.message);
  }
};

document.getElementById('edit-announcement-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-announcement-id').value;

  let payload;
  try {
    payload = buildAnnouncementPayload('edit-announcement');
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/announcements/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('edit-announcement-modal').setAttribute('hidden', '');
    showToast('Announcement updated');
    loadAdminAnnouncements();
    refreshAdminOverview();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('edit-announcement-cancel')?.addEventListener('click', () => {
  document.getElementById('edit-announcement-modal').setAttribute('hidden', '');
});

document.getElementById('edit-announcement-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'edit-announcement-modal') {
    document.getElementById('edit-announcement-modal').setAttribute('hidden', '');
  }
});

window.deleteAnnouncement = async function(id) {
  if (!confirm('Delete this announcement? This cannot be undone.')) return;
  try {
    const res = await fetch(`${API_URL}/admin/announcements/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    loadAdminAnnouncements();
    refreshAdminOverview();
  } catch (err) {
    alert(err.message);
  }
};


window.toggleAnnouncementRead = toggleAnnouncementRead;
window.markAllAnnouncementsRead = markAllAnnouncementsRead;

// ========== TEACHER & PARENT DETAIL MODALS ==========
let currentDetailAccountId = null;
let currentDetailAccountRole = null;
let currentDetailAccountStatus = 'active';

function closeDetailActionsMenus() {
  closeDownloadMenu(
    document.getElementById('teacher-detail-actions-menu'),
    document.getElementById('teacher-detail-actions-btn')
  );
  closeDownloadMenu(
    document.getElementById('parent-detail-actions-menu'),
    document.getElementById('parent-detail-actions-btn')
  );
}

function updateDetailStatusActionLabel(status) {
  const label = status === 'active' ? 'Deactivate' : 'Activate';
  const teacherBtn = document.getElementById('teacher-detail-action-status');
  const parentBtn = document.getElementById('parent-detail-action-status');
  if (teacherBtn) teacherBtn.textContent = label;
  if (parentBtn) parentBtn.textContent = label;
}

function toggleDetailActionsMenu(role) {
  const menuId = role === 'teacher' ? 'teacher-detail-actions-menu' : 'parent-detail-actions-menu';
  const btnId = role === 'teacher' ? 'teacher-detail-actions-btn' : 'parent-detail-actions-btn';
  const otherRole = role === 'teacher' ? 'parent' : 'teacher';
  closeDownloadMenu(
    document.getElementById(`${otherRole}-detail-actions-menu`),
    document.getElementById(`${otherRole}-detail-actions-btn`)
  );
  toggleDownloadMenu(
    document.getElementById(btnId),
    document.getElementById(menuId)
  );
}

window.openTeacherDetailModal = async function(teacherId) {
  const modal = document.getElementById('teacher-detail-modal');
  const nameEl = document.getElementById('teacher-detail-name');
  const contentEl = document.getElementById('teacher-detail-content');

  closeDetailActionsMenus();
  modal.removeAttribute('hidden');
  contentEl.innerHTML = '<p style="color:var(--text-muted);">Loading...</p>';
  currentDetailAccountId = teacherId;
  currentDetailAccountRole = 'teacher';

  try {
    const res = await fetch(`${API_URL}/admin/teachers/${teacherId}/detail`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    currentDetailAccountStatus = data.status || 'active';
    updateDetailStatusActionLabel(currentDetailAccountStatus);
    nameEl.textContent = `${data.first_name} ${data.last_name}`;

    let html = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;font-size:0.88rem;margin-bottom:16px;">
        <div><strong>Email:</strong> ${data.email || '-'}</div>
        <div><strong>Phone:</strong> ${data.phone || '-'}</div>
        <div><strong>Status:</strong> ${statusBadgeHtml(data.status)}</div>
        <div><strong>Teaching Mode:</strong> ${teachingModeDisplay(data.teaching_mode, data.teaching_mode_label, data.homeroom_role)}</div>
      </div>
    `;

    if (data.class_adviser_assignments && data.class_adviser_assignments.length > 0) {
      const uniqueCA = [...new Map(data.class_adviser_assignments.map(a => [
        `${a.grade_level}-${a.section}-${a.school_year}`, a
      ])).values()];

      html += `<h4 style="color:var(--maroon-deep);font-size:0.95rem;margin:16px 0 8px;">Class Adviser Assignment</h4>`;
      html += `<table style="width:100%;font-size:0.82rem;border-collapse:collapse;">
        <thead style="background:var(--maroon-header);color:#fff;">
          <tr><th style="padding:6px;text-align:left;">Grade</th><th style="padding:6px;text-align:left;">Section</th><th style="padding:6px;text-align:left;">School Year</th></tr>
        </thead>
        <tbody>`;
      uniqueCA.forEach(a => {
        html += `<tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px;">Grade ${a.grade_level}</td>
          <td style="padding:6px;">${a.section}</td>
          <td style="padding:6px;">${a.school_year}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }

    const adviserSubjects = data.adviser_subjects || [];
    const assistantAssignments = data.assistant_assignments || [];
    const assistantSubjects = data.assistant_subjects || [];
    if (assistantAssignments.length > 0) {
      const uniqueAssistant = [...new Map(assistantAssignments.map(a => [
        `${a.grade_level}-${a.section}-${a.school_year}`, a
      ])).values()];
      html += `<h4 style="color:var(--maroon-deep);font-size:0.95rem;margin:16px 0 8px;">Assistant Teacher Assignment</h4>`;
      html += `<table style="width:100%;font-size:0.82rem;border-collapse:collapse;">
        <thead style="background:var(--maroon-header);color:#fff;">
          <tr><th style="padding:6px;text-align:left;">Grade</th><th style="padding:6px;text-align:left;">Section</th><th style="padding:6px;text-align:left;">School Year</th></tr>
        </thead>
        <tbody>`;
      uniqueAssistant.forEach(a => {
        html += `<tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px;">Grade ${a.grade_level}</td>
          <td style="padding:6px;">${a.section}</td>
          <td style="padding:6px;">${a.school_year}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }
    if (assistantSubjects.length > 0) {
      html += `<h4 style="color:var(--maroon-deep);font-size:0.95rem;margin:16px 0 8px;">Subjects Taught as Assistant Teacher</h4>`;
      html += `<table style="width:100%;font-size:0.82rem;border-collapse:collapse;table-layout:fixed;">
        <colgroup><col style="width:50%"><col style="width:50%"></colgroup>
        <thead style="background:var(--maroon-header);color:#fff;">
          <tr><th style="padding:6px;text-align:left;">Subject</th><th style="padding:6px;text-align:left;">Class</th></tr>
        </thead>
        <tbody>`;
      assistantSubjects.forEach(a => {
        html += `<tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px;overflow-wrap:anywhere;">${a.subject_name || a.subject_code || 'Subject ID ' + a.subject_id}</td>
          <td style="padding:6px;">Grade ${a.grade_level} – ${a.section}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }
    if (adviserSubjects.length > 0) {
      html += `<h4 style="color:var(--maroon-deep);font-size:0.95rem;margin:16px 0 8px;">Subjects Taught as Class Adviser</h4>`;
      html += `<table style="width:100%;font-size:0.82rem;border-collapse:collapse;table-layout:fixed;">
        <colgroup><col style="width:50%"><col style="width:50%"></colgroup>
        <thead style="background:var(--maroon-header);color:#fff;">
          <tr><th style="padding:6px;text-align:left;">Subject</th><th style="padding:6px;text-align:left;">Class</th></tr>
        </thead>
        <tbody>`;
      adviserSubjects.forEach(a => {
        html += `<tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px;overflow-wrap:anywhere;">${a.subject_name || a.subject_code || 'Subject ID ' + a.subject_id}</td>
          <td style="padding:6px;">Grade ${a.grade_level} – ${a.section}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }

    if (data.subject_assignments && data.subject_assignments.length > 0) {
      html += `<h4 style="color:var(--maroon-deep);font-size:0.95rem;margin:16px 0 8px;">Subject Teacher Assignments (Grades 4–6)</h4>`;
      html += `<table style="width:100%;font-size:0.82rem;border-collapse:collapse;table-layout:fixed;">
        <colgroup><col style="width:50%"><col style="width:50%"></colgroup>
        <thead style="background:var(--maroon-header);color:#fff;">
          <tr><th style="padding:6px;text-align:left;">Subject</th><th style="padding:6px;text-align:left;">Class</th></tr>
        </thead>
        <tbody>`;
      data.subject_assignments.forEach(a => {
        html += `<tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px;overflow-wrap:anywhere;">${a.subject_name || a.subject_code || 'Subject ID ' + a.subject_id}</td>
          <td style="padding:6px;">Grade ${a.grade_level} – ${a.section}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }

    if ((!data.class_adviser_assignments || data.class_adviser_assignments.length === 0) &&
        (!adviserSubjects.length) &&
        (!assistantAssignments.length) &&
        (!assistantSubjects.length) &&
        (!data.subject_assignments || data.subject_assignments.length === 0)) {
      html += `<p style="color:var(--text-muted);font-size:0.85rem;margin-top:12px;">No assignments found for this teacher.</p>`;
    }

    contentEl.innerHTML = html;
  } catch (err) {
    contentEl.innerHTML = `<p style="color:#b71c1c;">Failed to load teacher details: ${err.message}</p>`;
  }
};

window.openParentDetailModal = async function(parentId) {
  const modal = document.getElementById('parent-detail-modal');
  const nameEl = document.getElementById('parent-detail-name');
  const contentEl = document.getElementById('parent-detail-content');

  closeDetailActionsMenus();
  modal.removeAttribute('hidden');
  contentEl.innerHTML = '<p style="color:var(--text-muted);">Loading...</p>';
  currentDetailAccountId = parentId;
  currentDetailAccountRole = 'parent';

  try {
    const res = await fetch(`${API_URL}/admin/parents/${parentId}/detail`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    currentDetailAccountStatus = data.status || 'active';
    updateDetailStatusActionLabel(currentDetailAccountStatus);
    nameEl.textContent = `${data.first_name} ${data.last_name}`;

    let html = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;font-size:0.88rem;margin-bottom:16px;">
        <div><strong>Email:</strong> ${data.email || '-'}</div>
        <div><strong>Phone:</strong> ${data.phone || '-'}</div>
        <div><strong>Status:</strong> ${statusBadgeHtml(data.status)}</div>
        <div><strong>Emergency Contact:</strong> ${data.emergency_contact || '-'}</div>
      </div>
    `;

    if (data.address) {
      html += `<div style="font-size:0.88rem;margin-bottom:16px;"><strong>Address:</strong> ${data.address}</div>`;
    }

    if (data.linked_students && data.linked_students.length > 0) {
      html += `<h4 style="color:var(--maroon-deep);font-size:0.95rem;margin:16px 0 8px;">👶 Linked Students</h4>`;
      html += `<table style="width:100%;font-size:0.82rem;border-collapse:collapse;">
        <thead style="background:var(--maroon-header);color:#fff;">
          <tr>
            <th style="padding:6px;text-align:left;">Name</th>
            <th style="padding:6px;text-align:left;">LRN</th>
            <th style="padding:6px;text-align:left;">Grade & Section</th>
            <th style="padding:6px;text-align:left;">Gender</th>
            <th style="padding:6px;text-align:left;">Status</th>
          </tr>
        </thead>
        <tbody>`;
      data.linked_students.forEach(s => {
        html += `<tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px;">${escapeHtml(s.last_name)}, ${escapeHtml(s.first_name)}${s.middle_name ? ` ${escapeHtml(s.middle_name)}` : ''}</td>
          <td style="padding:6px;">${s.lrn || '-'}</td>
          <td style="padding:6px;">Grade ${s.grade_level}-${s.section}</td>
          <td style="padding:6px;">${s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : '-'}</td>
          <td style="padding:6px;">${statusBadgeHtml(s.student_status)}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    } else {
      html += `<p style="color:var(--text-muted);font-size:0.85rem;margin-top:12px;">No students linked to this parent.</p>`;
    }

    contentEl.innerHTML = html;
  } catch (err) {
    contentEl.innerHTML = `<p style="color:#b71c1c;">Failed to load parent details: ${err.message}</p>`;
  }
};

// Modal close handlers
document.getElementById('teacher-detail-actions-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDetailActionsMenu('teacher');
});
document.getElementById('parent-detail-actions-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDetailActionsMenu('parent');
});

document.getElementById('teacher-detail-action-reset')?.addEventListener('click', () => {
  closeDetailActionsMenus();
  document.getElementById('teacher-detail-modal')?.setAttribute('hidden', '');
  if (currentDetailAccountId) resetAccountPassword(currentDetailAccountId);
});
document.getElementById('parent-detail-action-reset')?.addEventListener('click', () => {
  closeDetailActionsMenus();
  document.getElementById('parent-detail-modal')?.setAttribute('hidden', '');
  if (currentDetailAccountId) resetAccountPassword(currentDetailAccountId);
});

async function openEditAccountInfoModal(accountId, role) {
  closeDetailActionsMenus();
  const modal = document.getElementById('edit-account-info-modal');
  const msg = document.getElementById('edit-account-info-msg');
  if (!modal || !accountId) return;
  if (msg) {
    msg.hidden = true;
    msg.textContent = '';
  }

  try {
    const res = await fetch(`${API_URL}/admin/accounts/${accountId}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load account');

    document.getElementById('edit-account-id').value = String(data.id);
    document.getElementById('edit-account-role').value = data.role || role || '';
    document.getElementById('edit-account-first').value = data.first_name || '';
    document.getElementById('edit-account-last').value = data.last_name || '';
    document.getElementById('edit-account-email').value = data.email || '';
    document.getElementById('edit-account-phone').value = data.phone || '';

    const parentFields = document.getElementById('edit-account-parent-fields');
    const isParent = (data.role || role) === 'parent';
    if (parentFields) parentFields.hidden = !isParent;
    document.getElementById('edit-account-address').value = data.address || '';
    document.getElementById('edit-account-emergency').value = data.emergency_contact || '';

    const title = document.getElementById('edit-account-info-title');
    const sub = document.getElementById('edit-account-info-subtitle');
    if (title) title.textContent = isParent ? 'Edit Parent Info' : 'Edit Teacher Info';
    if (sub) sub.textContent = `Editing ${data.last_name || ''}, ${data.first_name || ''}`;


    modal.removeAttribute('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('teacher-detail-action-edit-info')?.addEventListener('click', () => {
  if (currentDetailAccountId) openEditAccountInfoModal(currentDetailAccountId, 'teacher');
});
document.getElementById('parent-detail-action-edit-info')?.addEventListener('click', () => {
  if (currentDetailAccountId) openEditAccountInfoModal(currentDetailAccountId, 'parent');
});

document.getElementById('edit-account-info-cancel')?.addEventListener('click', () => {
  document.getElementById('edit-account-info-modal')?.setAttribute('hidden', '');
});
document.getElementById('edit-account-info-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'edit-account-info-modal') {
    e.currentTarget.setAttribute('hidden', '');
  }
});

document.getElementById('edit-account-info-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-account-id')?.value;
  const role = document.getElementById('edit-account-role')?.value;
  const msg = document.getElementById('edit-account-info-msg');
  if (!id) return;

  const payload = {
    first_name: document.getElementById('edit-account-first').value.trim(),
    last_name: document.getElementById('edit-account-last').value.trim(),
    email: document.getElementById('edit-account-email').value.trim(),
    phone: document.getElementById('edit-account-phone').value.trim()
  };
  if (role === 'parent') {
    payload.address = document.getElementById('edit-account-address').value.trim();
    payload.emergency_contact = document.getElementById('edit-account-emergency').value.trim();
  }

  try {
    const res = await fetch(`${API_URL}/admin/accounts/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.details || 'Update failed');

    document.getElementById('edit-account-info-modal')?.setAttribute('hidden', '');
    showToast(data.message || 'Account updated');

    await refreshSchoolData({ accounts: true, teachers: true, parents: true, overview: true });

    if (role === 'teacher') openTeacherDetailModal(id);
    else if (role === 'parent') openParentDetailModal(id);
  } catch (err) {
    if (msg) {
      msg.hidden = false;
      msg.textContent = err.message;
      msg.style.color = '#b71c1c';
    } else {
      showToast(err.message, 'error');
    }
  }
});

document.getElementById('teacher-detail-action-edit')?.addEventListener('click', () => {
  closeDetailActionsMenus();
  const id = currentDetailAccountId;
  document.getElementById('teacher-detail-modal')?.setAttribute('hidden', '');
  if (id) openEditTeacherModal(id);
});

document.getElementById('teacher-detail-action-status')?.addEventListener('click', () => {
  closeDetailActionsMenus();
  if (!currentDetailAccountId) return;
  const next = currentDetailAccountStatus === 'active' ? 'inactive' : 'active';
  toggleAccountStatus(currentDetailAccountId, next);
});
document.getElementById('parent-detail-action-status')?.addEventListener('click', () => {
  closeDetailActionsMenus();
  if (!currentDetailAccountId) return;
  const next = currentDetailAccountStatus === 'active' ? 'inactive' : 'active';
  toggleAccountStatus(currentDetailAccountId, next);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.modal-actions-wrap')) closeDetailActionsMenus();
});

document.getElementById('teacher-detail-close')?.addEventListener('click', () => {
  closeDetailActionsMenus();
  document.getElementById('teacher-detail-modal')?.setAttribute('hidden', '');
});
document.getElementById('teacher-detail-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'teacher-detail-modal') {
    closeDetailActionsMenus();
    document.getElementById('teacher-detail-modal')?.setAttribute('hidden', '');
  }
});

document.getElementById('parent-detail-close')?.addEventListener('click', () => {
  closeDetailActionsMenus();
  document.getElementById('parent-detail-modal')?.setAttribute('hidden', '');
});
document.getElementById('parent-detail-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'parent-detail-modal') {
    closeDetailActionsMenus();
    document.getElementById('parent-detail-modal')?.setAttribute('hidden', '');
  }
});