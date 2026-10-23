/**
 * points.js — прозрачная таблица начисления баллов.
 *
 * Логика вынесена отдельно от api.js, чтобы форма добавления достижения
 * могла показывать ученику баллы ДО отправки (прозрачность системы —
 * продуктовый принцип из PRODUCT.md), а учитель видел ту же цифру при
 * проверке. Обоснование категорий — в README → «Система баллов».
 */

const OLYMPIAD_LEVELS = {
  school: { label: 'Школьный', points: { participant: 2, '3': 5, '2': 6, '1': 8 } },
  municipal: { label: 'Муниципальный', points: { participant: 5, '3': 10, '2': 12, '1': 15 } },
  regional: { label: 'Региональный', points: { participant: 10, '3': 20, '2': 25, '1': 30 } },
  national: { label: 'Всероссийский', points: { participant: 20, '3': 40, '2': 50, '1': 60 } },
  international: { label: 'Международный', points: { participant: 30, '3': 60, '2': 80, '1': 100 } },
};

const PROJECT_LEVELS = {
  school: { label: 'Школьный', points: { participant: 5, '3': 8, '2': 10, '1': 12 } },
  city: { label: 'Городской', points: { participant: 10, '3': 14, '2': 16, '1': 20 } },
  regional: { label: 'Региональный', points: { participant: 15, '3': 20, '2': 25, '1': 30 } },
};

const PLACE_LABELS = { participant: 'Участие', '3': '3 место', '2': '2 место', '1': '1 место' };

const SUBJECT_LABELS = { physics: 'Физика', math: 'Математика', cs: 'Информатика' };
const CATEGORY_LABELS = { academic: 'Академическое', olympiad: 'Олимпиада', project: 'Проект', volunteer: 'Волонтёрство' };

const ACADEMIC_BASE_POINTS = 5;
const VOLUNTEER_POINTS_PER_2H = 1;
const VOLUNTEER_MAX_POINTS = 10;

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
