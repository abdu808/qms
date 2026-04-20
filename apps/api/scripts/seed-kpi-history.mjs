/**
 * seed-kpi-history.mjs
 *
 * يُدخل بيانات المؤشرات التاريخية لعام 2025 والربع الأول من 2026:
 *   - 2025 (12 شهر): القيم الفعلية لكل هدف استراتيجي
 *   - Q1 2026 (يناير / فبراير / مارس): أهداف + أنشطة تشغيلية
 *
 * Idempotent: يتخطى الإدخالات الموجودة (unique constraint)
 * تشغيل يدوي: node scripts/seed-kpi-history.mjs
 *
 * قواعد التوزيع الشهري:
 *   SNAPSHOT   → القيمة في نهاية الشهر (headcount, %, etc.)
 *   CUMULATIVE → مجموع تراكمي (صرف شهري جديد، عدد جديد)
 *   PERIODIC   → ربعي: يُسجَّل في مارس / يونيو / سبتمبر / ديسمبر فقط
 *   BINARY     → 0 أو 1 (أُنجز أم لا)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ─────────────────────────────────────────────────────────────────────────────
// بيانات 2025 — التوزيع الشهري لكل هدف استراتيجي
// المصدر: الخطة الاستراتيجية 2025-2027 (قيم الخط الأساسي والأداء الفعلي)
// ─────────────────────────────────────────────────────────────────────────────
const OBJ_2025 = [
  {
    code: 'OBJ-2026-001',
    // SNAPSHOT UNIFORM — عدد الأيتام المكفولين (تراكم تصاعدي خلال 2025)
    // بدأ العام بـ 630 وانتهى بـ 680
    monthly: [630, 640, 648, 655, 660, 663, 665, 668, 670, 674, 677, 680],
  },
  {
    code: 'OBJ-2026-002',
    // SNAPSHOT RAMADAN_RELIEF — أسر السلة الغذائية
    // رمضان 2025: مارس-أبريل → طفرة في الخدمة
    monthly: [820, 900, 1300, 1350, 1100, 1050, 1000, 1050, 1100, 1200, 1350, 1500],
  },
  {
    code: 'OBJ-2026-003',
    // CUMULATIVE UNIFORM — مستفيدو برامج التمكين (تراكمي سنوي)
    // في 2025 أنجزوا 300 مستفيد
    monthly: [10, 20, 35, 55, 70, 120, 150, 190, 230, 265, 285, 300],
  },
  {
    code: 'OBJ-2026-004',
    // CUMULATIVE RAMADAN_RELIEF — الإيرادات الشهرية (ريال)
    // إجمالي 2025: 11,309,157 ريال — رمضان (مارس) الأعلى
    monthly: [
      520_000,   // يناير
      640_000,   // فبراير
    1_980_000,   // مارس — رمضان 2025
    1_150_000,   // أبريل — بعد رمضان (أضحى)
      730_000,   // مايو
      680_000,   // يونيو
      700_000,   // يوليو
      750_000,   // أغسطس
      780_000,   // سبتمبر
      820_000,   // أكتوبر
      870_000,   // نوفمبر
      889_157,   // ديسمبر
    ],
  },
  {
    code: 'OBJ-2026-005',
    // SNAPSHOT QUARTERLY — نسبة نمو عائد الاستثمارات (%)
    // في 2025 لم يكن هناك قياس منتظم — تسجيل ربعي فقط
    monthly: [null, null, 1.5, null, null, 2.0, null, null, 2.5, null, null, 3.2],
  },
  {
    code: 'OBJ-2026-006',
    // PERIODIC MONTHLY_EVEN — نسبة المصاريف الإدارية (%)
    // الهدف ≤15%، في 2025 كانت أعلى (مشكلة قائمة)
    monthly: [22, 21, 20, 20, 19, 19, 18, 18, 18, 17, 17, 17],
  },
  {
    code: 'OBJ-2026-007',
    // PERIODIC QUARTERLY — نسبة رضا أصحاب المصلحة (%)
    // استبيان ربعي فقط — القيمة الأساسية 35%
    monthly: [null, null, 33, null, null, 35, null, null, 35, null, null, 38],
  },
  {
    code: 'OBJ-2026-008',
    // CUMULATIVE UNIFORM — عدد الشراكات الفعّالة
    // في 2025 وصلوا إلى 10 شراكات
    monthly: [8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 10],
  },
  {
    code: 'OBJ-2026-009',
    // SNAPSHOT UNIFORM — نسبة استكمال ISO 9001 (%)
    // بدأوا في منتصف 2025 — وصلوا إلى 66% في نهاية العام
    monthly: [null, null, null, null, null, 30, 40, 48, 54, 58, 62, 66],
  },
  {
    code: 'OBJ-2026-010',
    // SNAPSHOT QUARTERLY — نسبة التحول التقني (%)
    monthly: [null, null, 52, null, null, 55, null, null, 58, null, null, 60],
  },
  {
    code: 'OBJ-2026-011',
    // CUMULATIVE UNIFORM — ساعات التدريب للموظف (تراكمي سنوي)
    // في 2025: موظف واحد فقط تدرب رسمياً (ساعة واحدة)
    monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  },
  {
    code: 'OBJ-2026-012',
    // PERIODIC QUARTERLY — نسبة رضا المستفيدين (%)
    // القيمة الأساسية 70%
    monthly: [null, null, 68, null, null, 70, null, null, 70, null, null, 72],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// بيانات Q1 2026 — الأهداف الاستراتيجية (يناير / فبراير / مارس)
// ─────────────────────────────────────────────────────────────────────────────
const OBJ_Q1_2026 = [
  {
    code: 'OBJ-2026-001',
    // انطلق برنامج التوسع — وصل إلى 870 يتيم مباشرة
    q1: [728, 810, 870],
  },
  {
    code: 'OBJ-2026-002',
    // السلة الغذائية مستقرة على 1500 أسرة
    q1: [1500, 1500, 1500],
  },
  {
    code: 'OBJ-2026-003',
    // برنامج التمكين لم ينطلق بعد — يبدأ Q2
    q1: [0, 0, 30],
  },
  {
    code: 'OBJ-2026-004',
    // رمضان 2026 يبدأ فبراير 28 ← طفرة مارس
    q1: [540_000, 780_000, 2_200_000],
  },
  {
    code: 'OBJ-2026-005',
    // ربعي — يُقاس مارس فقط
    q1: [null, null, 5.0],
  },
  {
    code: 'OBJ-2026-006',
    // تحسن تدريجي في ضبط الإنفاق الإداري
    q1: [16.8, 16.2, 15.5],
  },
  {
    code: 'OBJ-2026-007',
    // ربعي — استبيان Q1 في مارس
    q1: [null, null, 45],
  },
  {
    code: 'OBJ-2026-008',
    // شراكتان جديدتان في Q1
    q1: [10, 11, 12],
  },
  {
    code: 'OBJ-2026-009',
    // تسارع ملحوظ في استكمال ISO
    q1: [75, 80, 85],
  },
  {
    code: 'OBJ-2026-010',
    // ربعي — تقييم مارس
    q1: [null, null, 80],
  },
  {
    code: 'OBJ-2026-011',
    // ساعات التدريب بدأت تتراكم
    q1: [0, 2, 4],
  },
  {
    code: 'OBJ-2026-012',
    // ربعي — رضا المستفيدين
    q1: [null, null, 72],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// بيانات Q1 2026 — الأنشطة التشغيلية (actualValue + spent)
// ─────────────────────────────────────────────────────────────────────────────
const ACT_Q1_2026 = [
  {
    code: 'ACT-2026-001',
    // عدد الأيتام المكفولين شهرياً + مبلغ الصرف (ريال)
    q1: [
      { value: 728,  spent: 582_400 },   // يناير: 728 × 800 ريال
      { value: 810,  spent: 648_000 },   // فبراير
      { value: 870,  spent: 696_000 },   // مارس
    ],
  },
  {
    code: 'ACT-2026-002',
    // أسر السلة الغذائية + تكلفة (1500 × 70 ريال/شهر)
    q1: [
      { value: 1500, spent: 105_000 },
      { value: 1500, spent: 105_000 },
      { value: 1500, spent: 175_000 },   // مارس: سلة رمضان مضاعفة
    ],
  },
  {
    code: 'ACT-2026-003',
    // أسر استفادت من دعم الإيجار + مبلغ
    q1: [
      { value: 15, spent: 22_500 },
      { value: 18, spent: 27_000 },
      { value: 20, spent: 30_000 },
    ],
  },
  {
    code: 'ACT-2026-004',
    // برامج التمكين — لم تنطلق بعد في يناير/فبراير
    q1: [
      { value: 0, spent: 0 },
      { value: 0, spent: 0 },
      { value: 30, spent: 15_000 },   // مارس: انطلاق أول دورة
    ],
  },
  {
    code: 'ACT-2026-005',
    // إيرادات حملات التبرع (ريال)
    q1: [
      { value: 540_000, spent: 6_000 },    // يناير
      { value: 780_000, spent: 7_000 },    // فبراير — بداية رمضان
      { value: 2_200_000, spent: 12_000 }, // مارس — رمضان ذروة
    ],
  },
  {
    code: 'ACT-2026-006',
    // إيرادات منصة إحسان (ريال)
    q1: [
      { value: 85_000,  spent: 2_000 },
      { value: 130_000, spent: 1_500 },
      { value: 320_000, spent: 1_500 },   // رمضان: طفرة التبرع الرقمي
    ],
  },
  {
    code: 'ACT-2026-007',
    // نسبة نمو عائد الاستثمارات (%) — ربعي: مارس فقط
    q1: [
      { value: null, spent: 1_500 },
      { value: null, spent: 1_500 },
      { value: 5.0,  spent: 2_000 },
    ],
  },
  {
    code: 'ACT-2026-008',
    // نسبة المصاريف الإدارية (%) — شهري
    q1: [
      { value: 16.8, spent: 2_000 },
      { value: 16.2, spent: 1_500 },
      { value: 15.5, spent: 2_000 },
    ],
  },
  {
    code: 'ACT-2026-009',
    // نسبة استكمال مشروع الهوية البصرية — لم يبدأ بعد
    q1: [
      { value: 0, spent: 0 },
      { value: 0, spent: 0 },
      { value: 10, spent: 8_000 },   // مارس: إطار المشروع
    ],
  },
  {
    code: 'ACT-2026-010',
    // نسبة رضا أصحاب المصلحة (%) — ربعي
    q1: [
      { value: null, spent: 7_000 },
      { value: null, spent: 6_500 },
      { value: 45,   spent: 7_500 },
    ],
  },
  {
    code: 'ACT-2026-011',
    // عدد الشراكات الفعّالة
    q1: [
      { value: 10, spent: 1_500 },
      { value: 11, spent: 1_500 },
      { value: 12, spent: 2_000 },
    ],
  },
  {
    code: 'ACT-2026-012',
    // نسبة استكمال مشروع ISO (%)
    q1: [
      { value: 75, spent: 8_000 },
      { value: 80, spent: 9_000 },
      { value: 85, spent: 8_000 },
    ],
  },
  {
    code: 'ACT-2026-013',
    // نسبة التحول التقني — ربعي
    q1: [
      { value: null, spent: 10_000 },
      { value: null, spent: 10_000 },
      { value: 80,   spent: 10_000 },
    ],
  },
  {
    code: 'ACT-2026-014',
    // ساعات التدريب لكل موظف (تراكمي)
    q1: [
      { value: 0, spent: 0 },
      { value: 2, spent: 0 },
      { value: 4, spent: 0 },         // دورة في مارس
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// المنفذ الرئيسي
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[seed-kpi] بدء إدخال بيانات المؤشرات التاريخية...\n');

  // ── المستخدم المُدخِل ─────────────────────────────────────────────────────
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'QUALITY_MANAGER'] } },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) {
    console.warn('[seed-kpi] ⚠️ لا يوجد مستخدم — شغّل seed.js أولاً');
    return;
  }

  // ── تحميل الأهداف ─────────────────────────────────────────────────────────
  const objCodes = [...new Set([...OBJ_2025.map(o => o.code), ...OBJ_Q1_2026.map(o => o.code)])];
  const objectives = await prisma.objective.findMany({ where: { code: { in: objCodes } } });
  const objMap = Object.fromEntries(objectives.map(o => [o.code, o.id]));

  const missing = objCodes.filter(c => !objMap[c]);
  if (missing.length > 0) {
    console.warn(`[seed-kpi] ⚠️ أهداف غير موجودة: ${missing.join(', ')} — شغّل seed-strategic-plan.mjs أولاً`);
  }

  // ── تحميل الأنشطة ─────────────────────────────────────────────────────────
  const actCodes = ACT_Q1_2026.map(a => a.code);
  const activities = await prisma.operationalActivity.findMany({ where: { code: { in: actCodes } } });
  const actMap = Object.fromEntries(activities.map(a => [a.code, a.id]));

  let created = 0, skipped = 0;

  // ────────────────────────────────────────────────────────────────────────
  // 1. بيانات 2025 — الأهداف الاستراتيجية
  // ────────────────────────────────────────────────────────────────────────
  console.log('[seed-kpi] ── 2025: أهداف استراتيجية ──');
  for (const obj of OBJ_2025) {
    const objectiveId = objMap[obj.code];
    if (!objectiveId) continue;

    for (let month = 1; month <= 12; month++) {
      const actualValue = obj.monthly[month - 1];
      if (actualValue === null || actualValue === undefined) continue;

      try {
        await prisma.kpiEntry.create({
          data: {
            objectiveId,
            year: 2025,
            month,
            actualValue,
            enteredById: admin.id,
            note: 'بيانات تاريخية 2025',
          },
        });
        created++;
      } catch (e) {
        if (e.code === 'P2002') { skipped++; } // unique constraint — موجود مسبقاً
        else throw e;
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // 2. بيانات Q1 2026 — الأهداف الاستراتيجية
  // ────────────────────────────────────────────────────────────────────────
  console.log('[seed-kpi] ── Q1 2026: أهداف استراتيجية ──');
  for (const obj of OBJ_Q1_2026) {
    const objectiveId = objMap[obj.code];
    if (!objectiveId) continue;

    for (let i = 0; i < 3; i++) {
      const month = i + 1; // 1=يناير, 2=فبراير, 3=مارس
      const actualValue = obj.q1[i];
      if (actualValue === null || actualValue === undefined) continue;

      try {
        await prisma.kpiEntry.create({
          data: {
            objectiveId,
            year: 2026,
            month,
            actualValue,
            enteredById: admin.id,
            note: 'Q1 2026 — الربع الأول',
          },
        });
        created++;
      } catch (e) {
        if (e.code === 'P2002') { skipped++; }
        else throw e;
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // 3. بيانات Q1 2026 — الأنشطة التشغيلية
  // ────────────────────────────────────────────────────────────────────────
  console.log('[seed-kpi] ── Q1 2026: أنشطة تشغيلية ──');
  for (const act of ACT_Q1_2026) {
    const activityId = actMap[act.code];
    if (!activityId) continue;

    for (let i = 0; i < 3; i++) {
      const month = i + 1;
      const { value, spent } = act.q1[i];
      if (value === null || value === undefined) {
        // حتى لو القيمة فارغة (ربعي)، نُسجِّل المصروف إن وُجد
        if (!spent) continue;
      }

      try {
        await prisma.kpiEntry.create({
          data: {
            activityId,
            year: 2026,
            month,
            actualValue: value ?? 0,
            spent: spent ?? 0,
            enteredById: admin.id,
            note: 'Q1 2026 — الربع الأول',
          },
        });
        created++;
      } catch (e) {
        if (e.code === 'P2002') { skipped++; }
        else throw e;
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // ملخص
  // ────────────────────────────────────────────────────────────────────────
  console.log(`\n[seed-kpi] ✅ اكتمل إدخال بيانات المؤشرات`);
  console.log(`  إدخالات جديدة: ${created} | موجودة مسبقاً: ${skipped}`);
  console.log(`  الفترات المغطاة: يناير 2025 → مارس 2026 (15 شهراً)`);
}

main()
  .catch(e => { console.error('[seed-kpi] خطأ:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
