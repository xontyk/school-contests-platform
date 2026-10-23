/**
 * common.js — общие утилиты, иконки и шапка навигации для всех страниц.
 */

const ACH_STATUS_LABELS = {
  pending: 'На проверке',
  approved: 'Подтверждено',
  rejected: 'Отклонено',
};

const ROLE_LABELS = { student: 'Ученик', teacher: 'Учитель' };

// Один набор line-иконок (24x24, единая толщина обводки) — тема обсерватории:
// орбиты и звёзды вместо эмодзи.
const ICON_SPRITE = `
<svg class="icon-sprite" xmlns="http://www.w3.org/2000/svg">
  <symbol id="icon-orbit" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="2.3"/>
    <ellipse cx="12" cy="12" rx="10" ry="4.2"/>
    <ellipse cx="12" cy="12" rx="4.2" ry="10" transform="rotate(35 12 12)"/>
  </symbol>
  <symbol id="icon-star" viewBox="0 0 24 24">
    <path d="M12 3l2.4 5.1 5.6.7-4.1 3.9 1 5.6-4.9-2.6-4.9 2.6 1-5.6-4.1-3.9 5.6-.7L12 3z"/>
  </symbol>
  <symbol id="icon-star-filled" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 3l2.4 5.1 5.6.7-4.1 3.9 1 5.6-4.9-2.6-4.9 2.6 1-5.6-4.1-3.9 5.6-.7L12 3z"/>
  </symbol>
  <symbol id="icon-atom" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>
    <ellipse cx="12" cy="12" rx="9" ry="3.6"/>
    <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/>
    <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>
  </symbol>
  <symbol id="icon-compass" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"/>
    <path d="M15.5 8.5l-2.2 5.2-5.2 2.2 2.2-5.2 5.2-2.2z"/>
  </symbol>
  <symbol id="icon-code" viewBox="0 0 24 24">
    <path d="M9 7L4 12l5 5"/>
    <path d="M15 7l5 5-5 5"/>
  </symbol>
  <symbol id="icon-heart" viewBox="0 0 24 24">
    <path d="M12 20s-7.5-4.6-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2 4.4-9.5 9-9.5 9z"/>
  </symbol>
  <symbol id="icon-book" viewBox="0 0 24 24">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16z"/>
    <path d="M20 19H6.5A2.5 2.5 0 0 0 4 21.5"/>
  </symbol>
  <symbol id="icon-mail" viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <path d="M4 6.5l8 6.5 8-6.5"/>
  </symbol>
  <symbol id="icon-lock" viewBox="0 0 24 24">
    <rect x="5" y="10.5" width="14" height="9.5" rx="2"/>
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>
  </symbol>
  <symbol id="icon-user" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="3.6"/>
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>
  </symbol>
  <symbol id="icon-check-circle" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"/>
    <path d="M8.3 12.5l2.3 2.3 4.7-5"/>
  </symbol>
  <symbol id="icon-x-circle" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"/>
    <path d="M9.5 9.5l5 5"/>
    <path d="M14.5 9.5l-5 5"/>
  </symbol>
  <symbol id="icon-clock" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3.5 2"/>
  </symbol>
  <symbol id="icon-chart" viewBox="0 0 24 24">
    <path d="M4 20V11"/>
    <path d="M10 20V4"/>
    <path d="M16 20v-7"/>
    <path d="M4 20h16"/>
  </symbol>
  <symbol id="icon-download" viewBox="0 0 24 24">
    <path d="M12 4v10"/>
    <path d="M8 10l4 4 4-4"/>
    <path d="M5 18h14"/>
  </symbol>
  <symbol id="icon-logout" viewBox="0 0 24 24">
    <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/>
    <path d="M15 16l4-4-4-4"/>
    <path d="M19 12H9"/>
  </symbol>
  <symbol id="icon-plus-circle" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 8v8"/>
    <path d="M8 12h8"/>
  </symbol>
  <symbol id="icon-filter" viewBox="0 0 24 24">
    <path d="M4 5h16"/>
    <path d="M7 12h10"/>
    <path d="M10 19h4"/>
  </symbol>
  <symbol id="icon-medal" viewBox="0 0 24 24">
    <circle cx="12" cy="14.5" r="6"/>
    <path d="M9.5 9.5L7 3"/>
    <path d="M14.5 9.5L17 3"/>
    <path d="M12 11.5l1.2 2.4 2.6.3-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.3z" fill="currentColor" stroke="none"/>
  </symbol>
  <symbol id="icon-alert" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 8v5"/>
    <path d="M12 16.2v.1"/>
  </symbol>
  <symbol id="icon-print" viewBox="0 0 24 24">
    <path d="M6 9V3h12v6"/>
    <rect x="4" y="9" width="16" height="8" rx="1.5"/>
    <path d="M6 15h12v6H6z"/>
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
  toast.innerHTML = /<svg/.test(message) ? message : `${icon(isError ? 'alert' : 'star-filled')}<span>${message}</span>`;
  box.appendChild(toast);
  setTimeout(() => toast.classList.add('toast--visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/** Требует залогиненного пользователя нужной роли, иначе редиректит на login.html */
async function requireRole(role) {
  const user = await api.auth.currentUser();
  if (!user || user.role !== role) {
    window.location.href = 'login.html';
    return null;
  }
  renderNavbar(user);
  return user;
}

function initials(user) {
  return `${(user.firstName || '?')[0]}${(user.lastName || '?')[0]}`.toUpperCase();
}

function renderNavbar(user) {
  const slot = document.getElementById('navbar-user');
  if (!slot) return;
  slot.innerHTML = `
    <div class="navbar-user">
      <span class="avatar">${escapeHtml(initials(user))}</span>
      <span class="navbar-user__name">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</span>
      <button id="logout-btn" class="btn btn--ghost btn--small">${icon('logout')}Выйти</button>
    </div>`;
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api.auth.logout();
    window.location.href = 'login.html';
  });
}
