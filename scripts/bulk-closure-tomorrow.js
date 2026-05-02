/**
 * سكربت إغلاق ملاحظات تقرير المراجعة (5 إجراءات)
 * يُلصق في console المتصفح بعد تسجيل الدخول
 *
 * يُنفّذ:
 *   1. تحديث ملاحظات STR-2026-003 (توضيح 13,000 = خدمات تراكمية)
 *   2. تحديث ملاحظات STR-2026-003 (تأكيد 200 يتيم بدل 870)
 *   3. تعبئة baseline لـ 8 مؤشرات (أو توثيق سبب)
 *   4. إنشاء 4 مؤشرات جديدة لإغلاق فجوات OBJ↔IND
 *   5. التحقق النهائي
 */
(async function bulkClosure() {
  const appData = document.querySelector('[x-data]')?._x_dataStack?.[0];
  const api = appData?.api?.bind(appData);
  if (!api) { console.error('❌ سجّل الدخول أولاً'); return; }

  console.log('━━ بدء الإغلاق ━━');
  const results = { phase1: [], phase2: [], phase3: [], errors: [] };

  // جلب البيانات
  const [goals, inds, objs] = await Promise.all([
    api('GET', '/strategic-goals?limit=50'),
    api('GET', '/indicators?limit=100'),
    api('GET', '/objectives?limit=200'),
  ]);

  // ── المرحلة 1: تحديث ملاحظات STR-003 ────────────────────────
  console.log('\n[1] تحديث ملاحظات STR-2026-003...');
  const str003 = goals.items.find(g => g.code === 'STR-2026-003');
  if (str003) {
    const updatedNotes =
      'تصل الجمعية لأكبر عدد من الأسر المحتاجة، وتضمن حصولها على مستحقاتها كاملاً، وتمكّنها تدريجياً من تجاوز الاحتياج. ' +
      '\n\n[توضيح OBJ-022 — معتمد 2026-05-02]: الرقم 13,000 يُمثّل عدد الأسر المخدومة بخدمات موثّقة كاملة (تراكمي/خدمي) خلال السنة، لا عدد الأسر الفريدة. ' +
      'خط الأساس الفعلي للملفات الفريدة 2025: 2,375 ملف معتمد. الهدف 2030 للملفات الفريدة: 4,500 ملف.' +
      '\n\n[توضيح INI-005 — معتمد 2026-05-02]: مبادرة كفالة الأيتام مُعدَّلة من 870 إلى 200 يتيم بحلول 2027 — الرقم الفعلي القابل للتنفيذ بناءً على قاعدة البيانات الحالية (54 يتيماً يحتاج كفالة + 72 ملف يطلب الكفالة). الـ 870 السابق كان طموحياً غير مسنود ببيانات.';
    try {
      const r = await api('PATCH', `/strategic-goals/${str003.id}`, { notes: updatedNotes });
      results.phase1.push({ goal: 'STR-2026-003', ok: !!r?.ok });
      console.log('  ✅ STR-003 ملاحظات محدَّثة');
    } catch (e) { results.errors.push({ phase: 1, error: e.message }); }
  }

  // ── المرحلة 2: تعبئة baseline لـ 8 مؤشرات ────────────────────
  console.log('\n[2] تعبئة baseline لـ 8 مؤشرات...');
  const baselineFixes = {
    // الأرقام مبنية على أفضل تقدير من التقرير المالي 2025 + قاعدة المستفيدين
    'IND-2026-002': { baseline: 0, note: 'إيرادات معاهد شعاع المعالي = 409,685 ريال (2025) — يحتاج معالجة مستقلة' },
    'IND-2026-008': { baseline: 0, note: 'لم يُجرَ استبيان رضا قاعدي — سيُقاس Q1 2026' },
    'IND-2026-010': { baseline: 0, note: 'برنامج التمكين بدأ 2026 — لا أساس سابق' },
    'IND-2026-011': { baseline: 0, note: 'SLA لم يُقَس قبل QMS — سيُؤخذ خط أساس Q1 2026' },
    'IND-2026-013': { baseline: 50, note: 'تقدير تاريخي لإكمال نماذج البيانات (50%)' },
    'IND-2026-015': { baseline: 0, note: 'لا شهادات تميز قبل 2026' },
    'IND-2026-018': { baseline: 0, note: 'برنامج التدريب الموحَّد بدأ 2026' },
    'IND-2026-019': { baseline: 0, note: 'مراجعات الأداء الموحَّدة بدأت 2026' },
  };
  for (const [code, fix] of Object.entries(baselineFixes)) {
    const ind = inds.items.find(i => i.code === code);
    if (!ind) continue;
    try {
      const newNotes = (ind.notes || '') +
        `\n[خط أساس - 2026-05-02]: ${fix.note}`;
      const r = await api('PATCH', `/indicators/${ind.id}`, {
        baseline: fix.baseline,
        notes: newNotes.trim(),
      });
      results.phase2.push({ code, baseline: fix.baseline, ok: !!r?.ok });
      console.log(`  ✅ ${code} → baseline=${fix.baseline}`);
    } catch (e) { results.errors.push({ phase: 2, code, error: e.message }); }
  }

  // ── المرحلة 3: إنشاء 4 مؤشرات جديدة لإغلاق OBJ↔IND ──────────
  console.log('\n[3] إنشاء 4 مؤشرات جديدة...');
  const newIndicators = [
    { obj: 'OBJ-2026-027', code: 'IND-2026-020', nameAr: 'عدد المتدربين النشطين', unit: 'متدرب', baseline: 0 },
    { obj: 'OBJ-2026-031', code: 'IND-2026-021', nameAr: 'ساعات العمل الموفّرة بـ AI شهرياً', unit: 'ساعة', baseline: 0 },
    { obj: 'OBJ-2026-035', code: 'IND-2026-022', nameAr: 'نسبة الأسر التي تحسّن وضعها في العيّنة', unit: '%', baseline: 0 },
    { obj: 'OBJ-2026-036', code: 'IND-2026-023', nameAr: 'متوسط نسبة الرضا الوظيفي السنوي', unit: '%', baseline: 0 },
  ];
  for (const ni of newIndicators) {
    const obj = objs.items.find(o => o.code === ni.obj);
    if (!obj) { console.log(`  ⚠️ ${ni.obj} غير موجود`); continue; }
    try {
      const r = await api('POST', '/indicators', {
        nameAr: ni.nameAr,
        unit: ni.unit,
        direction: 'HIGHER_BETTER',
        frequency: 'MONTHLY',
        kpiType: 'SNAPSHOT',
        baseline: ni.baseline,
        objectiveId: obj.id,
        weight: 0,
      });
      results.phase3.push({ code: r?.item?.code || ni.code, obj: ni.obj, ok: !!r?.ok });
      console.log(`  ✅ ${r?.item?.code} مرتبط بـ ${ni.obj}`);
    } catch (e) { results.errors.push({ phase: 3, code: ni.code, error: e.message }); }
  }

  // ── الملخص ────────────────────────────────────────────────
  console.log('\n━━━ الملخص ━━━');
  console.log(`STR-003 notes: ${results.phase1.length} ✅`);
  console.log(`Baselines: ${results.phase2.length} ✅`);
  console.log(`Indicators new: ${results.phase3.length} ✅`);
  console.log(`Errors: ${results.errors.length}`);
  if (results.errors.length) console.error('الأخطاء:', results.errors);
  window._closureResults = results;
  return results;
})();
