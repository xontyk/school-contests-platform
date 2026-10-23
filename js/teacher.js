/**
 * teacher.js — кабинет учителя.
 * Блоки: (1) вкладки, (2) заявки на регистрацию, (3) верификация
 * достижений, (4) ученики + добавление достижения напрямую, (5) рейтинг.
 */

let CURRENT_TEACHER = null;
let CURRENT_REG_ID = null;
let CURRENT_VERIFY_ID = null;

function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `panel-${btn.dataset.tab}`);
      });
    });
  });
}

function subjectTag(subject) {
  if (!subject) return '<span class="subject-tag subject-tag--none">Общее</span>';
  const labels = { physics: 'Физика', math: 'Математика', cs: 'Информатика' };
  return `<span class="subject-tag subject-tag--${subject}">${labels[subject]}</span>`;
}

// ================= Заявки на регистрацию =================

async function renderRegistrations() {
  const pending = await api.registrations.list({ status: 'pending' });
  const tbody = document.getElementById('registrations-tbody');
  const emptyState = document.getElementById('registrations-empty');
  const countBadge = document.getElementById('count-registrations');

  countBadge.style.display = pending.length ? 'inline-block' : 'none';
  countBadge.textContent = pending.length;

  if (!pending.length) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  tbody.innerHTML = pending.map((r) => `
    <tr>
      <td>${escapeHtml([r.lastName, r.firstName, r.middleName].filter(Boolean).join(' '))}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.className || '—')}</td>
      <td>${formatDate(r.requestedAt)}</td>
      <td><button class="btn btn--small" data-decide="${r.id}">Рассмотреть</button></td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-decide]').forEach((btn) => {
    btn.addEventListener('click', () => openRegDecision(btn.dataset.decide, pending));
  });
}

function openRegDecision(id, pendingList) {
  const req = pendingList.find((r) => r.id === id);
  CURRENT_REG_ID = id;
  document.getElementById('reg-decision-title').textContent = 'Заявка на регистрацию';
  document.getElementById('reg-decision-summary').innerHTML = `
    <strong>${escapeHtml([req.lastName, req.firstName, req.middleName].filter(Boolean).join(' '))}</strong><br />
    ${escapeHtml(req.email)} · класс: ${escapeHtml(req.className || '—')} · подана ${formatDate(req.requestedAt)}`;
  document.getElementById('reg-role-select').value = req.className ? 'student' : 'student';
  document.getElementById('reg-decision-overlay').classList.remove('hidden');
}
function closeRegDecision() { document.getElementById('reg-decision-overlay').classList.add('hidden'); }

function initRegistrationFlow() {
  document.getElementById('reg-decision-cancel').addEventListener('click', closeRegDecision);
  document.getElementById('reg-decision-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'reg-decision-overlay') closeRegDecision();
  });

  document.getElementById('reg-decision-approve').addEventListener('click', async () => {
    const role = document.getElementById('reg-role-select').value;
    try {
      await api.registrations.approve(CURRENT_REG_ID, { role, decidedBy: CURRENT_TEACHER.id });
      closeRegDecision();
      showToast('Заявка одобрена, пользователь может входить в систему');
      await renderRegistrations();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('reg-decision-reject').addEventListener('click', () => {
    closeRegDecision();
    document.getElementById('reg-reject-reason').value = '';
    document.getElementById('reg-reject-overlay').classList.remove('hidden');
  });
  document.getElementById('reg-reject-cancel').addEventListener('click', () => {
    document.getElementById('reg-reject-overlay').classList.add('hidden');
  });
  document.getElementById('reg-reject-confirm').addEventListener('click', async () => {
    try {
      await api.registrations.reject(CURRENT_REG_ID, {
        reason: document.getElementById('reg-reject-reason').value.trim(),
        decidedBy: CURRENT_TEACHER.id,
      });
      document.getElementById('reg-reject-overlay').classList.add('hidden');
      showToast('Заявка отклонена');
      await renderRegistrations();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// ================= Достижения на проверке =================

async function renderVerifyQueue() {
  const [pending, users] = await Promise.all([
    api.achievements.list({ status: 'pending' }),
    api.users.list(),
  ]);
  const tbody = document.getElementById('verify-tbody');
  const emptyState = document.getElementById('verify-empty');
  const countBadge = document.getElementById('count-verify');

  countBadge.style.display = pending.length ? 'inline-block' : 'none';
  countBadge.textContent = pending.length;

  if (!pending.length) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  tbody.innerHTML = pending.map((a) => {
    const u = users.find((x) => x.id === a.userId);
    return `
      <tr>
        <td>${escapeHtml(u ? `${u.lastName} ${u.firstName}` : a.userId)}</td>
        <td>${escapeHtml(a.title)}</td>
        <td><span class="category-tag">${CATEGORY_LABELS[a.category]}</span></td>
        <td>${subjectTag(a.subject)}</td>
        <td>${a.points}</td>
        <td><button class="btn btn--small" data-verify="${a.id}">Проверить</button></td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-verify]').forEach((btn) => {
    btn.addEventListener('click', () => openVerifyModal(btn.dataset.verify, pending, users));
  });
}

function openVerifyModal(id, pendingList, users) {
  const a = pendingList.find((x) => x.id === id);
  const u = users.find((x) => x.id === a.userId);
  CURRENT_VERIFY_ID = id;
  document.getElementById('verify-summary').innerHTML = `
    <strong>${escapeHtml(a.title)}</strong><br />
    Ученик: ${escapeHtml(u ? `${u.lastName} ${u.firstName}` : '—')} · ${CATEGORY_LABELS[a.category]}${a.subject ? ' · ' + SUBJECT_LABELS[a.subject] : ''}<br />
    ${a.description ? escapeHtml(a.description) + '<br />' : ''}Дата: ${formatDate(a.date)} · Период: ${escapeHtml(a.period || '—')}`;
  document.getElementById('verify-points').value = a.points;
  document.getElementById('verify-comment').value = '';
  document.getElementById('verify-overlay').classList.remove('hidden');
}
function closeVerifyModal() { document.getElementById('verify-overlay').classList.add('hidden'); }

function initVerifyFlow() {
  document.getElementById('verify-cancel').addEventListener('click', closeVerifyModal);
  document.getElementById('verify-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'verify-overlay') closeVerifyModal();
  });

  async function decide(status) {
    const comment = document.getElementById('verify-comment').value.trim();
    if (status === 'rejected' && !comment) {
      showToast('Укажите комментарий — почему достижение отклонено', true);
      return;
    }
    try {
      await api.achievements.verify(CURRENT_VERIFY_ID, {
        status,
        teacherComment: comment,
        verifiedBy: CURRENT_TEACHER.id,
        points: document.getElementById('verify-points').value,
      });
      closeVerifyModal();
      showToast(status === 'approved' ? 'Достижение подтверждено' : 'Достижение отклонено');
      await Promise.all([renderVerifyQueue(), renderStudents(), renderTeacherRating()]);
    } catch (err) {
      showToast(err.message, true);
    }
  }
  document.getElementById('verify-approve').addEventListener('click', () => decide('approved'));
  document.getElementById('verify-reject').addEventListener('click', () => decide('rejected'));
}

// ================= Ученики + добавление достижения =================

async function renderStudents() {
  const [students, allAch] = await Promise.all([
    api.users.list({ role: 'student' }),
    api.achievements.list({ status: 'approved' }),
  ]);
  const tbody = document.getElementById('students-tbody');
  tbody.innerHTML = students.map((s) => {
    const mine = allAch.filter((a) => a.userId === s.id);
    const points = mine.reduce((sum, a) => sum + a.points, 0);
    return `
      <tr>
        <td>${escapeHtml(`${s.lastName} ${s.firstName}`)}</td>
        <td>${escapeHtml(s.className || '—')}</td>
        <td>${mine.length}</td>
        <td><strong>${points}</strong></td>
        <td><button class="btn btn--ghost btn--small" data-add-for="${s.id}">${icon('plus-circle')}Добавить</button></td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-add-for]').forEach((btn) => {
    btn.addEventListener('click', () => openTeacherAddModal(btn.dataset.addFor, students));
  });
}

function syncTeacherAddFields() {
  const category = document.getElementById('ta-category').value;
  const levels = category === 'olympiad' ? OLYMPIAD_LEVELS : category === 'project' ? PROJECT_LEVELS : null;
  document.getElementById('ta-level-row').style.display = levels ? 'flex' : 'none';
  document.getElementById('ta-hours-field').style.display = category === 'volunteer' ? 'block' : 'none';
  if (levels) {
    document.getElementById('ta-level').innerHTML = Object.entries(levels).map(([key, v]) => `<option value="${key}">${v.label}</option>`).join('');
  }
  updateTeacherAddPreview();
}
function updateTeacherAddPreview() {
  const points = calcAchievementPoints({
    category: document.getElementById('ta-category').value,
    level: document.getElementById('ta-level').value,
    place: document.getElementById('ta-place').value,
    hours: document.getElementById('ta-hours').value,
  });
  document.getElementById('ta-points-preview').textContent = points;
}

function openTeacherAddModal(userId, students) {
  const s = students.find((x) => x.id === userId);
  document.getElementById('ta-user-id').value = userId;
  document.getElementById('ta-student-name').textContent = `${s.lastName} ${s.firstName} · ${s.className || ''}`;
  document.getElementById('teacher-add-form').reset();
  document.getElementById('ta-user-id').value = userId;
  document.getElementById('ta-date').value = new Date().toISOString().slice(0, 10);
  syncTeacherAddFields();
  document.getElementById('teacher-add-overlay').classList.remove('hidden');
}
function closeTeacherAddModal() { document.getElementById('teacher-add-overlay').classList.add('hidden'); }

function initTeacherAddFlow() {
  document.getElementById('teacher-add-cancel').addEventListener('click', closeTeacherAddModal);
  document.getElementById('teacher-add-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'teacher-add-overlay') closeTeacherAddModal();
  });
  document.getElementById('ta-category').addEventListener('change', syncTeacherAddFields);
  document.getElementById('ta-level').addEventListener('change', updateTeacherAddPreview);
  document.getElementById('ta-place').addEventListener('change', updateTeacherAddPreview);
  document.getElementById('ta-hours').addEventListener('input', updateTeacherAddPreview);

  document.getElementById('teacher-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.achievements.createByTeacher({
        userId: document.getElementById('ta-user-id').value,
        category: document.getElementById('ta-category').value,
        subject: document.getElementById('ta-subject').value || null,
        level: document.getElementById('ta-level').value || null,
        place: document.getElementById('ta-place').value || null,
        hours: document.getElementById('ta-hours').value || null,
        title: document.getElementById('ta-title').value.trim(),
        date: document.getElementById('ta-date').value,
        period: document.getElementById('ta-period').value.trim(),
      }, CURRENT_TEACHER.id);
      closeTeacherAddModal();
      showToast('Достижение добавлено и подтверждено');
      await Promise.all([renderStudents(), renderTeacherRating()]);
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// ================= Рейтинг =================

async function populateTeacherClassFilter() {
  const students = await api.users.list({ role: 'student' });
  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  document.getElementById('teacher-rating-class').innerHTML =
    '<option value="">Все классы</option>' + classes.map((c) => `<option value="${c}">${c}</option>`).join('');
}

let LAST_RATING_ROWS = [];

async function renderTeacherRating() {
  const className = document.getElementById('teacher-rating-class').value;
  const subject = document.getElementById('teacher-rating-subject').value;
  const rows = await api.rating.compute({ className, subject: subject || undefined });
  LAST_RATING_ROWS = rows;
  const tbody = document.getElementById('teacher-rating-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Нет данных.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r) => {
    const pillClass = r.rank === 1 ? 'rank-pill--gold' : r.rank === 2 ? 'rank-pill--silver' : r.rank === 3 ? 'rank-pill--bronze' : '';
    return `
      <tr ${r.rank <= 3 ? 'class="rank-top"' : ''}>
        <td><span class="rank-pill ${pillClass}">${r.rank}</span></td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.className || '—')}</td>
        <td>${r.physics}</td>
        <td>${r.math}</td>
        <td>${r.cs}</td>
        <td><strong>${r.total}</strong></td>
      </tr>`;
  }).join('');
}

function initRatingTab() {
  document.getElementById('teacher-rating-class').addEventListener('change', renderTeacherRating);
  document.getElementById('teacher-rating-subject').addEventListener('change', renderTeacherRating);
  document.getElementById('download-rating-csv').addEventListener('click', () => {
    if (!LAST_RATING_ROWS.length) return;
    const rows = LAST_RATING_ROWS.map((r) => ({
      Место: r.rank, Ученик: r.name, Класс: r.className, Физика: r.physics, Математика: r.math, Информатика: r.cs, Итого: r.total,
    }));
    downloadBlob(`rating_${Date.now()}.csv`, api.reports.toCSV(rows), 'text/csv;charset=utf-8');
  });
}

// ================= init =================
(async function init() {
  CURRENT_TEACHER = await requireRole('teacher');
  if (!CURRENT_TEACHER) return;
  initTabs();
  initRegistrationFlow();
  initVerifyFlow();
  initTeacherAddFlow();
  initRatingTab();
  await populateTeacherClassFilter();
  await Promise.all([renderRegistrations(), renderVerifyQueue(), renderStudents(), renderTeacherRating()]);
})();
