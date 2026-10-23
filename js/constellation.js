/**
 * constellation.js — визуализация портфолио как карты созвездий.
 *
 * Сигнатурный приём интерфейса: каждое ПОДТВЕРЖДЁННОЕ достижение — звезда
 * в одном из четырёх кластеров (физика / математика / информатика /
 * проекты и волонтёрство), размер и яркость звезды растут вместе с
 * баллами, звёзды внутри кластера соединены линиями как созвездие.
 * Позиции детерминированы по id достижения — карта не "прыгает" между
 * перерисовками с теми же данными.
 */

const CONSTELLATION_CLUSTERS = [
  { key: 'physics', label: 'Физика', color: 'var(--subj-physics)', cx: 0.16 },
  { key: 'math', label: 'Математика', color: 'var(--subj-math)', cx: 0.40 },
  { key: 'cs', label: 'Информатика', color: 'var(--subj-cs)', cx: 0.64 },
  { key: 'other', label: 'Проекты и волонтёрство', color: '#9aa3c7', cx: 0.88 },
];

function hashToUnit(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

function clusterKeyFor(a) {
  if (a.subject === 'physics') return 'physics';
  if (a.subject === 'math') return 'math';
  if (a.subject === 'cs') return 'cs';
  return 'other';
}

function renderConstellation(rootEl, achievements) {
  const W = 760, H = 300;
  const approved = achievements.filter((a) => a.status === 'approved');

  if (!approved.length) {
    rootEl.innerHTML = '<div class="constellation__empty">Карта пока пуста — как только учитель подтвердит первое достижение, здесь зажжётся звезда.</div>';
    return;
  }

  const grouped = {};
  CONSTELLATION_CLUSTERS.forEach((c) => { grouped[c.key] = []; });
  approved.forEach((a) => grouped[clusterKeyFor(a)].push(a));

  const maxPoints = Math.max(...approved.map((a) => a.points), 1);
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  CONSTELLATION_CLUSTERS.forEach((cluster) => {
    const items = grouped[cluster.key];
    if (!items.length) return;
    const baseX = cluster.cx * W;
    const points = items.map((a, idx) => {
      const seedX = hashToUnit(a.id + 'x');
      const seedY = hashToUnit(a.id + 'y');
      const angle = (idx / items.length) * Math.PI * 2 + seedX * 0.8;
      const radius = 34 + seedY * 58;
      const x = baseX + Math.cos(angle) * radius * 0.55;
      const y = H / 2 + Math.sin(angle) * radius;
      const r = 4 + (a.points / maxPoints) * 9;
      return { a, x, y, r };
    });

    // линии созвездия: соединяем звёзды по порядку (ломаная) — читается
    // как настоящее созвездие, не как облако точек.
    if (points.length > 1) {
      const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      svg += `<path d="${path}" fill="none" stroke="${cluster.color}" stroke-width="1" opacity="0.35"/>`;
    }

    points.forEach(({ a, x, y, r }) => {
      const title = `${escapeHtml(a.title)} · ${a.points} баллов`;
      const delay = (hashToUnit(a.id + 'twinkle') * 3.2).toFixed(2);
      svg += `<circle class="constellation__star" style="--twinkle-delay:${delay}s" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${cluster.color}" opacity="0.92"><title>${title}</title></circle>`;
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 4).toFixed(1)}" fill="${cluster.color}" opacity="0.14"/>`;
    });

    svg += `<text class="constellation__label" x="${baseX.toFixed(1)}" y="${H - 14}" text-anchor="middle" fill="rgba(255,255,255,.55)" font-size="11" font-family="Manrope, sans-serif" font-weight="700" letter-spacing="0.03em">${cluster.label.toUpperCase()}</text>`;
  });

  svg += '</svg>';
  rootEl.innerHTML = svg;
}
