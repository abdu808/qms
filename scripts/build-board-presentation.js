/**
 * بناء وثيقة عرض الخطة الاستراتيجية للمجلس
 * جمعية البر الخيرية بصبيا - 2026-04-30
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, Header, Footer, PageNumber,
} = require('docx');

// ─── أنماط مشتركة ─────────────────────────────────────────────
const FONT = 'Arial';
const RTL = { bidirectional: true };

const border = { style: BorderStyle.SINGLE, size: 6, color: '2E75B6' };
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

// helpers
const p = (text, opts = {}) => new Paragraph({
  bidirectional: true,
  alignment: AlignmentType.RIGHT,
  spacing: { before: 80, after: 80 },
  ...opts,
  children: typeof text === 'string'
    ? [new TextRun({ text, font: FONT, size: opts.size || 22, bold: opts.bold, color: opts.color, rightToLeft: true })]
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
  children: [new TextRun({ text, font: FONT, size: 28, bold: true, color: '2E75B6', rightToLeft: true })],
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  bidirectional: true,
  alignment: AlignmentType.RIGHT,
  spacing: { before: 160, after: 100 },
  children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: '2E75B6', rightToLeft: true })],
});

const cell = (text, opts = {}) => new TableCell({
  borders: cellBorders,
  width: { size: opts.width || 2340, type: WidthType.DXA },
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  margins: { top: 100, bottom: 100, left: 140, right: 140 },
  children: [new Paragraph({
    bidirectional: true,
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.RIGHT,
    children: [new TextRun({ text: String(text), font: FONT, size: opts.size || 20, bold: opts.bold, color: opts.color, rightToLeft: true })],
  })],
});

const table = (rows, columnWidths) => new Table({
  width: { size: columnWidths.reduce((a,b) => a+b, 0), type: WidthType.DXA },
  columnWidths,
  rows: rows.map((row, idx) => new TableRow({
    children: row.map(c => cell(c.text, { ...c, width: columnWidths[row.indexOf(c)], fill: idx === 0 ? 'D5E8F0' : c.fill, bold: idx === 0 || c.bold })),
  })),
});

const bullet = (text) => new Paragraph({
  bidirectional: true,
  alignment: AlignmentType.RIGHT,
  numbering: { reference: 'bullets', level: 0 },
  spacing: { before: 60, after: 60 },
  children: [new TextRun({ text, font: FONT, size: 22, rightToLeft: true })],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ─── محتوى الوثيقة ─────────────────────────────────────────────
const content = [];

// ──── صفحة الغلاف ────
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 },
  children: [new TextRun({ text: 'جمعية البر الخيرية بصبيا', font: FONT, size: 48, bold: true, color: '1F4E79', rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 },
  children: [new TextRun({ text: 'الخطة الاستراتيجية 2026-2030', font: FONT, size: 40, bold: true, color: '2E75B6', rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 720, after: 240 },
  children: [new TextRun({ text: 'وثيقة العرض الرسمية لمجلس الإدارة', font: FONT, size: 32, bold: true, rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 },
  children: [new TextRun({ text: 'صبيا — منطقة جازان', font: FONT, size: 26, color: '595959', rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 1440, after: 80 },
  children: [new TextRun({ text: 'تاريخ الإصدار: 2026-04-30', font: FONT, size: 22, color: '595959', rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 },
  children: [new TextRun({ text: 'الإصدار: 1.0', font: FONT, size: 22, color: '595959', rightToLeft: true })],
}));
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 },
  children: [new TextRun({ text: 'الحالة: مُعتمَد للعرض على المجلس', font: FONT, size: 22, color: '595959', rightToLeft: true })],
}));

content.push(pageBreak());

// ──── الملخص التنفيذي ────
content.push(h1('1. الملخص التنفيذي'));

content.push(p('تُقدّم هذه الوثيقة الخطة الاستراتيجية لجمعية البر الخيرية بصبيا للسنوات الخمس القادمة (2026-2030)، بناءً على رؤية مؤسسية تستند إلى الواقع الميداني الفعلي لقاعدة المستفيدين، والتزام صريح بالشفافية في عرض الإنجازات والقيود والمخاطر معاً.'));

content.push(h2('1.1 ما تعرضه هذه الوثيقة'));
content.push(bullet('8 أهداف استراتيجية موزّعة على 4 محاور تشغيلية مُعتمَدة'));
content.push(bullet('19 هدفاً تشغيلياً + 21 مبادرة فعّالة + 16 مؤشر أداء قابلاً للقياس'));
content.push(bullet('خط الأساس الفعلي 2025 المستخرَج من قاعدة بيانات النظام (2,375 ملف مستفيد)'));
content.push(bullet('المستهدفات السنوية للسنوات الخمس بنموذج النمو المتسارع'));
content.push(bullet('سجل المخاطر المؤسسية المُعتمَد'));
content.push(bullet('قسم صريح بالقيود والفجوات التي تعمل عليها الجمعية'));

content.push(h2('1.2 ما تطلبه هذه الوثيقة من المجلس'));
content.push(bullet('اعتماد الخطة كإطار تنفيذي ملزم على مدى 5 سنوات'));
content.push(bullet('الموافقة على المراجعات الربعية المُلزمة لمجلس الإدارة'));
content.push(bullet('تخصيص الموارد التشغيلية اللازمة لمسارات الجودة والشراكات والتحول الرقمي'));
content.push(bullet('دعم الانتقال إلى منظومة قياس أثر مؤسسية موحَّدة'));

content.push(pageBreak());

// ──── الإطار العام ────
content.push(h1('2. الإطار العام للخطة'));

content.push(h2('2.1 المحاور الاستراتيجية الأربعة'));

content.push(table([
  [{ text: 'الكود', center: true }, { text: 'المحور', center: true }, { text: 'عدد الأهداف', center: true }, { text: 'التركيز الرئيسي', center: true }],
  [{ text: 'AXIS-01', center: true, bold: true }, { text: 'الأثر الاجتماعي والمستفيد' }, { text: '3', center: true }, { text: 'تعميق الأثر · تمكين المستفيدين · جودة الخدمة' }],
  [{ text: 'AXIS-02', center: true, bold: true }, { text: 'الاستدامة المالية' }, { text: '1', center: true }, { text: 'تنويع مصادر الدخل ورفع نسبة الموارد الذاتية' }],
  [{ text: 'AXIS-03', center: true, bold: true }, { text: 'التميز المؤسسي والتحول الرقمي' }, { text: '2', center: true }, { text: 'الجودة والحوكمة · ERP والذكاء المؤسسي' }],
  [{ text: 'AXIS-04', center: true, bold: true }, { text: 'الشراكات ورأس المال البشري' }, { text: '2', center: true }, { text: 'منظومة الشراكات · تنمية الكوادر والتطوع' }],
], [1500, 3000, 1300, 3560]));

content.push(p(''));
content.push(p('ملاحظة: المحاور الخمس لنموذج BSC (المالي/العميل/العمليات/التعلّم/الحوكمة) موجودة كبيانات مرجعية في النظام لقرار إداري لاحق، ولا تُستخدم في الخطة الحالية.', { color: '595959', size: 20 }));

content.push(h2('2.2 الأهداف الاستراتيجية الثمانية ومالكوها'));

content.push(table([
  [{ text: 'الكود', center: true }, { text: 'الهدف', center: true }, { text: 'المحور', center: true }, { text: 'المالك', center: true }],
  [{ text: 'STR-2026-003', center: true }, { text: 'تعميق الأثر الاجتماعي وتحسين معيشة الأسر الأشد احتياجاً' }, { text: 'AXIS-01', center: true }, { text: 'خاتمة محرق' }],
  [{ text: 'STR-2026-004', center: true }, { text: 'تمكين المستفيدين اقتصادياً واجتماعياً' }, { text: 'AXIS-01', center: true }, { text: 'عبدالرحمن عقيل (مؤقت)' }],
  [{ text: 'STR-2026-006', center: true }, { text: 'تحسين تجربة المستفيد ورفع جودة وسرعة تقديم الخدمات' }, { text: 'AXIS-01', center: true }, { text: 'خاتمة محرق' }],
  [{ text: 'STR-2026-007', center: true }, { text: 'تحقيق الاستدامة المالية وتنويع مصادر الدخل' }, { text: 'AXIS-02', center: true }, { text: 'نادية قلم' }],
  [{ text: 'STR-2026-012', center: true }, { text: 'تعزيز التميز المؤسسي والحوكمة والالتزام بمعايير الجودة' }, { text: 'AXIS-03', center: true }, { text: 'ايلاف حسن' }],
  [{ text: 'STR-2026-013', center: true }, { text: 'قيادة التحول الرقمي وتوظيف الذكاء المؤسسي' }, { text: 'AXIS-03', center: true }, { text: 'عبدالرحمن عقيل (مؤقت)' }],
  [{ text: 'STR-2026-016', center: true }, { text: 'بناء منظومة شراكات نوعية تعزز الأثر والاستدامة' }, { text: 'AXIS-04', center: true }, { text: 'فاطمة عقيبي' }],
  [{ text: 'STR-2026-017', center: true }, { text: 'تنمية رأس المال البشري والتطوعي' }, { text: 'AXIS-04', center: true }, { text: 'خليل هادي' }],
], [1700, 3960, 1100, 2600]));

content.push(p(''));
content.push(p('⚠️ ملاحظة شفافية: تحميل المدير التنفيذي هدفين (STR-004 + STR-013) وضع مؤقت معتمد، ويُسعى لتعيين منسقَين تنفيذيَّين خلال Q2-Q3 2026.', { color: 'C00000', size: 20 }));

content.push(pageBreak());

// ──── خط الأساس الفعلي 2025 ────
content.push(h1('3. خط الأساس الفعلي 2025'));

content.push(p('تستند الخطة إلى بيانات حقيقية مستخرَجة من قاعدة بيانات النظام بتاريخ 2026-05-01، لا إلى تقديرات أو طموحات. الأرقام التالية موثّقة في الملفات الرسمية للجمعية وقابلة للتدقيق.'));

content.push(h2('3.1 قاعدة المستفيدين (مصدر البيانات: ملف 01 مايو 2026)'));

content.push(table([
  [{ text: 'البند', center: true }, { text: 'العدد الفعلي', center: true }, { text: 'النسبة', center: true }],
  [{ text: 'إجمالي ملفات المستفيدين' }, { text: '2,375 ملف', center: true, bold: true }, { text: '100%', center: true }],
  [{ text: 'ملفات معتمدة' }, { text: '2,353', center: true }, { text: '99.1%', center: true }],
  [{ text: 'ملفات قيد المراجعة' }, { text: '22', center: true }, { text: '0.9%', center: true }],
], [4680, 2340, 2340]));

content.push(p(''));
content.push(h3('توزيع فئات الملفات'));
content.push(table([
  [{ text: 'الفئة', center: true }, { text: 'العدد', center: true }, { text: 'النسبة', center: true }],
  [{ text: 'فئة د' }, { text: '1,033', center: true }, { text: '43.5%', center: true }],
  [{ text: 'فئة ج' }, { text: '738', center: true }, { text: '31.1%', center: true }],
  [{ text: 'فئة أ' }, { text: '325', center: true }, { text: '13.7%', center: true }],
  [{ text: 'فئة ب' }, { text: '270', center: true }, { text: '11.4%', center: true }],
  [{ text: 'مؤقت' }, { text: '9', center: true }, { text: '0.4%', center: true }],
], [4680, 2340, 2340]));

content.push(p(''));
content.push(h3('التركيبة الديموغرافية'));
content.push(bullet('الجنس: 1,544 أنثى (65%) · 831 ذكر (35%)'));
content.push(bullet('الحالة الاجتماعية: 638 أرملة · 631 متزوج · 621 مطلقة · 178 عزباء'));
content.push(bullet('نسبة الأسر التي تعيلها امرأة (أرملة + مطلقة): 53% — أولوية مؤسسية'));
content.push(bullet('إجمالي الأيتام في كل الملفات: 785 يتيماً'));
content.push(bullet('ملفات تحتاج كفالة فعلياً: 72 ملف (54 يتيماً يحتاج كفالة)'));

content.push(h3('الوضع الاقتصادي'));
content.push(bullet('عدد الملفات بدخل موثّق: 2,241 (94.4%)'));
content.push(bullet('متوسط دخل الأسرة الشهري: 4,334 ريال'));
content.push(bullet('الوسيط: 3,946 ريال'));
content.push(bullet('المدى: 300 - 15,708 ريال'));
content.push(bullet('ملاحظة: المتوسط أقل بكثير من خط الفقر الرسمي (~9,000 ريال للأسرة)'));

content.push(h2('3.2 الاحتياجات الرئيسية المسجَّلة'));
content.push(table([
  [{ text: 'الاحتياج', center: true }, { text: 'عدد الملفات', center: true }],
  [{ text: 'ترميم منزل' }, { text: '148', center: true }],
  [{ text: 'توفير مسكن' }, { text: '46', center: true }],
  [{ text: 'سداد كهرباء' }, { text: '39', center: true }],
  [{ text: 'أجهزة كهربائية (مكيفات/غسالة/ثلاجة)' }, { text: '~200+', center: true }],
  [{ text: 'كفالة' }, { text: '72', center: true }],
], [6000, 3360]));

content.push(p(''));
content.push(p('💡 الدلالة الاستراتيجية: الإسكان (ترميم + توفير + كهرباء) يُمثّل أعلى احتياج مُعلَن، ما يستوجب مبادرة مُتخصِّصة في 2027-2028.', { color: '1F4E79', bold: true, size: 22 }));

content.push(pageBreak());

// ──── الادّعاءات والتناقضات ────
content.push(h1('4. الشفافية في الأرقام: التناقضات المُكتشَفة'));

content.push(p('عند مقارنة الادّعاءات في الخطة الأولية بالواقع الميداني، اكتُشفت ثلاثة تناقضات تستوجب المعالجة الصريحة قبل العرض الرسمي.'));

content.push(h2('4.1 تناقض عدد الأسر المخدومة'));
content.push(table([
  [{ text: 'في الخطة الأولية', center: true }, { text: 'في الواقع', center: true }, { text: 'الفجوة', center: true }],
  [{ text: '13,000 أسرة بحلول 2026' }, { text: '2,375 ملف فعلي', center: true, bold: true }, { text: '5.5× ضعف', center: true, color: 'C00000' }],
], [3120, 3120, 3120]));
content.push(p(''));
content.push(p('المعالجة المعتمدة:', { bold: true }));
content.push(bullet('إذا كان الرقم يشمل الخدمات المتراكمة (نفس الأسرة قد تتلقى خدمات متعددة في السنة): يجب توضيح المنهج في الخطة'));
content.push(bullet('إذا كان يقصد الملفات الفريدة: يُستبدَل بهدف واقعي = 4,500 ملف بحلول 2030 (نمو 90%)'));

content.push(h2('4.2 تناقض كفالة الأيتام'));
content.push(table([
  [{ text: 'في الخطة الأولية', center: true }, { text: 'في الواقع', center: true }, { text: 'الفجوة', center: true }],
  [{ text: 'كفالة 870 يتيم' }, { text: '72 ملف يطلب كفالة (54 يتيماً)', center: true, bold: true }, { text: '16× ضعف', center: true, color: 'C00000' }],
], [3120, 3120, 3120]));
content.push(p(''));
content.push(p('المعالجة المعتمدة: تعديل الهدف إلى "كفالة 200 يتيم بحلول 2027" — تضاعف 4× من الواقع، وهو طموح قابل للتحقق.', { bold: true }));

content.push(h2('4.3 خط الأساس المالي 2025 — مُؤكَّد رسمياً'));
content.push(table([
  [{ text: 'البند', center: true }, { text: 'القيمة (ريال)', center: true }],
  [{ text: 'إجمالي الإيرادات' }, { text: '11,309,157', center: true, bold: true }],
  [{ text: 'إجمالي المصروفات' }, { text: '10,641,351', center: true }],
  [{ text: 'صافي الفائض' }, { text: '667,806 (فائض)', center: true, color: '006100', bold: true }],
  [{ text: 'صافي الأصول' }, { text: '7,837,407', center: true }],
  [{ text: 'الموارد الذاتية' }, { text: '964,203 (8.5%)', center: true }],
  [{ text: 'إيرادات معاهد شعاع المعالي' }, { text: '409,685', center: true }],
  [{ text: 'نسبة مصروفات البرامج من الإيرادات' }, { text: '88.4% — ✅ يفوق المعيار', center: true, color: '006100' }],
], [4680, 4680]));
content.push(p('المصدر: التقرير المالي الرسمي 2025 — جمعية البر بصبيا', { color: '595959', size: 18 }));
content.push(p('💡 ملاحظة هامة: نسبة مصروفات البرامج 88.4% تفوق المعيار الدولي للقطاع غير الربحي (80%) — مؤشر صحة مالية ممتاز.', { color: '006100', bold: true, size: 22 }));

content.push(pageBreak());

// ──── المستهدفات السنوية ────
content.push(h1('5. المستهدفات السنوية للسنوات الخمس'));

content.push(p('اعتمدت الخطة نموذج النمو المتسارع: نمو معتدل في 2026-2027 (مرحلة بناء قدرات)، ثم نمو متسارع في 2028-2030 (مرحلة الحصاد). يعكس هذا واقع المنظمات الناشئة في القطاع الثالث.'));

content.push(h2('5.1 المؤشرات المالية (مُؤكَّدة من التقرير المالي 2025)'));
content.push(table([
  [{ text: 'المؤشر', center: true }, { text: 'خط الأساس 2025', center: true }, { text: '2026', center: true }, { text: '2027', center: true }, { text: '2028', center: true }, { text: '2029', center: true }, { text: '2030', center: true }],
  [{ text: 'إجمالي الإيرادات (M ريال)' }, { text: '11.3', center: true }, { text: '12.1', center: true }, { text: '13.0', center: true }, { text: '14.0', center: true }, { text: '15.2', center: true }, { text: '16.6', center: true }],
  [{ text: 'نسبة الموارد الذاتية' }, { text: '8.5%', center: true }, { text: '13%', center: true }, { text: '17%', center: true }, { text: '21%', center: true }, { text: '26%', center: true }, { text: '30%', center: true }],
  [{ text: 'عدد مصادر الإيرادات' }, { text: '5', center: true }, { text: '7', center: true }, { text: '8', center: true }, { text: '8', center: true }, { text: '9', center: true }, { text: '9', center: true }],
  [{ text: 'إيرادات معاهد شعاع المعالي (K)' }, { text: '410', center: true }, { text: '500', center: true }, { text: '700', center: true }, { text: '1,000', center: true }, { text: '1,300', center: true }, { text: '1,600', center: true }],
  [{ text: 'الفائض السنوي (K ريال)' }, { text: '668', center: true }, { text: '700', center: true }, { text: '750', center: true }, { text: '800', center: true }, { text: '850', center: true }, { text: '900', center: true }],
], [2400, 1640, 880, 880, 880, 880, 800]));
content.push(p('المصدر: التقرير المالي الرسمي 2025 — جمعية البر بصبيا', { color: '595959', size: 18 }));

content.push(h2('5.2 مؤشرات الأثر الاجتماعي'));
content.push(table([
  [{ text: 'المؤشر', center: true }, { text: 'خط الأساس 2025', center: true }, { text: '2026', center: true }, { text: '2027', center: true }, { text: '2028', center: true }, { text: '2029', center: true }, { text: '2030', center: true }],
  [{ text: 'عدد الأسر المخدومة (ملفات فريدة)' }, { text: '2,375', center: true }, { text: '2,800', center: true }, { text: '3,200', center: true }, { text: '3,700', center: true }, { text: '4,100', center: true }, { text: '4,500', center: true }],
  [{ text: 'أيتام في برنامج الكفالة' }, { text: '54', center: true }, { text: '100', center: true }, { text: '150', center: true }, { text: '200', center: true }, { text: '230', center: true }, { text: '250', center: true }],
  [{ text: 'مستفيدون من حزمة التمكين الكاملة' }, { text: '0', center: true }, { text: '350', center: true }, { text: '500', center: true }, { text: '700', center: true }, { text: '900', center: true }, { text: '1,100', center: true }],
], [2600, 1500, 850, 850, 850, 850, 850]));

content.push(h2('5.3 مؤشرات التحوّل المؤسسي'));
content.push(table([
  [{ text: 'المؤشر', center: true }, { text: 'خط الأساس 2025', center: true }, { text: '2026', center: true }, { text: '2027', center: true }, { text: '2028', center: true }, { text: '2029', center: true }, { text: '2030', center: true }],
  [{ text: 'نسبة الأتمتة الرقمية' }, { text: '90%', center: true }, { text: '92%', center: true }, { text: '93%', center: true }, { text: '94%', center: true }, { text: '94.5%', center: true }, { text: '95%', center: true }],
  [{ text: 'الشراكات الفعّالة' }, { text: '18', center: true }, { text: '28', center: true }, { text: '36', center: true }, { text: '44', center: true }, { text: '52', center: true }, { text: '60', center: true }],
  [{ text: 'متوسط ساعات تدريب/موظف' }, { text: '~5', center: true }, { text: '20', center: true }, { text: '20', center: true }, { text: '20', center: true }, { text: '20', center: true }, { text: '20', center: true }],
  [{ text: 'ساعات التطوع المنفَّذة سنوياً' }, { text: '~3K*', center: true }, { text: '10K', center: true }, { text: '15K', center: true }, { text: '20K', center: true }, { text: '25K', center: true }, { text: '30K', center: true }],
], [2600, 1500, 850, 850, 850, 850, 850]));

content.push(pageBreak());

// ──── المبادرات ────
content.push(h1('6. المبادرات الفعّالة (21 مبادرة)'));

content.push(p('بعد تطبيق فلتر القبول الخماسي على 23 مبادرة أوّلية، أُسقطت 4 مبادرات (دمج وتأجيل) وأُعيدت صياغة 7 مبادرات بمخرجات قابلة للقياس. النتيجة: 21 مبادرة فعّالة موزّعة كالتالي:'));

content.push(h2('6.1 مبادرات قيد التنفيذ (6 مبادرات)'));
content.push(table([
  [{ text: 'الكود', center: true }, { text: 'المبادرة', center: true }, { text: 'الهدف', center: true }, { text: 'المسؤول', center: true }],
  [{ text: 'INI-2026-005', center: true }, { text: 'كفالة 200 يتيم بحلول 2027' }, { text: 'STR-2026-003', center: true }, { text: 'طلال الحربي' }],
  [{ text: 'INI-2026-006', center: true }, { text: 'توزيع 1500 سلة غذائية شهرياً' }, { text: 'STR-2026-003', center: true }, { text: 'خاتمة محرق' }],
  [{ text: 'INI-2026-007', center: true }, { text: 'تأهيل 350 متدرب في مركز التدريب' }, { text: 'STR-2026-004', center: true }, { text: 'CEO' }],
  [{ text: 'INI-2026-017', center: true }, { text: 'تشغيل منظومة Rafid ERP وتكامل QMS' }, { text: 'STR-2026-013', center: true }, { text: 'CEO' }],
  [{ text: 'INI-2026-018', center: true }, { text: 'تدريب 30 موظف على 3 أدوات AI' }, { text: 'STR-2026-013', center: true }, { text: 'CEO' }],
  [{ text: 'INI-2026-023', center: true }, { text: 'تدقيق الشراكات الـ 18 القائمة' }, { text: 'STR-2026-016', center: true }, { text: 'فاطمة عقيبي' }],
], [1700, 3700, 1700, 2260]));

content.push(h2('6.2 المبادرات الجاهزة للانطلاق (15 مبادرة)'));
content.push(p('15 مبادرة بحالة NOT_STARTED مُجهَّزة للانطلاق فور اعتماد الخطة، موزّعة على المحاور الأربعة وفق أولويات إدارية معتمدة.'));

content.push(h2('6.3 المبادرات المؤجَّلة أو المُحوَّلة'));
content.push(table([
  [{ text: 'الكود', center: true }, { text: 'الإجراء', center: true }, { text: 'السبب', center: true }],
  [{ text: 'INI-2026-014', center: true }, { text: 'دمج مع OBJ-2026-020' }, { text: 'تكرار صريح في KPI' }],
  [{ text: 'INI-2026-024', center: true }, { text: 'دمج مع OBJ-2026-032' }, { text: 'تكرار في عدد الشراكات' }],
  [{ text: 'INI-2026-003', center: true }, { text: 'تأجيل لـ 2027' }, { text: 'مشروط بفائض مالي فعلي' }],
  [{ text: 'INI-2026-012', center: true }, { text: 'تحويل لدراسة جدوى Q3 2026' }, { text: 'يحتاج تقييماً قبل تطوير تجاري' }],
], [1700, 3700, 3960]));

content.push(pageBreak());

// ──── المخاطر والقيود ────
content.push(h1('7. سجل المخاطر والقيود (شفافية كاملة)'));

content.push(p('المعلومات التالية تُقدَّم بشفافية تامة. عرضها صراحةً يبني المصداقية أمام المجلس ويسمح باتخاذ قرارات معتمدة على واقع لا على تجميل.', { italics: true, color: '595959' }));

content.push(h2('7.1 المخاطر الاستراتيجية المُسجَّلة'));
content.push(table([
  [{ text: 'المخاطرة', center: true }, { text: 'الفئة', center: true }, { text: 'الأثر', center: true }, { text: 'الاحتمال', center: true }],
  [{ text: 'تركّز التمويل في مصدرين/ثلاثة' }, { text: 'مالية', center: true }, { text: 'مرتفع', center: true, color: 'C00000' }, { text: 'متوسط', center: true }],
  [{ text: 'انخفاض التبرعات الموسمية (رمضان/الأضحى)' }, { text: 'مالية', center: true }, { text: 'مرتفع', center: true, color: 'C00000' }, { text: 'مرتفع', center: true, color: 'C00000' }],
  [{ text: 'فجوة سيولة في Q3' }, { text: 'مالية', center: true }, { text: 'متوسط', center: true }, { text: 'متوسط', center: true }],
  [{ text: 'تعطّل منظومة Rafid ERP' }, { text: 'تشغيلية', center: true }, { text: 'مرتفع', center: true, color: 'C00000' }, { text: 'منخفض', center: true }],
  [{ text: 'تسرّب موظفين رئيسيين' }, { text: 'تشغيلية', center: true }, { text: 'متوسط', center: true }, { text: 'متوسط', center: true }],
  [{ text: 'تأخّر تقارير GASTAT أو منصة الجمعيات' }, { text: 'امتثال', center: true }, { text: 'متوسط', center: true }, { text: 'منخفض', center: true }],
  [{ text: 'انتهاء شهادات (Z أو خصوصية البيانات)' }, { text: 'امتثال', center: true }, { text: 'مرتفع', center: true, color: 'C00000' }, { text: 'منخفض', center: true }],
  [{ text: 'تغيير تشريعي مفاجئ من وزارة الموارد البشرية' }, { text: 'امتثال', center: true }, { text: 'مرتفع', center: true, color: 'C00000' }, { text: 'منخفض', center: true }],
  [{ text: 'شكاوى مستفيدين متراكمة دون معالجة' }, { text: 'سمعة', center: true }, { text: 'متوسط', center: true }, { text: 'منخفض', center: true }],
  [{ text: 'تغطية إعلامية سلبية أو تشكيك مجتمعي' }, { text: 'سمعة', center: true }, { text: 'مرتفع', center: true, color: 'C00000' }, { text: 'منخفض', center: true }],
  [{ text: 'حادث تسريب بيانات مستفيدين' }, { text: 'سمعة + امتثال', center: true }, { text: 'مرتفع', center: true, color: 'C00000' }, { text: 'منخفض', center: true }],
  [{ text: 'عدم قدرة الفريق على تحمّل عبء الخطة الإضافي' }, { text: 'تشغيلية', center: true }, { text: 'متوسط', center: true }, { text: 'مرتفع', center: true, color: 'C00000' }],
], [4200, 2000, 1580, 1580]));

content.push(h2('7.2 القيود المعروفة في تنفيذ الخطة الحالية'));

content.push(h3('قيود بيانات'));
content.push(bullet('غياب AnnualTargets رسمية لكل مؤشر للسنوات 2027-2030 (تُستكمل خلال 30 يوماً)'));
content.push(bullet('غياب KpiEntries فعلية لـ Q1 2026 — سيُدخَل خلال 30 يوماً'));
content.push(bullet('غياب التعريف الإجرائي الرسمي لمصطلحات جوهرية (أسرة مستفيدة، شراكة فعّالة، موظف مدرّب، متطوع نشط)'));
content.push(bullet('غياب بيانات تاريخية للمقارنة قبل بناء النظام (Q1-Q4 2025 جزئية)'));

content.push(h3('قيود تنظيمية'));
content.push(bullet('تحميل المدير التنفيذي هدفين استراتيجيين بشكل مؤقت (STR-004 + STR-013)'));
content.push(bullet('تحميل مدير قسم الرعاية هدفين (STR-003 + STR-006) — يحتاج مراجعة في Q3'));
content.push(bullet('عدم اعتماد قبول رسمي موقّع من جميع مالكي الأهداف'));

content.push(h3('قيود تنفيذ'));
content.push(bullet('21 مبادرة على فريق يدير عمليات يومية مكثّفة — توقُّع ضغط على الوقت'));
content.push(bullet('5 مبادرات IN_PROGRESS تستند إلى ادّعاء بدء، ولا توجد KpiEntries فعلية تثبت التقدم'));
content.push(bullet('غياب لوحة متابعة فردية للموظف تعرض مؤشراته'));

content.push(pageBreak());

// ──── خطة الـ 30 يوماً ────
content.push(h1('8. خطة الـ 30 يوماً قبل الإطلاق الرسمي'));

content.push(p('لإكمال جاهزية الخطة قبل البدء التشغيلي الكامل، اعتُمدت خطة 4 أسابيع تركّز على البيانات والصدق الرقمي.'));

content.push(h2('8.1 الجدول الأسبوعي'));
content.push(table([
  [{ text: 'الأسبوع', center: true }, { text: 'التواريخ', center: true }, { text: 'المُسلَّم', center: true }],
  [{ text: '1', center: true, bold: true }, { text: '1-7 مايو', center: true }, { text: 'تقرير مالي 2025 + خط أساس بشري + قائمة 18 شراكة' }],
  [{ text: '2', center: true, bold: true }, { text: '8-14 مايو', center: true }, { text: 'AnnualTargets للسنوات الخمس + 4 تعاريف إجرائية' }],
  [{ text: '3', center: true, bold: true }, { text: '15-21 مايو', center: true }, { text: 'KpiEntries Q1 2026 + سجل المخاطر + تنقية الادّعاءات' }],
  [{ text: '4', center: true, bold: true }, { text: '22-30 مايو', center: true }, { text: 'وثيقة العرض النهائية + جلسة بروفة + إقرار CEO' }],
], [1200, 1800, 6360]));

content.push(h2('8.2 الجهد المطلوب'));
content.push(bullet('CEO: ~15 ساعة'));
content.push(bullet('مدير الجودة: ~35 ساعة (التنسيق المركزي)'));
content.push(bullet('المالية: ~15 ساعة (التقرير المالي)'));
content.push(bullet('كل مالك هدف: ~7 ساعات (تعاريف + AnnualTargets + KpiEntries)'));
content.push(bullet('الإجمالي: ~115 ساعة موزّعة على فريق كامل خلال 30 يوماً'));
content.push(bullet('المعنى: 4 ساعات يومياً موزّعة — لا توقّف للعمل التشغيلي'));

content.push(h2('8.3 نقاط القرار'));
content.push(table([
  [{ text: 'التاريخ', center: true }, { text: 'القرار', center: true }],
  [{ text: '7 مايو', center: true }, { text: 'الاستمرار أو التأجيل (إن لم يثبت خط الأساس المالي)' }],
  [{ text: '14 مايو', center: true }, { text: 'جودة البيانات كافية أم نحتاج تأخيراً' }],
  [{ text: '21 مايو', center: true }, { text: 'إن سُحب >30% من الادّعاءات → مراجعة منهج العرض' }],
  [{ text: '27 مايو', center: true }, { text: 'البروفة → الجاهزية أم تأخير أسبوع' }],
], [2000, 7360]));

content.push(pageBreak());

// ──── منظومة الحوكمة ────
content.push(h1('9. منظومة الحوكمة والمتابعة'));

content.push(h2('9.1 المراجعة الربعية المُلزمة'));
content.push(p('60 دقيقة × 4 مرات سنوياً، يحضرها المدير التنفيذي + مالكو الأهداف الثمانية + مدير الجودة. المحضر يُرفع في النظام كوثيقة رسمية.'));

content.push(h2('9.2 لوحة المتابعة المؤسسية'));
content.push(p('يُستثمَر النظام القائم (QMS) في توفير لوحة موحَّدة تعرض:'));
content.push(bullet('حالة كل هدف (أخضر/أصفر/أحمر) ونسبة التقدم'));
content.push(bullet('المؤشرات المتأخرة عن مستهدفها الربعي'));
content.push(bullet('المبادرات المتعثّرة + سبب التعثّر'));
content.push(bullet('سجل المخاطر مع حالات التحديث'));

content.push(h2('9.3 سياسة قبول المبادرات الجديدة'));
content.push(p('فلتر خماسي ملزم — لا تُضاف مبادرة جديدة دون اجتياز الأسئلة الخمسة:'));
content.push(bullet('1. هل لها مالك واضح ومحدد بالاسم؟'));
content.push(bullet('2. هل لها مخرج قابل للقياس؟'));
content.push(bullet('3. هل تخدم هدفاً استراتيجياً مباشراً؟'));
content.push(bullet('4. هل تُنفَّذ بموارد الجمعية الحالية؟'));
content.push(bullet('5. هل لا تكرر مبادرة قائمة؟'));

content.push(h2('9.4 ربط المبادرات بأهداف داعمة'));
content.push(p('مبادرات تخدم أكثر من هدف تُسجَّل تحت هدفها الأصلي مع وسم نصي [يدعم: STR-XXX] في الوصف. مثال:'));
content.push(bullet('INI-2026-025 (شراكة بنك التنمية): مسجَّلة تحت STR-016 مع [يدعم: STR-2026-007]'));
content.push(bullet('INI-2026-026 (شراكة TVTC): مسجَّلة تحت STR-016 مع [يدعم: STR-2026-004]'));

content.push(pageBreak());

// ──── القرارات المطلوبة ────
content.push(h1('10. القرارات المطلوبة من المجلس'));

content.push(p('تطلب الإدارة التنفيذية من مجلس الإدارة اتخاذ القرارات التالية:'));

content.push(h2('قرار 1 — اعتماد الخطة كإطار خماسي'));
content.push(p('اعتماد الخطة الاستراتيجية 2026-2030 كإطار تنفيذي ملزم لمدة خمس سنوات، مع المراجعة السنوية في نهاية كل عام مالي.'));

content.push(h2('قرار 2 — اعتماد منظومة المراجعة الربعية'));
content.push(p('اعتماد المراجعة الربعية المُلزمة كآلية رسمية للمتابعة، يحضرها أعضاء من مجلس الإدارة بصفة مراقب على الأقل في الربع الأخير.'));

content.push(h2('قرار 3 — تخصيص الموارد'));
content.push(bullet('دعم تعيين منسقَين تنفيذيَّين لمسارَي التمكين والتحول الرقمي خلال Q3 2026'));
content.push(bullet('تخصيص ميزانية مسار الاعتماد المؤسسي السعودي (Z + Bayanat + ICCT)'));
content.push(bullet('دعم وظيفة إدارة علاقات الشركاء (مسؤول + سجل CRM)'));

content.push(h2('قرار 4 — السياسة الإعلامية'));
content.push(p('تفويض الإدارة التنفيذية بإعداد بيان مجتمعي شفّاف يعرض الإنجازات والقيود معاً، استناداً إلى منهج تقارير ربعية بسيطة تُنشر للمجتمع المحلي.'));

content.push(h2('قرار 5 — الموقف من الادّعاءات الطموحة'));
content.push(p('إقرار التعديلات على الأهداف الطموحة غير المتطابقة مع الواقع:'));
content.push(bullet('تعديل هدف 13,000 أسرة → نموذج النمو المتسارع للوصول إلى 4,500 ملف بحلول 2030'));
content.push(bullet('تعديل هدف 870 يتيم → 200 يتيم بحلول 2027'));
content.push(bullet('تأكيد الإيرادات والموارد الذاتية بعد استلام التقرير المالي 2025'));

content.push(pageBreak());

// ──── ملخص ختامي ────
content.push(h1('11. الخلاصة'));

content.push(p('تنتقل جمعية البر الخيرية بصبيا في هذه المرحلة من خطة ورقية تقليدية إلى منظومة تنفيذ مؤسسية متكاملة، مدعومة بنظام إدارة جودة (QMS) مُختبَر ومنشور على بنية إنتاج فعلية، يُتيح المتابعة الفورية لكل مؤشر ومبادرة.'));

content.push(p('الفرق بين الخطة السابقة وما يُعرض اليوم ليس في الطموح وحده، بل في الانتقال إلى:', { bold: true }));
content.push(bullet('قياس مبني على بيانات حقيقية لا تقديرات'));
content.push(bullet('مالكية شخصية واضحة لكل هدف ومبادرة'));
content.push(bullet('شفافية صريحة في عرض القيود والمخاطر'));
content.push(bullet('منظومة مراجعة ربعية مُلزمة'));
content.push(bullet('فلتر قبول صارم يمنع تضخّم المبادرات على حساب التركيز'));

content.push(p('نلتمس من مجلس الإدارة الموقّر اعتماد هذه الخطة بأقسامها، وتخصيص الدعم اللازم لمسارها التنفيذي، استكمالاً لمسيرة الجمعية في خدمة المجتمع المحلي بصبيا.', { spacing: { before: 240 } }));

content.push(p(''));
content.push(p('والله ولي التوفيق', { center: true, alignment: AlignmentType.CENTER, bold: true, size: 26, color: '1F4E79' }));

content.push(p(''));
content.push(p('المدير التنفيذي', { center: true, alignment: AlignmentType.CENTER, size: 22 }));
content.push(p('عبدالرحمن عقيل', { center: true, alignment: AlignmentType.CENTER, bold: true, size: 24 }));

// ─── بناء الوثيقة ─────────────────────────────────────────────
const doc = new Document({
  creator: 'جمعية البر الخيرية بصبيا',
  title: 'الخطة الاستراتيجية 2026-2030',
  description: 'وثيقة عرض الخطة الاستراتيجية لمجلس الإدارة',
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: '1F4E79' },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0, alignment: AlignmentType.RIGHT, bidirectional: true },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: '2E75B6' },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1, alignment: AlignmentType.RIGHT, bidirectional: true },
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: FONT, color: '2E75B6' },
        paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2, alignment: AlignmentType.RIGHT, bidirectional: true },
      },
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
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          bidirectional: true, alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'الخطة الاستراتيجية 2026-2030 — جمعية البر الخيرية بصبيا', font: FONT, size: 18, color: '595959', rightToLeft: true })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'صفحة ', font: FONT, size: 18, color: '595959' }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '595959' })],
        })],
      }),
    },
    children: content,
  }],
});

// ─── حفظ ─────────────────────────────────────────────
const outPath = path.join(__dirname, '..', 'docs', 'board-presentation-2026-04-30.docx');
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ تم بناء الوثيقة: ${outPath}`);
  console.log(`   الحجم: ${(buffer.length / 1024).toFixed(1)} KB`);
});
