/**
 * diploma.js — именной диплом в стиле портала, PNG 1600×1131 (пропорции A4).
 *
 * Рисуется на <canvas> в браузере: чёрный фон с зелёным и синим
 * свечением, крупный заголовок с зелёным подчёркиванием, «пилюли»,
 * круговой бейдж и искры — тот же визуальный язык, что и на сайте.
 * Выдаётся только за подтверждённое достижение (проверяется в UI и RLS).
 *
 * ПОДСКАЗКА: что поменять → что изменится на дипломе
 * • diplomaHeadline()        — зелёное слово под «ДИПЛОМ» (ПОБЕДИТЕЛЯ / ПРИЗЁРА …).
 * • diplomaReason()          — строка «за 1 место — олимпиада «…»».
 * • renderDiplomaCanvas():
 *     «фон и свечения»       — цвет фона и пятна света в углах;
 *     «шапка»                — название портала и предметы сверху;
 *     «заголовок»            — размер и цвет слова «ДИПЛОМ»;
 *     «подвал»               — дата, номер, строка подписи учителя.
 * Координаты — в пикселях холста 1600×1131: x слева направо, y сверху вниз.
 */

const DIPLOMA_W = 1600; // ширина PNG в пикселях
const DIPLOMA_H = 1131; // высота: 1600 / 1131 ≈ √2, как у листа A4

/** Зелёное слово-заголовок по результату достижения. */
function diplomaHeadline(a) {
  if (a.source === 'contest' || a.category === 'olympiad' || a.category === 'project') {
    if (a.place === '1') return 'ПОБЕДИТЕЛЯ';
    if (a.place === '2' || a.place === '3') return 'ПРИЗЁРА';
    return 'УЧАСТНИКА';
  }
  return 'ЗА УСПЕХ';
}

/** «За что» — текст под ФИО. */
function diplomaReason(a) {
  const place = a.place && a.place !== 'participant' ? `${a.place} место` : 'участие';
  // «олимпиада «Муниципальная олимпиада…»» звучит коряво: тип пишем, только если его нет в названии
  const kind = (word, label) => (a.title.toLowerCase().includes(word) ? '' : label + ' ');
  if (a.category === 'olympiad') return `${place}: ${kind('олимпиад', 'олимпиада')}«${a.title}»`;
  if (a.category === 'project') return `${place}: ${kind('проект', 'конкурс проектов')}«${a.title}»`;
  if (a.category === 'volunteer') return `волонтёрство: «${a.title}»${a.hours ? `, ${a.hours} ч` : ''}`;
  return `«${a.title}»`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Пилюля как на сайте; возвращает её ширину, чтобы ставить следующую. */
function drawPill(ctx, x, y, text, { fill = null, stroke = 'rgba(255,255,255,.6)', color = '#fff', size = 22 } = {}) {
  ctx.font = `700 ${size}px Manrope`;
  const w = ctx.measureText(text).width + size * 1.8;
  const h = size * 2.1;
  roundRect(ctx, x, y, w, h, h / 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size * 0.9, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  return w;
}

function drawSparkle(ctx, x, y, r, color) {
  const k = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.bezierCurveTo(x + k, y - k, x + k, y - k, x + r, y);
  ctx.bezierCurveTo(x + k, y + k, x + k, y + k, x, y + r);
  ctx.bezierCurveTo(x - k, y + k, x - k, y + k, x - r, y);
  ctx.bezierCurveTo(x - k, y - k, x - k, y - k, x, y - r);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawRingText(ctx, cx, cy, radius, text, colorFor) {
  ctx.font = '800 26px Unbounded';
  const chars = [...text];
  const step = (Math.PI * 2) / chars.length;
  chars.forEach((ch, i) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i * step - Math.PI / 2);
    ctx.translate(0, -radius);
    ctx.fillStyle = colorFor(i);
    ctx.textAlign = 'center';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

function fitFont(ctx, text, weight, family, maxSize, maxWidth) {
  let size = maxSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > 20);
  return size;
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

async function renderDiplomaCanvas(achievement, student) {
  const sample = 'ДИПЛОМ ПОБЕДИТЕЛЯ ПРИЗЁРА УЧАСТНИКА абвгдеёжзийклмнопрстуфхцчшщъыьэюя0123456789';
  await Promise.all([
    document.fonts.load('900 120px Unbounded', sample),
    document.fonts.load('800 60px Unbounded', sample),
    document.fonts.load('700 24px Manrope', sample),
    document.fonts.load('500 24px Manrope', sample),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = DIPLOMA_W;
  canvas.height = DIPLOMA_H;
  const ctx = canvas.getContext('2d');

  // фон и свечения
  ctx.fillStyle = '#070707';
  ctx.fillRect(0, 0, DIPLOMA_W, DIPLOMA_H);
  const g1 = ctx.createRadialGradient(120, 60, 0, 120, 60, 760);
  g1.addColorStop(0, 'rgba(46,140,64,0.75)');
  g1.addColorStop(1, 'rgba(46,140,64,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, DIPLOMA_W, DIPLOMA_H);
  const g2 = ctx.createRadialGradient(1500, 1080, 0, 1500, 1080, 700);
  g2.addColorStop(0, 'rgba(61,72,255,0.55)');
  g2.addColorStop(1, 'rgba(61,72,255,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, DIPLOMA_W, DIPLOMA_H);

  const L = 90;
  // шапка с линией, как навигация сайта
  ctx.fillStyle = '#fff';
  ctx.font = '800 26px Unbounded';
  ctx.fillText('ПОРТАЛ ДОСТИЖЕНИЙ ЛИЦЕЯ', L, 112); // название в шапке диплома
  ctx.font = '700 20px Manrope';
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.textAlign = 'right';
  ctx.fillText('ФИЗИКА   ·   МАТЕМАТИКА   ·   ИНФОРМАТИКА', DIPLOMA_W - L, 110);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(L, 140, DIPLOMA_W - L * 2, 2);

  // заголовок: «ДИПЛОМ» + зелёное подчёркнутое слово
  ctx.fillStyle = '#fff';
  ctx.font = '900 168px Unbounded'; // 168px — размер слова «ДИПЛОМ»
  ctx.fillText('ДИПЛОМ', L - 6, 330);
  const accent = diplomaHeadline(achievement);
  const accentSize = fitFont(ctx, accent, 900, 'Unbounded', 104, 900);
  ctx.font = `900 ${accentSize}px Unbounded`;
  ctx.fillStyle = '#4be36b';
  ctx.fillText(accent, L - 4, 460);
  const accentW = ctx.measureText(accent).width;
  roundRect(ctx, L - 2, 482, accentW, 12, 6);
  ctx.fill();

  // кому и за что
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.font = '500 28px Manrope';
  ctx.fillText('награждается', L, 590);
  const name = student.fullName || `${student.lastName} ${student.firstName}`;
  const nameSize = fitFont(ctx, name.toUpperCase(), 800, 'Unbounded', 66, 1000);
  ctx.font = `800 ${nameSize}px Unbounded`;
  ctx.fillStyle = '#fff';
  ctx.fillText(name.toUpperCase(), L, 590 + nameSize + 18);

  ctx.font = '500 32px Manrope';
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  const reasonLines = wrapLines(ctx, `за ${diplomaReason(achievement)}`, 960).slice(0, 3);
  let y = 590 + nameSize + 82;
  reasonLines.forEach((line) => { ctx.fillText(line, L, y); y += 44; });

  // пилюли: класс, предмет, баллы
  let px = L;
  const py = y + 18;
  if (student.className) px += drawPill(ctx, px, py, `${student.className} класс`.toUpperCase()) + 14;
  if (achievement.subject) px += drawPill(ctx, px, py, SUBJECT_LABELS[achievement.subject].toUpperCase()) + 14;
  if (achievement.period) px += drawPill(ctx, px, py, achievement.period.toUpperCase(), { size: 20 }) + 14;
  drawPill(ctx, px, py, `+${pointsWord(achievement.points).toUpperCase()}`, { fill: '#4be36b', stroke: null, color: '#000' });

  // круговой бейдж с искрой в центре
  const cx = 1290, cy = 470;
  ctx.beginPath();
  ctx.arc(cx, cy, 190, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
  drawRingText(ctx, cx, cy, 150, 'ПОРТАЛ ДОСТИЖЕНИЙ • ЛИЦЕЙ • ', (i) => (i >= 18 && i < 25 ? '#8b93ff' : '#fff'));
  drawSparkle(ctx, cx, cy, 70, '#3d48ff');
  drawSparkle(ctx, 1470, 200, 34, '#3d48ff');
  drawSparkle(ctx, 1420, 250, 16, '#3d48ff');
  drawSparkle(ctx, 1100, 760, 22, '#4be36b');

  // подвал: дата, номер, подпись
  const footY = DIPLOMA_H - 96;
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(L, footY - 46, DIPLOMA_W - L * 2, 2);
  ctx.font = '700 22px Manrope';
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillText(`ДАТА: ${formatDate(achievement.date)}`, L, footY);
  ctx.fillText(`№ ${String(achievement.id).padStart(5, '0')}`, L + 300, footY);
  ctx.textAlign = 'right';
  ctx.fillText('УЧИТЕЛЬ  ______________________', DIPLOMA_W - L, footY); // место для подписи
  ctx.textAlign = 'left';

  return canvas;
}

async function downloadDiploma(achievement, student) {
  if (achievement.status !== 'approved') {
    showToast('Диплом доступен только за подтверждённое достижение', true);
    return;
  }
  const canvas = await renderDiplomaCanvas(achievement, student);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const safe = (student.fullName || 'ученик').replace(/\s+/g, '_');
  downloadBlob(`Диплом_${safe}_${achievement.id}.png`, blob);
}
