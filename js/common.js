/**
 * common.js — иконки, подписи статусов, уведомления, шапка и проверка роли.
 * Подключается на всех страницах, функции отсюда вызывают student.js, teacher.js, login.js.
 *
 * ПОДСКАЗКА:
 * • Подписи статусов ниже — это то, что видит пользователь в бейджах и таблицах.
 *   Переименуешь «На проверке» → «Ждёт учителя» — изменится на всём сайте.
 * • Новая иконка: добавь <symbol id="icon-имя"> в ICON_SPRITE и вызывай icon('имя').
 * • showToast — всплывающее сообщение внизу экрана (время показа — внутри функции).
 * • requireRole — «охранник» страницы: без входа или с чужой ролью отправит на login.html.
 */

// статусы достижений (бейджи в таблицах ученика и учителя)
const ACH_STATUS_LABELS = { pending: 'На проверке', approved: 'Подтверждено', rejected: 'Отклонено', revoked: 'Отозвано' };
const CONTEST_STATUS_LABELS = { upcoming: 'Скоро', active: 'Идёт приём', finished: 'Завершён' };
const RESULT_LABELS = { registered: 'Заявка подана', participant: 'Участник', '3': '3 место', '2': '2 место', '1': '1 место', absent: 'Не явился' };
const ROLE_LABELS = { student: 'Ученик', teacher: 'Учитель', admin: 'Администратор' };

// Один набор line-иконок (24×24, единая обводка) + заливная «искра» из референса.
const ICON_SPRITE = `
<svg class="icon-sprite" xmlns="http://www.w3.org/2000/svg">
  <symbol id="icon-logo" viewBox="0 0 24 24"><path d="M3 6l4.5 12L12 8l4.5 10L21 6"/><path d="M9.5 12.5h5"/></symbol>
  <symbol id="icon-sparkle" viewBox="0 0 24 24"><path d="M12 0c.9 6.6 4.8 10.8 12 12-7.2 1.2-11.1 5.4-12 12-.9-6.6-4.8-10.8-12-12C7.2 10.8 11.1 6.6 12 0z" fill="currentColor" stroke="none"/></symbol>
  <symbol id="icon-arrow-right" viewBox="0 0 24 24"><path d="M3 12h17"/><path d="M14 6l6 6-6 6"/></symbol>
  <symbol id="icon-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></symbol>
  <symbol id="icon-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 6.5l8 6.5 8-6.5"/></symbol>
  <symbol id="icon-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
  <symbol id="icon-x" viewBox="0 0 24 24"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></symbol>
  <symbol id="icon-undo" viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></symbol>
  <symbol id="icon-plus" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></symbol>
  <symbol id="icon-edit" viewBox="0 0 24 24"><path d="M4 20l1-4 11-11 3 3-11 11-4 1z"/><path d="M14 6l3 3"/></symbol>
  <symbol id="icon-trash" viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/></symbol>
  <symbol id="icon-download" viewBox="0 0 24 24"><path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19h14"/></symbol>
  <symbol id="icon-print" viewBox="0 0 24 24"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1.5"/><path d="M6 15h12v6H6z"/></symbol>
  <symbol id="icon-chart" viewBox="0 0 24 24"><path d="M4 20V11"/><path d="M10 20V4"/><path d="M16 20v-6"/><path d="M4 20h16"/></symbol>
  <symbol id="icon-logout" viewBox="0 0 24 24"><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="M15 16l4-4-4-4"/><path d="M19 12H9"/></symbol>
  <symbol id="icon-telegram" viewBox="0 0 24 24"><path d="M21 4L3 11l6 2.2L18 7l-7 7.5 7 5.5z"/></symbol>
  <symbol id="icon-history" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></symbol>
  <symbol id="icon-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.2v.1"/></symbol>
</svg>`;

function injectIconSprite() {
  if (document.getElementById('icon-sprite-root')) return;
  const wrap = document.createElement('div');
  wrap.id = 'icon-sprite-root';
  wrap.innerHTML = ICON_SPRITE;
  document.body.prepend(wrap);
}
function icon(name, extraClass) {
  return `<svg class="icon${extraClass ? ' ' + extraClass : ''}"><use href="#icon-${name}"></use></svg>`;
}
if (document.body) injectIconSprite();
else document.addEventListener('DOMContentLoaded', injectIconSprite);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
/** Сегодняшняя дата YYYY-MM-DD по местному времени (toISOString дал бы UTC и вчерашний день после полуночи). */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** «1 балл», «3 балла», «21 балл», «25 баллов». */
function pointsWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} балл`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} балла`;
  return `${n} баллов`;
}

/** «с 15.10.2026 по 20.11.2026», или одна дата, если вторая не указана. */
function dateRange(start, end) {
  if (start && end) return `с ${formatDate(start)} по ${formatDate(end)}`;
  return formatDate(start || end);
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}
function subjectTag(subject) {
  if (!subject) return '<span class="subject">Общее</span>';
  return `<span class="subject subject--${subject}">${SUBJECT_LABELS[subject]}</span>`;
}
function statusBadge(status) {
  return `<span class="badge badge--${status}">${ACH_STATUS_LABELS[status] || status}</span>`;
}
function resultBadge(result) {
  const cls = ['1', '2', '3'].includes(result) ? 'won' : result;
  return `<span class="badge badge--${cls}">${RESULT_LABELS[result] || result}</span>`;
}

function downloadBlob(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showToast(message, isError = false) {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    box.setAttribute('role', 'status');
    document.body.appendChild(box);
  }
  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' toast--error' : '');
  toast.innerHTML = `${icon(isError ? 'alert' : 'sparkle')}<span>${escapeHtml(message)}</span>`;
  box.appendChild(toast);
  setTimeout(() => toast.classList.add('toast--visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3600); // 3600 мс = 3,6 с — столько сообщение висит на экране
}

/** Модалка-«причина»: возвращает введённый текст или null при отмене. */
function askReason(title, hint, confirmLabel = 'Подтвердить') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2>${escapeHtml(title)}</h2>
        <p class="modal__summary">${escapeHtml(hint)}</p>
        <div class="field"><label for="reason-input">Причина</label><textarea id="reason-input" rows="3" required></textarea></div>
        <p class="error-text" id="reason-error"></p>
        <div class="modal__actions">
          <button type="button" class="btn btn--outline" data-act="cancel">Отмена</button>
          <button type="button" class="btn btn--danger" data-act="ok">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#reason-input');
    input.focus();
    const close = (val) => { overlay.remove(); resolve(val); };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.dataset.act === 'cancel') close(null);
      if (e.target.dataset.act === 'ok') {
        if (!input.value.trim()) { overlay.querySelector('#reason-error').textContent = 'Без причины нельзя: она сохранится в истории.'; return; }
        close(input.value.trim());
      }
    });
  });
}

function initials(user) {
  return `${(user.firstName || '?')[0]}${(user.lastName || '?')[0]}`.toUpperCase();
}

/** Требует одобренного пользователя нужной роли, иначе — на страницу входа. */
async function requireRole(role) {
  let user = null;
  try { user = await api.auth.currentUser(); } catch (e) { user = null; }
  if (!user || user.role !== role) {
    window.location.href = 'login.html';
    return null;
  }
  renderNavbar(user);
  return user;
}

/** Правый угол шапки: инициалы, имя и кнопка «Выйти». */
function renderNavbar(user) {
  const slot = document.getElementById('navbar-user');
  if (!slot) return;
  slot.innerHTML = `
    <div class="navbar-user">
      <span class="avatar" aria-hidden="true">${escapeHtml(initials(user))}</span>
      <span class="navbar-user__name">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</span>
      <button id="logout-btn" class="btn btn--outline btn--small">${icon('logout')}Выйти</button>
    </div>`;
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api.auth.logout();
    window.location.href = 'login.html';
  });
}

/**
 * Переключение вкладок по data-tab у кнопок и id="panel-<имя>" у панелей.
 * Новая вкладка: кнопка <button class="tab-btn" data-tab="xxx"> + <section class="tab-panel" id="panel-xxx">.
 */
function initTabs(onChange) {
  const buttons = document.querySelectorAll('.tab-btn[data-tab]');
  buttons.forEach((btn) => btn.addEventListener('click', () => {
    buttons.forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${btn.dataset.tab}`));
    if (onChange) onChange(btn.dataset.tab);
  }));
}
