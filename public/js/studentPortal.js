let apiUrl = '';
let authHeaders = () => ({});
let escape = (value) => String(value ?? '');
let toast = () => {};
let wired = false;
let studentSubjectId = null;
let studentTab = 'classwork';
let studentTodo = 'all';
let classworkType = 'all';
let recordType = 'all';
let recordQuarter = 'all';
let workReturnTab = 'classwork';
let studentSubjects = [];

function previewStudentUsername(firstName, lastName) {
  const first = String(firstName || '').replace(/[^a-zA-Z]/g, '').toLowerCase();
  const last = String(lastName || '').replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (first.length < 2 || !last) return '';
  return `${first.slice(0, 2)}${last}@gmail.com`;
}

function syncEnrollUsernamePreview() {
  const input = document.getElementById('student-username');
  if (!input) return;
  const first = document.getElementById('student-first')?.value || '';
  const last = document.getElementById('student-last')?.value || '';
  input.value = previewStudentUsername(first, last);
}

function formatDue(value) {
  if (!value) return 'No due date';
  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function typeLabel(type) {
  const value = String(type || '').toLowerCase();
  if (value === 'exam') return 'Exam';
  if (value === 'activity') return 'Activity';
  return 'Quiz';
}

function statusLabel(status) {
  if (status === 'pending') return 'Pending';
  if (status === 'finished') return 'Finished';
  if (status === 'missing') return 'Missing';
  return 'Posted';
}

function quarterLabel(quarter) {
  const value = String(quarter || 'Q1').toUpperCase();
  return value.startsWith('Q') ? `Quarter ${value.slice(1)}` : value;
}

function scoreText(item) {
  if (item.pending_score) return 'Not scored yet';
  if (item.score == null || item.score === '') return '—';
  const max = Number(item.max_score) || 0;
  return max ? `${item.score} / ${max}` : String(item.score);
}

async function studentFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const tokenHeader = authHeaders();
  if (tokenHeader.Authorization) headers.Authorization = tokenHeader.Authorization;
  if (options.json) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
  }
  const res = await fetch(`${apiUrl}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function selectedSubject() {
  return studentSubjects.find((item) => Number(item.id) === Number(studentSubjectId)) || null;
}

function renderSubjectNav() {
  const nav = document.getElementById('student-subject-nav');
  if (!nav) return;
  if (!studentSubjects.length) {
    nav.innerHTML = '<p class="student-sidebar-empty">No subjects yet</p>';
    return;
  }
  nav.innerHTML = studentSubjects.map((subject) => `
    <button type="button" class="sidebar-item${Number(subject.id) === Number(studentSubjectId) ? ' active' : ''}" data-subject-id="${subject.id}">
      <span class="nav-ico">📚</span> ${escape(subject.name || 'Subject')}
    </button>
  `).join('');
}

function showSubjectPage() {
  const empty = document.getElementById('student-empty');
  const page = document.getElementById('student-subject');
  const work = document.getElementById('student-work');
  if (work) work.hidden = true;
  if (!studentSubjectId) {
    if (page) page.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  if (page) page.hidden = false;
  const subject = selectedSubject();
  const title = document.getElementById('student-subject-title');
  const code = document.getElementById('student-subject-code');
  if (title) title.textContent = subject?.name || 'Subject';
  if (code) code.textContent = subject?.code || '';
  document.querySelectorAll('[data-student-tab]').forEach((btn) => {
    btn.classList.toggle('primary', btn.dataset.studentTab === studentTab);
  });
  const classwork = document.getElementById('student-classwork');
  const material = document.getElementById('student-material');
  const record = document.getElementById('student-record');
  if (classwork) classwork.hidden = studentTab !== 'classwork';
  if (material) material.hidden = studentTab !== 'material';
  if (record) record.hidden = studentTab !== 'record';
}

function fillRecordQuarterOptions() {
  const sel = document.getElementById('student-record-quarter');
  if (!sel) return;
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const current = recordQuarter || 'all';
  sel.innerHTML = `<option value="all">All</option>${quarters.map((q) => (
    `<option value="${escape(q)}">${escape(quarterLabel(q))}</option>`
  )).join('')}`;
  sel.value = [...sel.options].some((option) => option.value === current) ? current : 'all';
  recordQuarter = sel.value;
}

function selectSubject(id, tab) {
  studentSubjectId = id;
  studentTab = tab || 'classwork';
  renderSubjectNav();
  showSubjectPage();
  if (studentTab === 'material') loadStudentMaterials();
  else if (studentTab === 'record') loadStudentRecords();
  else loadStudentClasswork();
}

async function loadStudentSubjects() {
  const nameEl = document.getElementById('student-sidebar-name');
  const empty = document.getElementById('student-empty');
  if (empty) empty.hidden = false;
  try {
    const data = await studentFetch('/student/subjects');
    studentSubjects = Array.isArray(data.subjects) ? data.subjects : [];
    const student = data.student || {};
    if (nameEl) {
      const name = `${student.first_name || ''} ${student.last_name || ''}`.trim();
      nameEl.textContent = name
        ? `${name} · Grade ${student.grade_level}-${student.section}`
        : 'Student';
    }
    if (!studentSubjects.length) {
      studentSubjectId = null;
      renderSubjectNav();
      showSubjectPage();
      if (empty) {
        empty.hidden = false;
        empty.innerHTML = `
          <h3 class="page-heading font-heading">Subjects</h3>
          <p class="empty-state">No subjects are assigned to your section yet.</p>`;
      }
      return;
    }
    const stillThere = studentSubjects.some((item) => Number(item.id) === Number(studentSubjectId));
    selectSubject(stillThere ? studentSubjectId : studentSubjects[0].id, studentTab);
  } catch (error) {
    studentSubjects = [];
    renderSubjectNav();
    if (empty) {
      empty.hidden = false;
      empty.innerHTML = `<p class="empty-state">${escape(error.message)}</p>`;
    }
  }
}

async function loadStudentClasswork() {
  const host = document.getElementById('student-classwork-list');
  if (!host || !studentSubjectId) return;
  host.innerHTML = '<p class="empty-state">Loading classwork…</p>';
  try {
    const params = new URLSearchParams();
    if (studentTodo && studentTodo !== 'all') params.set('status', studentTodo);
    if (classworkType && classworkType !== 'all') params.set('type', classworkType);
    const data = await studentFetch(`/student/subjects/${studentSubjectId}/classwork?${params.toString()}`);
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      host.innerHTML = '<p class="empty-state">No classwork in this list.</p>';
      return;
    }
    const groups = [
      ['pending', 'Pending'],
      ['finished', 'Finished'],
      ['missing', 'Missing']
    ];
    host.innerHTML = groups.map(([status, label]) => {
      const rows = items.filter((item) => item.status === status);
      if (!rows.length) return '';
      const cards = rows.map((item) => {
        const kind = String(item.type || 'quiz').toLowerCase();
        const takeHome = String(item.activity_mode || '') === 'take_home'
          ? '<span class="badge">Take-home</span>'
          : '';
        const open = item.status === 'pending'
          ? `<button type="button" class="chip-ghost primary" data-open-work="${item.id}">Open</button>`
          : '';
        return `
          <article class="student-box student-box--${escape(kind)}">
            <div class="student-box-tags">
              <span class="badge type-${escape(kind)}">${escape(typeLabel(kind))}</span>
              ${takeHome}
            </div>
            <h4>${escape(item.title)}</h4>
            <p class="student-box-meta">Due ${escape(formatDue(item.due_at))}</p>
            ${open}
          </article>`;
      }).join('');
      return `<section class="student-box-group">
        <h4 class="student-quarter-heading">${escape(label)}</h4>
        <div class="student-box-grid">${cards}</div>
      </section>`;
    }).join('');
  } catch (error) {
    host.innerHTML = `<p class="empty-state">${escape(error.message)}</p>`;
  }
}

async function loadStudentMaterials() {
  const host = document.getElementById('student-material-list');
  if (!host || !studentSubjectId) return;
  host.innerHTML = '<p class="empty-state">Loading materials…</p>';
  try {
    const data = await studentFetch(`/student/subjects/${studentSubjectId}/materials`);
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      host.innerHTML = '<p class="empty-state">No materials for this subject yet.</p>';
      return;
    }
    const groups = new Map();
    items.forEach((item) => {
      const quarter = String(item.quarter || 'Q1').toUpperCase();
      if (!groups.has(quarter)) groups.set(quarter, []);
      groups.get(quarter).push(item);
    });
    const order = ['Q1', 'Q2', 'Q3', 'Q4'].filter((quarter) => groups.has(quarter));
    groups.forEach((_rows, quarter) => {
      if (!order.includes(quarter)) order.push(quarter);
    });
    host.innerHTML = order.map((quarter) => {
      const cards = groups.get(quarter).map((item) => {
        const file = item.file_path
          ? `<a class="chip-ghost primary" href="${escape(item.file_path)}" target="_blank" rel="noopener">Open file</a>`
          : '';
        const objectives = item.objectives
          ? `<p class="student-box-meta">${escape(item.objectives)}</p>`
          : '';
        return `
          <article class="student-box student-box--file">
            <h4>${escape(item.title)}</h4>
            ${objectives}
            ${file}
          </article>`;
      }).join('');
      return `<section class="student-box-group">
        <h4 class="student-quarter-heading">${escape(quarterLabel(quarter))}</h4>
        <div class="student-box-grid">${cards}</div>
      </section>`;
    }).join('');
  } catch (error) {
    host.innerHTML = `<p class="empty-state">${escape(error.message)}</p>`;
  }
}

async function loadStudentRecords() {
  const host = document.getElementById('student-record-list');
  if (!host || !studentSubjectId) return;
  host.innerHTML = '<p class="empty-state">Loading records…</p>';
  try {
    const params = new URLSearchParams();
    if (recordType && recordType !== 'all') params.set('type', recordType);
    if (recordQuarter && recordQuarter !== 'all') params.set('quarter', recordQuarter);
    const data = await studentFetch(`/student/subjects/${studentSubjectId}/records?${params.toString()}`);
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      host.innerHTML = '<p class="empty-state">No records for this filter.</p>';
      return;
    }
    const groups = new Map();
    items.forEach((item) => {
      const quarter = String(item.quarter || 'Q1').toUpperCase();
      if (!groups.has(quarter)) groups.set(quarter, []);
      groups.get(quarter).push(item);
    });
    const order = ['Q1', 'Q2', 'Q3', 'Q4'].filter((quarter) => groups.has(quarter));
    groups.forEach((_rows, quarter) => {
      if (!order.includes(quarter)) order.push(quarter);
    });
    host.innerHTML = order.map((quarter) => {
      const cards = groups.get(quarter).map((item) => {
        const kind = String(item.type || 'quiz').toLowerCase();
        const view = item.has_submission
          ? `<button type="button" class="chip-ghost primary" data-view-work="${item.id}">View work</button>`
          : '';
        const takeHome = String(item.activity_mode || '') === 'take_home'
          ? '<span class="badge">Take-home</span>'
          : '';
        return `
          <article class="student-box student-box--${escape(kind)}">
            <strong class="student-box-score">${escape(scoreText(item))}</strong>
            <div class="student-box-tags">
              <span class="badge type-${escape(kind)}">${escape(typeLabel(kind))}</span>
              ${takeHome}
            </div>
            <h4>${escape(item.title)}</h4>
            ${view}
          </article>`;
      }).join('');
      return `<section class="student-box-group">
        <h4 class="student-quarter-heading">${escape(quarterLabel(quarter))}</h4>
        <div class="student-box-grid">${cards}</div>
      </section>`;
    }).join('');
  } catch (error) {
    host.innerHTML = `<p class="empty-state">${escape(error.message)}</p>`;
  }
}

function questionBody(question) {
  const type = String(question.item_type || '').toLowerCase();
  const id = question.id;
  if (type === 'true_false' || type === 'mcq') {
    const choices = type === 'true_false' && !(question.choices || []).length
      ? ['True', 'False']
      : (question.choices || []);
    return `<div class="student-choices">${choices.map((choice) => `
      <label><input type="radio" name="q_${id}" value="${escape(choice)}" /> ${escape(choice)}</label>
    `).join('')}</div>`;
  }
  if (type === 'fill_blank') {
    const parts = String(question.question || '').split(/_{3,}/);
    const blanks = Math.max(1, parts.length - 1);
    return `<div class="student-blanks">${Array.from({ length: blanks }, () => '<input type="text" class="student-blank" />').join('')}</div>`;
  }
  if (type === 'matching') {
    const pairs = (question.choices || []).map((choice) => {
      const bits = String(choice).split('|');
      return { left: (bits[0] || '').trim(), right: bits.slice(1).join('|').trim() };
    }).filter((pair) => pair.left && pair.right);
    const rights = [];
    const seen = new Set();
    pairs.forEach((pair) => {
      const key = pair.right.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      rights.push(pair.right);
    });
    const options = `<option value="">Choose</option>${rights.map((right) => `<option value="${escape(right)}">${escape(right)}</option>`).join('')}`;
    return `<div class="student-match">${pairs.map((pair) => `
      <label class="student-match-row"><span>${escape(pair.left)}</span>
        <select class="student-match-select" data-left="${escape(pair.left)}">${options}</select>
      </label>`).join('')}</div>`;
  }
  if (type === 'sequencing') {
    const steps = (question.choices || []).map((step) => String(step));
    return `<ol class="student-seq">${steps.map((step) => `
      <li data-step="${escape(step)}"><span>${escape(step)}</span>
        <span><button type="button" data-move="up">Up</button><button type="button" data-move="down">Down</button></span>
      </li>`).join('')}</ol>`;
  }
  if (type === 'identification' && (question.choices || []).length) {
    const options = `<option value="">Choose</option>${question.choices.map((word) => `<option value="${escape(word)}">${escape(word)}</option>`).join('')}`;
    return `<select class="student-id-select">${options}</select>`;
  }
  if (type === 'activity' || type === 'activity_prompt') {
    return `<textarea class="student-answer" placeholder="Write your answer"></textarea>
      <input type="file" class="student-file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*" />`;
  }
  return '<textarea class="student-answer" placeholder="Your answer"></textarea>';
}

function showWorkHost() {
  const page = document.getElementById('student-subject');
  const empty = document.getElementById('student-empty');
  const host = document.getElementById('student-work');
  if (page) page.hidden = true;
  if (empty) empty.hidden = true;
  if (host) host.hidden = false;
  return host;
}

function renderStudentWork(data) {
  const host = showWorkHost();
  if (!host) return;
  workReturnTab = 'classwork';
  if (data.status !== 'pending') {
    const score = data.score != null ? ` Score: ${data.score}.` : '';
    host.innerHTML = `
      <button type="button" class="chip-ghost" id="student-work-back">← Back</button>
      <h3 class="page-heading font-heading">${escape(data.title)}</h3>
      <p>${escape(data.subject_name)} · ${escape(typeLabel(data.type))} · ${escape(data.status)}.${escape(score)}</p>`;
    return;
  }
  const questions = (data.questions || []).map((question, index) => {
    const type = String(question.item_type || '').toLowerCase();
    const prompt = type === 'fill_blank'
      ? escape(question.question)
      : `<strong>${index + 1}.</strong> ${escape(question.question)}`;
    return `<div class="student-question" data-qid="${question.id}" data-kind="${escape(type)}">
      <p>${prompt} <span class="page-subheading">(${question.points || 1} pts)</span></p>
      ${questionBody(question)}
    </div>`;
  }).join('');
  host.innerHTML = `
    <button type="button" class="chip-ghost" id="student-work-back">← Back</button>
    <h3 class="page-heading font-heading">${escape(data.title)}</h3>
    <p class="page-subheading">${escape(data.subject_name)} · ${escape(typeLabel(data.type))} · Due ${escape(formatDue(data.due_at))}</p>
    <div id="student-question-list">${questions}</div>
    <p id="student-work-error" class="inline-message" style="color:#b71c1c;" hidden></p>
    <button type="button" class="btn-solid" id="student-work-submit" data-work-id="${data.id}">Submit</button>`;
}

function renderSubmittedWork(data) {
  const host = showWorkHost();
  if (!host) return;
  workReturnTab = 'record';
  const items = (data.items || []).map((item) => {
    const file = item.file && item.file.url
      ? `<p><a href="${escape(item.file.url)}" target="_blank" rel="noopener">${escape(item.file.name || 'Attachment')}</a></p>`
      : '';
    return `<div class="student-question">
      <p><strong>${item.n}.</strong> ${escape(item.question || '')}</p>
      <p><strong>Your answer:</strong> ${escape(item.given || '—')}</p>
      ${file}
    </div>`;
  }).join('') || '<p class="empty-state">No submitted answers are stored for this work.</p>';
  host.innerHTML = `
    <button type="button" class="chip-ghost" id="student-work-back">← Back</button>
    <h3 class="page-heading font-heading">${escape(data.title)}</h3>
    <p class="page-subheading">${escape(typeLabel(data.type))} · ${escape(quarterLabel(data.quarter))} · Score ${escape(scoreText(data))}</p>
    ${items}`;
}

async function openStudentWork(id) {
  const host = showWorkHost();
  if (host) host.innerHTML = '<p class="empty-state">Loading classwork…</p>';
  try {
    const data = await studentFetch(`/student/classwork/${id}`);
    renderStudentWork(data);
  } catch (error) {
    if (host) host.innerHTML = `<p class="empty-state">${escape(error.message)}</p>`;
    toast(error.message, 'error');
  }
}

async function openSubmittedWork(id) {
  const host = showWorkHost();
  if (host) host.innerHTML = '<p class="empty-state">Loading submitted work…</p>';
  try {
    const data = await studentFetch(`/student/classwork/${id}/work`);
    renderSubmittedWork(data);
  } catch (error) {
    if (host) host.innerHTML = `<p class="empty-state">${escape(error.message)}</p>`;
    toast(error.message, 'error');
  }
}

function collectAnswers(root) {
  const answers = {};
  const fd = new FormData();
  let hasFile = false;
  let missingActivity = false;
  root.querySelectorAll('.student-question').forEach((block) => {
    const qid = block.dataset.qid;
    const kind = block.dataset.kind;
    if (kind === 'mcq' || kind === 'true_false') {
      const checked = block.querySelector('input[type="radio"]:checked');
      answers[qid] = checked ? checked.value : '';
      return;
    }
    if (kind === 'fill_blank') {
      answers[qid] = [...block.querySelectorAll('.student-blank')].map((input) => input.value.trim()).join(', ');
      return;
    }
    if (kind === 'matching') {
      answers[qid] = [...block.querySelectorAll('.student-match-select')].map((select) => (
        `${select.dataset.left || ''} | ${select.value || ''}`
      )).join('; ');
      return;
    }
    if (kind === 'sequencing') {
      answers[qid] = [...block.querySelectorAll('.student-seq li')].map((item) => item.dataset.step || '').join(' | ');
      return;
    }
    if (kind === 'identification') {
      answers[qid] = block.querySelector('.student-id-select')?.value || '';
      return;
    }
    const text = block.querySelector('textarea')?.value.trim() || '';
    if (kind === 'activity' || kind === 'activity_prompt') {
      if (!text) missingActivity = true;
      answers[qid] = { text };
      const file = block.querySelector('.student-file')?.files?.[0];
      if (file) {
        fd.append(`file_${qid}`, file);
        hasFile = true;
      }
      return;
    }
    answers[qid] = text;
  });
  return { answers, fd, hasFile, missingActivity };
}

async function submitStudentWork(id) {
  const root = document.getElementById('student-question-list');
  const errEl = document.getElementById('student-work-error');
  if (!root) return;
  const collected = collectAnswers(root);
  if (collected.missingActivity) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = 'Write your answer for every activity item before submitting.';
    }
    return;
  }
  try {
    let data;
    if (collected.hasFile) {
      collected.fd.append('answers', JSON.stringify(collected.answers));
      const headers = {};
      const tokenHeader = authHeaders();
      if (tokenHeader.Authorization) headers.Authorization = tokenHeader.Authorization;
      const res = await fetch(`${apiUrl}/student/classwork/${id}/submit`, {
        method: 'POST',
        headers,
        body: collected.fd
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not submit');
    } else {
      data = await studentFetch(`/student/classwork/${id}/submit`, {
        method: 'POST',
        json: { answers: collected.answers }
      });
    }
    toast(data.message || 'Submitted');
    studentTab = 'classwork';
    showSubjectPage();
    loadStudentClasswork();
  } catch (error) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = error.message;
    } else {
      toast(error.message, 'error');
    }
  }
}

function wireStudentPortal() {
  if (wired) return;
  wired = true;
  document.getElementById('student-first')?.addEventListener('input', syncEnrollUsernamePreview);
  document.getElementById('student-last')?.addEventListener('input', syncEnrollUsernamePreview);
  document.getElementById('student-todo')?.addEventListener('change', (event) => {
    studentTodo = event.target.value || 'all';
    loadStudentClasswork();
  });
  document.getElementById('student-classwork-type')?.addEventListener('change', (event) => {
    classworkType = event.target.value || 'all';
    loadStudentClasswork();
  });
  document.getElementById('student-record-type')?.addEventListener('change', (event) => {
    recordType = event.target.value || 'all';
    loadStudentRecords();
  });
  document.getElementById('student-record-quarter')?.addEventListener('change', (event) => {
    recordQuarter = event.target.value || 'all';
    loadStudentRecords();
  });
  document.getElementById('view-student')?.addEventListener('click', (event) => {
    const tabBtn = event.target.closest('[data-student-tab]');
    if (tabBtn) {
      studentTab = tabBtn.dataset.studentTab || 'classwork';
      showSubjectPage();
      if (studentTab === 'material') loadStudentMaterials();
      else if (studentTab === 'record') loadStudentRecords();
      else loadStudentClasswork();
      return;
    }
    const subjectBtn = event.target.closest('[data-subject-id]');
    if (subjectBtn && subjectBtn.closest('#student-subject-nav')) {
      selectSubject(Number(subjectBtn.dataset.subjectId), 'classwork');
      return;
    }
    const openBtn = event.target.closest('[data-open-work]');
    if (openBtn) {
      openStudentWork(openBtn.dataset.openWork);
      return;
    }
    const viewBtn = event.target.closest('[data-view-work]');
    if (viewBtn) {
      openSubmittedWork(viewBtn.dataset.viewWork);
      return;
    }
    if (event.target.closest('#student-work-back')) {
      studentTab = workReturnTab || 'classwork';
      showSubjectPage();
      if (studentTab === 'record') loadStudentRecords();
      else if (studentTab === 'material') loadStudentMaterials();
      else loadStudentClasswork();
      return;
    }
    const move = event.target.closest('[data-move]');
    if (move) {
      const item = move.closest('li');
      const list = item && item.parentElement;
      if (!item || !list) return;
      if (move.dataset.move === 'up' && item.previousElementSibling) {
        list.insertBefore(item, item.previousElementSibling);
      } else if (move.dataset.move === 'down' && item.nextElementSibling) {
        list.insertBefore(item.nextElementSibling, item);
      }
      return;
    }
    const submit = event.target.closest('#student-work-submit');
    if (submit) submitStudentWork(submit.dataset.workId);
  });
}

export function refreshEnrollUsernamePreview() {
  syncEnrollUsernamePreview();
}

export function loadStudentPortal() {
  wireStudentPortal();
  studentTab = 'classwork';
  studentTodo = 'all';
  classworkType = 'all';
  recordType = 'all';
  recordQuarter = 'all';
  const todo = document.getElementById('student-todo');
  const classworkTypeSel = document.getElementById('student-classwork-type');
  const type = document.getElementById('student-record-type');
  if (todo) todo.value = 'all';
  if (classworkTypeSel) classworkTypeSel.value = 'all';
  if (type) type.value = 'all';
  fillRecordQuarterOptions();
  loadStudentSubjects();
}

export function initStudentPortal(options) {
  apiUrl = options.apiUrl;
  authHeaders = options.authHeaders;
  escape = options.escapeHtml;
  toast = options.showToast;
  wireStudentPortal();
}
