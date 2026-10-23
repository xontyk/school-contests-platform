/**
 * api.js — эмулированный API-слой.
 *
 * Контракт (имена методов, Promise + задержка, форма ответа) повторяет
 * то, как выглядел бы реальный fetch()-клиент к REST API — при переходе
 * на настоящий бэкенд меняется только реализация внутри каждого метода,
 * код страниц (login.js, student.js, teacher.js) не меняется.
 *
 * Разделы: api.auth (вход + регистрация в 3 шага), api.registrations
 * (очередь заявок на регистрацию для учителя), api.users, api.achievements
 * (CRUD + верификация), api.rating (агрегация баллов), api.reports (CSV).
 */

const api = (() => {
  const LATENCY_MS = 150;

  function ok(data) {
    return new Promise((resolve) => setTimeout(() => resolve(data), LATENCY_MS));
  }
  function fail(message) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), LATENCY_MS));
  }

  // -------------------- auth: вход --------------------------------------
  const SESSION_KEY = 'lic_session_user_id';
  const CODE_KEY = 'lic_pending_registration_code';

  function fullName(u) {
    return [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');
  }

  const auth = {
    async login(email, password) {
      const normalizedEmail = (email || '').trim().toLowerCase();
      const user = DB.getAll(DB.KEYS.users).find(
        (u) => u.email.toLowerCase() === normalizedEmail && u.password === password
      );
      if (user) {
        localStorage.setItem(SESSION_KEY, user.id);
        const { password: _pw, ...safe } = user;
        return ok(safe);
      }
      const pendingReq = DB.getAll(DB.KEYS.registrations).find(
        (r) => r.email.toLowerCase() === normalizedEmail && r.status === 'pending'
      );
      if (pendingReq) return fail('Ваша заявка на регистрацию ещё на рассмотрении у учителя.');
      const rejectedReq = DB.getAll(DB.KEYS.registrations).find(
        (r) => r.email.toLowerCase() === normalizedEmail && r.status === 'rejected'
      );
      if (rejectedReq) return fail(`Заявка отклонена: ${rejectedReq.rejectionReason || 'без указания причины'}`);
      return fail('Неверный e-mail или пароль.');
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
      const { password: _pw, ...safe } = user;
      return ok(safe);
    },

    // -------------------- auth: регистрация в 3 шага ---------------------
    /** Шаг 1: "отправляет" код на почту. Демо-режим — код возвращается
     *  вызывающей стороне, чтобы показать его прямо в интерфейсе. */
    async requestCode(email) {
      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return fail('Введите корректный e-mail.');
      const existingUser = DB.getAll(DB.KEYS.users).find((u) => u.email.toLowerCase() === normalizedEmail);
      if (existingUser) return fail('Пользователь с таким e-mail уже зарегистрирован.');
      const pendingReq = DB.getAll(DB.KEYS.registrations).find(
        (r) => r.email.toLowerCase() === normalizedEmail && r.status === 'pending'
      );
      if (pendingReq) return fail('Заявка с этим e-mail уже отправлена и ждёт решения учителя.');
      const code = String(Math.floor(100000 + Math.random() * 900000));
      sessionStorage.setItem(CODE_KEY, JSON.stringify({ email: normalizedEmail, code, expiresAt: Date.now() + 10 * 60 * 1000 }));
      return ok({ email: normalizedEmail, code });
    },
    /** Шаг 2: проверка кода из письма. */
    async verifyCode(email, code) {
      const normalizedEmail = (email || '').trim().toLowerCase();
      const raw = sessionStorage.getItem(CODE_KEY);
      if (!raw) return fail('Код не запрошен или устарел. Запросите новый.');
      const pending = JSON.parse(raw);
      if (pending.email !== normalizedEmail) return fail('Код выдан для другого e-mail.');
      if (Date.now() > pending.expiresAt) return fail('Срок действия кода истёк. Запросите новый.');
      if (pending.code !== String(code).trim()) return fail('Неверный код подтверждения.');
      sessionStorage.setItem(CODE_KEY, JSON.stringify({ ...pending, verified: true }));
      return ok(true);
    },
    /** Шаг 3: пароль + ФИО + класс → заявка уходит в очередь к учителю. */
    async submitRegistration({ email, password, lastName, firstName, middleName, className }) {
      const normalizedEmail = (email || '').trim().toLowerCase();
      const raw = sessionStorage.getItem(CODE_KEY);
      const pending = raw ? JSON.parse(raw) : null;
      if (!pending || pending.email !== normalizedEmail || !pending.verified) {
        return fail('Сначала подтвердите e-mail кодом.');
      }
      if (!password || password.length < 4) return fail('Пароль должен быть не короче 4 символов.');
      if (!lastName || !firstName) return fail('Укажите фамилию и имя.');
      const record = DB.insert(DB.KEYS.registrations, 'r', {
        email: normalizedEmail,
        password,
        lastName,
        firstName,
        middleName: middleName || '',
        className: className || '',
        status: 'pending',
        requestedAt: new Date().toISOString().slice(0, 10),
        decidedAt: null,
        decidedBy: null,
        rejectionReason: null,
        assignedRole: null,
      });
      sessionStorage.removeItem(CODE_KEY);
      return ok(record);
    },
  };

  // -------------------- заявки на регистрацию (учитель) ------------------
  const registrations = {
    async list(filter = {}) {
      let items = DB.getAll(DB.KEYS.registrations);
      if (filter.status) items = items.filter((r) => r.status === filter.status);
      return ok(items.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1)));
    },
    async approve(id, { role, decidedBy, className }) {
      const req = DB.getById(DB.KEYS.registrations, id);
      if (!req) return fail('Заявка не найдена');
      if (req.status !== 'pending') return fail('Заявка уже рассмотрена');
      const user = DB.insert(DB.KEYS.users, 'u', {
        role,
        firstName: req.firstName,
        lastName: req.lastName,
        middleName: req.middleName,
        email: req.email,
        password: req.password,
        className: role === 'student' ? (className || req.className) : null,
        avatarColor: ['#6ec6ff', '#5be8a7', '#f5c77d', '#8a6cff', '#ff8a9e'][Math.floor(Math.random() * 5)],
      });
      DB.update(DB.KEYS.registrations, id, {
        status: 'approved',
        decidedAt: new Date().toISOString().slice(0, 10),
        decidedBy,
        assignedRole: role,
      });
      return ok(user);
    },
    async reject(id, { reason, decidedBy }) {
      const req = DB.getById(DB.KEYS.registrations, id);
      if (!req) return fail('Заявка не найдена');
      if (req.status !== 'pending') return fail('Заявка уже рассмотрена');
      const updated = DB.update(DB.KEYS.registrations, id, {
        status: 'rejected',
        decidedAt: new Date().toISOString().slice(0, 10),
        decidedBy,
        rejectionReason: reason || 'Без указания причины',
      });
      return ok(updated);
    },
  };

  // -------------------- users ---------------------------------------------
  const users = {
    async list(filter = {}) {
      let items = DB.getAll(DB.KEYS.users).map(({ password, ...u }) => u);
      if (filter.role) items = items.filter((u) => u.role === filter.role);
      if (filter.className) items = items.filter((u) => u.className === filter.className);
      return ok(items);
    },
    async get(id) {
      const u = DB.getById(DB.KEYS.users, id);
      if (!u) return fail('Пользователь не найден');
      const { password, ...safe } = u;
      return ok(safe);
    },
  };

  // -------------------- achievements --------------------------------------
  const achievements = {
    async list(filter = {}) {
      let items = DB.getAll(DB.KEYS.achievements);
      if (filter.userId) items = items.filter((a) => a.userId === filter.userId);
      if (filter.status) items = items.filter((a) => a.status === filter.status);
      if (filter.subject) items = items.filter((a) => a.subject === filter.subject);
      if (filter.category) items = items.filter((a) => a.category === filter.category);
      return ok(items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    },
    /** Ученик отправляет достижение — всегда уходит в статус "pending". */
    async submit(data) {
      if (!data.userId || !data.category || !data.title) return fail('Заполните обязательные поля');
      const points = calcAchievementPoints(data);
      const record = DB.insert(DB.KEYS.achievements, 'a', {
        userId: data.userId,
        category: data.category,
        subject: data.subject || null,
        title: data.title,
        description: data.description || '',
        level: data.level || null,
        place: data.place || null,
        hours: data.hours ? Number(data.hours) : null,
        period: data.period || '',
        date: data.date || new Date().toISOString().slice(0, 10),
        points,
        status: 'pending',
        teacherComment: '',
        verifiedBy: null,
        verifiedAt: null,
        createdAt: new Date().toISOString().slice(0, 10),
      });
      return ok(record);
    },
    /** Учитель добавляет достижение ученику напрямую — сразу подтверждено. */
    async createByTeacher(data, teacherId) {
      if (!data.userId || !data.category || !data.title) return fail('Заполните обязательные поля');
      const points = calcAchievementPoints(data);
      const record = DB.insert(DB.KEYS.achievements, 'a', {
        userId: data.userId,
        category: data.category,
        subject: data.subject || null,
        title: data.title,
        description: data.description || '',
        level: data.level || null,
        place: data.place || null,
        hours: data.hours ? Number(data.hours) : null,
        period: data.period || '',
        date: data.date || new Date().toISOString().slice(0, 10),
        points,
        status: 'approved',
        teacherComment: 'Добавлено учителем',
        verifiedBy: teacherId,
        verifiedAt: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString().slice(0, 10),
      });
      return ok(record);
    },
    async verify(id, { status, teacherComment, verifiedBy, points }) {
      const existing = DB.getById(DB.KEYS.achievements, id);
      if (!existing) return fail('Достижение не найдено');
      const updated = DB.update(DB.KEYS.achievements, id, {
        status,
        teacherComment: teacherComment || '',
        verifiedBy,
        verifiedAt: new Date().toISOString().slice(0, 10),
        points: points != null ? Number(points) : existing.points,
      });
      return ok(updated);
    },
  };

  // -------------------- рейтинг --------------------------------------------
  const rating = {
    /** Агрегирует баллы подтверждённых достижений по ученикам. */
    async compute(filter = {}) {
      const allUsers = DB.getAll(DB.KEYS.users).filter((u) => u.role === 'student');
      let allAch = DB.getAll(DB.KEYS.achievements).filter((a) => a.status === 'approved');
      if (filter.period) allAch = allAch.filter((a) => a.period === filter.period);
      if (filter.subject) allAch = allAch.filter((a) => a.subject === filter.subject);

      let rows = allUsers
        .filter((u) => !filter.className || u.className === filter.className)
        .map((u) => {
          const mine = allAch.filter((a) => a.userId === u.id);
          const bySubject = { physics: 0, math: 0, cs: 0 };
          mine.forEach((a) => { if (a.subject && bySubject[a.subject] != null) bySubject[a.subject] += a.points; });
          const total = mine.reduce((sum, a) => sum + a.points, 0);
          return {
            userId: u.id,
            name: fullName(u),
            className: u.className,
            total,
            physics: bySubject.physics,
            math: bySubject.math,
            cs: bySubject.cs,
            achievementsCount: mine.length,
          };
        });
      rows.sort((a, b) => b.total - a.total);
      rows = rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
      return ok(rows);
    },
  };

  // -------------------- отчёты (CSV) ----------------------------------------
  const reports = {
    toCSV(rows) {
      if (!rows.length) return '';
      const headers = Object.keys(rows[0]);
      const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const lines = [headers.map(escape).join(',')];
      rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(',')));
      return '﻿' + lines.join('\r\n');
    },
  };

  return { auth, registrations, users, achievements, rating, reports };
})();
