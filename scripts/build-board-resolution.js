/**
 * بناء ملحق محضر مجلس الإدارة — بنود اعتماد الخطة + السياسات
 * يُضاف للمحضر رقم 1-2026
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, Header, Footer, PageNumber,
} = require('docx');

const FONT = 'Arial';
const ROOT = path.join(__dirname, '..', 'ISO9001');
const OUT_DIR = path.join(ROOT, 'الخطط والمشرات');

// ─── أنماط ─────────────────────────────────────────
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
  heading: HeadingLevel.HEADING_1, bidirectional: true,
  alignment: AlignmentType.CENTER, spacing: { before: 360, after: 240 },
  children: [new TextRun({ text, font: FONT, size: 32, bold: true, color: '1F4E79', rightToLeft: true })],
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2, bidirectional: true,
  alignment: AlignmentType.RIGHT, spacing: { before: 240, after: 160 },
  children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: '2E75B6', rightToLeft: true })],
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

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ─── المحتوى ────────────────────────────────────────
const content = [];

// ─── ترويسة المحضر ─────────────────────────────────
content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 100 },
  children: [new TextRun({ text: 'بسم الله الرحمن الرحيم', font: FONT, size: 28, bold: true, color: '1F4E79', rightToLeft: true })],
}));

content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 240, after: 100 },
  children: [new TextRun({ text: 'جمعية البر الخيرية بصبيا', font: FONT, size: 32, bold: true, color: '1F4E79', rightToLeft: true })],
}));

content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 100, after: 240 },
  children: [new TextRun({ text: 'ملحق محضر اجتماع مجلس الإدارة رقم (___) لعام 2026م', font: FONT, size: 26, bold: true, rightToLeft: true })],
}));

content.push(new Paragraph({
  bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 100, after: 240 },
  children: [new TextRun({ text: 'بنود اعتماد: الخطة الاستراتيجية + حزمة السياسات واللوائح والإجراءات', font: FONT, size: 22, color: '595959', rightToLeft: true })],
}));

content.push(new Paragraph({
  border: { bottom: { color: '2E75B6', size: 12, style: BorderStyle.SINGLE } },
  spacing: { before: 100, after: 240 },
  children: [],
}));

// ─── البند 1 ───────────────────────────────────────
content.push(h2('البند رقم (___): اعتماد الخطة الاستراتيجية للجمعية 2026-2030م'));

content.push(p(
  'استعرض المجلس مشروع الخطة الاستراتيجية لجمعية البر الخيرية بصبيا للفترة 2026-2030م، والمبني على مراجعة الوضع المؤسسي والتشغيلي والمالي للجمعية لعام 2025م، وقرر اعتمادها كمرجع رسمي للتخطيط والمتابعة من تاريخ هذا القرار.',
));

content.push(p(
  'وتُعد هذه الخطة الإطار الاستراتيجي المعتمد للجمعية، مع استمرار إعداد الخطط التشغيلية السنوية المنبثقة عنها.',
));

content.push(p(
  'كما فوّض المجلس المدير التنفيذي بمتابعة التنفيذ عبر نظام إدارة الجودة QMS، ورفع تقرير ربعي للمجلس عن مستوى الإنجاز والانحرافات والإجراءات التصحيحية.',
));

content.push(p(''));

// ─── البند 2 ───────────────────────────────────────
content.push(h2('البند رقم (___): اعتماد حزمة السياسات واللوائح والإجراءات المنظمة للحوكمة ونظام الجودة'));

content.push(p(
  'استعرض المجلس حزمة السياسات واللوائح والإجراءات المنظمة لأعمال الجمعية، والمتعلقة بالحوكمة والامتثال ونظام إدارة الجودة، وقرر اعتمادها كمرجع رسمي للعمل المؤسسي داخل الجمعية، وفق القائمة المرفقة بهذا المحضر.',
));

content.push(p(
  'كما فوّض المجلس المدير التنفيذي ومدير الجودة بتحديث النماذج والإجراءات التشغيلية غير الجوهرية عند الحاجة.',
));

content.push(p(
  'وتُعرض أي تعديلات جوهرية على السياسات أو اللوائح على المجلس لاعتمادها وفق الإجراءات النظامية.',
));

content.push(pageBreak());

// ─── الملحق: قائمة السياسات المعتمدة ─────────────────
content.push(h1('الملحق — قائمة السياسات واللوائح والإجراءات المعتمدة'));

content.push(p(
  'القائمة الكاملة بالوثائق المرجعية المعتمدة بموجب البند الثاني من هذا المحضر، ويُعتمد جميعها بنفس تاريخ هذا المحضر:',
  { italics: true, color: '595959' },
));

// المجموعة 1: السياسات والأهداف
content.push(h2('1. السياسات والأهداف الاستراتيجية'));
content.push(buildTable([
  [{ text: 'الكود', center: true }, { text: 'الوثيقة', center: true }, { text: 'بند ISO', center: true }],
  [{ text: 'QM-001-2026', center: true, bold: true }, { text: 'دليل نظام إدارة الجودة' }, { text: '7.5', center: true }],
  [{ text: 'QM-002-2026', center: true, bold: true }, { text: 'نطاق نظام إدارة الجودة' }, { text: '4.4', center: true }],
  [{ text: 'QP-001-2026', center: true, bold: true }, { text: 'سياسة الجودة' }, { text: '5.2', center: true }],
  [{ text: 'QP-002-2026', center: true, bold: true }, { text: 'أهداف الجودة' }, { text: '6.2', center: true }],
  [{ text: 'QP-003-2026', center: true, bold: true }, { text: 'إدارة المخاطر والفرص' }, { text: '6.1', center: true }],
  [{ text: 'QP-004-2026', center: true, bold: true }, { text: 'ضبط الوثائق والسجلات' }, { text: '7.5', center: true }],
  [{ text: 'QP-005-2026', center: true, bold: true }, { text: 'سياسة التوثيق الرشيق' }, { text: '7.5', center: true }],
], [1800, 5760, 1800]));

// المجموعة 2: الإجراءات التشغيلية
content.push(p(''));
content.push(h2('2. الإجراءات التشغيلية'));
content.push(buildTable([
  [{ text: 'الكود', center: true }, { text: 'الوثيقة', center: true }],
  [{ text: 'FIN-001-2026', center: true, bold: true }, { text: 'السياسة المالية واسترداد التبرعات' }],
  [{ text: 'HR-001-2026', center: true, bold: true }, { text: 'إجراء الموارد البشرية والكفاءة' }],
  [{ text: 'IT-001-2026', center: true, bold: true }, { text: 'سياسة البنية التحتية التقنية' }],
  [{ text: 'PUR-001-2026', center: true, bold: true }, { text: 'إجراء المشتريات والموردين' }],
  [{ text: 'QS-001-2026', center: true, bold: true }, { text: 'إجراءات تقديم الخدمات' }],
  [{ text: 'QS-002-2026', center: true, bold: true }, { text: 'إدارة المتطوعين' }],
  [{ text: 'QS-003-2026', center: true, bold: true }, { text: 'إدارة التبرعات' }],
  [{ text: 'QS-004-2026', center: true, bold: true }, { text: 'حماية المستفيدين والشكاوى' }],
], [1800, 7560]));

// المجموعة 3: الحوكمة
content.push(p(''));
content.push(h2('3. الحوكمة والمخاطر'));
content.push(buildTable([
  [{ text: 'الكود', center: true }, { text: 'الوثيقة', center: true }],
  [{ text: 'GOV-001-2026', center: true, bold: true }, { text: 'ميثاق مجلس الإدارة واللجان' }],
  [{ text: 'GOV-002-2026', center: true, bold: true }, { text: 'سياسة الإفصاح والشفافية' }],
  [{ text: 'MR-001-2026', center: true, bold: true }, { text: 'أجندة مراجعة الإدارة' }],
  [{ text: 'MR-002-2026', center: true, bold: true }, { text: 'تقرير مراجعة الإدارة' }],
], [1800, 7560]));

// المجموعة 4: التدقيق والتحسين
content.push(p(''));
content.push(h2('4. التدقيق والتحسين'));
content.push(buildTable([
  [{ text: 'الكود', center: true }, { text: 'الوثيقة', center: true }],
  [{ text: 'CA-001-2026', center: true, bold: true }, { text: 'إجراء عدم المطابقة والإجراءات التصحيحية' }],
  [{ text: 'CA-002-2026', center: true, bold: true }, { text: 'سجل متابعة الإجراءات التصحيحية' }],
  [{ text: 'IA-001-2026', center: true, bold: true }, { text: 'خطة التدقيق الداخلي' }],
  [{ text: 'IA-002-2026', center: true, bold: true }, { text: 'نموذج تقرير التدقيق الداخلي' }],
], [1800, 7560]));

// المجموعة 5: السياسات العامة المنشورة
content.push(p(''));
content.push(h2('5. السياسات العامة المنشورة'));
content.push(buildTable([
  [{ text: 'الكود', center: true }, { text: 'الوثيقة', center: true }],
  [{ text: 'PUB-005-2026', center: true, bold: true }, { text: 'سياسة الإفصاح والشفافية (نسخة عامة)' }],
  [{ text: 'PUB-006-2026', center: true, bold: true }, { text: 'سياسة مكافحة الاحتيال' }],
  [{ text: 'PUB-007-2026', center: true, bold: true }, { text: 'سياسة حماية المستفيدين' }],
  [{ text: 'PUB-008-2026', center: true, bold: true }, { text: 'سياسة استرداد التبرعات' }],
  [{ text: 'PUB-009-2026', center: true, bold: true }, { text: 'السياسة المالية العامة' }],
], [1800, 7560]));

content.push(pageBreak());

// المجموعة 6: المواثيق
content.push(h2('6. المواثيق والسياسات الحوكمية 2026'));
content.push(buildTable([
  [{ text: '#', center: true }, { text: 'الوثيقة', center: true }],
  [{ text: '1', center: true, bold: true }, { text: 'الميثاق الأخلاقي' }],
  [{ text: '2', center: true, bold: true }, { text: 'إقرار تضارب المصالح' }],
  [{ text: '3', center: true, bold: true }, { text: 'اتفاقية السرية' }],
  [{ text: '4', center: true, bold: true }, { text: 'سياسة حماية البيانات الشخصية' }],
  [{ text: '5', center: true, bold: true }, { text: 'سياسة الحماية (Safeguarding)' }],
  [{ text: '6', center: true, bold: true }, { text: 'سياسة مكافحة التحرش' }],
  [{ text: '7', center: true, bold: true }, { text: 'سياسة مكافحة الفساد' }],
  [{ text: '8', center: true, bold: true }, { text: 'سياسة الإبلاغ عن المخالفات (Whistleblowing)' }],
  [{ text: '9', center: true, bold: true }, { text: 'لائحة العمل الداخلية' }],
  [{ text: '10', center: true, bold: true }, { text: 'ميثاق مجلس الإدارة' }],
  [{ text: '11', center: true, bold: true }, { text: 'حقوق ومسؤوليات المستفيد' }],
  [{ text: '12', center: true, bold: true }, { text: 'ميثاق سلوك الموردين' }],
  [{ text: '13', center: true, bold: true }, { text: 'سياسة خصوصية المتبرع' }],
], [1200, 8160]));

// المجموعة 7: خرائط الإجراءات الموحدة
content.push(p(''));
content.push(h2('7. خرائط الإجراءات الموحدة 2026'));
content.push(buildTable([
  [{ text: 'الكود', center: true }, { text: 'الإجراء', center: true }],
  [{ text: 'P-01', center: true, bold: true }, { text: 'إجراء فهم سياق المنظمة' }],
  [{ text: 'P-02', center: true, bold: true }, { text: 'إجراء سياسة وأهداف الجودة' }],
  [{ text: 'P-03', center: true, bold: true }, { text: 'إجراء إدارة المخاطر والفرص' }],
  [{ text: 'P-04', center: true, bold: true }, { text: 'إجراء ضبط الوثائق والسجلات' }],
  [{ text: 'P-05', center: true, bold: true }, { text: 'إجراء الموارد البشرية والكفاءة' }],
  [{ text: 'P-06', center: true, bold: true }, { text: 'إجراء الاتصال الداخلي والخارجي' }],
  [{ text: 'P-07', center: true, bold: true }, { text: 'إجراء التخطيط التشغيلي' }],
  [{ text: 'P-08', center: true, bold: true }, { text: 'إجراء خدمة المستفيدين' }],
  [{ text: 'P-09', center: true, bold: true }, { text: 'إجراء إدارة التبرعات' }],
  [{ text: 'P-10', center: true, bold: true }, { text: 'إجراء المشتريات والموردين' }],
  [{ text: 'P-11', center: true, bold: true }, { text: 'إجراء الشكاوى والرضا' }],
  [{ text: 'P-12', center: true, bold: true }, { text: 'إجراء التدقيق الداخلي' }],
  [{ text: 'P-13', center: true, bold: true }, { text: 'إجراء المراجعة الإدارية' }],
  [{ text: 'P-14', center: true, bold: true }, { text: 'إجراء عدم المطابقة والإجراء التصحيحي' }],
  [{ text: 'P-15', center: true, bold: true }, { text: 'إجراء التحسين المستمر' }],
], [1200, 8160]));

content.push(pageBreak());

// ─── ملخص ───────────────────────────────────────
content.push(h2('ملخص الاعتماد'));

content.push(buildTable([
  [{ text: 'الفئة', center: true }, { text: 'العدد', center: true }],
  [{ text: 'السياسات والأهداف الاستراتيجية' }, { text: '7', center: true, bold: true }],
  [{ text: 'الإجراءات التشغيلية' }, { text: '8', center: true, bold: true }],
  [{ text: 'وثائق الحوكمة والمخاطر' }, { text: '4', center: true, bold: true }],
  [{ text: 'وثائق التدقيق والتحسين' }, { text: '4', center: true, bold: true }],
  [{ text: 'السياسات العامة المنشورة' }, { text: '5', center: true, bold: true }],
  [{ text: 'المواثيق والسياسات الحوكمية' }, { text: '13', center: true, bold: true }],
  [{ text: 'خرائط الإجراءات الموحدة', bold: true }, { text: '15', center: true, bold: true }],
  [{ text: 'الإجمالي', bold: true, color: '1F4E79' }, { text: '56 وثيقة', center: true, bold: true, color: '1F4E79' }],
], [6500, 2860]));

content.push(p(''));

content.push(p(
  'جميع الوثائق المُدرَجة أعلاه محفوظة في نظام إدارة الجودة (QMS) كنسخ إلكترونية معتمدة، ومتاحة للمراجعة والتحقق من قبل الجهات الرقابية والتدقيق الداخلي والخارجي.',
  { italics: true, color: '595959' },
));

content.push(p(''));
content.push(p(''));

// ─── التوقيعات ─────────────────────────────────────
content.push(h2('توقيعات الاعتماد'));

content.push(buildTable([
  [{ text: 'الصفة', center: true }, { text: 'الاسم', center: true }, { text: 'التوقيع والختم', center: true }, { text: 'التاريخ', center: true }],
  [{ text: 'رئيس مجلس الإدارة', center: true, bold: true }, { text: '__________________' }, { text: '', center: true }, { text: '____________', center: true }],
  [{ text: 'نائب رئيس المجلس', center: true, bold: true }, { text: '__________________' }, { text: '', center: true }, { text: '____________', center: true }],
  [{ text: 'أمين السر', center: true, bold: true }, { text: '__________________' }, { text: '', center: true }, { text: '____________', center: true }],
  [{ text: 'المدير التنفيذي', center: true, bold: true }, { text: 'عبدالرحمن عقيل' }, { text: '', center: true }, { text: '____________', center: true }],
], [2200, 3500, 2000, 1660]));

// ─── بناء الوثيقة ────────────────────────────────────
const doc = new Document({
  creator: 'جمعية البر الخيرية بصبيا',
  title: 'ملحق محضر مجلس الإدارة 1-2026',
  description: 'بنود اعتماد الخطة والسياسات',
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: '1F4E79' },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0, alignment: AlignmentType.CENTER, bidirectional: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: '2E75B6' },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1, alignment: AlignmentType.RIGHT, bidirectional: true } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: {
      default: new Header({
        children: [new Paragraph({
          bidirectional: true, alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'ملحق محضر مجلس الإدارة (1-2026) — جمعية البر الخيرية بصبيا', font: FONT, size: 16, color: '595959', rightToLeft: true })],
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

const out = path.join(OUT_DIR, 'ملحق_محضر_مجلس_الإدارة_2026_بنود_الاعتماد.docx');
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(out, buf);
  console.log(`✅ ${out}`);
  console.log(`   ${(buf.length / 1024).toFixed(1)} KB`);
});
