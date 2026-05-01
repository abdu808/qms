/**
 * بناء وثيقة الخطة الاستراتيجية الكاملة (DOCX)
 * للاعتماد بتاريخ بداية 2026
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, Header, Footer, PageNumber,
} = require('docx');

const FONT = 'Arial';
const ROOT = path.join(__dirname, '..', 'ISO9001', 'الخطط والمشرات');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'qms-export.json'), 'utf-8'));

// ─── Helpers ──────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 6, color: '2E75B6' };
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

const p = (text, opts = {}) => new Paragraph({
  bidirectional: true,
  alignment: opts.alignment || AlignmentType.RIGHT,
  spacing: { before: 80, after: 80 },
  children: typeof text === 'string'
    ? [new TextRun({ text, font: FONT, size: opts.size || 22, bold: opts.bold, color: opts.color, italics: opts.italics, rightToLeft: true })]
    : text,
});

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  bidirectional: true,
  alignment: AlignmentType.RIGHT,
  spacing: { before: 360, after: 240 },
  children: [new TextRun({ text, font: FONT, size: 32, bold: true, color: '1F4E79', rightToLeft: true })],
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  bidirectional: true,
  alignment: AlignmentType.RIGHT,
  spacing: { before: 240, after: 160 },
  children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: '2E75B6', rightToLeft: true })],
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  bidirectional: true,
  alignment: AlignmentType.RIGHT,
  spacing: { before: 160, after: 100 },
  children: [new TextRun({ text, font: FONT, size: 22, bold: true, color: '2E75B6', rightToLeft: true })],
});

const cell = (text, opts = {}) => new TableCell({
  borders: cellBorders,
  width: { size: opts.width || 2000, type: WidthType.DXA },
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  margins: { top: 80, bottom: 80, left: 100, right: 100 },
  children: [new Paragraph({
    bidirectional: true,
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.RIGHT,
    children: [new TextRun({ text: String(text || ''), font: FONT, size: opts.size || 18, bold: opts.bold, color: opts.color, rightToLeft: true })],
  })],
});

const buildTable = (rows, columnWidths) => new Table({
  width: { size: columnWidths.reduce((a,b)=>a+b,0), type: WidthType.DXA },
  columnWidths,
  rows: rows.map((row, idx) => new TableRow({
    children: row.map((c, i) => cell(c.text, {
      ...c,
      width: columnWidths[i],
      fill: idx === 0 ? '1F4E79' : c.fill,
      bold: idx === 0 || c.bold,
      color: idx === 0 ? 'FFFFFF' : c.color,
    })),
  })),
});

const bullet = (text) => new Paragraph({
  bidirectional: true, alignment: AlignmentType.RIGHT,
  numbering: { reference: 'bullets', level: 0 },
  spacing: { before: 60, after: 60 },
  children: [new TextRun({ text, font: FONT, size: 22, rightToLeft: true })],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ─── Content ──────────────────────────────────────────
const content = [];

// ─── صفحة الغلاف ─────────────────────────────────────
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 },
  children: [new TextRun({ text: 'جمعية البر الخيرية بصبيا', font: FONT, size: 48, bold: true, color: '1F4E79', rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 },
  children: [new TextRun({ text: 'الخطة الاستراتيجية', font: FONT, size: 44, bold: true, color: '2E75B6', rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 100, after: 240 },
  children: [new TextRun({ text: '2026 — 2030', font: FONT, size: 56, bold: true, color: '1F4E79', rightToLeft: false })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 720, after: 240 },
  children: [new TextRun({ text: '⏎  ⏎  وثيقة معتمدة من مجلس الإدارة', font: FONT, size: 28, bold: true, rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 },
  children: [new TextRun({ text: 'مرجع التطبيق: نظام إدارة الجودة (QMS)', font: FONT, size: 22, color: '595959', rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 80 },
  children: [new TextRun({ text: 'تاريخ الإصدار: ____________ (للتعبئة)', font: FONT, size: 20, color: '595959', rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 80 },
  children: [new TextRun({ text: 'تاريخ الاعتماد: ____________ (للتعبئة)', font: FONT, size: 20, color: '595959', rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 80 },
  children: [new TextRun({ text: `${data.plan.code} · الإصدار 1.0`, font: FONT, size: 20, color: '595959', rightToLeft: true })],
}));

content.push(pageBreak());

// ─── 1. الديباجة والاعتماد ─────────────────────────────
content.push(h1('1. الديباجة والاعتماد'));

content.push(p('بسم الله الرحمن الرحيم،'));
content.push(p(''));
content.push(p('انطلاقاً من رسالة جمعية البر الخيرية بصبيا في خدمة المجتمع وتلبية احتياجات الأسر الأشد احتياجاً، وتحقيقاً للأهداف المؤسسية المتوافقة مع رؤية المملكة 2030، يُقدَّم هذا الوثيقة كإطار استراتيجي رسمي للسنوات الخمس القادمة.'));

content.push(p('تُعتمد هذه الخطة من مجلس الإدارة كمرجع تنفيذي ملزم لجميع منسوبي الجمعية، وتُربط مباشرةً بنظام إدارة الجودة (QMS) المؤسسي المنشور على بنية إنتاج فعلية، حيث تُتابع جميع المؤشرات والمستهدفات والمبادرات إلكترونياً.'));

content.push(h2('1.1 توقيعات الاعتماد'));

content.push(buildTable([
  [{ text: 'الجهة', center: true }, { text: 'الاسم', center: true }, { text: 'التاريخ', center: true }, { text: 'التوقيع والختم', center: true }],
  [{ text: 'رئيس مجلس الإدارة', center: true, bold: true }, { text: '__________________' }, { text: '____________', center: true }, { text: '', center: true }],
  [{ text: 'المدير التنفيذي', center: true, bold: true }, { text: 'عبدالرحمن عقيل' }, { text: '____________', center: true }, { text: '', center: true }],
  [{ text: 'مدير الجودة', center: true, bold: true }, { text: 'ايلاف حسن' }, { text: '____________', center: true }, { text: '', center: true }],
], [2400, 3000, 1800, 2160]));

content.push(pageBreak());

// ─── 2. النطاق والإطار العام ───────────────────────────
content.push(h1('2. النطاق والإطار العام'));

content.push(h2('2.1 معلومات الخطة'));
content.push(buildTable([
  [{ text: 'البند', center: true }, { text: 'القيمة', center: true }],
  [{ text: 'كود الخطة', bold: true }, { text: data.plan.code, center: true }],
  [{ text: 'العنوان', bold: true }, { text: data.plan.title }],
  [{ text: 'الفترة', bold: true }, { text: `${data.plan.startYear} — ${data.plan.endYear}`, center: true, bold: true }],
  [{ text: 'الحالة', bold: true }, { text: data.plan.status, center: true, color: '006100' }],
  [{ text: 'مرجع المتابعة', bold: true }, { text: 'نظام إدارة الجودة (QMS) — quality.aqiltech.sa' }],
], [3000, 6360]));

content.push(h2('2.2 الإطار الإحصائي للخطة'));
content.push(buildTable([
  [{ text: 'البند', center: true }, { text: 'العدد', center: true }],
  [{ text: 'المحاور الاستراتيجية' }, { text: data.axes.length, center: true, bold: true }],
  [{ text: 'الأهداف الاستراتيجية' }, { text: data.goals.length, center: true, bold: true }],
  [{ text: 'الأهداف التشغيلية' }, { text: data.objectives.length, center: true, bold: true }],
  [{ text: 'مؤشرات الأداء (KPIs)' }, { text: data.indicators.length, center: true, bold: true }],
  [{ text: 'المستهدفات السنوية (5 سنوات)' }, { text: data.annualTargets.length, center: true, bold: true }],
  [{ text: 'المبادرات الفعّالة' }, { text: data.initiatives.length, center: true, bold: true }],
], [4680, 4680]));

content.push(pageBreak());

// ─── 3. المحاور الاستراتيجية ───────────────────────────
content.push(h1('3. المحاور الاستراتيجية الأربعة'));
content.push(p('تتكوّن الخطة من أربعة محاور استراتيجية مُحدَّدة، مُعتمَدة من مجلس الإدارة، تُغطّي جميع جوانب عمل الجمعية:'));

const axisRows = [[
  { text: 'الكود', center: true },
  { text: 'اسم المحور', center: true },
  { text: 'الترتيب', center: true },
  { text: 'الوزن', center: true },
  { text: 'عدد الأهداف', center: true },
]];
const goalsByAxis = {};
data.goals.forEach(g => { goalsByAxis[g.axisCode] = (goalsByAxis[g.axisCode] || 0) + 1; });
data.axes.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(a => {
  axisRows.push([
    { text: a.code, center: true, bold: true },
    { text: a.nameAr },
    { text: a.order || '', center: true },
    { text: `${a.weight || 0}%`, center: true },
    { text: goalsByAxis[a.code] || 0, center: true, bold: true },
  ]);
});
content.push(buildTable(axisRows, [1400, 4000, 1200, 1280, 1480]));

content.push(pageBreak());

// ─── 4. الأهداف الاستراتيجية الثمانية ──────────────────
content.push(h1('4. الأهداف الاستراتيجية الثمانية'));
content.push(p('تحقيقاً لمحاور الجمعية الأربعة، اعتُمدت ثمانية أهداف استراتيجية موزّعة كالتالي:'));

// تجميع حسب المحور
const goalsByAxisGrouped = {};
data.goals.forEach(g => {
  if (!goalsByAxisGrouped[g.axisCode]) goalsByAxisGrouped[g.axisCode] = [];
  goalsByAxisGrouped[g.axisCode].push(g);
});

data.axes.sort((a,b)=> (a.order||0) - (b.order||0)).forEach(axis => {
  const axisGoals = goalsByAxisGrouped[axis.code] || [];
  if (!axisGoals.length) return;
  content.push(h2(`${axis.code} — ${axis.nameAr}`));
  axisGoals.forEach(g => {
    content.push(h3(`${g.code} — ${g.title}`));
    content.push(buildTable([
      [{ text: 'البند', center: true }, { text: 'القيمة', center: true }],
      [{ text: 'المالك', bold: true }, { text: g.ownerName || '—' }],
      [{ text: 'التقدم الحالي', bold: true }, { text: `${g.progress}%`, center: true }],
      [{ text: 'الحالة', bold: true }, { text: g.status, center: true, color: '006100' }],
      [{ text: 'الملاحظات', bold: true }, { text: g.notes || '—' }],
    ], [2400, 6960]));
    content.push(p(''));
  });
});

content.push(pageBreak());

// ─── 5. المؤشرات الـ 16 ───────────────────────────────
content.push(h1('5. كتالوج المؤشرات (KPIs) الـ 16'));
content.push(p('جميع المؤشرات مُسجَّلة في النظام بترميز IND-2026-XXX، مع تعريف إجرائي وصيغة احتساب وتردد قياس وعتبات RAG.'));

const indRows = [[
  { text: '#', center: true },
  { text: 'الكود', center: true },
  { text: 'اسم المؤشر', center: true },
  { text: 'الوحدة', center: true },
  { text: 'التردد', center: true },
  { text: 'الاتجاه', center: true },
]];
data.indicators.sort((a,b)=>a.code.localeCompare(b.code)).forEach((ind, i) => {
  indRows.push([
    { text: i+1, center: true },
    { text: ind.code, center: true, bold: true },
    { text: ind.nameAr },
    { text: ind.unit || '—', center: true },
    { text: ind.frequency || '—', center: true },
    { text: ind.direction || '—', center: true },
  ]);
});
content.push(buildTable(indRows, [800, 1600, 3360, 1000, 1300, 1300]));

content.push(pageBreak());

// ─── 6. الأهداف التشغيلية ─────────────────────────────
content.push(h1('6. الأهداف التشغيلية الـ 19'));
content.push(p('تربط الأهداف التشغيلية بين الأهداف الاستراتيجية والمؤشرات، وتحدد المستهدفات الكمية القابلة للقياس.'));

const objRows = [[
  { text: '#', center: true },
  { text: 'الكود', center: true },
  { text: 'الهدف التشغيلي', center: true },
  { text: 'الأب', center: true },
  { text: 'KPI', center: true },
  { text: 'المستهدف', center: true },
  { text: 'الوحدة', center: true },
]];
data.objectives.sort((a,b)=>a.code.localeCompare(b.code)).forEach((o, i) => {
  objRows.push([
    { text: i+1, center: true },
    { text: o.code, center: true, bold: true, size: 16 },
    { text: o.title, size: 16 },
    { text: o.goalCode, center: true, size: 16 },
    { text: o.kpi || '—', size: 16 },
    { text: o.target || '—', center: true, bold: true, size: 16 },
    { text: o.unit || '—', center: true, size: 16 },
  ]);
});
content.push(buildTable(objRows, [600, 1300, 2700, 1200, 2000, 900, 660]));

content.push(pageBreak());

// ─── 7. المبادرات ─────────────────────────────────────
content.push(h1('7. المبادرات الفعّالة الـ 21'));
content.push(p('تُمثّل المبادرات الإجراءات التنفيذية المباشرة لتحقيق الأهداف الاستراتيجية. اعتُمدت 21 مبادرة بعد تطبيق الفلتر الخماسي (مالك واضح + مخرج قابل للقياس + يخدم هدفاً + موارد متاحة + لا تكرار).'));

const iniRows = [[
  { text: '#', center: true },
  { text: 'الكود', center: true },
  { text: 'المبادرة', center: true },
  { text: 'الهدف', center: true },
  { text: 'الحالة', center: true },
  { text: 'المالك', center: true },
]];
data.initiatives.sort((a,b)=> (a.goalCode||'').localeCompare(b.goalCode||'')).forEach((i, idx) => {
  const colorMap = { 'IN_PROGRESS': '006100', 'NOT_STARTED': '595959', 'COMPLETED': '1F4E79' };
  iniRows.push([
    { text: idx+1, center: true },
    { text: i.code, center: true, bold: true, size: 16 },
    { text: i.name, size: 16 },
    { text: i.goalCode || '—', center: true, size: 16 },
    { text: i.status || '—', center: true, color: colorMap[i.status] || '000000', size: 16 },
    { text: i.ownerName || '—', center: true, size: 16 },
  ]);
});
content.push(buildTable(iniRows, [600, 1500, 3460, 1200, 1300, 1300]));

content.push(pageBreak());

// ─── 8. المستهدفات السنوية (مُلخَّص) ───────────────────
content.push(h1('8. المستهدفات السنوية 2026-2030'));
content.push(p('تحوي الخطة 80 مستهدفاً سنوياً (16 مؤشر × 5 سنوات) محفوظة في النظام كمرجع رسمي. الجدول الكامل في ملف Excel المرفق "AnnualTargets_2026_2030.xlsx".'));

content.push(h2('8.1 ملخّص المستهدفات الرئيسية لكل مؤشر'));

// لكل مؤشر، عرض هدف 2030 فقط
const targetsByInd = {};
data.annualTargets.forEach(t => {
  if (!targetsByInd[t.indicatorCode]) targetsByInd[t.indicatorCode] = {};
  targetsByInd[t.indicatorCode][t.year] = t.targetValue;
});

const yearTargetRows = [[
  { text: 'الكود', center: true },
  { text: 'المؤشر', center: true },
  { text: '2026', center: true },
  { text: '2027', center: true },
  { text: '2028', center: true },
  { text: '2029', center: true },
  { text: '2030', center: true },
]];
data.indicators.sort((a,b)=>a.code.localeCompare(b.code)).forEach(ind => {
  const t = targetsByInd[ind.code] || {};
  yearTargetRows.push([
    { text: ind.code, center: true, bold: true, size: 16 },
    { text: ind.nameAr, size: 16 },
    { text: t[2026] || '—', center: true, size: 16 },
    { text: t[2027] || '—', center: true, size: 16 },
    { text: t[2028] || '—', center: true, size: 16 },
    { text: t[2029] || '—', center: true, size: 16 },
    { text: t[2030] || '—', center: true, bold: true, size: 16 },
  ]);
});
content.push(buildTable(yearTargetRows, [1400, 3000, 1000, 1000, 1000, 1000, 960]));

content.push(pageBreak());

// ─── 9. الحوكمة والمتابعة ─────────────────────────────
content.push(h1('9. منظومة الحوكمة والمتابعة'));

content.push(h2('9.1 المراجعة الربعية المُلزمة'));
content.push(p('60 دقيقة، 4 مرات سنوياً، يحضرها المدير التنفيذي + مالكو الأهداف الثمانية + مدير الجودة. المحضر يُرفع في النظام كوثيقة رسمية.'));

content.push(h2('9.2 لوحة المتابعة المؤسسية'));
content.push(p('يستثمر النظام (QMS) في توفير لوحة موحَّدة تعرض:'));
content.push(bullet('حالة كل هدف (أخضر/أصفر/أحمر) ونسبة التقدم'));
content.push(bullet('المؤشرات المتأخرة عن مستهدفها الربعي'));
content.push(bullet('المبادرات المتعثّرة + سبب التعثّر'));
content.push(bullet('سجل المخاطر مع حالات التحديث'));

content.push(h2('9.3 فلتر قبول المبادرات الجديدة'));
content.push(p('فلتر خماسي ملزم — لا تُضاف مبادرة جديدة دون اجتياز جميع الأسئلة:'));
content.push(bullet('1. هل لها مالك واضح ومحدد بالاسم؟'));
content.push(bullet('2. هل لها مخرج قابل للقياس؟'));
content.push(bullet('3. هل تخدم هدفاً استراتيجياً مباشراً؟'));
content.push(bullet('4. هل تُنفَّذ بموارد الجمعية الحالية؟'));
content.push(bullet('5. هل لا تكرر مبادرة قائمة؟'));

content.push(pageBreak());

// ─── 10. الملاحق ─────────────────────────────────────
content.push(h1('10. الملاحق المرفقة'));
content.push(p('تُرفَق مع هذه الوثيقة الملفات التفصيلية التالية في مجلد ISO9001/الخطط والمشرات/:'));

content.push(buildTable([
  [{ text: '#', center: true }, { text: 'الملف', center: true }, { text: 'المحتوى', center: true }],
  [{ text: '1', center: true, bold: true }, { text: 'الخطة_الاستراتيجية_2026_2030_المعتمدة.xlsx' }, { text: 'الأهداف الثمانية + المحاور الأربعة + المالكين' }],
  [{ text: '2', center: true, bold: true }, { text: 'الخطة_التشغيلية_2026_بـ4_محاور.xlsx' }, { text: 'الـ 19 هدفاً تشغيلياً + KPI ومستهدف لكل واحد' }],
  [{ text: '3', center: true, bold: true }, { text: 'KPI_Catalog_v11_2026_2030.xlsx' }, { text: '16 مؤشر بترميز IND-2026-XXX' }],
  [{ text: '4', center: true, bold: true }, { text: 'AnnualTargets_2026_2030.xlsx' }, { text: '80 سجل (16 × 5 سنوات)' }],
  [{ text: '5', center: true, bold: true }, { text: 'المبادرات_الـ21_2026_2030.xlsx' }, { text: '21 مبادرة فعّالة بمالكين وحالات' }],
], [600, 4000, 4760]));

content.push(p(''));
content.push(p('ملاحظة: الملفات القديمة (خطة 2025-2027 و KPI_Playbook_v10) منقولة إلى مجلد _archive/ كمرجع تاريخي.', { italics: true, color: '595959' }));

content.push(pageBreak());

// ─── 11. الخاتمة ─────────────────────────────────────
content.push(h1('11. الخاتمة والاعتماد'));

content.push(p('تُمثّل هذه الخطة الاستراتيجية إطاراً تنفيذياً ملزماً لجميع منسوبي جمعية البر الخيرية بصبيا للسنوات الخمس القادمة (2026-2030).'));

content.push(p('تُلزم الخطة الإدارة التنفيذية ومالكي الأهداف الثمانية بـ:'));
content.push(bullet('متابعة دورية للمؤشرات الـ 16 وفق التردد المُحدَّد'));
content.push(bullet('تنفيذ المراجعات الربعية المُلزمة وإصدار محاضرها رسمياً'));
content.push(bullet('استثمار نظام إدارة الجودة (QMS) كأداة وحيدة للتتبع والإبلاغ'));
content.push(bullet('الالتزام بفلتر القبول الخماسي عند إضافة أي مبادرة جديدة'));
content.push(bullet('رفع تقرير سنوي لمجلس الإدارة عن تحقُّق المستهدفات'));

content.push(p('والله ولي التوفيق', { alignment: AlignmentType.CENTER, bold: true, size: 28, color: '1F4E79' }));

content.push(p(''));
content.push(p(''));
content.push(p('عبدالرحمن عقيل', { alignment: AlignmentType.CENTER, bold: true, size: 24 }));
content.push(p('المدير التنفيذي', { alignment: AlignmentType.CENTER, size: 22 }));
content.push(p('جمعية البر الخيرية بصبيا', { alignment: AlignmentType.CENTER, size: 22, color: '595959' }));

// ─── بناء الوثيقة ────────────────────────────────────
const doc = new Document({
  creator: 'جمعية البر الخيرية بصبيا',
  title: 'الخطة الاستراتيجية 2026-2030',
  description: 'وثيقة الخطة الاستراتيجية الرسمية',
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: '1F4E79' },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0, alignment: AlignmentType.RIGHT, bidirectional: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: '2E75B6' },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1, alignment: AlignmentType.RIGHT, bidirectional: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: FONT, color: '2E75B6' },
        paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2, alignment: AlignmentType.RIGHT, bidirectional: true } },
    ],
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.RIGHT,
        style: { paragraph: { indent: { right: 720, hanging: 360 }, bidirectional: true } },
      }],
    }],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: {
      default: new Header({
        children: [new Paragraph({
          bidirectional: true, alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'الخطة الاستراتيجية 2026-2030 — جمعية البر الخيرية بصبيا', font: FONT, size: 16, color: '595959', rightToLeft: true })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'صفحة ', font: FONT, size: 16, color: '595959' }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '595959' })],
        })],
      }),
    },
    children: content,
  }],
});

// ─── حفظ ────────────────────────────────────────────
const out = path.join(ROOT, 'الخطة_الاستراتيجية_2026_2030_للاعتماد.docx');
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(out, buf);
  console.log(`✅ ${out}`);
  console.log(`   ${(buf.length / 1024).toFixed(1)} KB`);
});
