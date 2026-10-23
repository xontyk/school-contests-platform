/**
 * student.js — кабинет ученика.
 * Блоки: (1) карта созвездий и портфолио, (2) афиша конкурсов и мои
 * результаты, (3) мои достижения + форма, (4) рейтинг, (5) Telegram и печать.
 * Все данные — из общей базы через api.*; права ограничивает RLS.
 *
 * ПОДСКАЗКА: что на экране → какая функция его рисует
 * • Вкладка «Карта и портфолио» (звёзды, плитки баллов, таблица)  → renderMap()
 * • Вкладка «Конкурсы» (карточки, «Участвовать», мои результаты)  → renderContests()
 * • Вкладка «Достижения» (таблица)                                 → renderAchievements()
 * • Окно «Добавить достижение» и предпросмотр баллов              → initAchievementForm(), updatePreview()
 * • Вкладка «Рейтинг» (фильтры, топ-10, «(вы)»)                    → renderRating()
 * • Кнопки «Подключить Telegram» и «Портфолио в PDF»               → initToolbar()
 * Разметка (HTML) этих блоков — в student.html, внешний вид — в css/style.css.
 */

let ME = null;
let MY_ACH = [];

// ---------------- (1) карта и портфолио ----------------
function renderMap() {
  renderConstellation(document.getElementById('constellation-root'), MY_ACH);
  const approved = MY_ACH.filter((a) => a.status === 'approved');
  const sum = (list) => list.reduce((s, a) => s + a.points, 0);
  const bySubject = (s) => sum(approved.filter((a) => a.subject === s));

  document.getElementById('portfolio-stats').innerHTML = `
    <div class="stat stat--total"><strong>${sum(approved)}</strong><span>Всего баллов</span></div>
    <div class="stat stat--physics"><strong>${bySubject('physics')}</strong><span>Физика</span></div>
    <div class="stat stat--math"><strong>${bySubject('math')}</strong><span>Математика</span></div>
    <div class="stat stat--cs"><strong>${bySubject('cs')}</strong><span>Информатика</span></div>
    <div class="stat"><strong>${approved.length}</strong><span>Звёзд на карте</span></div>`;

  document.getElementById('category-summary').innerHTML = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const list = approved.filter((a) => a.category === key);
    return `<div class="stat"><strong>${list.length}</strong><span>${label} · ${pointsWord(sum(list))}</span></div>`;
  }).join('');

  const tbody = document.getElementById('portfolio-tbody');
  tbody.innerHTML = approved.length ? approved.map((a) => `
    <tr>
      <td>${escapeHtml(a.title)}</td>
      <td class="muted">${CATEGORY_LABELS[a.category]}</td>
      <td>${subjectTag(a.subject)}</td>
      <td class="muted">${escapeHtml(a.period || 'не указан')}</td>
      <td class="num-strong">+${a.points}</td>
      <td class="no-print"><button class="btn btn--outline btn--small" data-diploma="${a.id}">${icon('download')}Диплом</button></td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty-state">Пока нет подтверждённых достижений.</td></tr>';
}

// ---------------- (2) конкурсы ----------------
/** Афиша конкурсов: карточка на каждый конкурс + блок «Мои результаты». */
async function renderContests() {
  const [contests, mine] = await Promise.all([api.contests.list(), api.participations.listMine()]);
  const byContest = Object.fromEntries(mine.map((p) => [p.contestId, p]));
  const open = contests.filter((c) => c.status !== 'finished');
  const counter = document.getElementById('count-contests');
  counter.hidden = !open.length;
  counter.textContent = open.length;

  const grid = document.getElementById('contest-grid');
  grid.innerHTML = contests.length ? contests.map((c) => {
    const p = byContest[c.id];
    let action;
    if (p && p.result === 'registered') action = `<button class="btn btn--outline btn--small" data-leave="${p.id}">Отозвать заявку</button>`;
    else if (p) action = resultBadge(p.result);
    else if (c.status === 'finished') action = '<span class="muted">Приём закрыт</span>';
    else action = `<button class="btn btn--small" data-join="${c.id}">Участвовать</button>`;
    const level = (c.category === 'olympiad' ? OLYMPIAD_LEVELS : PROJECT_LEVELS)[c.level];
    return `
      <article class="contest-card">
        <div class="contest-card__meta">
          <span class="badge badge--${c.status}">${CONTEST_STATUS_LABELS[c.status]}</span>
          ${subjectTag(c.subject)}
          <span class="subject">${CATEGORY_LABELS[c.category]}${level ? ' · ' + level.label : ''}</span>
        </div>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.description)}</p>
        <div class="contest-card__footer">
          <span class="contest-card__dates">${dateRange(c.startDate, c.endDate)}</span>
          ${action}
        </div>
      </article>`;
  }).join('') : '<div class="empty-state">Учитель ещё не опубликовал ни одного конкурса.</div>';

  const tbody = document.getElementById('my-results-tbody');
  tbody.innerHTML = mine.length ? mine.map((p) => {
    const ach = MY_ACH.find((a) => a.id === p.achievementId);
    return `
      <tr>
        <td>${escapeHtml(p.contest ? p.contest.title : 'конкурс удалён')}</td>
        <td>${resultBadge(p.result)}</td>
        <td class="num-strong">${ach ? '+' + ach.points : ''}</td>
        <td class="muted">${escapeHtml(p.statusReason || '')}</td>
        <td>${ach && ach.status === 'approved' ? `<button class="btn btn--outline btn--small" data-diploma="${ach.id}">${icon('download')}Диплом</button>` : ''}</td>
      </tr>`;
  }).join('') : '<tr><td colspan="5" class="empty-state">Вы ещё не участвуете в конкурсах.</td></tr>';
}

// ---------------- (3) мои достижения ----------------
/** Таблица «Мои достижения» со статусами и комментариями учителя. */
function renderAchievements() {
  const tbody = document.getElementById('achievements-tbody');
  tbody.innerHTML = MY_ACH.length ? MY_ACH.map((a) => `
    <tr>
      <td>${escapeHtml(a.title)}${a.source === 'contest' ? ' <span class="muted">· конкурс</span>' : ''}${a.source === 'telegram' ? ' <span class="muted">· из бота</span>' : ''}</td>
      <td class="muted">${CATEGORY_LABELS[a.category]}</td>
      <td>${subjectTag(a.subject)}</td>
      <td class="num-strong">${a.status === 'approved' ? '+' + a.points : a.points}</td>
      <td>${statusBadge(a.status)}</td>
      <td class="muted">${escapeHtml(a.teacherComment || '')}</td>
      <td>${a.status === 'approved' ? `<button class="btn btn--outline btn--small" data-diploma="${a.id}">${icon('download')}Диплом</button>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="7" class="empty-state">Достижений пока нет. Добавьте первое!</td></tr>';
}

/** Показывает нужные поля формы: уровень и место — для олимпиад и проектов, часы — для волонтёрства. */
function syncForm() {
  const category = document.getElementById('ach-category').value;
  const hasLevels = fillLevelOptions(document.getElementById('ach-level'), category);
  document.getElementById('ach-level-row').hidden = !hasLevels;
  document.getElementById('ach-hours-field').hidden = category !== 'volunteer';
  updatePreview();
}
/** «Будет начислено N баллов» — считается тут же, по таблице из points.js. */
function updatePreview() {
  document.getElementById('ach-points').textContent = calcAchievementPoints({
    category: document.getElementById('ach-category').value,
    level: document.getElementById('ach-level').value,
    place: document.getElementById('ach-place').value,
    hours: document.getElementById('ach-hours').value,
  });
}
function initAchievementForm() {
  const modal = document.getElementById('ach-modal');
  const periodSelect = document.getElementById('ach-period');
  periodSelect.innerHTML = periodOptions().filter((o) => o.value.includes('четверть'))
    .map((o) => `<option value="${o.value}">${o.label}</option>`).join('');

  document.getElementById('add-achievement-btn').addEventListener('click', () => {
    document.getElementById('ach-form').reset();
    document.getElementById('ach-date').value = todayISO();
    periodSelect.value = periodOf();
    syncForm();
    modal.classList.remove('hidden');
    document.getElementById('ach-title').focus();
  });
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.hasAttribute('data-close')) modal.classList.add('hidden'); });
  document.getElementById('ach-category').addEventListener('change', syncForm);
  ['ach-level', 'ach-place'].forEach((id) => document.getElementById(id).addEventListener('change', updatePreview));
  document.getElementById('ach-hours').addEventListener('input', updatePreview);
  document.getElementById('ach-date').addEventListener('change', (e) => { periodSelect.value = periodOf(e.target.value); });

  document.getElementById('ach-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('ach-category').value;
    const hasLevel = category === 'olympiad' || category === 'project';
    if (category === 'volunteer' && !(Number(document.getElementById('ach-hours').value) > 0)) {
      showToast('Укажите количество часов', true);
      return;
    }
    e.submitter.disabled = true;
    try {
      await api.achievements.submit({
        category,
        subject: document.getElementById('ach-subject').value,
        level: hasLevel ? document.getElementById('ach-level').value : null,
        place: hasLevel ? document.getElementById('ach-place').value : null,
        hours: category === 'volunteer' ? document.getElementById('ach-hours').value : null,
        title: document.getElementById('ach-title').value.trim(),
        proofUrl: document.getElementById('ach-proof').value.trim(),
        date: document.getElementById('ach-date').value,
        period: periodSelect.value,
      });
      modal.classList.add('hidden');
      showToast('Отправлено на проверку учителю');
      await reloadMine();
    } catch (ex) {
      showToast(ex.message, true);
    } finally {
      e.submitter.disabled = false;
    }
  });
}

// ---------------- (4) рейтинг ----------------
/** Рейтинг лицея с фильтрами; строка текущего ученика помечается «(вы)». */
async function renderRating() {
  const rows = await api.rating.compute({
    className: document.getElementById('r-class').value,
    subject: document.getElementById('r-subject').value,
    period: document.getElementById('r-period').value,
  });
  const classSelect = document.getElementById('r-class');
  if (classSelect.options.length === 1) {
    const all = await api.rating.compute();
    [...new Set(all.map((r) => r.className).filter(Boolean))].sort()
      .forEach((c) => classSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`));
  }
  const top10 = document.getElementById('r-top10').checked;
  let shown = top10 ? rows.slice(0, 10) : rows;
  const me = rows.find((r) => r.userId === ME.id);
  if (top10 && me && me.rank > 10) shown = [...shown, me];

  document.getElementById('rating-tbody').innerHTML = shown.length ? shown.map((r) => `
    <tr class="${r.userId === ME.id ? 'is-me' : ''}">
      <td><span class="rank ${r.rank <= 3 ? 'rank--' + r.rank : ''}">${r.rank}</span></td>
      <td>${escapeHtml(r.name)}${r.userId === ME.id ? ' <strong>(вы)</strong>' : ''}</td>
      <td>${escapeHtml(r.className || '')}</td>
      <td>${r.physics}</td><td>${r.math}</td><td>${r.cs}</td><td>${r.other}</td>
      <td class="num-strong">${r.total}</td>
    </tr>`).join('') : '<tr><td colspan="8" class="empty-state">Нет данных для выбранных фильтров.</td></tr>';
}

// ---------------- (5) Telegram, печать, дипломы ----------------
/** Кнопки над вкладками: привязка Telegram (ссылка с одноразовым кодом) и печать в PDF. */
function initToolbar() {
  const tgBtn = document.getElementById('telegram-btn');
  if (ME.telegramLinked) tgBtn.querySelector('span').textContent = 'Telegram подключён';
  tgBtn.addEventListener('click', async () => {
    try {
      const url = await api.telegram.linkUrl();
      window.open(url, '_blank', 'noopener');
      showToast('Нажмите «Start» в боте, и аккаунт привяжется сам');
    } catch (ex) { showToast(ex.message, true); }
  });
  document.getElementById('print-btn').addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="map"]').click();
    window.print();
  });

  document.body.addEventListener('click', async (e) => {
    const diplomaBtn = e.target.closest('[data-diploma]');
    if (diplomaBtn) {
      const a = MY_ACH.find((x) => String(x.id) === diplomaBtn.dataset.diploma);
      if (a) {
        diplomaBtn.disabled = true;
        try { await downloadDiploma(a, ME); } finally { diplomaBtn.disabled = false; }
      }
    }
    const joinBtn = e.target.closest('[data-join]');
    if (joinBtn) {
      joinBtn.disabled = true;
      try { await api.participations.join(Number(joinBtn.dataset.join)); showToast('Заявка на участие подана'); await renderContests(); }
      catch (ex) { showToast(ex.message, true); joinBtn.disabled = false; }
    }
    const leaveBtn = e.target.closest('[data-leave]');
    if (leaveBtn) {
      leaveBtn.disabled = true;
      try { await api.participations.leave(Number(leaveBtn.dataset.leave)); showToast('Заявка отозвана'); await renderContests(); }
      catch (ex) { showToast(ex.message, true); leaveBtn.disabled = false; }
    }
  });
}

/** Заново загружает достижения ученика и перерисовывает карту, таблицу и конкурсы. */
async function reloadMine() {
  MY_ACH = await api.achievements.listMine();
  renderMap();
  renderAchievements();
  await renderContests();
}

(async function init() {
  ME = await requireRole('student');
  if (!ME) return;
  document.getElementById('student-subtitle').textContent = `${ME.fullName}${ME.className ? ' · ' + ME.className : ''}`;
  // при переключении вкладки перечитываем базу: учитель мог проверить достижение, пока вкладка была открыта
  initTabs((tab) => (tab === 'rating' ? renderRating() : reloadMine()).catch((e) => showToast(e.message, true)));
  initAchievementForm();
  initToolbar();

  const periodFilter = document.getElementById('r-period');
  periodFilter.innerHTML = '<option value="">За всё время</option>' + periodOptions().map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  ['r-class', 'r-subject', 'r-period', 'r-top10'].forEach((id) => document.getElementById(id).addEventListener('change', () => renderRating().catch((e) => showToast(e.message, true))));

  try { await reloadMine(); } catch (e) { showToast(e.message, true); }
})();
