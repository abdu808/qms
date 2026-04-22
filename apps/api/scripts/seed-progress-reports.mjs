/**
 * seed-progress-reports.mjs — بذر بيانات تجريبية لنظام المحقق الشهري
 *
 * يُنشئ تقارير متنوعة الدرجات (متميِّز / مستقر / منذر / متعثِّر) لآخر 3 أشهر
 * مع إجابات وهمية على أسئلة التحقيق، وقيم KPI، وعلامات تحقيق.
 *
 * Idempotent: يتخطى إذا التقرير موجود.
 * تشغيل: node scripts/seed-progress-reports.mjs
 */
import { PrismaClient } from '@prisma/client';
import { generateReport, scoreReport } from '../src/services/progressReportService.js';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

function prevMonth(year, month, n) {
  const d = new Date(year, month - 1 - n, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// استراتيجيات ملء لإنتاج درجات متدرِّجة
const FILL_STRATEGIES = [
  { name: 'excellent', kpiMultiplier: 1.05, answerQuality: 'full',  freeText: 'الشهر سار كما خُطط له بالكامل. تحقّقت جميع المؤشرات وتمّت معالجة الملاحظات السابقة.' },
  { name: 'stable',    kpiMultiplier: 0.92, answerQuality: 'full',  freeText: 'أداء مستقر، بعض التأخّر في نشاط واحد بسبب ظروف تشغيلية عادية.' },
  { name: 'warning',   kpiMultiplier: 0.70, answerQuality: 'partial', freeText: 'واجهنا ضغوطاً في الموارد أدّت إلى تأخير بعض المؤشرات.' },
  { name: 'distressed',kpiMultiplier: 0.40, answerQuality: 'empty',   freeText: '' },
];

async function seedOne({ dept, year, month, strategy }) {
  // (1) توليد (أو استرجاع) التقرير
  let report;
  try {
    report = await generateReport({ departmentId: dept.id, year, month, forceRegenerate: false });
  } catch (e) {
    console.warn(`  ⚠️ generate failed for ${dept.name} ${month}/${year}: ${e.message}`);
    return;
  }
  if (report.status !== 'DRAFT') {
    console.log(`  ↪ ${dept.name} ${month}/${year} موجود بالفعل (${report.status})`);
    return;
  }

  const auto = typeof report.autoFilled === 'string' ? JSON.parse(report.autoFilled) : report.autoFilled;
  const ai   = typeof report.aiQuestions === 'string' ? JSON.parse(report.aiQuestions) : (report.aiQuestions || []);

  const kpisNeeded = auto?.kpisNeedingValue || [];

  // (2) ملء القيم
  const kpiValues = kpisNeeded.map(k => ({
    objectiveId: k.id,
    title: k.title,
    value: k.target ? +(Number(k.target) * strategy.kpiMultiplier).toFixed(2) : Math.round(50 + strategy.kpiMultiplier * 40),
    note: strategy.kpiMultiplier >= 1 ? 'تجاوزنا المستهدف' : (strategy.kpiMultiplier >= 0.8 ? '' : 'أقل من المستهدف'),
  }));

  const aiAnswers = ai.map(q => ({
    questionId: q.id,
    answer: strategy.answerQuality === 'empty'
      ? ''
      : (strategy.answerQuality === 'partial'
          ? 'نعمل على ذلك.'
          : `${q.context ? 'بخصوص ' + q.context + ': ' : ''}${strategy.freeText} وتجري المتابعة وفق خطة عمل معتمدة.`),
  }));

  const deptFilled = { kpiValues, aiAnswers, freeText: strategy.freeText };

  // (3) احفظ + قيِّم + ضع الحالة APPROVED للتقارير القديمة
  const score    = scoreReport({ ...report, deptFilled });
  const isOld    = month !== new Date().getMonth() + 1 || year !== new Date().getFullYear();

  await prisma.progressReport.update({
    where: { id: report.id },
    data: {
      deptFilled: JSON.stringify(deptFilled),
      status: isOld ? 'APPROVED' : 'SUBMITTED',
      submittedAt: new Date(Date.UTC(year, month - 1, 8)),
      approvedAt:  isOld ? new Date(Date.UTC(year, month - 1, 12)) : null,
      score: score.total,
      scoreBreakdown: JSON.stringify(score.breakdown),
    },
  });
  console.log(`  ✅ ${dept.name} ${month}/${year} → ${strategy.name} (${score.total}/100)`);
}

async function main() {
  console.log('🌱 بذر تقارير المحقق الشهري...');
  const depts = await prisma.department.findMany({ where: { deletedAt: null }, take: 8 });
  if (!depts.length) { console.log('لا توجد أقسام.'); return; }

  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = now.getMonth() + 1;

  // آخر 3 أشهر × كل قسم
  for (let back = 2; back >= 0; back--) {
    const { year, month } = prevMonth(currentY, currentM, back);
    console.log(`\nشهر ${month}/${year}:`);
    for (let i = 0; i < depts.length; i++) {
      const strategy = FILL_STRATEGIES[i % FILL_STRATEGIES.length];
      await seedOne({ dept: depts[i], year, month, strategy });
    }
  }

  console.log('\n✨ انتهى البذر.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
