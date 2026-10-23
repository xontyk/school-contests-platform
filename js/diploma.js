/**
 * diploma.js — работа с дипломами.
 *
 * Базовый сценарий по ТЗ: скачивание готового шаблона (файл/изображение).
 * Опциональный бонус: генерация персонального диплома с именем ученика —
 * рисуется на <canvas> и экспортируется в PNG через canvas.toDataURL,
 * без сторонних библиотек и без обращения к серверу.
 */

const DIPLOMA_THEMES = {
  t1: { bg: '#fdf6e3', border: '#c9a227', accent: '#8a6d1a', title: 'ДИПЛОМ' },
  t2: { bg: '#eef3ff', border: '#2d5fd1', accent: '#1b3a82', title: 'ДИПЛОМ' },
};

/** Скачивает статический файл-шаблон диплома (без персонализации). */
function downloadDiplomaTemplateFile(templateFile, templateName) {
  const a = document.createElement('a');
  a.href = templateFile;
  a.download = templateName.replace(/\s+/g, '_') + '.svg';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Рисует и скачивает персональный диплом в формате PNG. */
function generateAndDownloadPersonalDiploma({ templateId, studentName, contestName, place, date }) {
  const theme = DIPLOMA_THEMES[templateId] || DIPLOMA_THEMES.t1;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 850;
  const ctx = canvas.getContext('2d');

  // фон и рамка
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 14;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
  ctx.lineWidth = 2;
  ctx.strokeRect(55, 55, canvas.width - 110, canvas.height - 110);

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.accent;
  ctx.font = 'bold 72px Georgia, serif';
  ctx.fillText(theme.title, canvas.width / 2, 200);

  ctx.font = '28px Georgia, serif';
  ctx.fillStyle = '#333';
  ctx.fillText(place ? `${place} место` : 'награждается', canvas.width / 2, 260);

  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(studentName, canvas.width / 2, 400);

  ctx.font = '30px Georgia, serif';
  ctx.fillStyle = '#333';
  wrapText(ctx, `за участие в конкурсе «${contestName}»`, canvas.width / 2, 480, 1000, 40);

  ctx.font = '24px Georgia, serif';
  ctx.fillStyle = '#555';
  ctx.fillText(`Дата выдачи: ${formatDate(date)}`, canvas.width / 2, 700);
  ctx.fillText('Платформа школьных конкурсов', canvas.width / 2, 740);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Диплом_${studentName.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  words.forEach((word) => {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word + ' ';
      yy += lineHeight;
    } else {
      line = test;
    }
  });
  ctx.fillText(line, x, yy);
}
