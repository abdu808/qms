/**
 * backfill-survey-responses.mjs
 *
 * ترحيل بيانات الردود الموجودة من Survey.resultsJson إلى جدول SurveyResponse.
 *
 * الاستخدام:
 *   DATABASE_URL=postgres://... node scripts/backfill-survey-responses.mjs
 *
 * الخصائص:
 *   - Idempotent: يتخطى استبيانات لها صفوف بالفعل (آمن للتشغيل مرة ثانية)
 *   - يُرجع كود خروج 0 عند النجاح، 1 عند الفشل
 *   - يطبع ملخّصاً في النهاية
 *
 * ترتيب التطبيق (انظر migrations-manual/004_survey_response_table.sql):
 *   1) prisma db push --skip-generate
 *   2) تطبيق migration 004
 *   3) تشغيل هذا السكريبت
 *   4) التحقق من 0 discrepancy بالاستعلام الموثَّق في migration 004
 *   5) نشر الكود الجديد
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function main() {
  console.log('[backfill] بدء ترحيل Survey.resultsJson → SurveyResponse...\n');

  const surveys = await prisma.survey.findMany({
    where:  { resultsJson: { not: null } },
    select: { id: true, code: true, resultsJson: true, questionsJson: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[backfill] وُجد ${surveys.length} استبيان(ات) بحقل resultsJson`);

  let totalInserted = 0;
  let totalSkipped  = 0;
  let totalErrors   = 0;

  for (const survey of surveys) {
    // فحص idempotency: إذا كان هناك صفوف بالفعل → تخطّ
    const existingCount = await prisma.surveyResponse.count({
      where: { surveyId: survey.id },
    });

    let parsed;
    try {
      const raw = JSON.parse(survey.resultsJson || '[]');
      parsed = Array.isArray(raw) ? raw : [];
    } catch {
      console.warn(`  ⚠️ [${survey.code}] تعذّر تحليل resultsJson — تخطّي`);
      totalErrors++;
      continue;
    }

    if (parsed.length === 0) {
      console.log(`  ✓ [${survey.code}] resultsJson فارغ — تخطّي`);
      continue;
    }

    if (existingCount >= parsed.length) {
      console.log(`  ✓ [${survey.code}] لديه ${existingCount} صفاً بالفعل — تخطّي`);
      totalSkipped += parsed.length;
      continue;
    }

    // أدرج الصفوف المتبقية
    let inserted = 0;
    for (const r of parsed) {
      try {
        await prisma.surveyResponse.create({
          data: {
            surveyId:      survey.id,
            submittedAt:   r.at ? new Date(r.at) : new Date(),
            respondentName: typeof r.respondentName === 'string' ? r.respondentName.slice(0, 120) : null,
            answersJson:   JSON.stringify(r.answers || {}),
            idHash:        String(r._idHash || ''),
          },
        });
        inserted++;
        totalInserted++;
      } catch (e) {
        console.error(`  ✗ [${survey.code}] فشل إدراج رد:`, e?.message);
        totalErrors++;
      }
    }
    console.log(`  ✓ [${survey.code}] أُدرج ${inserted}/${parsed.length} رد(اً)`);
  }

  console.log(`
[backfill] النتيجة النهائية:
  أُدرج:    ${totalInserted}
  تخطّى:    ${totalSkipped}
  أخطاء:   ${totalErrors}
`);

  if (totalErrors > 0) {
    console.error('[backfill] ⚠️ وُجدت أخطاء — راجع السجلات أعلاه');
    process.exit(1);
  }

  console.log('[backfill] ✅ اكتمل الترحيل بنجاح');
  console.log('[backfill] تحقق من صحة البيانات بتشغيل استعلام SQL في migrations-manual/004_survey_response_table.sql');
}

main()
  .catch(e => { console.error('[backfill] خطأ فادح:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
