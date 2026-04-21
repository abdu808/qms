/**
 * مشتركات استيراد البيانات من Excel
 */
import ExcelJS  from 'exceljs';
import { BadRequest } from '../../utils/errors.js';

// ═══════════════════════════════════════════════════════════════════════════════
// بناء نموذج Excel
// ═══════════════════════════════════════════════════════════════════════════════
export async function buildTemplate(entityKey, ENTITIES) {
  const def = ENTITIES[entityKey];
  if (!def) throw BadRequest(`نوع البيانات غير مدعوم: ${entityKey}`);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'QMS - جمعية البر بصبيا';
  wb.created = new Date();

  const ws = wb.addWorksheet(def.sheetName, {
    views: [{ rightToLeft: true }],
  });

  // ── الصف 1: رؤوس الأعمدة (أزرق) ──
  const headerRow = ws.addRow(def.columns.map(c => c.label + (c.required ? ' *' : '')));
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } } };
  });
  headerRow.height = 30;

  // ── الصف 2: ملاحظات (أصفر) ──
  const notesRow = ws.addRow(def.columns.map(c => c.note || ''));
  notesRow.eachCell(cell => {
    cell.font      = { italic: true, size: 8, color: { argb: 'FF92400E' }, name: 'Arial' };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    cell.alignment = { horizontal: 'right', wrapText: true, readingOrder: 'rtl' };
  });
  notesRow.height = 20;

  // ── الصف 3: مثال توضيحي (أخضر) ──
  const exampleRow = ws.addRow(def.columns.map(c => c.example ?? ''));
  exampleRow.eachCell(cell => {
    cell.font      = { color: { argb: 'FF065F46' }, size: 10, name: 'Arial' };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
    cell.alignment = { horizontal: 'right', readingOrder: 'rtl' };
  });

  // ── عرض الأعمدة ──
  def.columns.forEach((col, i) => {
    const c = ws.getColumn(i + 1);
    c.width = col.width || 20;
    c.alignment = { readingOrder: 'rtl' };
  });

  // ── تجميد الصفوف الثلاثة الأولى ──
  ws.views = [{ state: 'frozen', ySplit: 3, rightToLeft: true }];

  // ── ورقة التعليمات ──
  const wsInfo = wb.addWorksheet('تعليمات', { views: [{ rightToLeft: true }] });
  const infoLines = [
    ['تعليمات استيراد البيانات — QMS جمعية البر بصبيا'],
    [''],
    ['■ الصف الأزرق:   رؤوس الأعمدة — لا تعدّل'],
    ['■ الصف الأصفر:   ملاحظات وقيم مسموحة — لا تعدّل'],
    ['■ الصف الأخضر:  مثال توضيحي — يمكن حذفه أو تعديله'],
    [''],
    ['■ الحقول المحددة بـ * إلزامية'],
    ['■ ابدأ إدخال بياناتك من الصف الرابع'],
    ['■ احفظ الملف بصيغة .xlsx قبل الرفع'],
    [''],
    [`■ الكيان: ${def.label}`],
    [`■ عدد الأعمدة: ${def.columns.length}`],
  ];
  infoLines.forEach((line, i) => {
    const r = wsInfo.addRow(line);
    if (i === 0) r.font = { bold: true, size: 14, color: { argb: 'FF1E40AF' } };
    else         r.font = { size: 11 };
  });
  wsInfo.getColumn(1).width = 65;

  return wb;
}

// ═══════════════════════════════════════════════════════════════════════════════
// تحليل ملف Excel المرفوع
// ═══════════════════════════════════════════════════════════════════════════════
export async function parseFile(entityKey, buffer, ENTITIES) {
  const def = ENTITIES[entityKey];
  const wb  = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) throw BadRequest('الملف لا يحتوي على بيانات');

  const records = [];
  const errors  = [];

  ws.eachRow((row, rowNum) => {
    if (rowNum <= 3) return; // تخطّ رؤوس + ملاحظات + مثال

    // استخرج القيم وتجاهل index 0 (ExcelJS يبدأ من 1)
    const vals = [];
    for (let i = 1; i <= def.columns.length; i++) {
      const cell = row.getCell(i);
      vals.push(cell.value != null ? String(cell.value).trim() : '');
    }

    if (vals.every(v => v === '')) return; // صف فارغ — تخطّ

    const obj = {};
    def.columns.forEach((col, i) => { obj[col.key] = vals[i] || ''; });

    const missing = def.columns.filter(c => c.required && !obj[c.key]).map(c => c.label);
    if (missing.length) {
      errors.push({ row: rowNum, message: `حقول إلزامية مفقودة: ${missing.join(', ')}` });
      return;
    }

    records.push({ row: rowNum, data: obj });
  });

  return { records, errors };
}
