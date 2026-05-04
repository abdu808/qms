/**
 * Enrich KPI definitions and entry governance for PLAN-2025-2027.
 * Direct Prisma script for server-side repeatability.
 *
 * Usage:
 *   node scripts/govern-plan-kpis-2025-2027.mjs --dry-run
 *   node scripts/govern-plan-kpis-2025-2027.mjs --apply
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(repoRoot, 'outputs', 'plan-reset');

function ruleForIndicator(ind) {
  const n = ind.nameAr;
  const base = {
    dataSource: 'MANUAL',
    approverUserId: undefined,
    definition: 'يقيس هذا المؤشر مستوى تحقق النتيجة المحددة ضمن الخطة الاستراتيجية 2025-2027 وفق الدليل الشهري/الربعي المعتمد.',
    formula: 'القيمة المدخلة من مالك البيانات وفق الدليل المعتمد للفترة.',
    notes: 'قاعدة إدخال: لا تعتمد القراءة دون دليل أو مصدر موثق. مالك الأداء مسؤول عن النتيجة، ومالك البيانات مسؤول عن صحة الإدخال، ووحدة الجودة تراجع المنهجية والانتظام.',
  };
  const has = (s) => n.includes(s);

  if (has('عدد الأيتام المكفولين')) return { ...base, definition:'عدد الأيتام ذوي الكفالات النشطة بنهاية فترة القياس.', formula:'إجمالي الأيتام المكفولين النشطين بنهاية الشهر حسب سجل الكفالات المعتمد.', dataSource:'SYSTEM' };
  if (has('كسوة العيد')) return { ...base, definition:'عدد الأيتام الذين استلموا كسوة العيد خلال الموسم المحدد.', formula:'عدد المستفيدين الفعليين الموثقين في أمر الصرف/التسليم.' };
  if (has('الحقيبة المدرسية')) return { ...base, definition:'عدد الأيتام المستفيدين من الحقيبة المدرسية في فترات العودة الدراسية.', formula:'عدد المستفيدين المسجلين في كشف التسليم المعتمد.' };
  if (has('مؤشر الاستحقاق')) return { ...base, definition:'نسبة قوائم المستفيدين التي تم تحديثها واعتمادها وفق معايير الاستحقاق قبل التنفيذ.', formula:'(عدد القوائم المحدثة والمعتمدة ÷ إجمالي القوائم المطلوبة للفترة) × 100', dataSource:'SYSTEM' };
  if (has('أوامر الصرف والتوزيع')) return { ...base, definition:'نسبة أوامر الصرف والتوزيع التي نفذت وفق الطلب المعتمد وفي الفترة المحددة.', formula:'(عدد أوامر الصرف/التوزيع المنفذة في الموعد ÷ إجمالي أوامر الصرف المعتمدة) × 100', dataSource:'SYSTEM' };
  if (has('السلة الغذائية')) return { ...base, definition:'عدد الأسر المستفيدة فعلياً من السلة الغذائية خلال فترة القياس.', formula:'عدد الأسر المسجلة في أوامر الصرف/التسليم المعتمدة.' };
  if (has('سداد الإيجارات')) return { ...base, definition:'عدد الأسر التي حصلت على مساعدة سداد إيجار خلال الفترة.', formula:'عدد ملفات سداد الإيجار المعتمدة والمنفذة.' };
  if (has('تأثيث وأجهزة كهربائية')) return { ...base, definition:'عدد الأسر المستفيدة من التأثيث أو الأجهزة الكهربائية.', formula:'عدد الأسر التي اكتمل لها التسليم أو أمر الصرف.' };
  if (has('المساعدات الموسمية والطارئة')) return { ...base, definition:'عدد المستفيدين من المساعدات الموسمية أو الطارئة المعتمدة.', formula:'إجمالي المستفيدين المنفذين حسب سجلات الصرف/التسليم.' };
  if (has('رضا المستفيدين')) return { ...base, definition:'متوسط رضا المستفيدين عن تجربة برامج الرعاية بناء على استبيان موحد موثق.', formula:'(مجموع درجات الرضا المحققة ÷ إجمالي الدرجات الممكنة) × 100', dataSource:'MANUAL' };
  if (has('التدريب والتأهيل لسوق العمل')) return { ...base, definition:'عدد المستفيدين الذين التحقوا ببرامج تدريب أو تأهيل مرتبطة بسوق العمل.', formula:'عدد المستفيدين الذين أكملوا أو التحقوا ببرنامج مؤهل موثق.' };
  if (has('المشاريع الصغيرة')) return { ...base, definition:'عدد المشاريع الصغيرة أو الريادية التي تم تمويلها أو دعمها رسمياً.', formula:'عدد المشاريع ذات قرار اعتماد وتمويل/دعم مكتمل.' };
  if (has('برنامج التوظيف')) return { ...base, definition:'عدد المستفيدين الذين تم توجيههم أو دعمهم في مسار توظيف موثق.', formula:'عدد الحالات التي اكتملت لها نتيجة توظيف أو إحالة موثقة.' };

  if (has('نمو إيرادات التبرعات')) return { ...base, definition:'نسبة نمو إيرادات التبرعات مقارنة بالعام السابق.', formula:'((إيرادات التبرعات في السنة الحالية - إيرادات التبرعات في السنة السابقة) ÷ إيرادات السنة السابقة) × 100', dataSource:'SYSTEM' };
  if (has('حملات التبرع الكبرى')) return { ...base, definition:'عدد حملات التبرع الكبرى المنفذة وفق خطة تنمية الموارد.', formula:'عدد الحملات المنفذة ذات خطة ونتائج موثقة.' };
  if (has('المتجر الإلكتروني للتبرعات')) return { ...base, definition:'إجمالي الإيرادات المحصلة عبر المتجر الإلكتروني للتبرعات.', formula:'مجموع مبالغ التبرعات المحصلة عبر المتجر خلال الفترة.', dataSource:'SYSTEM' };
  if (has('استبقاء المانحين')) return { ...base, definition:'نسبة المانحين الذين كرروا دعمهم مقارنة بقاعدة المانحين المستهدفة.', formula:'(عدد المانحين المتكررين خلال الفترة ÷ عدد المانحين في قاعدة المقارنة) × 100' };
  if (has('مصادر الإيرادات الفعّالة')) return { ...base, definition:'عدد مصادر الإيراد التي حققت دخلاً فعلياً وموثقاً خلال السنة.', formula:'عدد مصادر الإيراد ذات حركة مالية مثبتة خلال السنة.' };
  if (has('الاستثمارات الجديدة')) return { ...base, definition:'عدد الاستثمارات الجديدة التي تم اعتمادها وإنجازها وفق الإجراءات النظامية.', formula:'عدد الاستثمارات الجديدة المنجزة والمثبتة بمحضر/عقد/قرار.' };
  if (has('عائد الاستثمارات القائمة')) return { ...base, definition:'نسبة الزيادة في عوائد الاستثمارات القائمة مقارنة بخط الأساس.', formula:'((عائد الفترة الحالية - عائد خط الأساس) ÷ عائد خط الأساس) × 100', dataSource:'SYSTEM' };
  if (has('المصاريف الإدارية')) return { ...base, definition:'نسبة المصاريف الإدارية من إجمالي الإنفاق، والأقل أفضل.', formula:'(إجمالي المصاريف الإدارية ÷ إجمالي الإنفاق) × 100', dataSource:'SYSTEM' };
  if (has('ZATCA')) return { ...base, definition:'نسبة الالتزام بالرفع الزكوي والضريبي في المواعيد النظامية.', formula:'(عدد الالتزامات المرفوعة في موعدها ÷ إجمالي الالتزامات المطلوبة) × 100' };
  if (has('الإقفال المالي')) return { ...base, definition:'عدد أيام العمل اللازمة لإقفال الشهر مالياً، والأقل أفضل.', formula:'تاريخ الإقفال المالي المعتمد - آخر يوم عمل في الشهر' };

  if (has('ISO 9001')) return { ...base, definition:'تحقق الحصول على شهادة ISO 9001 أو المحافظة عليها وفق خطة الاعتماد.', formula:'0 = لم يتحقق، 1 = تحقق بالحصول على الشهادة أو المحافظة عليها.' };
  if (has('توثيق الأدلة التنظيمية')) return { ...base, definition:'نسبة الأدلة التنظيمية وإجراءات العمل الموثقة والمعتمدة من إجمالي الأدلة المطلوبة.', formula:'(عدد الأدلة والإجراءات المعتمدة ÷ إجمالي الأدلة والإجراءات المطلوبة) × 100' };
  if (has('السياسات والإجراءات')) return { ...base, definition:'نسبة السياسات والإجراءات المطورة أو المحدثة والمعتمدة.', formula:'(عدد السياسات والإجراءات المعتمدة ÷ إجمالي السياسات والإجراءات المطلوبة) × 100' };
  if (has('رقمنة العمليات')) return { ...base, definition:'نسبة العمليات الإدارية والمالية وعمليات الجودة ذات الأولوية التي تم رقمنتها.', formula:'(عدد العمليات ذات الأولوية المرقمنة ÷ إجمالي العمليات ذات الأولوية المعتمدة) × 100' };
  if (has('أتمتة الدورات المستندية')) return { ...base, definition:'نسبة الدورات المستندية ذات الأولوية التي تعمل إلكترونياً دون اعتماد ورقي كامل.', formula:'(عدد الدورات المستندية المؤتمتة ÷ إجمالي الدورات ذات الأولوية) × 100' };
  if (has('درجة الحوكمة')) return { ...base, definition:'درجة الحوكمة المؤسسية حسب أداة القياس أو التقرير المعتمد.', formula:'الدرجة المحققة ÷ الدرجة المستهدفة أو الدرجة النهائية × 100' };
  if (has('تقرير الحوكمة')) return { ...base, definition:'تحقق إصدار تقرير الحوكمة السنوي واعتماده.', formula:'0 = لم يصدر، 1 = صدر واعتمد.' };

  if (has('ساعات التدريب')) return { ...base, definition:'متوسط ساعات التدريب السنوية المنفذة لكل موظف.', formula:'إجمالي ساعات التدريب المنفذة للموظفين ÷ عدد الموظفين المشمولين.' };
  if (has('شهادات احترافية')) return { ...base, definition:'عدد الموظفين الذين حصلوا على شهادة احترافية معتمدة ذات علاقة بالعمل.', formula:'عدد الشهادات الاحترافية المعتمدة والمثبتة للموظفين.' };
  if (has('الشراكات الفعّالة')) return { ...base, definition:'عدد الشراكات الفعالة المبرمة ذات مخرجات أو قيمة موثقة.', formula:'عدد اتفاقيات الشراكة النشطة ذات مخرج موثق خلال الفترة.' };
  if (has('العائد المالي أو العيني من الشراكات')) return { ...base, definition:'نسبة الشراكات التي تم توثيق عائدها المالي أو العيني.', formula:'(عدد الشراكات ذات العائد الموثق ÷ إجمالي الشراكات الفعالة) × 100' };
  if (has('فرص التطوع التخصصي')) return { ...base, definition:'عدد فرص التطوع التخصصي ذات القيمة السوقية الموثقة والمنفذة.', formula:'عدد فرص التطوع التخصصي المكتملة بسجل يوضح التخصص والساعات والمستفيد.' };
  if (has('القيمة الاقتصادية')) return { ...base, definition:'القيمة الاقتصادية التقديرية الموثقة للتطوع التخصصي.', formula:'مجموع (ساعات التطوع التخصصي × متوسط الأجر السوقي للتخصص).' };
  if (has('الفعاليات الكبرى')) return { ...base, definition:'عدد الفعاليات الكبرى المنفذة في نطاق صبيا وفق خطة الاتصال.', formula:'عدد الفعاليات المنفذة ذات تقرير أو توثيق مخرجات.' };

  return base;
}

function quarterlyTargets(target, frequency, kpiType) {
  if (target == null) return {};
  const v = Number(target);
  if (!Number.isFinite(v)) return {};
  if (kpiType === 'BINARY') return { q1Target: null, q2Target: null, q3Target: v, q4Target: v };
  if (frequency === 'ANNUALLY') return { q1Target: null, q2Target: null, q3Target: null, q4Target: v };
  if (frequency === 'SEMI_ANNUAL') {
    if (kpiType === 'CUMULATIVE') return { q1Target: null, q2Target: v / 2, q3Target: null, q4Target: v };
    return { q1Target: null, q2Target: v, q3Target: null, q4Target: v };
  }
  if (kpiType === 'CUMULATIVE') return { q1Target: v * .25, q2Target: v * .5, q3Target: v * .75, q4Target: v };
  return { q1Target: v, q2Target: v, q3Target: v, q4Target: v };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function correctedTargetValue(ind, target) {
  const n = ind.nameAr;
  if (target.targetValue !== 0) return target.targetValue;
  if (n.includes('ISO 9001')) return 1;
  if (n.includes('توثيق الأدلة التنظيمية')) return 100;
  if (n.includes('السياسات والإجراءات')) return 100;
  if (n.includes('تقرير الحوكمة')) return 1;
  return target.targetValue;
}

function stagedTargets(ind, target) {
  const corrected = correctedTargetValue(ind, target);
  if (ind.nameAr.includes('ISO 9001')) {
    return { targetValue: corrected, q1Target: null, q2Target: null, q3Target: corrected, q4Target: corrected };
  }
  if (ind.nameAr.includes('تقرير الحوكمة')) {
    return { targetValue: corrected, q1Target: null, q2Target: null, q3Target: null, q4Target: corrected };
  }
  const base = quarterlyTargets(corrected, ind.frequency, ind.kpiType);
  const v = Number(corrected);
  const baseline = Number(ind.baseline);
  const canStageSnapshot = (
    ind.baseline != null
    && Number.isFinite(v)
    && Number.isFinite(baseline)
    && ind.kpiType === 'SNAPSHOT'
    && ['MONTHLY', 'QUARTERLY'].includes(ind.frequency)
  );
  if (!canStageSnapshot) return { targetValue: corrected, ...base };

  const step = (v - baseline) / 4;
  return {
    targetValue: corrected,
    q1Target: round2(baseline + step),
    q2Target: round2(baseline + step * 2),
    q3Target: round2(baseline + step * 3),
    q4Target: v,
  };
}

function appendGovernanceNote(existing, addition) {
  const text = String(existing || '').trim();
  if (!addition) return text || null;
  if (text.includes(addition)) return text;
  return text ? `${text} | ${addition}` : addition;
}

async function writeReport(report) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(OUT_DIR, `govern-plan-kpis-2025-2027-${APPLY ? 'apply' : 'dry-run'}-${stamp}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
  return file;
}

async function main() {
  const indicators = await prisma.indicator.findMany({
    where: { deletedAt: null },
    include: { annualTargets: true },
    orderBy: { code: 'asc' },
  });
  const changes = [];

  await prisma.$transaction(async (tx) => {
    for (const ind of indicators) {
      const rule = ruleForIndicator(ind);
      const data = {
        definition: rule.definition,
        formula: rule.formula,
        dataSource: rule.dataSource,
        notes: appendGovernanceNote(ind.notes, rule.notes),
      };
      changes.push({ type: 'indicator.governance', code: ind.code, name: ind.nameAr });
      if (APPLY) await tx.indicator.update({ where: { id: ind.id }, data });

      for (const target of ind.annualTargets) {
        const q = stagedTargets(ind, target);
        const changeType = q.targetValue !== target.targetValue ? 'annualTarget.targetAndQuarters' : 'annualTarget.quarters';
        changes.push({ type: changeType, code: ind.code, year: target.year, fromTarget: target.targetValue, ...q });
        if (APPLY) {
          await tx.annualTarget.update({
            where: { id: target.id },
            data: { ...q, modificationReason: 'توزيع ربعي إرشادي لمتابعة الخطة 2025-2027' },
          });
        }
      }
    }
  }, { timeout: 120_000 });

  const report = { ok: true, mode: APPLY ? 'apply' : 'dry-run', indicators: indicators.length, changesCount: changes.length, changes };
  const file = await writeReport(report);
  console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
}

main().catch((err) => { console.error(err); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
