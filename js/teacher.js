/**
 * teacher.js — кабинет учителя.
 * Блоки: (1) заявки на регистрацию, (2) конкурсы и результаты участников
 * (начисление и отмена наград), (3) проверка достижений, (4) журнал
 * начислений с отменой, (5) пользователи: роль, класс, прямое начисление, (6) рейтинг + CSV.
 * Любое изменение баллов идёт через RPC-функции базы, которые сами
 * проверяют роль и пишут историю в award_log.
 *
 * ПОДСКАЗКА: что на экране → какая функция его рисует
 * • «Заявки» (кто хочет зарегистрироваться)          → renderRegistrations()
 * • «Конкурсы» (карточки, «Новый конкурс»)            → renderContests(), openContestModal()
 * • окно «Участники» (результат каждому ученику)      → openParticipants(), renderParticipants()
 * • «Проверка» (достижения на проверке)               → renderVerify(), openVerify()
 * • «Начисления» (отзыв награды, история)             → renderAwards(), showHistory()
 * • «Пользователи» (роли, классы, «Начислить»)        → renderStudents(), drawUsers()
 * • «Рейтинг» и «Скачать CSV»                         → renderRating()
 * • Все нажатия кнопок в таблицах (Принять, Сохранить, Отозвать…) → wireActions()
 * Цифра у вкладки («Заявки 2») — setCount(). Разметка вкладок и окон — teacher.html.
 */

let ME = null;
let CONTESTS = [];
let PENDING_ACH = [];
let CURRENT_VERIFY = null;
let CURRENT_CONTEST = null;
let LAST_RATING = [];

const SOURCE_LABELS = { student: 'Ученик', teacher: 'Учитель', contest: 'Конкурс', telegram: 'Бот' };
const LOG_LABELS = { awarded: 'Начислено', approved: 'Подтверждено', rejected: 'Отклонено', revoked: 'Отозвано' };

// окна (модалки): показываются снятием класса hidden; закрываются фоном или кнопкой data-close
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function wireModalClose() {
  document.querySelectorAll('.modal-overlay').forEach((m) => m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-close]')) m.classList.add('hidden');
  }));
}
/** Выполняет действие; при успехе — зелёный тост okMessage, при ошибке — красный с текстом из базы. */
async function guard(fn, okMessage) {
  try { await fn(); if (okMessage) showToast(okMessage); return true; }
  catch (ex) { showToast(ex.message, true); return false; }
}
// число-счётчик на кнопке вкладки; при нуле скрывается
function setCount(id, n) { const el = document.getElementById(id); el.hidden = !n; el.textContent = n; }
function periodSelectHtml(onlyQuarters) {
  return periodOptions().filter((o) => !onlyQuarters || o.value.includes('четверть'))
    .map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
}

// ================= (1) заявки на регистрацию =================
async function renderRegistrations() {
  const pending = await api.registrations.listPending();
  setCount('count-registrations', pending.length);
  const tbody = document.getElementById('registrations-tbody');
  tbody.innerHTML = pending.length ? pending.map((p) => `
    <tr>
      <td>${escapeHtml(p.fullName)}</td>
      <td class="muted">${escapeHtml(p.email)}</td>
      <td>${escapeHtml(p.className || '—')}</td>
      <td class="muted">${formatDate(p.createdAt)}</td>
      <td><div class="field" style="margin:0; min-width:130px;"><select data-role-for="${p.id}" aria-label="Роль"><option value="student">Ученик</option><option value="teacher">Учитель</option></select></div></td>
      <td><div class="flex-row" style="flex-wrap:nowrap;">
        <button class="btn btn--small" data-approve="${p.id}" data-class="${escapeHtml(p.className || '')}">${icon('check')}Принять</button>
        <button class="btn btn--danger btn--small" data-reject="${p.id}">${icon('x')}Отклонить</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty-state">Новых заявок нет.</td></tr>';
}

// ================= (2) конкурсы =================
/** Карточки конкурсов с числом участников и кнопками «Участники», «Изменить», «Удалить». */
async function renderContests() {
  const [contests, counts] = await Promise.all([api.contests.list(), api.participations.countsByContest()]);
  CONTESTS = contests;
  const grid = document.getElementById('teacher-contest-grid');
  grid.innerHTML = contests.length ? contests.map((c) => {
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
        <span class="contest-card__dates">${formatDate(c.startDate)} — ${formatDate(c.endDate)} · ${escapeHtml(c.period || 'период не указан')}</span>
        <div class="contest-card__footer">
          <button class="btn btn--small" data-participants="${c.id}">Участники · ${counts[c.id] || 0}</button>
          <div class="flex-row">
            <button class="btn btn--outline btn--small" data-edit-contest="${c.id}" aria-label="Изменить">${icon('edit')}</button>
            <button class="btn btn--danger btn--small" data-delete-contest="${c.id}" aria-label="Удалить">${icon('trash')}</button>
          </div>
        </div>
      </article>`;
  }).join('') : '<div class="empty-state">Конкурсов пока нет — опубликуйте первый.</div>';
}

function syncContestLevel(selected) {
  fillLevelOptions(document.getElementById('c-level'), document.getElementById('c-category').value);
  if (selected) document.getElementById('c-level').value = selected;
}
/** Окно создания (contest = null) или редактирования конкурса. */
function openContestModal(contest) {
  document.getElementById('contest-modal-title').textContent = contest ? 'Изменить конкурс' : 'Новый конкурс';
  document.getElementById('c-id').value = contest ? contest.id : '';
  document.getElementById('c-title').value = contest ? contest.title : '';
  document.getElementById('c-description').value = contest ? contest.description : '';
  document.getElementById('c-category').value = contest ? contest.category : 'olympiad';
  syncContestLevel(contest ? contest.level : null);
  document.getElementById('c-subject').value = contest ? contest.subject || '' : '';
  document.getElementById('c-status').value = contest ? contest.status : 'active';
  document.getElementById('c-start').value = contest ? contest.startDate || '' : '';
  document.getElementById('c-end').value = contest ? contest.endDate || '' : '';
  document.getElementById('c-period').value = contest && contest.period ? contest.period : periodOf();
  openModal('contest-modal');
}

async function openParticipants(contestId) {
  CURRENT_CONTEST = CONTESTS.find((c) => c.id === contestId);
  document.getElementById('participants-title').textContent = CURRENT_CONTEST.title;
  const level = (CURRENT_CONTEST.category === 'olympiad' ? OLYMPIAD_LEVELS : PROJECT_LEVELS)[CURRENT_CONTEST.level];
  document.getElementById('participants-summary').innerHTML =
    `${CATEGORY_LABELS[CURRENT_CONTEST.category]} · ${level ? level.label : ''} уровень. Баллы за результат: ` +
    ['participant', '3', '2', '1'].map((r) => `${RESULT_LABELS[r].toLowerCase()} — <strong>${calcAchievementPoints({ category: CURRENT_CONTEST.category, level: CURRENT_CONTEST.level, place: r })}</strong>`).join(', ') +
    '. Если у участника уже есть награда, при смене результата она отзывается — понадобится причина.';
  await renderParticipants();
  openModal('participants-modal');
}

/** Таблица участников конкурса: текущий результат, выбор нового, баллы. */
async function renderParticipants() {
  const list = await api.participations.listForContest(CURRENT_CONTEST.id);
  const awards = Object.fromEntries((await api.achievements.byIds(list.map((p) => p.achievementId).filter(Boolean))).map((a) => [a.id, a]));
  const options = (cur) => Object.entries(RESULT_LABELS).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v}</option>`).join('');
  document.getElementById('participants-tbody').innerHTML = list.length ? list.map((p) => {
    const ach = awards[p.achievementId];
    return `
      <tr>
        <td>${escapeHtml(p.student ? p.student.fullName : '—')}</td>
        <td>${escapeHtml(p.student ? p.student.className || '—' : '—')}</td>
        <td>${resultBadge(p.result)}</td>
        <td><div class="field" style="margin:0; min-width:150px;"><select data-result-for="${p.id}" aria-label="Новый результат">${options(p.result)}</select></div></td>
        <td class="num-strong">${ach && ach.status === 'approved' ? '+' + ach.points : '—'}</td>
        <td><div class="flex-row" style="flex-wrap:nowrap;">
          <button class="btn btn--small" data-save-result="${p.id}" data-had-award="${p.achievementId ? 1 : 0}">Сохранить</button>
          ${p.achievementId ? `<button class="btn btn--outline btn--small" data-history="${p.achievementId}" aria-label="История">${icon('history')}</button>` : ''}
        </div></td>
      </tr>`;
  }).join('') : '<tr><td colspan="6" class="empty-state">На этот конкурс ещё никто не записался.</td></tr>';
}

// ================= (3) проверка =================
/** Список достижений «На проверке»; число попадает на вкладку «Проверка». */
async function renderVerify() {
  PENDING_ACH = await api.achievements.listAll({ status: 'pending' });
  setCount('count-verify', PENDING_ACH.length);
  document.getElementById('verify-tbody').innerHTML = PENDING_ACH.length ? PENDING_ACH.map((a) => `
    <tr>
      <td>${escapeHtml(a.student ? a.student.fullName : '—')}<div class="muted" style="font-size:12.5px;">${escapeHtml(a.student ? a.student.className || '' : '')}</div></td>
      <td>${escapeHtml(a.title)}${a.source === 'telegram' ? ' <span class="muted">· из бота</span>' : ''}</td>
      <td class="muted">${CATEGORY_LABELS[a.category]}</td>
      <td>${subjectTag(a.subject)}</td>
      <td>${a.points}</td>
      <td><button class="btn btn--small" data-verify="${a.id}">Проверить</button></td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty-state">Все заявки проверены.</td></tr>';
}

/** Окно проверки: можно поправить баллы, написать комментарий, «Подтвердить» или «Отклонить». */
function openVerify(id) {
  const a = PENDING_ACH.find((x) => x.id === id);
  CURRENT_VERIFY = a;
  const levels = a.category === 'olympiad' ? OLYMPIAD_LEVELS : a.category === 'project' ? PROJECT_LEVELS : null;
  document.getElementById('verify-summary').innerHTML = `
    <strong>${escapeHtml(a.title)}</strong><br />
    ${escapeHtml(a.student ? a.student.fullName : '')} · ${CATEGORY_LABELS[a.category]}${a.subject ? ' · ' + SUBJECT_LABELS[a.subject] : ''}
    ${levels && a.level ? ' · ' + levels[a.level].label + ', ' + (PLACE_LABELS[a.place] || '').toLowerCase() : ''}${a.hours ? ' · ' + a.hours + ' ч' : ''}<br />
    ${formatDate(a.date)} · ${escapeHtml(a.period || '')}
    ${a.proofUrl ? `<br /><a href="${escapeHtml(a.proofUrl)}" target="_blank" rel="noopener noreferrer">Открыть подтверждающий документ</a>` : ''}`;
  document.getElementById('v-points').value = a.points;
  document.getElementById('v-comment').value = '';
  openModal('verify-modal');
}

// ================= (4) журнал начислений =================
/** Журнал выданных баллов с фильтром по статусу и кнопкой «Отозвать». */
async function renderAwards() {
  const status = document.getElementById('awards-filter').value;
  const list = await api.achievements.listAll({ status });
  document.getElementById('awards-tbody').innerHTML = list.length ? list.map((a) => `
    <tr>
      <td>${escapeHtml(a.student ? a.student.fullName : '—')}</td>
      <td>${escapeHtml(a.title)}</td>
      <td class="muted">${SOURCE_LABELS[a.source] || a.source}</td>
      <td class="num-strong">${a.points}</td>
      <td class="muted">${escapeHtml(a.teacherComment || '—')}</td>
      <td><div class="flex-row" style="flex-wrap:nowrap;">
        ${a.status === 'approved' ? `<button class="btn btn--danger btn--small" data-revoke="${a.id}">${icon('undo')}Отозвать</button>` : ''}
        <button class="btn btn--outline btn--small" data-history="${a.id}" aria-label="История">${icon('history')}</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty-state">Записей нет.</td></tr>';
}

/** Окно «История начислений» по одному достижению (из таблицы award_log). */
async function showHistory(achievementId) {
  const log = await api.achievements.history(achievementId);
  document.getElementById('history-body').innerHTML = log.length ? `
    <table class="data-table"><thead><tr><th>Когда</th><th>Действие</th><th>Баллы</th><th>Причина</th></tr></thead><tbody>
    ${log.map((l) => `<tr><td class="muted">${new Date(l.created_at).toLocaleString('ru-RU')}</td><td>${LOG_LABELS[l.action] || l.action}</td>
      <td>${l.points_before ?? '—'} → ${l.points_after ?? '—'}</td><td class="muted">${escapeHtml(l.reason || '')}</td></tr>`).join('')}
    </tbody></table>` : '<div class="empty-state">История пуста.</div>';
  openModal('history-modal');
}

// ================= (5) пользователи: роль, класс, начисление =================
let USERS = [];
let TOTALS = {};

/** Загружает всех пользователей и их баллы, затем рисует таблицу. */
async function renderStudents() {
  const [users, rating] = await Promise.all([api.users.listAll(), api.rating.compute()]);
  USERS = users;
  TOTALS = Object.fromEntries(rating.map((r) => [r.userId, r.total]));
  drawUsers();
}

/** Таблица «Пользователи» с учётом фильтра и поиска (без повторного запроса к базе). */
function drawUsers() {
  const filter = document.getElementById('u-filter').value;
  const q = document.getElementById('u-search').value.trim().toLowerCase();
  const list = USERS.filter((u) => {
    if (filter === 'rejected' ? u.status !== 'rejected' : (filter && (u.status !== 'approved' || u.role !== filter))) return false;
    return !q || `${u.fullName} ${u.email}`.toLowerCase().includes(q);
  });
  document.getElementById('students-tbody').innerHTML = list.length ? list.map((u) => {
    const self = ME && u.id === ME.id;
    const rejected = u.status === 'rejected';
    // профиль администратора меняет только администратор (то же правило в триггере protect_profile)
    const locked = self || (u.isAdmin && !ME.isAdmin);
    const role = u.isAdmin ? 'admin' : u.role;
    const opt = (v, label) => `<option value="${v}"${role === v ? ' selected' : ''}>${label}</option>`;
    return `
    <tr>
      <td>${escapeHtml(u.fullName)}${self ? ' <span class="muted">(вы)</span>' : ''}${rejected ? `<br><span class="badge badge--rejected" title="${escapeHtml(u.rejectionReason || '')}">Отклонён</span>` : ''}</td>
      <td class="muted">${escapeHtml(u.email)}</td>
      <td><div class="field" style="margin:0; min-width:150px;"><select data-user-role="${u.id}" aria-label="Роль"${locked ? ' disabled' : ''}>${opt('student', 'Ученик')}${opt('teacher', 'Учитель')}${ME.isAdmin || u.isAdmin ? opt('admin', 'Администратор') : ''}</select></div></td>
      <td><div class="field" style="margin:0; width:80px;"><input data-user-class="${u.id}" value="${escapeHtml(u.className || '')}" placeholder="—" aria-label="Класс"${locked ? ' disabled' : ''} /></div></td>
      <td>${u.telegramLinked ? '<span class="badge badge--approved">Подключён</span>' : '<span class="muted">—</span>'}</td>
      <td class="num-strong">${u.role === 'student' && !rejected ? TOTALS[u.id] || 0 : '—'}</td>
      <td><div class="flex-row" style="flex-wrap:nowrap;">
        ${locked ? '' : `<button class="btn btn--small${rejected ? '' : ' btn--outline'}" data-save-user="${u.id}">${icon('check')}${rejected ? 'Вернуть' : 'Сохранить'}</button>`}
        ${u.role === 'student' && !rejected ? `<button class="btn btn--outline btn--small" data-add-for="${u.id}" data-name="${escapeHtml(u.fullName)}">${icon('plus')}Начислить</button>` : ''}
      </div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" class="empty-state">Никого не нашлось.</td></tr>';
}

function syncAddForm() {
  const category = document.getElementById('a-category').value;
  document.getElementById('a-level-row').hidden = !fillLevelOptions(document.getElementById('a-level'), category);
  document.getElementById('a-hours-field').hidden = category !== 'volunteer';
  updateAddPreview();
}
function updateAddPreview() {
  document.getElementById('a-points').textContent = calcAchievementPoints({
    category: document.getElementById('a-category').value,
    level: document.getElementById('a-level').value,
    place: document.getElementById('a-place').value,
    hours: document.getElementById('a-hours').value,
  });
}

// ================= (6) рейтинг =================
/** Рейтинг лицея по фильтрам «Класс», «Направление», «Период». */
async function renderRating() {
  const rows = await api.rating.compute({
    className: document.getElementById('t-class').value,
    subject: document.getElementById('t-subject').value,
    period: document.getElementById('t-period').value,
  });
  LAST_RATING = rows;
  const classSelect = document.getElementById('t-class');
  if (classSelect.options.length === 1) {
    [...new Set(rows.map((r) => r.className).filter(Boolean))].sort()
      .forEach((c) => classSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`));
  }
  document.getElementById('t-rating-tbody').innerHTML = rows.length ? rows.map((r) => `
    <tr>
      <td><span class="rank ${r.rank <= 3 ? 'rank--' + r.rank : ''}">${r.rank}</span></td>
      <td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.className || '—')}</td>
      <td>${r.physics}</td><td>${r.math}</td><td>${r.cs}</td><td class="num-strong">${r.total}</td>
    </tr>`).join('') : '<tr><td colspan="7" class="empty-state">Нет данных.</td></tr>';
}

// ================= обработчики =================
/**
 * Один обработчик кликов на всю страницу: по data-атрибуту кнопки (data-approve,
 * data-save-user, data-revoke …) понимает, что нажали, и вызывает нужный api.*.
 * Новая кнопка в таблице = новый data-атрибут + ветка else if ниже.
 */
function wireActions() {
  document.body.addEventListener('click', async (e) => {
    const t = (sel) => e.target.closest(sel);
    let el;

    if ((el = t('[data-approve]'))) {
      const role = document.querySelector(`[data-role-for="${el.dataset.approve}"]`).value;
      el.disabled = true;
      if (await guard(() => api.registrations.approve(el.dataset.approve, role, el.dataset.class), `Заявка принята: ${ROLE_LABELS[role].toLowerCase()}`)) {
        await Promise.all([renderRegistrations(), renderStudents()]);
      } else el.disabled = false;
    } else if ((el = t('[data-reject]'))) {
      const reason = await askReason('Отклонить заявку', 'Причину увидит человек, когда попробует войти.', 'Отклонить');
      if (reason && await guard(() => api.registrations.reject(el.dataset.reject, reason), 'Заявка отклонена')) await renderRegistrations();
    } else if ((el = t('[data-participants]'))) {
      await guard(() => openParticipants(Number(el.dataset.participants)));
    } else if ((el = t('[data-edit-contest]'))) {
      openContestModal(CONTESTS.find((c) => c.id === Number(el.dataset.editContest)));
    } else if ((el = t('[data-delete-contest]'))) {
      // eslint-disable-next-line no-alert
      if (confirm('Удалить конкурс? Заявки на участие удалятся, а уже начисленные баллы останутся в истории.')) {
        if (await guard(() => api.contests.remove(Number(el.dataset.deleteContest)), 'Конкурс удалён')) await renderContests();
      }
    } else if ((el = t('[data-save-result]'))) {
      const id = Number(el.dataset.saveResult);
      const result = document.querySelector(`[data-result-for="${id}"]`).value;
      let reason = null;
      if (el.dataset.hadAward === '1') {
        reason = await askReason('Изменить результат', 'Ранее начисленная награда за этот конкурс будет отозвана. Укажите причину — она сохранится в истории.', 'Изменить и отозвать');
        if (!reason) return;
      }
      el.disabled = true;
      if (await guard(() => api.participations.setResult(id, result, reason), 'Результат сохранён')) {
        await Promise.all([renderParticipants(), renderContests(), renderAwards()]);
      } else el.disabled = false;
    } else if ((el = t('[data-verify]'))) {
      openVerify(Number(el.dataset.verify));
    } else if ((el = t('[data-revoke]'))) {
      const reason = await askReason('Отозвать награду', 'Баллы уйдут из рейтинга ученика, запись останется в истории с вашей причиной.', 'Отозвать');
      if (reason && await guard(() => api.achievements.revoke(Number(el.dataset.revoke), reason), 'Награда отозвана')) {
        await Promise.all([renderAwards(), renderStudents()]);
      }
    } else if ((el = t('[data-history]'))) {
      await guard(() => showHistory(Number(el.dataset.history)));
    } else if ((el = t('[data-save-user]'))) {
      const id = el.dataset.saveUser;
      const user = USERS.find((u) => u.id === id);
      const role = document.querySelector(`[data-user-role="${id}"]`).value;
      const className = document.querySelector(`[data-user-class="${id}"]`).value;
      if (role === 'admin' && !user.isAdmin
        // eslint-disable-next-line no-alert
        && !confirm(`Сделать ${user.fullName} администратором? Появится право создавать аккаунты и назначать администраторов.`)) return;
      if (role === 'teacher' && user.role !== 'teacher'
        // eslint-disable-next-line no-alert
        && !confirm(`Сделать ${user.fullName} учителем? Появится доступ к заявкам, проверке и начислению баллов.`)) return;
      el.disabled = true;
      if (await guard(() => api.users.setRole(id, role, className), `${user.fullName}: ${ROLE_LABELS[role].toLowerCase()}${role === 'student' && className ? ', ' + className.toUpperCase() : ''}`)) {
        await Promise.all([renderStudents(), renderRating()]);
      } else el.disabled = false;
    } else if ((el = t('[data-add-for]'))) {
      document.getElementById('add-form').reset();
      document.getElementById('a-user').value = el.dataset.addFor;
      document.getElementById('add-student').textContent = el.dataset.name;
      document.getElementById('a-date').value = todayISO();
      document.getElementById('a-period').value = periodOf();
      syncAddForm();
      openModal('add-modal');
    }
  });

  async function decide(status) {
    const comment = document.getElementById('v-comment').value.trim();
    if (status === 'rejected' && !comment) { showToast('Укажите причину отклонения', true); return; }
    if (await guard(() => api.achievements.verify(CURRENT_VERIFY.id, { status, points: document.getElementById('v-points').value, comment }),
      status === 'approved' ? 'Достижение подтверждено' : 'Достижение отклонено')) {
      closeModal('verify-modal');
    }
    await Promise.all([renderVerify(), renderAwards(), renderStudents()]);
  }
  document.getElementById('v-approve').addEventListener('click', () => decide('approved'));
  document.getElementById('v-reject').addEventListener('click', () => decide('rejected'));

  document.getElementById('new-contest-btn').addEventListener('click', () => openContestModal(null));
  document.getElementById('c-category').addEventListener('change', () => syncContestLevel());
  document.getElementById('contest-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('c-id').value;
    const data = {
      title: document.getElementById('c-title').value.trim(),
      description: document.getElementById('c-description').value.trim(),
      category: document.getElementById('c-category').value,
      level: document.getElementById('c-level').value,
      subject: document.getElementById('c-subject').value,
      status: document.getElementById('c-status').value,
      startDate: document.getElementById('c-start').value,
      endDate: document.getElementById('c-end').value,
      period: document.getElementById('c-period').value,
    };
    if (data.startDate && data.endDate && data.endDate < data.startDate) { showToast('Окончание не может быть раньше начала', true); return; }
    if (await guard(() => (id ? api.contests.update(Number(id), data) : api.contests.create(data)), id ? 'Конкурс обновлён' : 'Конкурс опубликован')) {
      closeModal('contest-modal');
      await renderContests();
    }
  });

  document.getElementById('a-category').addEventListener('change', syncAddForm);
  ['a-level', 'a-place'].forEach((id) => document.getElementById(id).addEventListener('change', updateAddPreview));
  document.getElementById('a-hours').addEventListener('input', updateAddPreview);
  document.getElementById('a-date').addEventListener('change', (e) => { document.getElementById('a-period').value = periodOf(e.target.value); });
  document.getElementById('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('a-category').value;
    const hasLevel = category === 'olympiad' || category === 'project';
    if (await guard(() => api.achievements.createByTeacher({
      userId: document.getElementById('a-user').value,
      category,
      subject: document.getElementById('a-subject').value,
      level: hasLevel ? document.getElementById('a-level').value : null,
      place: hasLevel ? document.getElementById('a-place').value : null,
      hours: category === 'volunteer' ? document.getElementById('a-hours').value : null,
      title: document.getElementById('a-title').value.trim(),
      date: document.getElementById('a-date').value,
      period: document.getElementById('a-period').value,
    }), 'Достижение начислено')) {
      closeModal('add-modal');
      await Promise.all([renderStudents(), renderAwards()]);
    }
  });

  document.getElementById('awards-filter').addEventListener('change', () => guard(renderAwards));
  ['t-class', 't-subject', 't-period'].forEach((id) => document.getElementById(id).addEventListener('change', () => guard(renderRating)));
  // ---------- создание пользователя (только администратор) ----------
  const cuRole = document.getElementById('cu-role');
  const syncCreateForm = () => { document.getElementById('cu-class-field').hidden = cuRole.value !== 'student'; };
  cuRole.addEventListener('change', syncCreateForm);
  document.getElementById('cu-generate').addEventListener('click', () => {
    const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    document.getElementById('cu-password').value = Array.from(bytes, (b) => abc[b % abc.length]).join('');
  });
  document.getElementById('create-user-btn').addEventListener('click', () => {
    document.getElementById('create-user-form').reset();
    document.getElementById('cu-error').textContent = '';
    syncCreateForm();
    openModal('create-user-modal');
    document.getElementById('cu-email').focus();
  });
  document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = (id) => document.getElementById(id).value.trim();
    const data = {
      email: val('cu-email'), password: document.getElementById('cu-password').value,
      lastName: val('cu-lastname'), firstName: val('cu-firstname'), middleName: val('cu-middlename'),
      className: val('cu-class'), role: cuRole.value, status: document.getElementById('cu-status').value,
    };
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await api.users.create(data);
      closeModal('create-user-modal');
      showToast(`${data.lastName} ${data.firstName}: аккаунт создан`);
      await Promise.all([renderStudents(), renderRegistrations()]);
    } catch (ex) {
      document.getElementById('cu-error').textContent = ex.message;
    } finally { btn.disabled = false; }
  });

  document.getElementById('u-filter').addEventListener('change', drawUsers);
  document.getElementById('u-search').addEventListener('input', drawUsers);

  document.getElementById('rating-csv').addEventListener('click', () => {
    if (!LAST_RATING.length) return;
    const rows = LAST_RATING.map((r) => ({ Место: r.rank, Ученик: r.name, Класс: r.className, Физика: r.physics, Математика: r.math, Информатика: r.cs, Итого: r.total }));
    downloadBlob(`rating_${todayISO()}.csv`, api.reports.toCSV(rows), 'text/csv;charset=utf-8');
  });
}

(async function init() {
  ME = await requireRole('teacher');
  if (!ME) return;
  document.getElementById('create-user-btn').hidden = !ME.isAdmin;
  document.getElementById('c-period').innerHTML = periodSelectHtml(true);
  document.getElementById('a-period').innerHTML = periodSelectHtml(true);
  document.getElementById('t-period').innerHTML = '<option value="">За всё время</option>' + periodSelectHtml(false);
  // вкладки перечитывают базу: данные могли поменять другой учитель, бот или соседняя вкладка
  const RENDER = { registrations: renderRegistrations, contests: renderContests, verify: renderVerify,
    awards: renderAwards, students: renderStudents, rating: renderRating };
  initTabs((tab) => RENDER[tab] && guard(RENDER[tab]));
  wireModalClose();
  wireActions();
  await guard(() => Promise.all([renderRegistrations(), renderContests(), renderVerify(), renderAwards(), renderStudents(), renderRating()]));
})();
