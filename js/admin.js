/**
 * admin.js — логика админ-панели.
 * Блоки: (1) вкладки, (2) CRUD конкурсов через модальное окно,
 * (3) импорт списка участников (CSV/JSON), (4) отчёты по активности (CSV).
 */

let CURRENT_ADMIN = null;
let LAST_REPORT_ROWS = [];

// ---------------- вкладки ----------------
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

// ================= Конкурсы (CRUD) =================

async function renderContestsTable() {
  const [contests, allParticipations] = await Promise.all([
    api.contests.list(),
    api.participations.list(),
  ]);
  const tbody = document.getElementById('contests-tbody');

  if (!contests.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Конкурсов пока нет.</td></tr>';
    return;
  }

  tbody.innerHTML = contests.map((c) => {
    const count = allParticipations.filter((p) => p.contestId === c.id).length;
    return `
      <tr>
        <td>${escapeHtml(c.title)}</td>
        <td>${escapeHtml(c.category)}</td>
        <td><span class="badge badge--${c.status}">${CONTEST_STATUS_LABELS[c.status] || c.status}</span></td>
        <td>${formatDate(c.startDate)} – ${formatDate(c.endDate)}</td>
        <td>${count}</td>
        <td class="flex-row">
          <button class="btn btn--ghost btn--small" data-edit="${c.id}">${icon('edit')}Изменить</button>
          <button class="btn btn--danger btn--small" data-delete="${c.id}">${icon('trash')}Удалить</button>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const contest = await api.contests.get(btn.dataset.edit);
      openContestModal(contest);
    });
  });
  tbody.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить конкурс? Связанные участия останутся в базе.')) return;
      await api.contests.remove(btn.dataset.delete);
      showToast('Конкурс удалён');
      await Promise.all([renderContestsTable(), refreshContestSelects()]);
    });
  });
}

function openContestModal(contest = null) {
  document.getElementById('contest-modal-title').textContent = contest ? 'Редактировать конкурс' : 'Новый конкурс';
  document.getElementById('contest-id').value = contest?.id || '';
  document.getElementById('contest-title').value = contest?.title || '';
  document.getElementById('contest-category').value = contest?.category || '';
  document.getElementById('contest-description').value = contest?.description || '';
  document.getElementById('contest-start').value = contest?.startDate || '';
  document.getElementById('contest-end').value = contest?.endDate || '';
  document.getElementById('contest-status').value = contest?.status || 'upcoming';
  document.getElementById('contest-template').value = contest?.diplomaTemplateId || 't1';
  document.getElementById('contest-modal-overlay').classList.remove('hidden');
}

function closeContestModal() {
  document.getElementById('contest-modal-overlay').classList.add('hidden');
}

function initContestModal() {
  document.getElementById('add-contest-btn').addEventListener('click', () => openContestModal());
  document.getElementById('contest-cancel-btn').addEventListener('click', closeContestModal);
  document.getElementById('contest-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'contest-modal-overlay') closeContestModal();
  });

  document.getElementById('contest-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('contest-id').value;
    const payload = {
      title: document.getElementById('contest-title').value.trim(),
      category: document.getElementById('contest-category').value.trim() || 'Общее',
      description: document.getElementById('contest-description').value.trim(),
      startDate: document.getElementById('contest-start').value,
      endDate: document.getElementById('contest-end').value,
      status: document.getElementById('contest-status').value,
      diplomaTemplateId: document.getElementById('contest-template').value,
    };
    try {
      if (id) {
        await api.contests.update(id, payload);
        showToast('Конкурс обновлён');
      } else {
        await api.contests.create(payload);
        showToast('Конкурс создан');
      }
      closeContestModal();
      await Promise.all([renderContestsTable(), refreshContestSelects()]);
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// ================= Импорт участников =================

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

function parseImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(reader.result);
          resolve(Array.isArray(data) ? data : []);
        } else {
          resolve(parseCSV(reader.result));
        }
      } catch (err) {
        reject(new Error('Не удалось разобрать файл: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsText(file, 'utf-8');
  });
}

async function refreshContestSelects() {
  const contests = await api.contests.list();
  const importSelect = document.getElementById('import-contest-select');
  const reportSelect = document.getElementById('report-contest-select');
  const options = contests.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
  importSelect.innerHTML = options || '<option disabled>Нет конкурсов</option>';
  reportSelect.innerHTML = '<option value="">Все конкурсы</option>' + options;
}

function renderImportPreview(rows) {
  const box = document.getElementById('import-preview');
  if (!rows.length) {
    box.innerHTML = '<div class="empty-state">В файле не найдено ни одной строки.</div>';
    return;
  }
  const headers = Object.keys(rows[0]);
  box.innerHTML = `
    <p style="font-size:13px;color:var(--ink-muted);">Найдено строк: ${rows.length}. Проверьте данные и подтвердите импорт.</p>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(r[h] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    <button class="btn" id="confirm-import-btn" style="margin-top:14px;">${icon('upload-file')}Импортировать ${rows.length} участников</button>
  `;

  document.getElementById('confirm-import-btn').addEventListener('click', async () => {
    const contestId = document.getElementById('import-contest-select').value;
    if (!contestId) { showToast('Выберите конкурс', true); return; }
    let createdUsers = 0;
    let createdParticipations = 0;
    let skipped = 0;

    for (const row of rows) {
      const login = (row.login || '').trim();
      if (!login) { skipped++; continue; }

      let user = (await api.users.list()).find((u) => u.login === login);
      if (!user) {
        try {
          user = await api.users.create({
            role: 'student',
            login,
            firstName: row.firstName || 'Ученик',
            lastName: row.lastName || login,
            className: row.className || '—',
          });
          createdUsers++;
        } catch (err) {
          skipped++; continue;
        }
      }

      try {
        await api.participations.create({
          userId: user.id,
          contestId,
          status: row.status || 'registered',
          points: Number(row.points) || 0,
        });
        createdParticipations++;
      } catch (err) {
        skipped++;
      }
    }

    showToast(`Импорт завершён: новых учеников ${createdUsers}, участий добавлено ${createdParticipations}, пропущено ${skipped}`);
    document.getElementById('import-preview').innerHTML = '';
    document.getElementById('import-file-input').value = '';
    await renderContestsTable();
  });
}

function initImportTab() {
  const label = document.getElementById('file-drop-label');
  const input = document.getElementById('import-file-input');
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const rows = await parseImportFile(file);
      renderImportPreview(rows);
    } catch (err) {
      showToast(err.message, true);
    }
  });
  ['dragover'].forEach((evt) => label.addEventListener(evt, (e) => e.preventDefault()));
  label.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) {
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

// ================= Отчёты =================

function initReportsTab() {
  document.getElementById('build-report-btn').addEventListener('click', async () => {
    const contestId = document.getElementById('report-contest-select').value;
    const rows = await api.reports.activityReport(contestId ? { contestId } : {});
    LAST_REPORT_ROWS = rows;
    const table = document.getElementById('report-table');
    const emptyState = document.getElementById('report-empty');
    const downloadBtn = document.getElementById('download-report-btn');

    if (!rows.length) {
      table.querySelector('thead').innerHTML = '';
      table.querySelector('tbody').innerHTML = '';
      emptyState.style.display = 'block';
      downloadBtn.disabled = true;
      return;
    }
    emptyState.style.display = 'none';
    downloadBtn.disabled = false;
    const headers = Object.keys(rows[0]);
    table.querySelector('thead').innerHTML = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
    table.querySelector('tbody').innerHTML = rows.map((r) =>
      `<tr>${headers.map((h) => `<td>${escapeHtml(r[h])}</td>`).join('')}</tr>`
    ).join('');
  });

  document.getElementById('download-report-btn').addEventListener('click', () => {
    if (!LAST_REPORT_ROWS.length) return;
    const csv = api.reports.toCSV(LAST_REPORT_ROWS);
    downloadBlob(`report_${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
  });
}

// ================= init =================
(async function init() {
  CURRENT_ADMIN = await requireRole('admin');
  if (!CURRENT_ADMIN) return;
  initTabs();
  initContestModal();
  initImportTab();
  initReportsTab();
  await Promise.all([renderContestsTable(), refreshContestSelects()]);
})();
