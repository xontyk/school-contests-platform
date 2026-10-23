/**
 * student.js — личный кабинет ученика.
 * Блоки: (1) вкладки, (2) карта созвездий + сводка баллов,
 * (3) список достижений + форма добавления, (4) рейтинг с фильтрами.
 */

let CURRENT_USER = null;

function initTabs() {
  const links = document.querySelectorAll('[data-tab-link]');
  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const name = link.dataset.tabLink;
      links.forEach((l) => l.classList.toggle('active', l === link));
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${name}`);
      });
    });
  });
}

function subjectTag(subject) {
  if (!subject) return '<span class="subject-tag subject-tag--none">Общее</span>';
  const labels = { physics: 'Физика', math: 'Математика', cs: 'Информатика' };
  return `<span class="subject-tag subject-tag--${subject}">${labels[subject]}</span>`;
}

// ---------------- карта созвездий + сводка ----------------
async function renderMap() {
  const mine = await api.achievements.list({ userId: CURRENT_USER.id });
  renderConstellation(document.getElementById('constellation-svg-root'), mine);

  const approved = mine.filter((a) => a.status === 'approved');
  const bySubject = { physics: 0, math: 0, cs: 0 };
  approved.forEach((a) => { if (a.subject && bySubject[a.subject] != null) bySubject[a.subject] += a.points; });
  const total = approved.reduce((s, a) => s + a.points, 0);

  document.getElementById('portfolio-stats').innerHTML = `
    <div class="stat-plaque stat-plaque--total"><strong>${total}</strong><span>Всего баллов</span></div>
    <div class="stat-plaque stat-plaque--physics"><strong>${bySubject.physics}</strong><span>Физика</span></div>
    <div class="stat-plaque stat-plaque--math"><strong>${bySubject.math}</strong><span>Математика</span></div>
    <div class="stat-plaque stat-plaque--cs"><strong>${bySubject.cs}</strong><span>Информатика</span></div>
    <div class="stat-plaque"><strong>${approved.length}</strong><span>Звёзд на карте</span></div>
  `;
}

// ---------------- список достижений ----------------
async function renderAchievements() {
  const mine = await api.achievements.list({ userId: CURRENT_USER.id });
  const tbody = document.getElementById('achievements-tbody');
  const emptyState = document.getElementById('achievements-empty');

  if (!mine.length) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  tbody.innerHTML = mine.map((a) => `
    <tr>
      <td>${escapeHtml(a.title)}</td>
      <td><span class="category-tag">${CATEGORY_LABELS[a.category]}</span></td>
      <td>${subjectTag(a.subject)}</td>
      <td>${a.points}</td>
      <td><span class="badge badge--${a.status}">${ACH_STATUS_LABELS[a.status]}</span></td>
      <td style="font-size:12.5px;color:var(--ink-muted);">${escapeHtml(a.teacherComment || '—')}</td>
    </tr>`).join('');
}

// ---------------- форма добавления достижения ----------------
function syncAchievementFormFields() {
  const category = document.getElementById('ach-category').value;
  const levelRow = document.getElementById('ach-level-row');
  const hoursField = document.getElementById('ach-hours-field');
  const levelSelect = document.getElementById('ach-level');

  const levels = category === 'olympiad' ? OLYMPIAD_LEVELS : category === 'project' ? PROJECT_LEVELS : null;
  levelRow.style.display = levels ? 'flex' : 'none';
  hoursField.style.display = category === 'volunteer' ? 'block' : 'none';

  if (levels) {
    levelSelect.innerHTML = Object.entries(levels).map(([key, v]) => `<option value="${key}">${v.label}</option>`).join('');
  }
  updatePointsPreview();
}

function updatePointsPreview() {
  const category = document.getElementById('ach-category').value;
  const level = document.getElementById('ach-level').value;
  const place = document.getElementById('ach-place').value;
  const hours = document.getElementById('ach-hours').value;
  const points = calcAchievementPoints({ category, level, place, hours });
  document.getElementById('ach-points-preview').textContent = points;
}

function openAchievementModal() {
  document.getElementById('achievement-form').reset();
  document.getElementById('ach-date').value = new Date().toISOString().slice(0, 10);
  syncAchievementFormFields();
  document.getElementById('achievement-modal-overlay').classList.remove('hidden');
}
function closeAchievementModal() {
  document.getElementById('achievement-modal-overlay').classList.add('hidden');
}

function initAchievementForm() {
  document.getElementById('add-achievement-btn').addEventListener('click', openAchievementModal);
  document.getElementById('achievement-cancel-btn').addEventListener('click', closeAchievementModal);
  document.getElementById('achievement-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'achievement-modal-overlay') closeAchievementModal();
  });
  document.getElementById('ach-category').addEventListener('change', syncAchievementFormFields);
  document.getElementById('ach-level').addEventListener('change', updatePointsPreview);
  document.getElementById('ach-place').addEventListener('change', updatePointsPreview);
  document.getElementById('ach-hours').addEventListener('input', updatePointsPreview);

  document.getElementById('achievement-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('ach-category').value;
    try {
      await api.achievements.submit({
        userId: CURRENT_USER.id,
        category,
        subject: document.getElementById('ach-subject').value || null,
        level: document.getElementById('ach-level').value || null,
        place: document.getElementById('ach-place').value || null,
        hours: document.getElementById('ach-hours').value || null,
        title: document.getElementById('ach-title').value.trim(),
        description: document.getElementById('ach-description').value.trim(),
        date: document.getElementById('ach-date').value,
        period: document.getElementById('ach-period').value.trim(),
      });
      closeAchievementModal();
      showToast('Достижение отправлено на проверку учителю');
      await Promise.all([renderAchievements(), renderMap()]);
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// ---------------- рейтинг ----------------
async function populateClassFilter() {
  const students = await api.users.list({ role: 'student' });
  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  const select = document.getElementById('rating-class-filter');
  select.innerHTML = '<option value="">Все классы</option>' + classes.map((c) => `<option value="${c}">${c}</option>`).join('');
}

async function renderRating() {
  const className = document.getElementById('rating-class-filter').value;
  const subject = document.getElementById('rating-subject-filter').value;
  const rows = await api.rating.compute({ className, subject: subject || undefined });
  const tbody = document.getElementById('rating-tbody');

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Нет данных для выбранных фильтров.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const isMe = r.userId === CURRENT_USER.id;
    const pillClass = r.rank === 1 ? 'rank-pill--gold' : r.rank === 2 ? 'rank-pill--silver' : r.rank === 3 ? 'rank-pill--bronze' : '';
    return `
      <tr ${r.rank <= 3 ? 'class="rank-top"' : ''} style="${isMe ? 'background:rgba(124,111,255,.08);' : ''}">
        <td><span class="rank-pill ${pillClass}">${r.rank}</span></td>
        <td>${escapeHtml(r.name)}${isMe ? ' <strong>(вы)</strong>' : ''}</td>
        <td>${escapeHtml(r.className || '—')}</td>
        <td>${r.physics}</td>
        <td>${r.math}</td>
        <td>${r.cs}</td>
        <td><strong>${r.total}</strong></td>
      </tr>`;
  }).join('');
}

// ---------------- печать портфолио ----------------
function initPrint() {
  document.getElementById('print-portfolio-btn').addEventListener('click', () => window.print());
}

// ---------------- init ----------------
(async function init() {
  CURRENT_USER = await requireRole('student');
  if (!CURRENT_USER) return;
  initTabs();
  initAchievementForm();
  initPrint();
  await populateClassFilter();
  document.getElementById('rating-class-filter').addEventListener('change', renderRating);
  document.getElementById('rating-subject-filter').addEventListener('change', renderRating);
  await Promise.all([renderMap(), renderAchievements(), renderRating()]);
})();
