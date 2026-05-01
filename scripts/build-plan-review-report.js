/**
 * تقرير مراجعة الخطة السابقة 2025-2027 ومبررات الخطة الجديدة 2026-2030
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak,
} = require('docx');

const FONT = 'Arial';
const OUT = path.join(__dirname, '..', 'ISO9001', 'الخطط والمشرات', 'تقرير_مراجعة_الخطة_السابقة_ومبررات_التحديث_2026.docx');

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

const p = (text, opts = {}) => new Paragraph({
  bidirectional: true,
  alignment: opts.alignment || AlignmentType.RIGHT,
  spacing: { before: opts.before || 80, after: opts.after || 80 },
  children: [new TextRun({ text, font: FONT, size: opts.size || 22, bold: opts.bold, color: opts.color, italics: opts.italics, rightToLeft: true })],
});
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1, bidirectional: true, alignment: AlignmentType.CENTER,
  spacing: { before: 360, after: 240 },
  children: [new TextRun({ text, font: FONT, size: 30, bold: true, color: '1F4E79', rightToLeft: true })],
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2, bidirectional: true, alignment: AlignmentType.RIGHT,
  spacing: { before: 240, after: 160 },
  children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: '2E75B6', rightToLeft: true })],
});
const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3, bidirectional: true, alignment: AlignmentType.RIGHT,
  spacing: { before: 160, after: 100 },
  children: [new TextRun({ text, font: FONT, size: 22, bold: true, color: '2E75B6', rightToLeft: true })],
});
const cell = (text, opts = {}) => new TableCell({
  borders: cellBorders, width: { size: opts.width || 2000, type: WidthType.DXA },
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  margins: { top: 80, bottom: 80, left: 100, right: 100 },
  children: [new Paragraph({
    bidirectional: true, alignment: opts.center ? AlignmentType.CENTER : AlignmentType.RIGHT,
    children: [new TextRun({ text: String(text || ''), font: FONT, size: opts.size || 18, bold: opts.bold, color: opts.color, rightToLeft: true })],
  })],
});
const buildTable = (rows, columnWidths) => new Table({
  width: { size: columnWidths.reduce((a,b)=>a+b,0), type: WidthType.DXA },
  columnWidths,
  rows: rows.map((row, idx) => new TableRow({
    children: row.map((c, i) => cell(c.text, { ...c, width: columnWidths[i],
      fill: idx === 0 ? '1F4E79' : c.fill, bold: idx === 0 || c.bold,
      color: idx === 0 ? 'FFFFFF' : c.color })),
  })),
});
const pb = () => new Paragraph({ children: [new PageBreak()] });

const c = [];

// ─── الغلاف ──────────────────────────────
c.push(p('بسم الله الرحمن الرحيم', { alignment: AlignmentType.CENTER, bold: true, size: 28, color: '1F4E79', before: 1200 }));
c.push(p('جمعية البر الخيرية بصبيا', { alignment: AlignmentType.CENTER, bold: true, size: 36, color: '1F4E79', before: 480 }));
c.push(p('', { before: 240 }));
c.push(p('تقرير مراجعة الخطة الاستراتيجية السابقة', { alignment: AlignmentType.CENTER, bold: true, size: 32, color: '2E75B6', before: 240 }));
c.push(p('(2025-2027م)', { alignment: AlignmentType.CENTER, bold: true, size: 28, color: '2E75B6' }));
c.push(p('ومبررات إعداد الخطة الجديدة', { alignment: AlignmentType.CENTER, bold: true, size: 28, color: '2E75B6' }));
c.push(p('(2026-2030م)', { alignment: AlignmentType.CENTER, bold: true, size: 28, color: '2E75B6' }));
c.push(p('', { before: 720 }));
c.push(p('مُعَدّ من: الإدارة التنفيذية', { alignment: AlignmentType.CENTER, size: 22 }));
c.push(p('للعرض على: مجلس الإدارة', { alignment: AlignmentType.CENTER, size: 22 }));
c.push(p('التاريخ: __ / 05 / 2026م', { alignment: AlignmentType.CENTER, size: 22, color: '595959' }));

c.push(pb());

// ─── 1. الملخص التنفيذي ─────────────────────
c.push(h1('1. الملخص التنفيذي'));
c.push(p('يقدّم هذا التقرير مراجعة موضوعية للخطة الاستراتيجية السابقة لجمعية البر الخيرية بصبيا للفترة 2025-2027م، ويستعرض أداءها التطبيقي خلال العام 2025م، ويُحدد المبررات الموضوعية لإعداد خطة استراتيجية جديدة للفترة 2026-2030م.'));
c.push(p('يخلص التقرير إلى أن إعداد الخطة الجديدة قرار مؤسسي ناضج ومبرَّر، يستجيب لمتطلبات رؤية المملكة 2030، ولتطور القدرات المؤسسية للجمعية، ولمتطلبات المواصفة الدولية ISO 9001:2015 التي تستوجب التحديث الدوري للأهداف الاستراتيجية.'));

c.push(p(''));
c.push(p('ولا تُلغي الخطة الجديدة الخطة السابقة بل تبني عليها، حيث تُرحّل المبادرات قيد التنفيذ، وتستثمر الإنجازات المُحقَّقة، وتعالج الفجوات التي رصدتها مراجعة الأداء.', { italics: true, color: '595959' }));

// ─── 2. تقييم الخطة السابقة ─────────────────
c.push(h1('2. تقييم الخطة الاستراتيجية السابقة (2025-2027م)'));

c.push(h2('2.1 الإطار العام للخطة السابقة'));
c.push(buildTable([
  [{ text: 'البند', center: true }, { text: 'القيمة', center: true }],
  [{ text: 'مرجع الاعتماد', bold: true }, { text: 'محضر مجلس الإدارة رقم (___) — 11/2024م' }],
  [{ text: 'الإطار الزمني', bold: true }, { text: '3 سنوات (2025-2027م)' }],
  [{ text: 'عدد المحاور', bold: true }, { text: '7 محاور' }],
  [{ text: 'عدد الأهداف الاستراتيجية', bold: true }, { text: 'متعدد' }],
  [{ text: 'الميزانية الإجمالية المقترحة', bold: true }, { text: '~12.5 مليون ريال' }],
  [{ text: 'منهج المتابعة', bold: true }, { text: 'يدوي ودوري' }],
], [3000, 6360]));

c.push(h2('2.2 تقييم الأداء — العام 2025م'));
c.push(p('بعد استعراض التقرير المالي 2025م الفعلي ومراجعة تنفيذ الأهداف، تم رصد ما يلي:'));

c.push(h3('أ. الإنجازات المُحقَّقة'));
c.push(buildTable([
  [{ text: 'المجال', center: true }, { text: 'الإنجاز', center: true }],
  [{ text: 'الإيرادات' }, { text: 'تحقيق إيرادات قدرها 11,309,157 ريال (فائض 667,806 ريال)' }],
  [{ text: 'البرامج التشغيلية' }, { text: 'استمرار خدمة [____] أسرة مستفيدة وكفالة [____] يتيماً' }],
  [{ text: 'المعاهد' }, { text: 'إيرادات معاهد شعاع المعالي 409,685 ريال' }],
  [{ text: 'البنية المؤسسية' }, { text: 'بناء نواة نظام إدارة الجودة الإلكتروني (QMS)' }],
  [{ text: 'الحوكمة' }, { text: 'تطوير منظومة شاملة من السياسات واللوائح' }],
], [2400, 6960]));

c.push(h3('ب. الفجوات والتحديات'));
c.push(p('• محدودية تتبع الأهداف الكمية بسبب غياب نظام رقمي موحَّد', { size: 22 }));
c.push(p('• تفاوت في تنفيذ بعض المؤشرات الفرعية بين الإدارات', { size: 22 }));
c.push(p('• الحاجة إلى ترميز وتوحيد المؤشرات والمستهدفات السنوية', { size: 22 }));
c.push(p('• تطور المتطلبات التنظيمية (Bayanat، NCNP، GASTAT) الذي يستوجب تحديثاً', { size: 22 }));

c.push(pb());

// ─── 3. المبررات السبعة ─────────────────────
c.push(h1('3. المبررات الموضوعية لإعداد الخطة الجديدة'));

c.push(h2('المبرر الأول: المواءمة مع رؤية المملكة 2030'));
c.push(p('الخطة السابقة (2025-2027م) ثلاثية الأمد، بينما الخطة الجديدة (2026-2030م) تنتهي بنهاية رؤية المملكة 2030، تحقيقاً للمواءمة الكاملة مع المرتكزات الوطنية للقطاع غير الربحي وأهداف الرؤية الوطنية.'));

c.push(h2('المبرر الثاني: متطلبات المركز الوطني لتنمية القطاع غير الربحي (NCNP)'));
c.push(p('يوصي المركز الوطني بإطار خماسي للخطط الاستراتيجية للجمعيات الأهلية بدلاً من الإطار الثلاثي، لتعزيز الاستقرار التخطيطي والتوافق مع دورات التقييم الوطنية.'));

c.push(h2('المبرر الثالث: نتائج مراجعة الأداء 2025م'));
c.push(p('بعد تقييم تنفيذ الخطة السابقة خلال 2025م، تبيَّن وجود فرص لتحسين هيكل المحاور (من 7 إلى 4 محاور مُركَّزة)، وضرورة إدراج أولويات جديدة لم تكن قائمة عند صياغة الخطة السابقة (التحول الرقمي، الاستدامة المالية المتقدمة، حوكمة البيانات).'));

c.push(h2('المبرر الرابع: التطور المؤسسي ونظام إدارة الجودة الرقمي'));
c.push(p('صيغت الخطة السابقة قبل تطوير نظام إدارة الجودة الإلكتروني (QMS). الخطة الجديدة مبنية أصلاً على هذا النظام، مع مؤشرات أداء قابلة للقياس الآلي ومتابعة لحظية، مما يُحقق نقلة نوعية في إدارة الأداء.'));

c.push(h2('المبرر الخامس: متطلبات المواصفة الدولية ISO 9001:2015'));
c.push(p('السعي للحصول على شهادة ISO 9001:2015 يستوجب الالتزام بـ:'));
c.push(p('• البند 6.2.2: تحديث الأهداف الاستراتيجية عند تغيُّر الظروف', { size: 22 }));
c.push(p('• البند 9.3: إجراء مراجعة إدارية تُولّد قرارات تحسين', { size: 22 }));
c.push(p('• البند 10.3: التحسين المستمر كثقافة مؤسسية', { size: 22 }));
c.push(p('انتقال الجمعية للخطة الجديدة هو تطبيق عملي مباشر لهذه البنود.', { italics: true }));

c.push(h2('المبرر السادس: تحديث خط الأساس المالي'));
c.push(p('التقرير المالي 2025م الفعلي (إيرادات 11.3M ريال، فائض 667K ريال، موارد ذاتية 8.5%) أنتج بيانات لم تكن متاحة وقت إعداد الخطة السابقة. هذا الواقع المالي الجديد يستوجب إعادة معايرة المستهدفات والمؤشرات لتنطلق من خط أساس فعلي لا تقديري.'));

c.push(h2('المبرر السابع: الاستجابة للمستجدات التشريعية'));
c.push(p('شهد القطاع غير الربحي خلال 2025م مستجدات تشريعية ومؤسسية متعددة (منظومة Bayanat للبيانات، تحديثات NCNP، اشتراطات شهادة Z، متطلبات حماية البيانات الشخصية، التقارير الإلزامية لـ GASTAT) — استوجبت تحديث الإطار الاستراتيجي ليتوافق معها.'));

c.push(pb());

// ─── 4. الفروقات بين الخطتين ───────────────
c.push(h1('4. مقارنة بين الخطة السابقة والخطة الجديدة'));

c.push(buildTable([
  [{ text: 'البند', center: true }, { text: 'الخطة السابقة 2025-2027م', center: true }, { text: 'الخطة الجديدة 2026-2030م', center: true }],
  [{ text: 'الإطار الزمني', bold: true }, { text: '3 سنوات', center: true }, { text: '5 سنوات (متوافق مع رؤية 2030)', center: true }],
  [{ text: 'عدد المحاور', bold: true }, { text: '7 محاور متعددة', center: true }, { text: '4 محاور مركَّزة', center: true }],
  [{ text: 'الأهداف الاستراتيجية', bold: true }, { text: 'متعددة بدون ترميز موحَّد', center: true }, { text: '8 أهداف بترميز STR-2026-XXX', center: true }],
  [{ text: 'الأهداف التشغيلية', bold: true }, { text: '163 نشاط (تفصيلي مفرط)', center: true }, { text: '19 هدف تشغيلي مُركَّز', center: true }],
  [{ text: 'المؤشرات', bold: true }, { text: 'متعددة بدون نظام', center: true }, { text: '16 مؤشر بترميز IND-2026-XXX', center: true }],
  [{ text: 'المستهدفات السنوية', bold: true }, { text: 'سنوية فقط للسنة الحالية', center: true }, { text: '80 مستهدف (16 × 5 سنوات)', center: true }],
  [{ text: 'المبادرات', bold: true }, { text: '58 مبادرة', center: true }, { text: '21 مبادرة فعّالة', center: true }],
  [{ text: 'منهج المتابعة', bold: true }, { text: 'يدوي/دوري', center: true }, { text: 'إلكتروني (QMS) فوري', center: true }],
  [{ text: 'المواءمة مع رؤية 2030', bold: true }, { text: 'جزئية', center: true }, { text: 'كاملة', center: true }],
  [{ text: 'مرجع البيانات المالية', bold: true }, { text: 'تقديرات', center: true }, { text: 'تقرير 2025م الفعلي', center: true }],
  [{ text: 'المواءمة مع ISO 9001', bold: true }, { text: 'غير مُتطابقة بالكامل', center: true }, { text: 'مُتطابقة بالكامل', center: true }],
], [2200, 3500, 3660]));

// ─── 5. الاستمرارية ───────────────────────
c.push(h1('5. مبدأ الاستمرارية — لا قطيعة'));

c.push(p('تُؤكّد الإدارة التنفيذية أن الخطة الجديدة لا تُلغي الخطة السابقة بل تستكملها وتطوّرها. وفيما يلي عناصر الاستمرارية:'));

c.push(h2('5.1 ما يُرحَّل من الخطة السابقة'));
c.push(p('• المبادرات قيد التنفيذ (مثل: تشغيل Rafid ERP، توزيع السلال الغذائية، كفالة الأيتام)', { size: 22 }));
c.push(p('• الخبرات المتراكمة في إدارة البرامج', { size: 22 }));
c.push(p('• قاعدة المستفيدين والشركاء القائمة', { size: 22 }));
c.push(p('• الإنجازات المؤسسية (نواة نظام الجودة)', { size: 22 }));

c.push(h2('5.2 ما يُؤرشف'));
c.push(p('• البنية الإطارية القديمة (7 محاور) — تُحفظ كمرجع تاريخي في الأرشيف الرقمي', { size: 22 }));
c.push(p('• المؤشرات السابقة — تُؤرشف بعد نقل الفعّال منها للبنية الجديدة', { size: 22 }));
c.push(p('• الميزانية التقديرية القديمة — تُحفظ مع التقرير المالي 2025م', { size: 22 }));

c.push(h2('5.3 ما يُضاف جديداً'));
c.push(p('• مسار التحول الرقمي والذكاء المؤسسي (محور كامل)', { size: 22 }));
c.push(p('• مؤشرات أداء قابلة للقياس الآلي عبر QMS', { size: 22 }));
c.push(p('• مستهدفات سنوية ممتدة لخمس سنوات (لا سنة واحدة)', { size: 22 }));
c.push(p('• ربط مباشر مع متطلبات ISO 9001:2015', { size: 22 }));
c.push(p('• خطة الحصول على شهادات الاعتماد (ISO + Z + Bayanat)', { size: 22 }));

// ─── 6. التوصية النهائية ──────────────────
c.push(h1('6. التوصية النهائية'));

c.push(p('بناءً على التقييم الموضوعي للخطة السابقة، والمبررات السبعة المذكورة، توصي الإدارة التنفيذية مجلس الإدارة الموقَّر بـ:'));

c.push(p(''));
c.push(p('1. اعتماد الخطة الاستراتيجية الجديدة 2026-2030م كإطار رسمي ملزم.', { bold: true, size: 22 }));
c.push(p('2. الإقرار بإنهاء الخطة السابقة 2025-2027م مع أرشفتها كمرجع تاريخي.', { bold: true, size: 22 }));
c.push(p('3. تفويض الإدارة التنفيذية بإحالة المبادرات قيد التنفيذ إلى البنية الجديدة.', { bold: true, size: 22 }));
c.push(p('4. اعتماد منظومة المتابعة الربعية عبر نظام QMS.', { bold: true, size: 22 }));
c.push(p('5. تكليف الإدارة التنفيذية بإكمال متطلبات الحصول على شهادة ISO 9001:2015 خلال العام 2026م.', { bold: true, size: 22 }));

c.push(p(''));
c.push(p(''));
c.push(p('تقبّلوا فائق التقدير والاحترام،', { alignment: AlignmentType.CENTER, before: 240 }));
c.push(p(''));
c.push(p(''));
c.push(p('عبدالرحمن عقيل', { alignment: AlignmentType.CENTER, bold: true, size: 24 }));
c.push(p('المدير التنفيذي', { alignment: AlignmentType.CENTER, size: 22 }));
c.push(p('جمعية البر الخيرية بصبيا', { alignment: AlignmentType.CENTER, color: '595959', size: 20 }));

const doc = new Document({
  creator: 'جمعية البر الخيرية بصبيا',
  title: 'تقرير مراجعة الخطة السابقة ومبررات التحديث',
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: FONT, color: '1F4E79' },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0, alignment: AlignmentType.CENTER, bidirectional: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: '2E75B6' },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1, alignment: AlignmentType.RIGHT, bidirectional: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: FONT, color: '2E75B6' },
        paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2, alignment: AlignmentType.RIGHT, bidirectional: true } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: c,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log(`✅ ${OUT}`);
  console.log(`   ${(buf.length / 1024).toFixed(1)} KB`);
});
