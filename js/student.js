/**
 * student.js — логика личного кабинета ученика.
 * Блоки: (1) навигация по вкладкам, (2) прогресс/уровень,
 * (3) афиша конкурсов + подача заявки, (4) список участий + дипломы.
 */

let CURRENT_USER = null;

// Пороги баллов для уровней прогресса (накопительные баллы по всем конкурсам).
const LEVEL_THRESHOLDS = [0, 80, 180, 320, 500, 750];

function calcLevel(totalPoints) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalPoints >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const idx = level - 1;
  const floor = LEVEL_THRESHOLDS[idx] ?? 0;
  const ceil = LEVEL_THRESHOLDS[idx + 1] ?? (floor + 250);
  const progressInLevel = Math.min(1, (totalPoints - floor) / (ceil - floor));
  return { level, floor, ceil, progressInLevel };
}

// ---------------- навигация по вкладкам ----------------
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

// ---------------- прогресс ----------------
// Полка трофеев — по одному кубку на уровень; заработанные горят золотом,
// текущий подсвечен, будущие — пунктирные латунные силуэты.
function renderTrophyShelf(level) {
  const rail = document.getElementById('trophy-shelf-rail');
  rail.innerHTML = LEVEL_THRESHOLDS.map((_, idx) => {
    const slotLevel = idx + 1;
    const state = slotLevel < level ? 'earned' : slotLevel === level ? 'current' : '';
    return `
      <div class="trophy-slot ${state ? `trophy-slot--${state}` : ''}" style="animation-delay:${idx * 70}ms">
        <div class="trophy-slot__icon">${icon('trophy')}</div>
        <div class="trophy-slot__label">Ур. ${slotLevel}</div>
      </div>`;
  }).join('');
}

async function renderProgress() {
  const myParticipations = await api.participations.list({ userId: CURRENT_USER.id });
  const totalPoints = myParticipations.reduce((sum, p) => sum + (p.points || 0), 0);
  const wins = myParticipations.filter((p) => p.status === 'winner').length;
  const myDiplomas = await api.diplomas.list({ userId: CURRENT_USER.id });

  const { level, floor, ceil, progressInLevel } = calcLevel(totalPoints);
  renderTrophyShelf(level);
  document.getElementById('level-badge').innerHTML = `${icon('trophy')}Уровень ${level}`;
  document.getElementById('points-label').textContent = totalPoints;
  document.getElementById('next-level-label').textContent =
    ceil > floor ? `до след. уровня: ${Math.max(0, ceil - totalPoints)} баллов` : 'максимальный уровень';
  document.getElementById('progress-bar-fill').style.width = `${Math.round(progressInLevel * 100)}%`;
  document.getElementById('stat-contests').textContent = myParticipations.length;
  document.getElementById('stat-wins').textContent = wins;
  document.getElementById('stat-diplomas').textContent = myDiplomas.length;
}

// ---------------- афиша конкурсов ----------------
function contestStatusBadge(status) {
  return `<span class="badge badge--${status}">${CONTEST_STATUS_LABELS[status] || status}</span>`;
}

async function renderContests() {
  const [contests, myParticipations] = await Promise.all([
    api.contests.list(),
    api.participations.list({ userId: CURRENT_USER.id }),
  ]);
  const joinedIds = new Set(myParticipations.map((p) => p.contestId));
  const grid = document.getElementById('contests-grid');

  if (!contests.length) {
    grid.innerHTML = '<div class="empty-state">Конкурсов пока нет.</div>';
    return;
  }

  grid.innerHTML = contests.map((c) => {
    const joined = joinedIds.has(c.id);
    const canJoin = c.status !== 'finished' && !joined;
    return `
      <div class="contest-card">
        <div class="flex-between">
          <span class="contest-card__title">${escapeHtml(c.title)}</span>
          ${contestStatusBadge(c.status)}
        </div>
        <div style="font-size:13px; color:var(--ink-muted);">${escapeHtml(c.description)}</div>
        <div class="contest-card__meta">
          <span>${escapeHtml(c.category)}</span>
          <span>до ${formatDate(c.endDate)}</span>
        </div>
        <button class="btn btn--small" data-join="${c.id}" ${canJoin ? '' : 'disabled'}>
          ${joined ? 'Вы участвуете' : (c.status === 'finished' ? 'Приём закрыт' : 'Подать заявку')}
        </button>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-join]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const contestId = btn.dataset.join;
      btn.disabled = true;
      try {
        await api.participations.create({ userId: CURRENT_USER.id, contestId, status: 'registered' });
        showToast('Заявка подана! Смотрите статус во вкладке «Мои участия».');
        await Promise.all([renderContests(), renderParticipations(), renderProgress()]);
      } catch (err) {
        showToast(err.message, true);
        btn.disabled = false;
      }
    });
  });
}

// ---------------- мои участия + дипломы ----------------
async function renderParticipations() {
  const [myParticipations, contests, templates, myDiplomas] = await Promise.all([
    api.participations.list({ userId: CURRENT_USER.id }),
    api.contests.list(),
    api.diplomas.templates(),
    api.diplomas.list({ userId: CURRENT_USER.id }),
  ]);

  const tbody = document.getElementById('participations-tbody');
  const emptyState = document.getElementById('participations-empty');

  if (!myParticipations.length) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  tbody.innerHTML = myParticipations.map((p) => {
    const contest = contests.find((c) => c.id === p.contestId);
    const diploma = myDiplomas.find((d) => d.participationId === p.id);
    const canDownload = ['completed', 'winner'].includes(p.status) && diploma;
    return `
      <tr>
        <td>${escapeHtml(contest ? contest.title : p.contestId)}</td>
        <td><span class="badge badge--${p.status}">${p.status === 'winner' ? icon('star') : ''}${STATUS_LABELS[p.status] || p.status}</span></td>
        <td>${p.points}</td>
        <td>${p.place ?? '—'}</td>
        <td>
          ${canDownload
            ? `<button class="btn btn--small" data-diploma="${p.id}" data-template="${diploma.templateId}">${icon('download')}Скачать диплом</button>`
            : '<span style="color:var(--ink-muted); font-size:13px;">недоступно</span>'}
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-diploma]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pId = btn.dataset.diploma;
      const participation = myParticipations.find((p) => p.id === pId);
      const contest = contests.find((c) => c.id === participation.contestId);
      generateAndDownloadPersonalDiploma({
        templateId: btn.dataset.template,
        studentName: `${CURRENT_USER.firstName} ${CURRENT_USER.lastName}`,
        contestName: contest ? contest.title : '',
        place: participation.place,
        date: new Date().toISOString().slice(0, 10),
      });
      showToast(`${icon('trophy')}Диплом за «${escapeHtml(contest ? contest.title : '')}» занял своё место на полке`);
    });
  });
}

// ---------------- init ----------------
(async function init() {
  CURRENT_USER = await requireRole('student');
  if (!CURRENT_USER) return;
  initTabs();
  await Promise.all([renderProgress(), renderContests(), renderParticipations()]);
})();
