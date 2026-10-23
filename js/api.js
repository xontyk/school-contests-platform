/**
 * api.js — эмулированный API-слой.
 *
 * Это "клиентский SDK" будущего бэкенда: все методы асинхронные
 * (Promise) и имитируют сетевую задержку, хотя под капотом пока
 * работают с localStorage через db.js. Контракт (имена методов,
 * форма ответа {data} / ошибка через reject) специально повторяет
 * то, как выглядел бы реальный fetch()-клиент к REST API — чтобы
 * при появлении настоящего бэкенда было достаточно переписать
 * реализацию внутри каждого метода, не трогая код страниц
 * (student.js, admin.js и т.д.).
 *
 * Разделы:
 *  - api.auth          — вход/выход, текущая сессия
 *  - api.users         — CRUD по пользователям
 *  - api.contests      — CRUD по конкурсам
 *  - api.participations— CRUD по участиям + расчёт прогресса
 *  - api.diplomas      — выдача дипломов
 *  - api.reports       — формирование CSV-отчётов
 */

const api = (() => {
  const LATENCY_MS = 150; // имитация сетевой задержки реального API

  function ok(data) {
    return new Promise((resolve) => setTimeout(() => resolve(data), LATENCY_MS));
  }

  function fail(message) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), LATENCY_MS));
  }

  // -------------------- auth --------------------------------------
  const SESSION_KEY = 'spk_session_user_id';

  const auth = {
    async login(login, password) {
      const user = DB.getAll(DB.KEYS.users).find((u) => u.login === login && u.password === password);
      if (!user) return fail('Неверный логин или пароль');
      localStorage.setItem(SESSION_KEY, user.id);
      const { password: _pw, ...safeUser } = user;
      return ok(safeUser);
    },
    async logout() {
      localStorage.removeItem(SESSION_KEY);
      return ok(true);
    },
    async currentUser() {
      const id = localStorage.getItem(SESSION_KEY);
      if (!id) return ok(null);
      const user = DB.getById(DB.KEYS.users, id);
      if (!user) return ok(null);
      const { password: _pw, ...safeUser } = user;
      return ok(safeUser);
    },
  };

  // -------------------- users --------------------------------------
  const users = {
    async list() {
      return ok(DB.getAll(DB.KEYS.users).map(({ password, ...u }) => u));
    },
    async get(id) {
      const u = DB.getById(DB.KEYS.users, id);
      if (!u) return fail('Пользователь не найден');
      const { password, ...safe } = u;
      return ok(safe);
    },
    async create(data) {
      if (!data.login || !data.firstName || !data.lastName) return fail('Не заполнены обязательные поля');
      const exists = DB.getAll(DB.KEYS.users).some((u) => u.login === data.login);
      if (exists) return fail('Такой логин уже занят');
      const record = DB.insert(DB.KEYS.users, 'u', {
        role: data.role || 'student',
        firstName: data.firstName,
        lastName: data.lastName,
        className: data.className || '—',
        login: data.login,
        password: data.password || '1234',
        points: 0,
        avatarColor: data.avatarColor || '#4f8cff',
      });
      const { password, ...safe } = record;
      return ok(safe);
    },
    async update(id, patch) {
      const updated = DB.update(DB.KEYS.users, id, patch);
      if (!updated) return fail('Пользователь не найден');
      const { password, ...safe } = updated;
      return ok(safe);
    },
    async remove(id) {
      const removed = DB.remove(DB.KEYS.users, id);
      if (!removed) return fail('Пользователь не найден');
      return ok(true);
    },
  };

  // -------------------- contests -------------------------------------
  const contests = {
    async list(filter = {}) {
      let items = DB.getAll(DB.KEYS.contests);
      if (filter.query) {
        const q = filter.query.toLowerCase();
        items = items.filter((c) => c.title.toLowerCase().includes(q));
      }
      if (filter.status) {
        items = items.filter((c) => c.status === filter.status);
      }
      return ok(items);
    },
    async get(id) {
      const c = DB.getById(DB.KEYS.contests, id);
      return c ? ok(c) : fail('Конкурс не найден');
    },
    async create(data) {
      if (!data.title) return fail('Укажите название конкурса');
      const record = DB.insert(DB.KEYS.contests, 'c', {
        title: data.title,
        category: data.category || 'Общее',
        description: data.description || '',
        status: data.status || 'upcoming',
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        maxPoints: Number(data.maxPoints) || 100,
        diplomaTemplateId: data.diplomaTemplateId || 't1',
      });
      return ok(record);
    },
    async update(id, patch) {
      const updated = DB.update(DB.KEYS.contests, id, patch);
      return updated ? ok(updated) : fail('Конкурс не найден');
    },
    async remove(id) {
      const removed = DB.remove(DB.KEYS.contests, id);
      return removed ? ok(true) : fail('Конкурс не найден');
    },
  };

  // -------------------- participations --------------------------------
  const participations = {
    async list(filter = {}) {
      let items = DB.getAll(DB.KEYS.participations);
      if (filter.userId) items = items.filter((p) => p.userId === filter.userId);
      if (filter.contestId) items = items.filter((p) => p.contestId === filter.contestId);
      return ok(items);
    },
    async create(data) {
      if (!data.userId || !data.contestId) return fail('Не указан ученик или конкурс');
      const already = DB.getAll(DB.KEYS.participations)
        .some((p) => p.userId === data.userId && p.contestId === data.contestId);
      if (already) return fail('Ученик уже участвует в этом конкурсе');
      const record = DB.insert(DB.KEYS.participations, 'p', {
        userId: data.userId,
        contestId: data.contestId,
        status: data.status || 'registered',
        points: Number(data.points) || 0,
        place: data.place ?? null,
        joinedAt: data.joinedAt || new Date().toISOString().slice(0, 10),
      });
      return ok(record);
    },
    async update(id, patch) {
      const updated = DB.update(DB.KEYS.participations, id, patch);
      return updated ? ok(updated) : fail('Запись об участии не найдена');
    },
    async remove(id) {
      const removed = DB.remove(DB.KEYS.participations, id);
      return removed ? ok(true) : fail('Запись об участии не найдена');
    },
  };

  // -------------------- diplomas ----------------------------------------
  const diplomas = {
    async list(filter = {}) {
      let items = DB.getAll(DB.KEYS.diplomas);
      if (filter.userId) items = items.filter((d) => d.userId === filter.userId);
      return ok(items);
    },
    async templates() {
      return ok(DB.getAll(DB.KEYS.diplomaTemplates));
    },
    async issue({ participationId, userId, contestId, templateId }) {
      const record = DB.insert(DB.KEYS.diplomas, 'd', {
        participationId,
        userId,
        contestId,
        templateId,
        issuedAt: new Date().toISOString().slice(0, 10),
      });
      return ok(record);
    },
  };

  // -------------------- reports ------------------------------------------
  const reports = {
    /** Собирает "плоский" отчёт по активности: 1 строка = 1 участие. */
    async activityReport(filter = {}) {
      const allUsers = DB.getAll(DB.KEYS.users);
      const allContests = DB.getAll(DB.KEYS.contests);
      let rows = DB.getAll(DB.KEYS.participations);
      if (filter.contestId) rows = rows.filter((p) => p.contestId === filter.contestId);

      const report = rows.map((p) => {
        const u = allUsers.find((x) => x.id === p.userId);
        const c = allContests.find((x) => x.id === p.contestId);
        return {
          Ученик: u ? `${u.lastName} ${u.firstName}` : p.userId,
          Класс: u ? u.className : '',
          Конкурс: c ? c.title : p.contestId,
          Статус: p.status,
          Баллы: p.points,
          Место: p.place ?? '',
          'Дата участия': p.joinedAt,
        };
      });
      return ok(report);
    },

    /** Превращает массив объектов в CSV-строку (с учётом кириллицы — BOM). */
    toCSV(rows) {
      if (!rows.length) return '';
      const headers = Object.keys(rows[0]);
      const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const lines = [headers.map(escape).join(',')];
      rows.forEach((row) => {
        lines.push(headers.map((h) => escape(row[h])).join(','));
      });
      return '﻿' + lines.join('\r\n');
    },
  };

  return { auth, users, contests, participations, diplomas, reports };
})();
