/**
 * سكربت دفعة لتنفيذ كل عمليات الإعداد في النظام عند عودة الاتصال.
 * يُلصق كاملاً في console المتصفح بعد تسجيل الدخول.
 *
 * يُنفّذ بالترتيب:
 *   1. إنشاء AnnualTargets للمؤشرات الـ 16 لـ 5 سنوات (~80 سجل)
 *   2. إنشاء سجل المخاطر المؤسسية (12 مخاطرة)
 *   3. تحديث ملاحظات STR-2026-003 (الواقع الفعلي 2,375 ملف)
 *   4. تعديل INI-2026-005 (200 يتيم بدلاً من 870)
 *   5. إنشاء FollowUpTasks لخطة الـ 30 يوماً (15 مهمة)
 *
 * الاستخدام: انسخ هذا الملف كاملاً والصقه في console بعد فتح quality.aqiltech.sa
 */
(async function bulkSetup() {
  const appData = document.querySelector('[x-data]')?._x_dataStack?.[0];
  const api = appData?.api?.bind(appData);
  if (!api) { console.error('❌ لا يمكن الوصول للـ API — سجّل الدخول أولاً'); return; }

  const log = (msg) => console.log(`[bulk-setup] ${msg}`);
  const results = { phase1: [], phase2: [], phase3: [], phase4: [], phase5: [], errors: [] };

  // ── جلب البيانات الحالية ──
  log('جاري جلب البيانات...');
  const [goals, inis, indicators, users] = await Promise.all([
    api('GET', '/strategic-goals?limit=50'),
    api('GET', '/initiatives?limit=100'),
    api('GET', '/indicators?limit=100'),
    api('GET', '/users?limit=100'),
  ]);

  const goalById = {};
  const goalByCode = {};
  goals.items.forEach(g => { goalById[g.id] = g; goalByCode[g.code] = g; });

  const indById = {};
  const indByCode = {};
  indicators.items.forEach(i => { indById[i.id] = i; indByCode[i.code] = i; });

  const iniByCode = {};
  inis.items.forEach(i => { iniByCode[i.code] = i; });

  const userByName = {};
  users.items.forEach(u => { userByName[u.name] = u.id; });

  log(`جاهز: ${goals.items.length} هدف · ${inis.items.length} مبادرة · ${indicators.items.length} مؤشر · ${users.items.length} مستخدم`);

  // ─────────────────────────────────────────────────
  // المرحلة 1: AnnualTargets للمؤشرات الـ 16
  // ─────────────────────────────────────────────────
  log('\n━━ المرحلة 1: إنشاء AnnualTargets ━━');

  // مستهدفات سنوية مُعتمَدة من المدير التنفيذي 2026-04-30
  // الأرقام المالية مُحدَّثة بناءً على التقرير المالي 2025 الفعلي
  // إيرادات: 11.3M (2025) → 16.6M (2030)
  // الموارد الذاتية: 8.5% (2025) → 30% (2030)
  // معاهد شعاع المعالي: 409K (2025) → 1.6M (2030)
  const targetsPlan = {
    // STR-2026-003 — الأثر الاجتماعي
    'IND-2026-009': { 2026: 80, 2027: 82, 2028: 85, 2029: 87, 2030: 90 },     // الالتزام بتعبئة المؤشرات
    'IND-2026-010': { 2026: 70, 2027: 75, 2028: 80, 2029: 85, 2030: 90 },     // تغطية الحاجات المستحقة
    // STR-2026-004 — التمكين
    'IND-2026-001': { 2026: 50, 2027: 60, 2028: 70, 2029: 80, 2030: 90 },     // نسبة المستفيدين بحزمة التمكين
    // STR-2026-006 — تجربة المستفيد
    'IND-2026-011': { 2026: 75, 2027: 80, 2028: 85, 2029: 90, 2030: 95 },     // الالتزام بـ SLA
    'IND-2026-012': { 2026: 75, 2027: 80, 2028: 83, 2029: 87, 2030: 90 },     // رضا المستفيدين
    // STR-2026-007 — الاستدامة المالية (مُحدَّث ببيانات 2025 الفعلية)
    'IND-2026-002': { 2026: 500000, 2027: 700000, 2028: 1000000, 2029: 1300000, 2030: 1600000 }, // إيرادات معاهد شعاع المعالي (خط الأساس 409K)
    'IND-2026-003': { 2026: 7, 2027: 8, 2028: 8, 2029: 9, 2030: 9 },          // عدد مصادر الإيراد (خط الأساس 5)
    'IND-2026-004': { 2026: 100, 2027: 102, 2028: 105, 2029: 108, 2030: 110 }, // نسبة التعادل المالي
    'IND-2026-005': { 2026: 13, 2027: 17, 2028: 21, 2029: 26, 2030: 30 },     // نسبة الموارد الذاتية (خط الأساس 8.5%)
    // STR-2026-012 — التميز والجودة
    'IND-2026-013': { 2026: 1, 2027: 1, 2028: 2, 2029: 2, 2030: 3 },          // شهادات التميز
    // STR-2026-013 — التحول الرقمي
    'IND-2026-006': { 2026: 92, 2027: 93, 2028: 94, 2029: 94.5, 2030: 95 },   // الأتمتة الرقمية
    // STR-2026-016 — الشراكات
    'IND-2026-014': { 2026: 28, 2027: 36, 2028: 44, 2029: 52, 2030: 60 },     // الشراكات الفعّالة
    // STR-2026-017 — رأس المال البشري
    'IND-2026-007': { 2026: 60, 2027: 70, 2028: 80, 2029: 85, 2030: 90 },     // المراجعات السنوية
    'IND-2026-008': { 2026: 50, 2027: 65, 2028: 75, 2029: 85, 2030: 90 },     // خطة تطبيق تدريب
    'IND-2026-015': { 2026: 10000, 2027: 15000, 2028: 20000, 2029: 25000, 2030: 30000 }, // ساعات التطوع
    'IND-2026-016': { 2026: 200, 2027: 300, 2028: 400, 2029: 500, 2030: 600 }, // الشراكات الفعّالة وقيمتها
  };

  const cmEditor = userByName['عبدالرحمن عقيل'] || userByName['ايلاف حسن'];

  for (const [code, yearTargets] of Object.entries(targetsPlan)) {
    const ind = indByCode[code];
    if (!ind) { results.errors.push(`AnnualTarget: مؤشر ${code} غير موجود`); continue; }

    for (const [year, value] of Object.entries(yearTargets)) {
      try {
        const r = await api('POST', '/annual-targets', {
          indicatorId: ind.id,
          year: parseInt(year),
          targetValue: value,
          createdById: cmEditor,
        });
        results.phase1.push({ ind: code, year, value, ok: !!r?.ok });
      } catch (e) {
        results.errors.push({ phase: 1, code, year, error: e.message });
      }
    }
  }
  log(`✅ المرحلة 1: ${results.phase1.length} سجل AnnualTarget`);

  // ─────────────────────────────────────────────────
  // المرحلة 2: سجل المخاطر المؤسسية
  // ─────────────────────────────────────────────────
  log('\n━━ المرحلة 2: إنشاء سجل المخاطر ━━');

  const risks = [
    { title: 'تركّز التمويل في مصدرين/ثلاثة', category: 'مالية', impact: 'مرتفع', likelihood: 'متوسط',
      treatment: 'تنويع المصادر إلى 9 + برنامج المانحين الكبار + حملات موسمية',
      ownerName: 'نادية قلم' },
    { title: 'انخفاض التبرعات الموسمية (رمضان/الأضحى)', category: 'مالية', impact: 'مرتفع', likelihood: 'مرتفع',
      treatment: '6 حملات تبرع كبرى موسمية + احتياطي طارئ',
      ownerName: 'نادية قلم' },
    { title: 'فجوة سيولة في Q3', category: 'مالية', impact: 'متوسط', likelihood: 'متوسط',
      treatment: 'صندوق احتياطي + خط ائتمان مع بنك التنمية',
      ownerName: 'عبدالرحمن سحاقي' },
    { title: 'تعطّل منظومة Rafid ERP', category: 'تشغيلية', impact: 'مرتفع', likelihood: 'منخفض',
      treatment: 'نسخ احتياطي يومي مشفّر + اتفاقية SLA مع المزوّد + تدريب فريق على بدائل يدوية',
      ownerName: 'عبدالرحمن عقيل' },
    { title: 'تسرّب موظفين رئيسيين', category: 'تشغيلية', impact: 'متوسط', likelihood: 'متوسط',
      treatment: 'برنامج توثيق المعرفة + نواب لكل دور حرج + مراجعة الأداء السنوية',
      ownerName: 'خليل هادي' },
    { title: 'تأخّر تقارير GASTAT أو منصة الجمعيات', category: 'امتثال', impact: 'متوسط', likelihood: 'منخفض',
      treatment: 'تذكيرات آلية في QMS + مسؤول امتثال محدد + تدريب ربع سنوي',
      ownerName: 'ايلاف حسن' },
    { title: 'انتهاء شهادات (Z أو خصوصية البيانات)', category: 'امتثال', impact: 'مرتفع', likelihood: 'منخفض',
      treatment: 'تذكير 90 يوماً قبل الانتهاء + خطة تجديد محددة',
      ownerName: 'ايلاف حسن' },
    { title: 'تغيير تشريعي مفاجئ من وزارة الموارد البشرية', category: 'امتثال', impact: 'مرتفع', likelihood: 'منخفض',
      treatment: 'متابعة دورية + استشارة قانونية + خطة تكيُّف 90 يوماً',
      ownerName: 'عبدالرحمن عقيل' },
    { title: 'شكاوى مستفيدين متراكمة دون معالجة', category: 'سمعة', impact: 'متوسط', likelihood: 'منخفض',
      treatment: 'نظام شكاوى موثّق + SLA معالجة 5 أيام + تقرير ربعي',
      ownerName: 'خاتمة محرق' },
    { title: 'تغطية إعلامية سلبية أو تشكيك مجتمعي', category: 'سمعة', impact: 'مرتفع', likelihood: 'منخفض',
      treatment: 'سياسة إعلامية واضحة + بيانات شفافة ربعية + جاهزية الرد',
      ownerName: 'فاطمة عقيبي' },
    { title: 'حادث تسريب بيانات مستفيدين', category: 'سمعة + امتثال', impact: 'مرتفع', likelihood: 'منخفض',
      treatment: 'تشفير + صلاحيات بأدوار + سجل تدقيق + خطة استجابة حوادث',
      ownerName: 'ايلاف حسن' },
    { title: 'عدم قدرة الفريق على تحمّل عبء الخطة الإضافي', category: 'تشغيلية', impact: 'متوسط', likelihood: 'مرتفع',
      treatment: 'مراقبة أسبوعية للضغط + إعادة توزيع المهام + تأجيل ما يستوجب',
      ownerName: 'ايلاف حسن' },
  ];

  for (const r of risks) {
    try {
      const ownerId = userByName[r.ownerName];
      const result = await api('POST', '/risks', {
        title: r.title,
        category: r.category,
        impact: r.impact,
        likelihood: r.likelihood,
        treatment: r.treatment,
        ownerId,
        status: 'IDENTIFIED',
        earlyWarning: 'مراجعة ربعية في النظام',
      });
      results.phase2.push({ title: r.title, ok: !!result?.ok });
    } catch (e) {
      results.errors.push({ phase: 2, title: r.title, error: e.message });
    }
  }
  log(`✅ المرحلة 2: ${results.phase2.length} مخاطرة مسجَّلة`);

  // ─────────────────────────────────────────────────
  // المرحلة 3: تحديث ملاحظات STR-2026-003 (الواقع الفعلي)
  // ─────────────────────────────────────────────────
  log('\n━━ المرحلة 3: تنقية الادّعاءات الكبرى ━━');

  try {
    const str003 = goalByCode['STR-2026-003'];
    const newNotes = (str003.notes || '') + '\n\n[ضبط الواقع 2026-04-30] خط الأساس الفعلي 2,375 ملف معتمد. الهدف 2030: 4,500 ملف فريد (نمو 90%) — بدلاً من 13,000 الطموحي. المرجع: docs/baseline-2025-actual.md';
    await api('PATCH', `/strategic-goals/${str003.id}`, { notes: newNotes });
    results.phase3.push({ target: 'STR-2026-003 notes', ok: true });
  } catch (e) {
    results.errors.push({ phase: 3, target: 'STR-2026-003 notes', error: e.message });
  }

  // تعديل INI-2026-005 (كفالة 200 بدلاً من 870)
  try {
    const ini005 = iniByCode['INI-2026-005'];
    await api('PATCH', `/initiatives/${ini005.id}`, {
      name: 'كفالة 200 يتيم بحلول 2027 (مع نمو متدرّج للوصول لـ 250 بحلول 2030)',
    });
    results.phase3.push({ target: 'INI-2026-005 name', ok: true });
  } catch (e) {
    results.errors.push({ phase: 3, target: 'INI-2026-005 name', error: e.message });
  }
  log(`✅ المرحلة 3: ${results.phase3.length} تعديل`);

  // ─────────────────────────────────────────────────
  // المرحلة 4: FollowUpTasks لخطة الـ 30 يوماً
  // ─────────────────────────────────────────────────
  log('\n━━ المرحلة 4: مهام الـ 30 يوماً ━━');

  const week1Date = new Date('2026-05-07T23:59:59');
  const week2Date = new Date('2026-05-14T23:59:59');
  const week3Date = new Date('2026-05-21T23:59:59');
  const week4Date = new Date('2026-05-30T23:59:59');

  const tasks = [
    // الأسبوع 1 — خط الأساس
    { title: 'تقرير مالي 2025 رسمي يُثبت الإيرادات والموارد الذاتية', ownerName: 'عبدالرحمن سحاقي', dueDate: week1Date.toISOString() },
    { title: 'عدد الأسر المخدومة فعلياً 2025 من سجلات الرعاية', ownerName: 'خاتمة محرق', dueDate: week1Date.toISOString() },
    { title: 'قائمة الـ 18 شراكة الحالية بأسمائها وأدوارها', ownerName: 'فاطمة عقيبي', dueDate: week1Date.toISOString() },
    { title: 'تقرير عدد الموظفين والمتطوعين النشطين بتعريف "نشط"', ownerName: 'خليل هادي', dueDate: week1Date.toISOString() },
    // الأسبوع 2 — التعاريف والمستهدفات
    { title: 'اعتماد التعاريف الإجرائية الأربعة', ownerName: 'ايلاف حسن', dueDate: week2Date.toISOString() },
    { title: 'مراجعة AnnualTargets للسنوات 2027-2030 من المالكين', ownerName: 'ايلاف حسن', dueDate: week2Date.toISOString() },
    // الأسبوع 3 — التحقق
    { title: 'إدخال KpiEntries فعلية لـ Q1 2026', ownerName: 'ايلاف حسن', dueDate: week3Date.toISOString() },
    { title: 'فحص كل مبادرة IN_PROGRESS — توثيق التقدم أو إعادة لـ NOT_STARTED', ownerName: 'ايلاف حسن', dueDate: week3Date.toISOString() },
    { title: 'تحديث progress fields لكل هدف ومبادرة وفق الواقع', ownerName: 'ايلاف حسن', dueDate: week3Date.toISOString() },
    // الأسبوع 4 — العرض
    { title: 'كتابة وثيقة العرض الرسمية للمجلس', ownerName: 'عبدالرحمن عقيل', dueDate: week4Date.toISOString() },
    { title: 'جلسة بروفة داخلية — كل مالك يعرض هدفه', ownerName: 'عبدالرحمن عقيل', dueDate: week4Date.toISOString() },
    { title: 'إقرار CEO النهائي + إرسال للمجلس', ownerName: 'عبدالرحمن عقيل', dueDate: week4Date.toISOString() },
  ];

  for (const t of tasks) {
    try {
      const ownerId = userByName[t.ownerName];
      const r = await api('POST', '/follow-up-tasks', {
        title: t.title,
        ownerId,
        dueDate: t.dueDate,
        status: 'OPEN',
        priority: 'HIGH',
        category: 'STRATEGIC_PLAN_LAUNCH',
      });
      results.phase4.push({ title: t.title.slice(0, 50), ok: !!r?.ok });
    } catch (e) {
      results.errors.push({ phase: 4, title: t.title.slice(0, 50), error: e.message });
    }
  }
  log(`✅ المرحلة 4: ${results.phase4.length} مهمة متابعة`);

  // ─────────────────────────────────────────────────
  // المرحلة 5: ملخص التنفيذ
  // ─────────────────────────────────────────────────
  log('\n═════════ ملخص التنفيذ ═════════');
  log(`AnnualTargets:  ${results.phase1.length}`);
  log(`المخاطر:         ${results.phase2.length}`);
  log(`تنقية الأهداف:  ${results.phase3.length}`);
  log(`مهام المتابعة:  ${results.phase4.length}`);
  log(`الأخطاء:         ${results.errors.length}`);
  if (results.errors.length) {
    console.error('الأخطاء:', results.errors);
  }
  window._bulkResults = results;
  return results;
})();
