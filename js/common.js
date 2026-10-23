/**
 * common.js — общие утилиты, иконки и шапка навигации, переиспользуемые
 * на всех страницах.
 */

// Один набор line-иконок (24x24, единая толщина обводки) — без эмодзи,
// в духе гравировки на латунной табличке.
const ICON_SPRITE = `
<svg class="icon-sprite" xmlns="http://www.w3.org/2000/svg">
  <symbol id="icon-trophy" viewBox="0 0 24 24">
    <path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/>
    <path d="M7 5H5a2 2 0 0 0 2 3"/>
    <path d="M17 5h2a2 2 0 0 1-2 3"/>
    <path d="M12 13v3"/>
    <path d="M9 20h6"/>
    <path d="M10.3 16h3.4l.6 2H9.7l.6-2z"/>
  </symbol>
  <symbol id="icon-ledger" viewBox="0 0 24 24">
    <rect x="5" y="4" width="14" height="17" rx="2"/>
    <path d="M9 3.2h6v2.2H9z"/>
    <path d="M8.5 10.5h7"/>
    <path d="M8.5 14h7"/>
    <path d="M8.5 17.5h4"/>
  </symbol>
  <symbol id="icon-logout" viewBox="0 0 24 24">
    <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/>
    <path d="M15 16l4-4-4-4"/>
    <path d="M19 12H9"/>
  </symbol>
  <symbol id="icon-download" viewBox="0 0 24 24">
    <path d="M12 4v10"/>
    <path d="M8 10l4 4 4-4"/>
    <path d="M5 18h14"/>
  </symbol>
  <symbol id="icon-upload-file" viewBox="0 0 24 24">
    <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
    <path d="M14 3v4h4"/>
    <path d="M12 12v6"/>
    <path d="M9 15h6"/>
  </symbol>
  <symbol id="icon-file" viewBox="0 0 24 24">
    <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
    <path d="M14 3v4h4"/>
    <path d="M8.5 13h7"/>
    <path d="M8.5 16.5h7"/>
  </symbol>
  <symbol id="icon-chart" viewBox="0 0 24 24">
    <path d="M4 20V11"/>
    <path d="M10 20V4"/>
    <path d="M16 20v-6"/>
    <path d="M4 20h16"/>
  </symbol>
  <symbol id="icon-plus-circle" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 8v8"/>
    <path d="M8 12h8"/>
  </symbol>
  <symbol id="icon-edit" viewBox="0 0 24 24">
    <path d="M4 20l1-4 11-11 3 3-11 11-4 1z"/>
    <path d="M14 6l3 3"/>
  </symbol>
  <symbol id="icon-trash" viewBox="0 0 24 24">
    <path d="M5 7h14"/>
    <path d="M9 7V4h6v3"/>
    <path d="M7 7l1 13h8l1-13"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
  </symbol>
  <symbol id="icon-star" viewBox="0 0 24 24">
    <path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3z"/>
  </symbol>
  <symbol id="icon-alert" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 8v5"/>
    <path d="M12 16.2v.1"/>
  </symbol>
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

const STATUS_LABELS = {
  registered: 'Зарегистрирован',
  in_progress: 'Участвует',
  completed: 'Завершил',
  winner: 'Победитель',
};

const CONTEST_STATUS_LABELS = {
  upcoming: 'Скоро старт',
  active: 'Идёт приём',
  finished: 'Завершён',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function showToast(message, isError = false) {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    document.body.appendChild(box);
  }
  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' toast--error' : '');
  toast.innerHTML = /<svg/.test(message) ? message : `${icon(isError ? 'alert' : 'star')}<span>${message}</span>`;
  box.appendChild(toast);
  setTimeout(() => toast.classList.add('toast--visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

/** Требует залогиненного пользователя нужной роли, иначе редиректит на index.html */
async function requireRole(role) {
  const user = await api.auth.currentUser();
  if (!user || user.role !== role) {
    window.location.href = 'index.html';
    return null;
  }
  renderNavbar(user);
  return user;
}

function renderNavbar(user) {
  const slot = document.getElementById('navbar-user');
  if (!slot) return;
  slot.innerHTML = `
    <div class="navbar-user">
      <span class="avatar">${escapeHtml(user.firstName[0] + user.lastName[0])}</span>
      <span class="navbar-user__name">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</span>
      <button id="logout-btn" class="btn btn--ghost btn--small">${icon('logout')}Выйти</button>
    </div>`;
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api.auth.logout();
    window.location.href = 'index.html';
  });
}
