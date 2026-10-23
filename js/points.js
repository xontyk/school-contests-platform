/**
 * points.js — прозрачная таблица начисления баллов (копия для браузера).
 *
 * Источник правды — функция calc_points() в supabase/schema.sql: при
 * сохранении база пересчитывает баллы сама, поэтому подмена числа в
 * браузере ничего не даёт. Эта копия нужна только для мгновенного
 * предпросмотра в форме. Обоснование категорий — README → «Система баллов».
 *
 * ПОДСКАЗКА: чтобы изменить, сколько баллов дают за олимпиаду или проект,
 * поменяй число И здесь, И в calc_points() в supabase/schema.sql (потом
 * запусти schema.sql в SQL Editor). Если поменять только здесь, форма
 * покажет одно число, а база начислит другое.
 */

// уровни олимпиад: label — как подписано в списках, points — баллы за участие и места

const OLYMPIAD_LEVELS = {
  school: { label: 'Школьный', points: { participant: 2, '3': 5, '2': 6, '1': 8 } },
  municipal: { label: 'Муниципальный', points: { participant: 5, '3': 10, '2': 12, '1': 15 } },
  regional: { label: 'Региональный', points: { participant: 10, '3': 20, '2': 25, '1': 30 } },
  national: { label: 'Всероссийский', points: { participant: 20, '3': 40, '2': 50, '1': 60 } },
  international: { label: 'Международный', points: { participant: 30, '3': 60, '2': 80, '1': 100 } },
};

// уровни конкурсов проектов (стоят меньше олимпиад: нет единого судейства)
const PROJECT_LEVELS = {
  school: { label: 'Школьный', points: { participant: 5, '3': 8, '2': 10, '1': 12 } },
  city: { label: 'Городской', points: { participant: 10, '3': 14, '2': 16, '1': 20 } },
  regional: { label: 'Региональный', points: { participant: 15, '3': 20, '2': 25, '1': 30 } },
};

// подписи, которые видит пользователь; переименуешь здесь — изменится во всех списках и таблицах
const PLACE_LABELS = { participant: 'Участие', '3': '3 место', '2': '2 место', '1': '1 место' };

const SUBJECT_LABELS = { physics: 'Физика', math: 'Математика', cs: 'Информатика' };
const CATEGORY_LABELS = { academic: 'Академическое', olympiad: 'Олимпиада', project: 'Проект', volunteer: 'Волонтёрство' };

const ACADEMIC_BASE_POINTS = 5;    // баллы за академическое достижение
const VOLUNTEER_POINTS_PER_2H = 1; // волонтёрство: 1 балл за каждые 2 часа
const VOLUNTEER_MAX_POINTS = 10;   // потолок баллов за одну заявку волонтёрства

const QUARTERS = ['I', 'II', 'III', 'IV'];

/** Учебный год и четверть по дате: сен–окт I, ноя–дек II, янв–мар III, апр–авг IV. */
function periodOf(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  const year = m >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
  const q = m >= 9 && m <= 10 ? 'I' : m >= 11 ? 'II' : m <= 3 ? 'III' : 'IV';
  return `${year}, ${q} четверть`;
}

/** Текущий и прошлый учебный год: для фильтров рейтинга и выбора периода. */
function periodOptions() {
  const current = periodOf().split(',')[0];
  const [a] = current.split('/').map(Number);
  const years = [current, `${a - 1}/${a}`];
  return years.flatMap((y) => [{ value: y, label: `${y}, весь год` }, ...QUARTERS.map((q) => ({ value: `${y}, ${q} четверть`, label: `${y}, ${q} четверть` }))]);
}

/** Заполняет <select> уровней для олимпиады или проекта. */
function fillLevelOptions(select, category) {
  const levels = category === 'olympiad' ? OLYMPIAD_LEVELS : category === 'project' ? PROJECT_LEVELS : null;
  select.innerHTML = levels ? Object.entries(levels).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('') : '';
  return Boolean(levels);
}

/** Считает баллы по тем же правилам, что показаны ученику в форме. */
function calcAchievementPoints({ category, level, place, hours }) {
  if (category === 'academic') return ACADEMIC_BASE_POINTS;
  if (category === 'olympiad') {
    const lvl = OLYMPIAD_LEVELS[level];
    if (!lvl) return 0;
    return lvl.points[place || 'participant'] ?? 0;
  }
  if (category === 'project') {
    const lvl = PROJECT_LEVELS[level];
    if (!lvl) return 0;
    return lvl.points[place || 'participant'] ?? 0;
  }
  if (category === 'volunteer') {
    const h = Number(hours) || 0;
    return Math.min(VOLUNTEER_MAX_POINTS, Math.floor(h / 2) * VOLUNTEER_POINTS_PER_2H);
  }
  return 0;
}
