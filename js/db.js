/**
 * db.js — слой хранения данных.
 *
 * Эмулирует базу данных поверх localStorage. Отвечает только за
 * чтение/запись "таблиц" (коллекций) и генерацию тестовых данных при
 * первом запуске. Бизнес-логика и правила доступа живут в api.js —
 * здесь их быть не должно.
 *
 * Схема хранения: каждая коллекция — это JSON-массив объектов под своим
 * ключом localStorage (см. DB.KEYS). При переходе на реальный бэкенд
 * этот файл полностью заменяется HTTP-клиентом к БД (см. README,
 * раздел "План масштабирования"), а api.js остаётся почти без изменений.
 */

const DB = (() => {
  const KEYS = {
    users: 'spk_users',
    contests: 'spk_contests',
    participations: 'spk_participations',
    diplomas: 'spk_diplomas',
    diplomaTemplates: 'spk_diploma_templates',
    seeded: 'spk_seeded_v1',
  };

  // ---- низкоуровневый доступ к localStorage -------------------------

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('DB.read: повреждённые данные в', key, e);
      return [];
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function nextId(prefix, collection) {
    const n = collection.reduce((max, item) => {
      const num = parseInt(String(item.id).replace(prefix, ''), 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);
    return `${prefix}${n + 1}`;
  }

  // ---- generic CRUD поверх произвольной коллекции --------------------

  function getAll(key) {
    return read(key);
  }

  function getById(key, id) {
    return read(key).find((item) => item.id === id) || null;
  }

  function insert(key, prefix, data) {
    const collection = read(key);
    const id = data.id || nextId(prefix, collection);
    const record = { ...data, id };
    collection.push(record);
    write(key, collection);
    return record;
  }

  function update(key, id, patch) {
    const collection = read(key);
    const idx = collection.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    collection[idx] = { ...collection[idx], ...patch, id };
    write(key, collection);
    return collection[idx];
  }

  function remove(key, id) {
    const collection = read(key);
    const next = collection.filter((item) => item.id !== id);
    write(key, next);
    return next.length !== collection.length;
  }

  // ---- тестовые данные (seed) ----------------------------------------
  // Минимум по ТЗ: 3+ конкурса, 5–10 участников. Здесь — 4 конкурса,
  // 5 учеников и 2 администратора.

  function seed() {
    if (localStorage.getItem(KEYS.seeded)) return;

    const users = [
      { id: 'u1', role: 'student', firstName: 'Пётр', lastName: 'Иванов', className: '9А', login: 'petr', password: '1234', points: 0, avatarColor: '#4f8cff' },
      { id: 'u2', role: 'student', firstName: 'Анна', lastName: 'Смирнова', className: '10Б', login: 'anna', password: '1234', points: 0, avatarColor: '#ff6b81' },
      { id: 'u3', role: 'student', firstName: 'Данил', lastName: 'Кузнецов', className: '11А', login: 'danil', password: '1234', points: 0, avatarColor: '#2ecc71' },
      { id: 'u4', role: 'student', firstName: 'Мария', lastName: 'Соколова', className: '9Б', login: 'maria', password: '1234', points: 0, avatarColor: '#f5a623' },
      { id: 'u5', role: 'student', firstName: 'Тимур', lastName: 'Орлов', className: '10А', login: 'timur', password: '1234', points: 0, avatarColor: '#9b59b6' },
      { id: 'u6', role: 'admin', firstName: 'Елена', lastName: 'Петрова', className: '—', login: 'admin', password: 'admin123', points: 0, avatarColor: '#34495e' },
      { id: 'u7', role: 'admin', firstName: 'Игорь', lastName: 'Волков', className: '—', login: 'admin2', password: 'admin123', points: 0, avatarColor: '#16a085' },
    ];

    const contests = [
      { id: 'c1', title: 'Олимпиада по математике', category: 'Наука', description: 'Школьный тур олимпиады по математике для 9–11 классов.', status: 'active', startDate: '2026-09-15', endDate: '2026-10-30', maxPoints: 100, diplomaTemplateId: 't1' },
      { id: 'c2', title: "Конкурс проектов «Инновация»", category: 'Проекты', description: 'Конкурс исследовательских и инженерных проектов учащихся.', status: 'active', startDate: '2026-10-01', endDate: '2026-11-15', maxPoints: 100, diplomaTemplateId: 't2' },
      { id: 'c3', title: "Творческий конкурс «Я — автор»", category: 'Творчество', description: 'Конкурс литературных и художественных работ.', status: 'finished', startDate: '2026-08-01', endDate: '2026-09-10', maxPoints: 100, diplomaTemplateId: 't1' },
      { id: 'c4', title: 'Турнир по шахматам', category: 'Спорт', description: 'Школьный шахматный турнир, осенний сезон.', status: 'upcoming', startDate: '2026-11-20', endDate: '2026-12-05', maxPoints: 100, diplomaTemplateId: 't2' },
    ];

    const participations = [
      { id: 'p1', userId: 'u1', contestId: 'c1', status: 'winner', points: 95, place: 1, joinedAt: '2026-09-16' },
      { id: 'p2', userId: 'u2', contestId: 'c1', status: 'completed', points: 78, place: 4, joinedAt: '2026-09-16' },
      { id: 'p3', userId: 'u3', contestId: 'c1', status: 'in_progress', points: 40, place: null, joinedAt: '2026-09-20' },
      { id: 'p4', userId: 'u1', contestId: 'c2', status: 'in_progress', points: 55, place: null, joinedAt: '2026-10-02' },
      { id: 'p5', userId: 'u4', contestId: 'c2', status: 'registered', points: 0, place: null, joinedAt: '2026-10-05' },
      { id: 'p6', userId: 'u5', contestId: 'c2', status: 'winner', points: 98, place: 1, joinedAt: '2026-10-01' },
      { id: 'p7', userId: 'u2', contestId: 'c3', status: 'winner', points: 92, place: 2, joinedAt: '2026-08-02' },
      { id: 'p8', userId: 'u4', contestId: 'c3', status: 'completed', points: 81, place: 3, joinedAt: '2026-08-03' },
      { id: 'p9', userId: 'u3', contestId: 'c3', status: 'completed', points: 70, place: 5, joinedAt: '2026-08-05' },
      { id: 'p10', userId: 'u5', contestId: 'c4', status: 'registered', points: 0, place: null, joinedAt: '2026-10-20' },
    ];

    const diplomaTemplates = [
      { id: 't1', name: 'Классический (золото)', file: 'assets/diplomas/template-1.svg' },
      { id: 't2', name: 'Современный (синий)', file: 'assets/diplomas/template-2.svg' },
    ];

    // Дипломы создаются только для участий со статусом winner/completed.
    const diplomas = [
      { id: 'd1', participationId: 'p1', userId: 'u1', contestId: 'c1', templateId: 't1', issuedAt: '2026-10-31' },
      { id: 'd2', participationId: 'p2', userId: 'u2', contestId: 'c1', templateId: 't1', issuedAt: '2026-10-31' },
      { id: 'd3', participationId: 'p6', userId: 'u5', contestId: 'c2', templateId: 't2', issuedAt: '2026-11-16' },
      { id: 'd4', participationId: 'p7', userId: 'u2', contestId: 'c3', templateId: 't1', issuedAt: '2026-09-11' },
      { id: 'd5', participationId: 'p8', userId: 'u4', contestId: 'c3', templateId: 't1', issuedAt: '2026-09-11' },
      { id: 'd6', participationId: 'p9', userId: 'u3', contestId: 'c3', templateId: 't1', issuedAt: '2026-09-11' },
    ];

    write(KEYS.users, users);
    write(KEYS.contests, contests);
    write(KEYS.participations, participations);
    write(KEYS.diplomas, diplomas);
    write(KEYS.diplomaTemplates, diplomaTemplates);
    localStorage.setItem(KEYS.seeded, '1');
  }

  function resetAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    seed();
  }

  seed();

  return { KEYS, getAll, getById, insert, update, remove, resetAll };
})();
