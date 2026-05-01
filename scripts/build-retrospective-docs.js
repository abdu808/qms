/**
 * بناء وثائق التوثيق الاستدراكي المشروع
 * 1. مذكرة المدير التنفيذي للمجلس - يناير 2026
 * 2. سجل القرارات الإدارية التنفيذية 2026
 * 3. الصياغة المحدثة لمحضر مايو 2026
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak,
} = require('docx');

const FONT = 'Arial';
const OUT_DIR = path.join(__dirname, '..', 'ISO9001', 'الخطط والمشرات');

// ─── Helpers ──────────────────────────────────────────
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

const p = (text, opts = {}) => new Paragraph({
  bidirectional: true,
  alignment: opts.alignment || AlignmentType.RIGHT,
  spacing: { before: opts.before || 80, after: opts.after || 80 },
  children: [new TextRun({
    text, font: FONT, size: opts.size || 22,
    bold: opts.bold, color: opts.color, italics: opts.italics,
    rightToLeft: true,
  })],
});

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  bidirectional: true, alignment: AlignmentType.CENTER,
  spacing: { before: 360, after: 240 },
  children: [new TextRun({ text, font: FONT, size: 32, bold: true, color: '1F4E79', rightToLeft: true })],
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  bidirectional: true, alignment: AlignmentType.RIGHT,
  spacing: { before: 240, after: 160 },
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

const baseStyles = {
  default: { document: { run: { font: FONT, size: 22 } } },
  paragraphStyles: [
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 32, bold: true, font: FONT, color: '1F4E79' },
      paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0, alignment: AlignmentType.CENTER, bidirectional: true } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 26, bold: true, font: FONT, color: '2E75B6' },
      paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1, alignment: AlignmentType.RIGHT, bidirectional: true } },
  ],
};
const baseSection = (children) => ({
  properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
  children,
});

// ═══════════════════════════════════════════════════════════════
// ─── الوثيقة 1: مذكرة المدير التنفيذي للمجلس ───────────────────
// ═══════════════════════════════════════════════════════════════
const memo = [];

memo.push(p('بسم الله الرحمن الرحيم', { alignment: AlignmentType.CENTER, bold: true, size: 28, color: '1F4E79', before: 0 }));
memo.push(p('جمعية البر الخيرية بصبيا', { alignment: AlignmentType.CENTER, bold: true, size: 32, color: '1F4E79', before: 240 }));
memo.push(p('الإدارة التنفيذية', { alignment: AlignmentType.CENTER, color: '595959', size: 20 }));

memo.push(new Paragraph({
  border: { bottom: { color: '2E75B6', size: 12, style: BorderStyle.SINGLE } },
  spacing: { before: 240, after: 240 },
  children: [],
}));

memo.push(p('المرجع: مذكرة (1) — 2026', { bold: true, size: 22 }));
memo.push(p('التاريخ: __ / 01 / 2026م', { bold: true, size: 22 }));
memo.push(p('من: المدير التنفيذي — عبدالرحمن عقيل', { size: 22 }));
memo.push(p('إلى: السادة أعضاء مجلس الإدارة الموقّرين', { size: 22 }));
memo.push(p('الموضوع: تقرير عن انطلاق مشروع تطوير نظام إدارة الجودة وبناء الخطة الاستراتيجية الجديدة', { bold: true, size: 22, color: '1F4E79' }));

memo.push(p(''));
memo.push(p('السلام عليكم ورحمة الله وبركاته،', { bold: true, size: 22 }));
memo.push(p(''));

memo.push(p('عطفاً على قرار المجلس في محضره رقم (___) بتاريخ __/11/2024م الذي اعتمد الخطة الاستراتيجية السابقة للفترة 2025-2027م، يسرّني أن أرفع لمعاليكم تقريراً عن انطلاق مشروع تطوير منظومة العمل المؤسسي للجمعية، الذي يهدف إلى مراجعة شاملة للأداء التشغيلي والمالي للعام 2025م وإعداد خطة جديدة للسنوات الخمس القادمة، والذي يشمل ثلاثة مسارات متوازية:'));

memo.push(p(''));
memo.push(h2('أولاً: تطوير نظام إدارة الجودة (QMS)'));
memo.push(p('بناء نظام إلكتروني متكامل لإدارة الجودة وفقاً لمتطلبات المواصفة الدولية ISO 9001:2015، يربط بين السياسات والإجراءات والأهداف والمؤشرات والمبادرات في منصة واحدة، ويُتيح المتابعة الآلية والإبلاغ الدوري للمجلس.'));

memo.push(h2('ثانياً: إعادة بناء الخطة الاستراتيجية'));
memo.push(p('مراجعة شاملة للوضع الراهن للجمعية واعتماد خطة استراتيجية جديدة للسنوات الخمس القادمة (2026-2030م)، تستند إلى:'));
memo.push(p('  • التقرير المالي الفعلي للعام 2025م', { size: 22 }));
memo.push(p('  • مراجعة الأداء التشغيلي للعام السابق', { size: 22 }));
memo.push(p('  • تحديد محاور وأولويات المرحلة القادمة', { size: 22 }));
memo.push(p('  • مواءمة الخطة مع رؤية المملكة 2030 ومتطلبات المركز الوطني لتنمية القطاع غير الربحي', { size: 22 }));

memo.push(h2('ثالثاً: تطوير حزمة السياسات والإجراءات'));
memo.push(p('إعداد مجموعة شاملة من السياسات واللوائح والإجراءات تشمل: سياسات الحوكمة، نظام الجودة، حماية الفئات، الإجراءات التشغيلية، أُطر المراجعة والتدقيق، والسياسات العامة المنشورة.'));

memo.push(p(''));
memo.push(h2('الجدول الزمني المتوقع'));
memo.push(buildTable([
  [{ text: 'المرحلة', center: true }, { text: 'الإنجاز المتوقع', center: true }],
  [{ text: 'Q1 2026', center: true, bold: true }, { text: 'بناء النظام الإلكتروني وإطار السياسات' }],
  [{ text: 'Q2 2026', center: true, bold: true }, { text: 'إكمال الخطة الاستراتيجية ورفعها للمجلس' }],
  [{ text: 'Q2-Q3 2026', center: true, bold: true }, { text: 'الحصول على شهادة ISO 9001:2015' }],
], [2400, 6960]));

memo.push(p(''));
memo.push(p('سيتم رفع المخرجات النهائية لمعاليكم لاعتمادها وفق الإجراءات النظامية فور اكتمالها.'));
memo.push(p(''));
memo.push(p('تقبّلوا فائق التقدير والاحترام،', { alignment: AlignmentType.CENTER, before: 240 }));
memo.push(p(''));
memo.push(p(''));
memo.push(p('عبدالرحمن عقيل', { alignment: AlignmentType.CENTER, bold: true, size: 24 }));
memo.push(p('المدير التنفيذي', { alignment: AlignmentType.CENTER, size: 22 }));
memo.push(p('جمعية البر الخيرية بصبيا', { alignment: AlignmentType.CENTER, color: '595959', size: 20 }));

const memoDoc = new Document({
  creator: 'جمعية البر الخيرية بصبيا',
  title: 'مذكرة المدير التنفيذي - يناير 2026',
  styles: baseStyles,
  sections: [baseSection(memo)],
});

Packer.toBuffer(memoDoc).then(buf => {
  fs.writeFileSync(path.join(OUT_DIR, '1_مذكرة_المدير_التنفيذي_يناير_2026.docx'), buf);
  console.log(`✅ الوثيقة 1: مذكرة المدير التنفيذي يناير 2026 (${(buf.length/1024).toFixed(1)} KB)`);
});

// ═══════════════════════════════════════════════════════════════
// ─── الوثيقة 2: سجل القرارات الإدارية التنفيذية ────────────────
// ═══════════════════════════════════════════════════════════════
const log = [];

log.push(p('بسم الله الرحمن الرحيم', { alignment: AlignmentType.CENTER, bold: true, size: 28, color: '1F4E79', before: 0 }));
log.push(p('جمعية البر الخيرية بصبيا', { alignment: AlignmentType.CENTER, bold: true, size: 30, color: '1F4E79', before: 240 }));

log.push(new Paragraph({
  border: { bottom: { color: '2E75B6', size: 12, style: BorderStyle.SINGLE } },
  spacing: { before: 200, after: 240 },
  children: [],
}));

log.push(h1('سجل القرارات الإدارية التنفيذية'));
log.push(p('العام 2026م', { alignment: AlignmentType.CENTER, bold: true, size: 26, color: '2E75B6' }));

log.push(p(''));
log.push(p('سجل تراكمي بالقرارات التنفيذية الصادرة عن المدير التنفيذي ضمن صلاحياته الإدارية والتشغيلية، وفقاً لميثاق المجلس واللوائح المنظِّمة لعمل الجمعية.', { italics: true, color: '595959' }));
log.push(p(''));

log.push(h2('سجل القرارات'));
log.push(buildTable([
  [{ text: 'م', center: true }, { text: 'التاريخ', center: true }, { text: 'القرار', center: true }, { text: 'المرجع/المسوّغ', center: true }, { text: 'التوقيع', center: true }],
  [{ text: '1', center: true, bold: true }, { text: '__/01/2026', center: true }, { text: 'تكليف مدير الجودة بإعداد خطة بناء نظام إدارة الجودة الإلكتروني وفق ISO 9001:2015' }, { text: 'الصلاحيات الإدارية', center: true }, { text: '' }],
  [{ text: '2', center: true, bold: true }, { text: '__/01/2026', center: true }, { text: 'تشكيل لجنة داخلية لمراجعة الوضع الراهن وإعداد مسوّدة الخطة الاستراتيجية 2026-2030' }, { text: 'الصلاحيات الإدارية', center: true }, { text: '' }],
  [{ text: '3', center: true, bold: true }, { text: '__/02/2026', center: true }, { text: 'تكليف رؤساء الإدارات بمراجعة إجراءاتهم التشغيلية وإعداد مسودات السياسات والإجراءات' }, { text: 'الصلاحيات الإدارية', center: true }, { text: '' }],
  [{ text: '4', center: true, bold: true }, { text: '__/02/2026', center: true }, { text: 'اعتماد مبدئي للهيكل الجديد لنظام الجودة وقواعد التوثيق الرشيق' }, { text: 'الصلاحيات الإدارية', center: true }, { text: '' }],
  [{ text: '5', center: true, bold: true }, { text: '__/03/2026', center: true }, { text: 'اعتماد المسوّدة الأولى لحزمة السياسات والإجراءات لمراجعتها داخلياً' }, { text: 'الصلاحيات الإدارية', center: true }, { text: '' }],
  [{ text: '6', center: true, bold: true }, { text: '__/03/2026', center: true }, { text: 'تكليف فريق العمل بإعداد التقرير المالي 2025م كأساس لخط الأساس في الخطة الاستراتيجية' }, { text: 'الصلاحيات الإدارية', center: true }, { text: '' }],
  [{ text: '7', center: true, bold: true }, { text: '__/04/2026', center: true }, { text: 'اعتماد الإصدار الأول لنظام إدارة الجودة الإلكتروني QMS وإطلاقه للاختبار التشغيلي' }, { text: 'الصلاحيات الإدارية', center: true }, { text: '' }],
  [{ text: '8', center: true, bold: true }, { text: '__/04/2026', center: true }, { text: 'إحالة الخطة الاستراتيجية وحزمة السياسات إلى مجلس الإدارة لاعتمادها النهائي' }, { text: 'الصلاحيات الإدارية', center: true }, { text: '' }],
  [{ text: '9', center: true, bold: true }, { text: '__/__/____', center: true }, { text: '' }, { text: '', center: true }, { text: '' }],
  [{ text: '10', center: true, bold: true }, { text: '__/__/____', center: true }, { text: '' }, { text: '', center: true }, { text: '' }],
], [600, 1500, 4760, 1500, 1000]));

log.push(p(''));
log.push(p('ملاحظات:', { bold: true, color: '1F4E79' }));
log.push(p('• هذا السجل تراكمي مفتوح، تُضاف إليه القرارات الجديدة بتسلسلها الزمني.', { size: 20 }));
log.push(p('• يُحفظ السجل في وحدة Documents بنظام إدارة الجودة (QMS) كنسخة إلكترونية معتمدة.', { size: 20 }));
log.push(p('• يُرفع نسخة منه لمجلس الإدارة بصفة دورية للعلم والمتابعة.', { size: 20 }));

log.push(p(''));
log.push(p('عبدالرحمن عقيل', { alignment: AlignmentType.CENTER, bold: true, size: 24, before: 480 }));
log.push(p('المدير التنفيذي', { alignment: AlignmentType.CENTER, size: 22 }));

const logDoc = new Document({
  creator: 'جمعية البر الخيرية بصبيا',
  title: 'سجل القرارات الإدارية التنفيذية 2026',
  styles: baseStyles,
  sections: [baseSection(log)],
});

Packer.toBuffer(logDoc).then(buf => {
  fs.writeFileSync(path.join(OUT_DIR, '2_سجل_القرارات_الإدارية_التنفيذية_2026.docx'), buf);
  console.log(`✅ الوثيقة 2: سجل القرارات الإدارية (${(buf.length/1024).toFixed(1)} KB)`);
});

// ═══════════════════════════════════════════════════════════════
// ─── الوثيقة 3: محضر مايو 2026 المُحدَّث ───────────────────────
// ═══════════════════════════════════════════════════════════════
const minutes = [];

minutes.push(p('بسم الله الرحمن الرحيم', { alignment: AlignmentType.CENTER, bold: true, size: 28, color: '1F4E79', before: 0 }));
minutes.push(p('جمعية البر الخيرية بصبيا', { alignment: AlignmentType.CENTER, bold: true, size: 32, color: '1F4E79', before: 240 }));
minutes.push(p('ملحق محضر اجتماع مجلس الإدارة رقم (___) لعام 2026م', { alignment: AlignmentType.CENTER, bold: true, size: 24 }));
minutes.push(p('بنود اعتماد الخطة الاستراتيجية وحزمة السياسات', { alignment: AlignmentType.CENTER, color: '595959', size: 22 }));

minutes.push(new Paragraph({
  border: { bottom: { color: '2E75B6', size: 12, style: BorderStyle.SINGLE } },
  spacing: { before: 240, after: 240 },
  children: [],
}));

// ─── فقرة تمهيدية ─────────────────────────────────────
minutes.push(h2('تمهيد'));
minutes.push(p('عطفاً على قرار المجلس في محضره رقم (___) بتاريخ __/11/2024م الذي اعتمد الخطة الاستراتيجية السابقة للفترة 2025-2027م، وبعد مراجعة شاملة للأداء التشغيلي والمالي والمؤسسي للعام 2025م، استعرض المجلس العمل التحضيري الذي أنجزته الإدارة التنفيذية ومدير الجودة خلال الفترة من يناير إلى أبريل 2026م — ضمن صلاحياتهما التنفيذية وبناءً على المذكرات الإدارية وسجل القرارات التنفيذية المعروضة على المجلس — والذي شمل:'));
minutes.push(p('  •  مراجعة الوضع المؤسسي والتشغيلي والمالي للجمعية لعام 2025م.', { size: 22 }));
minutes.push(p('  •  بناء نظام إدارة الجودة الإلكتروني (QMS) وفق متطلبات ISO 9001:2015.', { size: 22 }));
minutes.push(p('  •  تطوير حزمة شاملة من السياسات واللوائح والإجراءات.', { size: 22 }));
minutes.push(p('  •  صياغة الخطة الاستراتيجية للسنوات 2026-2030م بأهدافها الاستراتيجية والتشغيلية ومؤشراتها ومستهدفاتها السنوية ومبادراتها الفعّالة.', { size: 22 }));
minutes.push(p('  •  مواءمة كامل العمل مع رؤية المملكة 2030 والمتطلبات التنظيمية للمركز الوطني لتنمية القطاع غير الربحي.', { size: 22 }));

minutes.push(p(''));
minutes.push(p('وبعد المناقشة المستفيضة، اعتمد المجلس البنود التالية:', { bold: true }));

minutes.push(p(''));

// ─── البند الأول ─────────────────────────────────────
minutes.push(h2('البند رقم (___): اعتماد الخطة الاستراتيجية للجمعية 2026-2030م'));
minutes.push(p('استعرض المجلس مشروع الخطة الاستراتيجية لجمعية البر الخيرية بصبيا للفترة 2026-2030م، والمبني على مراجعة الوضع المؤسسي والتشغيلي والمالي للجمعية لعام 2025م، وقرر اعتمادها كمرجع رسمي للتخطيط والمتابعة من تاريخ هذا القرار، وتحلّ محلّ الخطة السابقة 2025-2027م المعتمدة في محضر (___) بتاريخ __/11/2024م.'));
minutes.push(p('وتُعد هذه الخطة الإطار الاستراتيجي المعتمد للجمعية، مع استمرار إعداد الخطط التشغيلية السنوية المنبثقة عنها.'));
minutes.push(p('كما فوّض المجلس المدير التنفيذي بمتابعة التنفيذ عبر نظام إدارة الجودة QMS، ورفع تقرير ربعي للمجلس عن مستوى الإنجاز والانحرافات والإجراءات التصحيحية.'));

minutes.push(p(''));

// ─── البند الثاني ─────────────────────────────────────
minutes.push(h2('البند رقم (___): اعتماد حزمة السياسات واللوائح والإجراءات المنظمة للحوكمة ونظام الجودة'));
minutes.push(p('استعرض المجلس حزمة السياسات واللوائح والإجراءات المنظمة لأعمال الجمعية، والمتعلقة بالحوكمة والامتثال ونظام إدارة الجودة، وقرر اعتمادها كمرجع رسمي للعمل المؤسسي داخل الجمعية، وفق القائمة المرفقة بهذا المحضر.'));
minutes.push(p('كما فوّض المجلس المدير التنفيذي ومدير الجودة بتحديث النماذج والإجراءات التشغيلية غير الجوهرية عند الحاجة.'));
minutes.push(p('وتُعرض أي تعديلات جوهرية على السياسات أو اللوائح على المجلس لاعتمادها وفق الإجراءات النظامية.'));

minutes.push(p(''));
minutes.push(p('والله الموفّق،', { alignment: AlignmentType.CENTER, bold: true, color: '1F4E79' }));

const minutesDoc = new Document({
  creator: 'جمعية البر الخيرية بصبيا',
  title: 'ملحق محضر مجلس الإدارة - مايو 2026 المُحدَّث',
  styles: baseStyles,
  sections: [baseSection(minutes)],
});

Packer.toBuffer(minutesDoc).then(buf => {
  fs.writeFileSync(path.join(OUT_DIR, '3_ملحق_محضر_مجلس_الإدارة_2026_بتمهيد_العمل_السابق.docx'), buf);
  console.log(`✅ الوثيقة 3: ملحق محضر مايو 2026 (${(buf.length/1024).toFixed(1)} KB)`);
});
