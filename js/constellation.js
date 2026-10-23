/**
 * constellation.js — портфолио как карта созвездий.
 *
 * Каждое ПОДТВЕРЖДЁННОЕ достижение — четырёхлучевая звезда-искра в
 * одном из четырёх кластеров (физика / математика / информатика /
 * проекты и волонтёрство). Размер звезды растёт с баллами, звёзды
 * кластера соединены линией. Позиции детерминированы по id, поэтому
 * карта не «прыгает» между перерисовками. Отозванные и непроверенные
 * достижения на карту не попадают.
 *
 * ПОДСКАЗКА: cx — где по горизонтали стоит кластер (0 = левый край, 1 = правый);
 * color — цвет звёзд (переменные из css/style.css); label — подпись в легенде.
 */

const CONSTELLATION_CLUSTERS = [
  { key: 'physics', label: 'Физика', color: 'var(--subj-physics)', cx: 0.15 },
  { key: 'math', label: 'Математика', color: 'var(--subj-math)', cx: 0.39 },
  { key: 'cs', label: 'Информатика', color: 'var(--subj-cs)', cx: 0.63 },
  { key: 'other', label: 'Проекты и волонтёрство', color: 'var(--subj-other)', cx: 0.86 },
];

/** Строка → число 0…1, всегда одинаковое для одной строки (звёзды не «прыгают» между загрузками). */
function hashToUnit(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return (h % 10000) / 10000;
}

function clusterKeyFor(a) {
  return ['physics', 'math', 'cs'].includes(a.subject) ? a.subject : 'other';
}

/** Четырёхлучевая звезда (как «искры» в референсе) радиусом r в точке x,y. */
function sparklePath(x, y, r) {
  const k = r * 0.16;
  return `M${x},${y - r} C${x + k},${y - k} ${x + k},${y - k} ${x + r},${y} C${x + k},${y + k} ${x + k},${y + k} ${x},${y + r} C${x - k},${y + k} ${x - k},${y + k} ${x - r},${y} C${x - k},${y - k} ${x - k},${y - k} ${x},${y - r}Z`;
}

function renderConstellation(rootEl, achievements) {
  const W = 760, H = 320; // «холст» карты; на экране SVG растягивается по ширине блока
  const approved = achievements.filter((a) => a.status === 'approved');

  if (!approved.length) {
    rootEl.innerHTML = '<div class="constellation__empty">Карта пока пуста. Как только учитель подтвердит первое достижение, здесь зажжётся звезда.</div>';
    return;
  }

  const grouped = Object.fromEntries(CONSTELLATION_CLUSTERS.map((c) => [c.key, []]));
  approved.forEach((a) => grouped[clusterKeyFor(a)].push(a));
  const maxPoints = Math.max(...approved.map((a) => a.points), 1);

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Карта созвездий: ${approved.length} подтверждённых достижений">`;

  // фоновая «звёздная пыль» — детерминированная, чтобы не мерцала при перерисовке
  for (let i = 0; i < 60; i++) { // 60 — количество фоновых точек-звёзд
    const x = hashToUnit(`dx${i}`) * W;
    const y = hashToUnit(`dy${i}`) * H;
    const r = 0.6 + hashToUnit(`dr${i}`) * 1.1;
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity="${(0.12 + hashToUnit(`do${i}`) * 0.3).toFixed(2)}"/>`;
  }

  CONSTELLATION_CLUSTERS.forEach((cluster) => {
    const items = grouped[cluster.key];
    if (!items.length) return;
    const baseX = cluster.cx * W;
    const stars = items.map((a, idx) => {
      const id = String(a.id);
      const angle = (idx / items.length) * Math.PI * 2 + hashToUnit(id + 'x') * 0.9;
      const radius = 30 + hashToUnit(id + 'y') * 64; // насколько далеко звезда от центра кластера
      return {
        a,
        x: baseX + Math.cos(angle) * radius * 0.6,
        y: H / 2 + Math.sin(angle) * radius,
        r: 9 + (a.points / maxPoints) * 15, // размер звезды: от 9 (мало баллов) до 24 (больше всех)
        delay: (hashToUnit(id + 'tw') * 3.2).toFixed(2),
      };
    });

    // пунктирная линия-созвездие между звёздами одного предмета
    if (stars.length > 1) {
      const d = stars.map((s, i) => `${i ? 'L' : 'M'}${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' ');
      svg += `<path d="${d}" fill="none" stroke="${cluster.color}" stroke-width="1.2" stroke-dasharray="3 5" opacity="0.5"/>`;
    }
    stars.forEach(({ a, x, y, r, delay }) => {
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.9).toFixed(1)}" fill="${cluster.color}" opacity="0.12"/>`;
      svg += `<path class="constellation__star" style="--twinkle-delay:${delay}s" d="${sparklePath(x, y, r)}" fill="${cluster.color}"><title>${escapeHtml(a.title)} · ${pointsWord(a.points)}</title></path>`;
    });
  });

  rootEl.innerHTML = svg + '</svg>';
}
