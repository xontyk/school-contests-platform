/**
 * db.js — слой хранения данных.
 *
 * Эмулирует базу данных поверх localStorage. Отвечает только за
 * чтение/запись "таблиц" (коллекций) и генерацию тестовых данных при
 * первом запуске. Бизнес-логика (расчёт баллов, правила верификации,
 * регистрация) живёт в api.js.
 *
 * При переходе на реальный бэкенд (см. README → «План развития») этот
 * файл заменяется HTTP-клиентом к PostgreSQL/MySQL, а api.js остаётся
 * почти без изменений — он уже написан как клиент REST-подобного API.
 */

const DB = (() => {
  const KEYS = {
    users: 'lic_users',
    achievements: 'lic_achievements',
    registrations: 'lic_registration_requests',
    seeded: 'lic_seeded_v1',
  };

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

  // ---- тестовые данные -------------------------------------------------

  function seed() {
    if (localStorage.getItem(KEYS.seeded)) return;

    const users = [
      { id: 'u1', role: 'teacher', firstName: 'Ольга', lastName: 'Соколова', middleName: 'Сергеевна', email: 'teacher@lyceum.ru', password: 'teacher123', className: null, avatarColor: '#8a6cff' },
      { id: 'u2', role: 'student', firstName: 'Пётр', lastName: 'Иванов', middleName: 'Андреевич', email: 'petr@lyceum.ru', password: '1234', className: '11А', avatarColor: '#6ec6ff' },
      { id: 'u3', role: 'student', firstName: 'Анна', lastName: 'Смирнова', middleName: 'Игоревна', email: 'anna@lyceum.ru', password: '1234', className: '10Б', avatarColor: '#5be8a7' },
      { id: 'u4', role: 'student', firstName: 'Данил', lastName: 'Кузнецов', middleName: 'Олегович', email: 'danil@lyceum.ru', password: '1234', className: '11А', avatarColor: '#f5c77d' },
      { id: 'u5', role: 'student', firstName: 'Мария', lastName: 'Соколова', middleName: 'Павловна', email: 'maria@lyceum.ru', password: '1234', className: '9Б', avatarColor: '#ff8a9e' },
      { id: 'u6', role: 'student', firstName: 'Тимур', lastName: 'Орлов', middleName: 'Русланович', email: 'timur@lyceum.ru', password: '1234', className: '10А', avatarColor: '#6ec6ff' },
      { id: 'u7', role: 'student', firstName: 'Ева', lastName: 'Волкова', middleName: 'Дмитриевна', email: 'eva@lyceum.ru', password: '1234', className: '9Б', avatarColor: '#5be8a7' },
    ];

    // category: academic | olympiad | project | volunteer
    // subject: physics | math | cs | null
    const achievements = [
      { id: 'a1', userId: 'u2', category: 'olympiad', subject: 'physics', title: 'Всероссийская олимпиада по физике', level: 'regional', place: '1', hours: null, period: '2025/2026, I четверть', date: '2025-10-12', points: 30, status: 'approved', teacherComment: 'Отличный результат!', verifiedBy: 'u1', verifiedAt: '2025-10-15', createdAt: '2025-10-13' },
      { id: 'a2', userId: 'u2', category: 'olympiad', subject: 'math', level: 'municipal', place: '2', title: 'Городская олимпиада по математике', hours: null, period: '2025/2026, I четверть', date: '2025-09-28', points: 12, status: 'approved', teacherComment: '', verifiedBy: 'u1', verifiedAt: '2025-09-30', createdAt: '2025-09-29' },
      { id: 'a3', userId: 'u2', category: 'project', subject: 'cs', level: 'school', place: null, title: 'Проект «Трекер привычек» на Python', hours: null, period: '2025/2026, I четверть', date: '2025-11-02', points: 5, status: 'pending', teacherComment: '', verifiedBy: null, verifiedAt: null, createdAt: '2025-11-03' },
      { id: 'a15', userId: 'u2', category: 'olympiad', subject: 'cs', level: 'school', place: '2', title: 'Школьный тур олимпиады по информатике', hours: null, period: '2025/2026, I четверть', date: '2025-10-14', points: 6, status: 'approved', teacherComment: '', verifiedBy: 'u1', verifiedAt: '2025-10-15', createdAt: '2025-10-14' },
      { id: 'a16', userId: 'u2', category: 'volunteer', subject: null, hours: 10, level: null, place: null, title: 'Помощь в организации Дня науки', period: '2025/2026, I четверть', date: '2025-10-28', points: 5, status: 'approved', teacherComment: 'Спасибо!', verifiedBy: 'u1', verifiedAt: '2025-10-29', createdAt: '2025-10-28' },
      { id: 'a17', userId: 'u2', category: 'project', subject: null, level: 'city', place: '2', title: 'Городской конкурс проектов «Юный исследователь»', hours: null, period: '2025/2026, I четверть', date: '2025-11-06', points: 16, status: 'approved', teacherComment: 'Сильная работа', verifiedBy: 'u1', verifiedAt: '2025-11-07', createdAt: '2025-11-06' },
      { id: 'a4', userId: 'u3', category: 'olympiad', subject: 'physics', level: 'school', place: '1', title: 'Школьный тур олимпиады по физике', hours: null, period: '2025/2026, I четверть', date: '2025-10-05', points: 8, status: 'approved', teacherComment: '', verifiedBy: 'u1', verifiedAt: '2025-10-06', createdAt: '2025-10-05' },
      { id: 'a5', userId: 'u3', category: 'volunteer', subject: null, hours: 14, level: null, place: null, title: 'Помощь на дне открытых дверей лицея', period: '2025/2026, I четверть', date: '2025-10-20', points: 7, status: 'approved', teacherComment: 'Спасибо за помощь!', verifiedBy: 'u1', verifiedAt: '2025-10-21', createdAt: '2025-10-20' },
      { id: 'a6', userId: 'u3', category: 'academic', subject: 'math', level: null, place: null, hours: null, title: 'Призёр школьной научной конференции', period: '2025/2026, I четверть', date: '2025-11-01', points: 5, status: 'pending', teacherComment: '', verifiedBy: null, verifiedAt: null, createdAt: '2025-11-01' },
      { id: 'a7', userId: 'u4', category: 'olympiad', subject: 'cs', level: 'national', place: '3', title: 'Всероссийская олимпиада по информатике', hours: null, period: '2025/2026, I четверть', date: '2025-10-18', points: 40, status: 'approved', teacherComment: 'Высокий уровень!', verifiedBy: 'u1', verifiedAt: '2025-10-19', createdAt: '2025-10-18' },
      { id: 'a8', userId: 'u4', category: 'project', subject: 'physics', level: 'city', place: '2', title: 'Городской конкурс инженерных проектов', hours: null, period: '2025/2026, I четверть', date: '2025-10-25', points: 16, status: 'approved', teacherComment: '', verifiedBy: 'u1', verifiedAt: '2025-10-26', createdAt: '2025-10-25' },
      { id: 'a9', userId: 'u4', category: 'volunteer', subject: null, hours: 6, level: null, place: null, title: 'Организация школьного турнира по шахматам', period: '2025/2026, I четверть', date: '2025-11-05', points: 3, status: 'rejected', teacherComment: 'Нужно подтверждение от организатора', verifiedBy: 'u1', verifiedAt: '2025-11-06', createdAt: '2025-11-05' },
      { id: 'a10', userId: 'u5', category: 'olympiad', subject: 'math', level: 'school', place: '2', title: 'Школьный тур олимпиады по математике', hours: null, period: '2025/2026, I четверть', date: '2025-10-07', points: 6, status: 'approved', teacherComment: '', verifiedBy: 'u1', verifiedAt: '2025-10-08', createdAt: '2025-10-07' },
      { id: 'a11', userId: 'u6', category: 'olympiad', subject: 'physics', level: 'municipal', place: '1', title: 'Городская олимпиада по физике', hours: null, period: '2025/2026, I четверть', date: '2025-10-11', points: 15, status: 'approved', teacherComment: '', verifiedBy: 'u1', verifiedAt: '2025-10-12', createdAt: '2025-10-11' },
      { id: 'a12', userId: 'u6', category: 'academic', subject: 'cs', level: null, place: null, hours: null, title: 'Лучший учебный проект по информатике за четверть', period: '2025/2026, I четверть', date: '2025-11-03', points: 5, status: 'pending', teacherComment: '', verifiedBy: null, verifiedAt: null, createdAt: '2025-11-03' },
      { id: 'a13', userId: 'u7', category: 'volunteer', subject: null, hours: 20, level: null, place: null, title: 'Волонтёрство на городском научном фестивале', period: '2025/2026, I четверть', date: '2025-10-15', points: 10, status: 'approved', teacherComment: 'Максимум за одну заявку', verifiedBy: 'u1', verifiedAt: '2025-10-16', createdAt: '2025-10-15' },
      { id: 'a14', userId: 'u7', category: 'olympiad', subject: 'cs', level: 'school', place: '3', title: 'Школьный тур олимпиады по информатике', hours: null, period: '2025/2026, I четверть', date: '2025-10-09', points: 5, status: 'approved', teacherComment: '', verifiedBy: 'u1', verifiedAt: '2025-10-10', createdAt: '2025-10-09' },
    ];

    const registrations = [
      { id: 'r1', email: 'novikova@lyceum.ru', password: 'demo1234', lastName: 'Новикова', firstName: 'Светлана', middleName: 'Игоревна', className: '9А', status: 'pending', requestedAt: '2025-11-08', decidedAt: null, decidedBy: null, rejectionReason: null, assignedRole: null },
      { id: 'r2', email: 'belov@lyceum.ru', password: 'demo1234', lastName: 'Белов', firstName: 'Максим', middleName: 'Сергеевич', className: '10Б', status: 'pending', requestedAt: '2025-11-09', decidedAt: null, decidedBy: null, rejectionReason: null, assignedRole: null },
      { id: 'r3', email: 'staraya@lyceum.ru', password: 'demo1234', lastName: 'Старая', firstName: 'Заявка', middleName: '', className: '9А', status: 'rejected', requestedAt: '2025-10-20', decidedAt: '2025-10-22', decidedBy: 'u1', rejectionReason: 'Не удалось подтвердить принадлежность к лицею', assignedRole: null },
    ];

    write(KEYS.users, users);
    write(KEYS.achievements, achievements);
    write(KEYS.registrations, registrations);
    localStorage.setItem(KEYS.seeded, '1');
  }

  function resetAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    seed();
  }

  seed();

  return { KEYS, getAll, getById, insert, update, remove, resetAll };
})();
