/**
 * rating-export.js — выгрузка рейтинга в Excel (.xlsx) с оформлением.
 *
 * Библиотека ExcelJS (assets/vendor/exceljs.min.js, ~1 МБ) грузится только
 * при первом нажатии «Скачать Excel», чтобы не замедлять открытие кабинета.
 *
 * ПОДСКАЗКА: что поменять → что изменится в файле
 * • RATING_COLUMNS — колонки, их ширина и цвет заливки.
 * • MEDALS         — цвет ячейки «Место» у первых трёх.
 * • HEADER_FILL    — цвет шапки таблицы.
 * • строки «Всего» и «Среднее» внизу считаются формулами Excel (SUM, AVERAGE).
 */

const RATING_COLUMNS = [
  { key: 'rank', title: 'Место', width: 8, align: 'center' },
  { key: 'name', title: 'Ученик', width: 34 },
  { key: 'className', title: 'Класс', width: 9, align: 'center' },
  { key: 'physics', title: 'Физика', width: 11, fill: 'FFE6E8FF', number: true },
  { key: 'math', title: 'Математика', width: 13, fill: 'FFE3F7E7', number: true },
  { key: 'cs', title: 'Информатика', width: 14, fill: 'FFF3E6FF', number: true },
  { key: 'other', title: 'Общее', width: 10, fill: 'FFF1F1F3', number: true },
  { key: 'total', title: 'Итого', width: 10, fill: 'FFFFF1CC', number: true, bold: true },
  { key: 'achievementsCount', title: 'Достижений', width: 13, number: true },
];
const MEDALS = { 1: 'FFFFD966', 2: 'FFE2E4E9', 3: 'FFF4C7A1' };
const HEADER_FILL = 'FF16161A';

function loadExcelJs() {
  if (window.ExcelJS) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'assets/vendor/exceljs.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Не удалось загрузить модуль Excel. Проверьте интернет.'));
    document.head.appendChild(s);
  });
}

/**
 * rows    — строки api.rating.compute()
 * filters — подписи выбранных фильтров: { className, subject, period }
 */
async function exportRatingXlsx(rows, filters) {
  await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Портал достижений лицея';
  const ws = wb.addWorksheet('Рейтинг', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const lastCol = String.fromCharCode(64 + RATING_COLUMNS.length); // 'I'
  const thin = { style: 'thin', color: { argb: 'FFD4D4D8' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  ws.columns = RATING_COLUMNS.map((c) => ({ key: c.key, width: c.width }));

  // заголовок и фильтры
  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell('A1').value = 'Рейтинг лицея';
  ws.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF16161A' } };
  ws.getRow(1).height = 30;
  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell('A2').value = `Класс: ${filters.className} · Направление: ${filters.subject} · Период: ${filters.period} · Выгружено ${formatDate(todayISO())}`;
  ws.getCell('A2').font = { size: 11, italic: true, color: { argb: 'FF6B6B73' } };

  // шапка таблицы (строка 4)
  const head = ws.getRow(4);
  RATING_COLUMNS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.title;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: i === 1 ? 'left' : 'center', vertical: 'middle' };
    cell.border = border;
  });
  head.height = 24;

  // строки учеников
  rows.forEach((r, idx) => {
    const row = ws.getRow(5 + idx);
    RATING_COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = c.key === 'className' ? (r.className || '') : r[c.key];
      cell.border = border;
      cell.alignment = { horizontal: c.number ? 'right' : (c.align || 'left'), vertical: 'middle' };
      if (c.number) cell.numFmt = '0';
      if (c.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.fill } };
      if (c.bold) cell.font = { bold: true };
    });
    const medal = MEDALS[r.rank];
    if (medal) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: medal } };
      row.getCell(1).font = { bold: true };
    }
    row.height = 20;
  });

  // итоги формулами: меняешь число в таблице — «Всего» и «Среднее» пересчитаются сами
  if (rows.length) {
    const first = 5;
    const last = 4 + rows.length;
    [['Всего', 'SUM', '0'], ['Среднее', 'AVERAGE', '0.0']].forEach(([label, fn, fmt], k) => {
      const row = ws.getRow(last + 1 + k);
      row.getCell(2).value = label;
      RATING_COLUMNS.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
        cell.border = { ...border, top: k === 0 ? { style: 'medium', color: { argb: 'FF16161A' } } : thin };
        if (c.number) {
          const col = String.fromCharCode(65 + i);
          cell.value = { formula: `${fn}(${col}${first}:${col}${last})` };
          cell.numFmt = fmt;
          cell.alignment = { horizontal: 'right' };
        }
      });
    });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: RATING_COLUMNS.length } };
  } else {
    ws.mergeCells(`A5:${lastCol}5`);
    ws.getCell('A5').value = 'Нет данных для выбранных фильтров';
    ws.getCell('A5').alignment = { horizontal: 'center' };
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(`Рейтинг_лицея_${todayISO()}.xlsx`,
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
