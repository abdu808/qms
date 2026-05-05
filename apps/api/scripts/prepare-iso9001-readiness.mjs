/**
 * Prepare ISO 9001 readiness evidence without pretending that unapproved work is complete.
 *
 * Usage:
 *   node scripts/prepare-iso9001-readiness.mjs
 *   node scripts/prepare-iso9001-readiness.mjs --apply
 *   node scripts/prepare-iso9001-readiness.mjs --apply --publish-approved-docs
 *
 * The default mode is a dry run. The --apply mode creates/updates foundational
 * records as drafts, planned records, or active registers. The
 * --publish-approved-docs mode is intentionally separate because document
 * publication is an approval decision, not a technical operation.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const PUBLISH_DOCS = args.has('--publish-approved-docs');
const NOW = new Date();

const nextDate = (iso) => new Date(`${iso}T09:00:00+03:00`);
const reviewDate = nextDate('2027-05-01');

const report = [];

function log(action, message) {
  report.push({ action, message });
  console.log(`${APPLY ? '[apply]' : '[dry-run]'} ${action}: ${message}`);
}

async function findActor() {
  const user =
    await prisma.user.findFirst({ where: { email: 'abdu808@gmail.com', active: true } }) ||
    await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', active: true } }) ||
    await prisma.user.findFirst({ where: { active: true } });
  if (!user) throw new Error('No active user found to own seeded ISO records.');
  return user;
}

async function findQualityOwner() {
  return (
    await prisma.user.findFirst({ where: { email: 'eylaf.ha12@gmail.com', active: true } }) ||
    await prisma.user.findFirst({ where: { role: 'QUALITY_MANAGER', active: true } }) ||
    await findActor()
  );
}

async function departmentsByCode() {
  const departments = await prisma.department.findMany({ where: { active: true } });
  return Object.fromEntries(departments.map((d) => [d.code, d]));
}

async function upsertByCode(modelName, code, createData, updateData = {}) {
  const model = prisma[modelName];
  if (!model) throw new Error(`Unknown Prisma model: ${modelName}`);

  const existing = await model.findUnique({ where: { code } }).catch(() => null);
  if (!APPLY) {
    log(existing ? 'skip' : 'create', `${modelName}.${code}`);
    return existing || { id: `dry-${code}`, code, ...createData };
  }

  if (existing) {
    const updated = Object.keys(updateData).length
      ? await model.update({ where: { code }, data: updateData })
      : existing;
    log('update', `${modelName}.${code}`);
    return updated;
  }

  const created = await model.create({ data: { code, ...createData } });
  log('create', `${modelName}.${code}`);
  return created;
}

async function prepareSwot(depts, owner) {
  const items = [
    ['ISO-SWOT-S01', 'STRENGTH', 'الخبرة الميدانية في خدمة المستفيدين', 'خبرة تراكمية في التعامل مع ملفات الأسر والأيتام والمساعدات العينية.', 'SOC'],
    ['ISO-SWOT-S02', 'STRENGTH', 'وجود نظام جودة إلكتروني ناشئ', 'النظام يحتوي على وحدات للوثائق والمؤشرات والتدقيق والتحسين يمكن البناء عليها.', 'QM'],
    ['ISO-SWOT-W01', 'WEAKNESS', 'ضعف اكتمال السجلات الإلكترونية', 'الوثائق موجودة، لكن سجلات التطبيق مثل التدقيق والتدريب والموردين تحتاج تعبئة واعتماد.', 'QM'],
    ['ISO-SWOT-W02', 'WEAKNESS', 'اعتماد بعض البيانات التشغيلية على أنظمة خارجية', 'بيانات رافد والمستفيدين لا بد أن تربط كمصدر بيانات موثق لا أن تنسخ دون تحقق.', 'SOC'],
    ['ISO-SWOT-O01', 'OPPORTUNITY', 'رفع جاهزية ISO 9001 خلال 2026', 'وجود البنية والوثائق يسمح بإغلاق فجوات الجاهزية قبل الربع الثالث.', 'QM'],
    ['ISO-SWOT-O02', 'OPPORTUNITY', 'تحسين تجربة المستفيد عبر القياس الدوري', 'يمكن تحويل استبيانات الرضا والمتابعة إلى مدخل رئيس للتحسين.', 'SOC'],
    ['ISO-SWOT-T01', 'THREAT', 'تأخر إدخال القراءات والسجلات', 'تأخر الإدخال يضعف مصداقية التقارير والمراجعة الإدارية.', 'QM'],
    ['ISO-SWOT-T02', 'THREAT', 'ضغط الموارد البشرية والمالية', 'محدودية التوظيف والموارد قد تؤثر على التنفيذ إذا لم تكن الخطة رشيقة.', 'ADM'],
  ];

  for (const [code, type, category, description, deptCode] of items) {
    await upsertByCode('swotItem', code, {
      type,
      category,
      description,
      impact: 'مرتبط بجاهزية نظام إدارة الجودة وتنفيذ الخطة.',
      strategy: 'متابعة شهرية ضمن موجه الأداء والجودة وسجل الجاهزية.',
      status: 'ACTIVE',
      reviewDate,
      ownerUserId: owner.id,
      departmentId: depts[deptCode]?.id,
    }, {
      status: 'ACTIVE',
      reviewDate,
      ownerUserId: owner.id,
      departmentId: depts[deptCode]?.id,
    });
  }
}

async function prepareInterestedParties(depts, owner) {
  const items = [
    ['IP-ISO-001', 'المستفيدون والأسر', 'BENEFICIARY', 'خدمة عادلة، خصوصية، وضوح شروط الاستحقاق، سرعة استجابة.', 'رضا مستفيد وقياس تجربة الخدمة ومعالجة الشكاوى.', 'SOC'],
    ['IP-ISO-002', 'الأيتام والكافلون', 'BENEFICIARY_DONOR', 'استمرارية الكفالة، توثيق الصرف، ووضوح أثر الكفالة.', 'تقارير دورية واستبقاء الكافلين وتحسين تجربة الكفالة.', 'SOC'],
    ['IP-ISO-003', 'المتبرعون والمانحون', 'DONOR', 'شفافية، أثر موثق، سلامة مالية، قنوات تواصل واضحة.', 'تقارير أثر وحوكمة تبرعات وحملات.', 'RES'],
    ['IP-ISO-004', 'مجلس الإدارة', 'GOVERNANCE', 'تقارير أداء دقيقة ومخاطر واضحة وقرارات مبنية على بيانات.', 'مراجعة إدارية ربعية ولوحة مؤشرات.', 'ADM'],
    ['IP-ISO-005', 'الموظفون', 'EMPLOYEE', 'وضوح الأدوار، تدريب، بيئة عمل مناسبة، تعليمات محدثة.', 'خطة كفاءة وتدريب وتواصل داخلي.', 'HR'],
    ['IP-ISO-006', 'الموردون ومقدمو الخدمة', 'SUPPLIER', 'معايير تقييم واضحة، تعامل عادل، أوامر شراء موثقة.', 'قائمة موردين وتقييم دوري.', 'FIN'],
    ['IP-ISO-007', 'الجهات الرقابية والمانحة الرسمية', 'REGULATOR', 'التزام نظامي، تقارير، حفظ سجلات، استجابة للملاحظات.', 'ضبط وثائق وسجلات ومراجعة امتثال.', 'QM'],
    ['IP-ISO-008', 'المجتمع المحلي والشركاء', 'COMMUNITY', 'مبادرات ذات أثر، شراكات موثقة، تواصل مؤسسي.', 'خطة شراكات وتطوع واتصال.', 'COM'],
  ];

  for (const [code, name, type, needs, expectations, deptCode] of items) {
    await upsertByCode('interestedParty', code, {
      name,
      type,
      needs,
      expectations,
      influence: 'مرتفع',
      monitoring: 'مراجعة نصف سنوية ضمن المراجعة الإدارية وسجل الأطراف المعنية.',
      responsible: depts[deptCode]?.manager || owner.name,
      status: 'ACTIVE',
      responsibleUserId: owner.id,
      departmentId: depts[deptCode]?.id,
    }, {
      status: 'ACTIVE',
      responsibleUserId: owner.id,
      departmentId: depts[deptCode]?.id,
    });
  }
}

async function prepareProcesses(depts, owner) {
  const items = [
    ['PROC-ISO-001', 'إدارة الخطة والمؤشرات', 'MANAGEMENT', 'الخطة المعتمدة، المؤشرات، قراءات الأداء', 'تقارير أداء، انحرافات، قرارات متابعة', 'انتظام إدخال القراءات، نسبة المؤشرات المحققة', 'QM'],
    ['PROC-ISO-002', 'إدارة ملفات المستفيدين والاستحقاق', 'CORE', 'طلبات المستفيدين، بيانات رافد، معايير الاستحقاق', 'قرار استحقاق، قوائم خدمة، تحديث ملف', 'رضا المستفيد، اكتمال بيانات المستفيد', 'SOC'],
    ['PROC-ISO-003', 'الكفالات والرعاية', 'CORE', 'ملفات الأيتام والكافلين، بيانات الكفالة', 'كفالات مستمرة، تقارير كافلين', 'استبقاء الكافلين، عدد الأيتام المكفولين', 'SOC'],
    ['PROC-ISO-004', 'المساعدات العينية والمستودع', 'CORE', 'أوامر صرف، قوائم مستفيدين، مخزون', 'توزيع موثق، جرد، محاضر استلام', 'نسبة الالتزام بأوامر الصرف والتوزيع', 'WH'],
    ['PROC-ISO-005', 'تنمية الموارد والتبرعات', 'SUPPORT', 'حملات، مانحون، تبرعات', 'إيرادات موثقة، تقارير مانحين', 'نمو الإيرادات غير المقيدة، استبقاء المانحين', 'RES'],
    ['PROC-ISO-006', 'المشتريات والموردون', 'SUPPORT', 'طلبات شراء، عروض، عقود', 'مورد معتمد، تقييم مورد، أمر شراء', 'نسبة الموردين المقيمين والمعتمدين', 'FIN'],
    ['PROC-ISO-007', 'الموارد البشرية والكفاءة', 'SUPPORT', 'وصف وظيفي، احتياج تدريبي، أداء موظف', 'خطة تدريب، سجل كفاءة، تقييم أداء', 'ساعات التدريب، رضا الموظفين', 'HR'],
    ['PROC-ISO-008', 'التدقيق والتحسين المستمر', 'MANAGEMENT', 'خطة تدقيق، شكاوى، NCR، فرص تحسين', 'تقرير تدقيق، CAPA، دروس مستفادة', 'إغلاق CAPA بفعالية، تنفيذ التدقيق', 'QM'],
  ];

  for (const [code, name, type, inputs, outputs, kpis, deptCode] of items) {
    await upsertByCode('process', code, {
      name,
      type,
      owner: depts[deptCode]?.manager || owner.name,
      inputs,
      outputs,
      resources: 'النظام الإلكتروني، ملفات رافد عند اللزوم، الموظفون المختصون، الوثائق المعتمدة.',
      kpis,
      risks: 'تأخر الإدخال، ضعف اكتمال الدليل، عدم وضوح المسؤوليات، الاعتماد على بيانات خارجية غير موثقة.',
      description: 'عملية تأسيسية ضمن جاهزية ISO 9001 لعام 2026.',
      status: 'ACTIVE',
      ownerUserId: owner.id,
      departmentId: depts[deptCode]?.id,
    }, {
      status: 'ACTIVE',
      ownerUserId: owner.id,
      departmentId: depts[deptCode]?.id,
    });
  }
}

async function prepareRisks(depts, actor, qm) {
  const items = [
    ['RSK-ISO-001', 'تأخر إدخال قراءات المؤشرات الشهرية', 'غياب البيانات في وقتها يضعف المتابعة والمراجعة الإدارية.', 4, 4, 'متابعة أسبوعية للمتأخرات وتنبيهات تلقائية.', 'QM'],
    ['RSK-ISO-002', 'عدم اكتمال نشر واعتماد الوثائق', 'وجود الوثيقة كملف دون اعتماد داخل النظام لا يكفي للتدقيق.', 4, 5, 'حصر الوثائق الأساسية واعتمادها قبل التدقيق الداخلي.', 'QM'],
    ['RSK-ISO-003', 'ضعف أدلة التدريب والكفاءة', 'عدم وجود سجلات تدريب وتقييم كفاءة قد يضعف بند 7.2.', 3, 4, 'تنفيذ توعية ISO وخطة تدريب مرتبطة بالوظائف الحرجة.', 'HR'],
    ['RSK-ISO-004', 'عدم تنفيذ تدقيق داخلي فعلي قبل التدقيق الخارجي', 'التدقيق الخارجي يتوقع وجود تدقيق داخلي ومخرجات معالجة.', 4, 5, 'جدولة تدقيق داخلي شامل قبل نهاية الربع الثاني.', 'QM'],
    ['RSK-ISO-005', 'عدم اكتمال تقييم الموردين', 'الموردون المؤثرون على الخدمة يحتاجون تقييم واعتماد.', 3, 3, 'تحديد الموردين الرئيسيين وتقييمهم قبل المراجعة الإدارية.', 'FIN'],
    ['RSK-ISO-006', 'ضعف قياس رضا المستفيدين', 'غياب قياس الرضا يضعف بند 9.1.2 ومؤشرات تجربة الخدمة.', 3, 4, 'إطلاق استبيان رضا بسيط وربطه بقنوات الخدمة.', 'SOC'],
    ['RSK-ISO-007', 'تشتت مصادر بيانات المستفيدين بين النظام ورافد', 'عدم توثيق مصدر البيانات قد يسبب تضارباً في التقارير.', 3, 4, 'اعتماد رافد كمصدر بيانات مرجعي مع تسجيل قراءة مؤشرات مختصرة في QMS.', 'SOC'],
    ['OPP-ISO-001', 'تحويل موجه الأداء والجودة إلى متابعة دورية', 'فرصة لتقليل العبء على الإدارة وتحسين الانضباط الشهري.', 3, 4, 'تشغيل تقرير شهري آلي بالمطلوب والمتأخر والانحرافات.', 'QM'],
  ];

  for (const [code, title, description, probability, impact, treatment, deptCode] of items) {
    const score = probability * impact;
    const level = score >= 20 ? 'حرج' : score >= 15 ? 'مرتفع' : score >= 8 ? 'متوسط' : 'منخفض';
    await upsertByCode('risk', code, {
      type: code.startsWith('OPP') ? 'OPPORTUNITY' : 'RISK',
      title,
      description,
      source: 'مراجعة جاهزية ISO 9001',
      departmentId: depts[deptCode]?.id,
      probability,
      impact,
      score,
      level,
      treatment,
      treatmentType: code.startsWith('OPP') ? 'استثمار الفرصة' : 'تخفيف',
      earlyWarning: 'ظهور تأخر أو نقص في لوحة الجاهزية أو سجل المتابعات.',
      ownerId: qm.id,
      status: 'IDENTIFIED',
      reviewDate: nextDate('2026-06-30'),
      createdById: actor.id,
      workflowState: 'DRAFT',
    }, {
      ownerId: qm.id,
      status: 'IDENTIFIED',
      reviewDate: nextDate('2026-06-30'),
    });
  }
}

async function prepareDocuments(depts, actor, qm) {
  const status = PUBLISH_DOCS ? 'PUBLISHED' : 'UNDER_REVIEW';
  const approvedFields = PUBLISH_DOCS
    ? { approvedById: actor.id, approvedAt: NOW, effectiveDate: NOW }
    : {};

  const items = [
    ['ISO-DOC-001', 'دليل نظام إدارة الجودة ISO 9001', 'MANUAL', '4.0-10.0', 'QM'],
    ['ISO-DOC-002', 'نطاق نظام إدارة الجودة', 'MANUAL', '4.3', 'QM'],
    ['ISO-DOC-003', 'سياسة الجودة', 'POLICY', '5.2', 'QM'],
    ['ISO-DOC-004', 'أهداف الجودة ومؤشرات الأداء', 'POLICY', '6.2', 'QM'],
    ['ISO-DOC-005', 'إجراء إدارة المخاطر والفرص', 'PROCEDURE', '6.1', 'QM'],
    ['ISO-DOC-006', 'إجراء ضبط الوثائق والسجلات', 'PROCEDURE', '7.5', 'QM'],
    ['ISO-DOC-007', 'إجراء الموارد البشرية والكفاءة والتدريب', 'PROCEDURE', '7.2', 'HR'],
    ['ISO-DOC-008', 'إجراء المستفيدين والشكاوى وقياس الرضا', 'PROCEDURE', '8.2,9.1.2', 'SOC'],
    ['ISO-DOC-009', 'إجراء الموردين والمشتريات', 'PROCEDURE', '8.4', 'FIN'],
    ['ISO-DOC-010', 'إجراء التدقيق الداخلي', 'PROCEDURE', '9.2', 'QM'],
    ['ISO-DOC-011', 'إجراء المراجعة الإدارية', 'PROCEDURE', '9.3', 'QM'],
    ['ISO-DOC-012', 'إجراء عدم المطابقة والإجراء التصحيحي CAPA', 'PROCEDURE', '10.2', 'QM'],
  ];

  for (const [code, title, category, isoClause, deptCode] of items) {
    await upsertByCode('document', code, {
      title,
      category,
      departmentId: depts[deptCode]?.id,
      currentVersion: '1.0',
      status,
      effectiveDate: PUBLISH_DOCS ? NOW : null,
      reviewDate,
      retentionYears: 5,
      isoClause,
      isPublic: false,
      createdById: actor.id,
      ...approvedFields,
    }, {
      status,
      reviewDate,
      ...approvedFields,
    });
  }

  if (!PUBLISH_DOCS) {
    log('approval-required', 'الوثائق الأساسية أصبحت تحت المراجعة. لا تنشر إلا بعد اعتماد المدير التنفيذي/الجودة.');
  }
}

async function prepareCompetenceAndTraining(depts, actor) {
  const competencies = [
    ['COMP-ISO-001', 'مدير الجودة/رئيس وحدة الاستراتيجية والجودة', 'QM', 'فهم ISO 9001، التدقيق الداخلي، إدارة CAPA، تحليل مؤشرات الأداء'],
    ['COMP-ISO-002', 'مدير الخدمة المجتمعية', 'SOC', 'إدارة ملفات المستفيدين، معايير الاستحقاق، سرية البيانات، قياس رضا المستفيد'],
    ['COMP-ISO-003', 'مسؤول المساعدات العينية والمستودع', 'WH', 'توثيق أوامر الصرف، الجرد، محاضر الاستلام، مطابقة قوائم المستفيدين'],
    ['COMP-ISO-004', 'مسؤول المالية/الموردين', 'FIN', 'ضبط الموردين، تقييم العروض، الالتزام المالي، توثيق الصرف'],
    ['COMP-ISO-005', 'مسؤول الموارد البشرية/التدريب', 'HR', 'مصفوفة الكفاءة، خطة التدريب، سجلات التقييم، بيئة العمل'],
  ];

  for (const [code, jobTitle, deptCode, skills] of competencies) {
    await upsertByCode('competenceRequirement', code, {
      jobTitle,
      department: depts[deptCode]?.name,
      departmentId: depts[deptCode]?.id,
      requiredSkills: skills,
      minEducation: 'ثانوي/دبلوم فأعلى حسب طبيعة الوظيفة',
      minExperience: 1,
      certifications: deptCode === 'QM' ? 'دورة أساسيات ISO 9001 أو تدقيق داخلي' : 'حسب طبيعة العمل',
      trainings: 'توعية ISO 9001، ضبط السجلات، الخصوصية وحماية البيانات',
      evaluationMethod: 'اختبار/ملاحظة أداء/مراجعة سجلات العمل',
      status: 'ACTIVE',
    }, {
      status: 'ACTIVE',
      departmentId: depts[deptCode]?.id,
    });
  }

  await upsertByCode('training', 'TRN-ISO-2026-001', {
    title: 'توعية الموظفين بنظام إدارة الجودة ISO 9001',
    description: 'جلسة تأسيسية لشرح سياسة الجودة، الأدوار، السجلات المطلوبة، وآلية التعامل مع الشكاوى وعدم المطابقة.',
    trainer: 'مدير الجودة / موجه الأداء والجودة',
    date: nextDate('2026-05-20'),
    duration: 2,
    location: 'مقر الجمعية / عن بعد',
    category: 'ISO 9001',
    competenceTarget: 'فهم نظام الجودة والسجلات المطلوبة لكل قسم',
  }, {
    date: nextDate('2026-05-20'),
  });
}

async function prepareCommunication(actor, qm) {
  const items = [
    ['COMM-ISO-001', 'تنبيه قراءات المؤشرات الشهرية', 'مالكو المؤشرات ومدخلو البيانات', 'تذكير بإدخال البيانات قبل التصعيد', 'داخل النظام / واتساب عند التفعيل', 'شهرياً', qm.name],
    ['COMM-ISO-002', 'تقرير جاهزية ISO', 'المدير التنفيذي ومدير الجودة', 'متابعة فجوات الجاهزية والاعتمادات المطلوبة', 'لوحة النظام + تقرير مختصر', 'أسبوعياً حتى التدقيق', qm.name],
    ['COMM-ISO-003', 'توعية سياسة الجودة', 'جميع الموظفين', 'ضمان فهم السياسة والأدوار', 'اجتماع توعوي + إقرار إلكتروني', 'عند الإصدار ثم سنوياً', qm.name],
    ['COMM-ISO-004', 'متابعة الشكاوى والرضا', 'الخدمة المجتمعية والإدارة التنفيذية', 'تحسين تجربة المستفيد ومعالجة الشكاوى', 'تقرير شهري', 'شهرياً', 'إدارة الخدمة المجتمعية'],
    ['COMM-ISO-005', 'متابعة الموردين والتقييم', 'المالية والدعم المؤسسي', 'ضبط الموردين المؤثرين على جودة الخدمة', 'سجل تقييم الموردين', 'نصف سنوي', 'الإدارة المالية'],
  ];

  for (const [code, topic, audience, purpose, channel, frequency, responsible] of items) {
    await upsertByCode('communicationPlan', code, {
      topic,
      audience,
      purpose,
      channel,
      frequency,
      responsible,
      format: 'سجل إلكتروني/تقرير مختصر',
      status: 'ACTIVE',
      responsibleUserId: qm.id || actor.id,
    }, {
      status: 'ACTIVE',
      responsibleUserId: qm.id || actor.id,
    });
  }
}

async function prepareAuditAndReview(depts, actor, qm) {
  await upsertByCode('audit', 'AUD-ISO-2026-001', {
    title: 'تدقيق داخلي استعدادي لنظام ISO 9001',
    type: 'INTERNAL',
    scope: 'جميع العمليات المؤثرة على نظام إدارة الجودة: الوثائق، المؤشرات، المستفيدين، الموردين، التدريب، التدقيق والتحسين.',
    criteria: 'ISO 9001:2015 clauses 4-10 + إجراءات الجمعية المعتمدة',
    plannedDate: nextDate('2026-06-15'),
    leadAuditorId: qm.id,
    team: 'مدير الجودة، ممثل الإدارة، أصحاب العمليات',
    status: 'PLANNED',
    departmentId: depts.QM?.id,
  }, {
    plannedDate: nextDate('2026-06-15'),
    leadAuditorId: qm.id,
    status: 'PLANNED',
  });

  await upsertByCode('managementReview', 'MR-ISO-2026-001', {
    title: 'المراجعة الإدارية الأولى لنظام إدارة الجودة 2026',
    meetingDate: nextDate('2026-06-30'),
    period: 'يناير - يونيو 2026',
    attendees: 'المدير التنفيذي، مدير الجودة، مدراء الإدارات، ممثل المالية، ممثل الخدمة المجتمعية',
    status: 'PLANNED',
    contextChanges: 'يتم تحديثه بعد استكمال سجل السياق والأطراف المعنية.',
    objectivesReview: 'مراجعة أداء مؤشرات الخطة وقراءات 2026.',
    processPerformance: 'مراجعة أداء العمليات الأساسية والداعمة.',
    conformityStatus: 'يعتمد على نتائج التدقيق الداخلي وسجل NCR/CAPA.',
    auditResults: 'يحدث بعد تنفيذ التدقيق الداخلي AUD-ISO-2026-001.',
    customerFeedback: 'يحدث بعد تفعيل استبيان رضا المستفيدين وسجل الشكاوى.',
    risksStatus: 'مراجعة سجل المخاطر والفرص.',
    improvementOpps: 'إغلاق فجوات الجاهزية، تحسين انتظام البيانات، تحسين قياس الرضا.',
    nextReview: nextDate('2026-09-30'),
    planId: null,
    year: 2026,
  }, {
    meetingDate: nextDate('2026-06-30'),
    status: 'PLANNED',
    nextReview: nextDate('2026-09-30'),
  });
}

async function prepareSuppliers(actor) {
  const suppliers = [
    ['SUP-ISO-001', 'مزود خدمات تقنية المعلومات والاستضافة', 'IT_SERVICES', 'تشغيل النظام والدعم التقني'],
    ['SUP-ISO-002', 'مورد السلال والمواد العينية', 'GOODS', 'توريد السلال والمواد العينية'],
    ['SUP-ISO-003', 'مقدم خدمات التدريب والاستشارات', 'CONSULTING', 'تدريب واستشارات جودة وتطوير مؤسسي'],
  ];

  for (const [code, name, type, category] of suppliers) {
    const supplier = await upsertByCode('supplier', code, {
      name,
      type,
      category,
      status: 'PENDING',
      notes: 'سجل تأسيسي يحتاج اعتماد/استبدال باسم المورد الحقيقي قبل التدقيق.',
    }, {
      status: 'PENDING',
      notes: 'سجل تأسيسي يحتاج اعتماد/استبدال باسم المورد الحقيقي قبل التدقيق.',
    });

    if (supplier?.id && APPLY) {
      const evalCode = `${code}-EVAL-2026`;
      const existing = await prisma.supplierEval.findUnique({ where: { code: evalCode } }).catch(() => null);
      if (!existing) {
        await prisma.supplierEval.create({
          data: {
            code: evalCode,
            supplierId: supplier.id,
            evaluatorId: actor.id,
            period: '2026-H1',
            criteriaJson: JSON.stringify({ quality: 20, delivery: 20, responsiveness: 20, price: 20, documentation: 20 }),
            totalScore: 0,
            maxScore: 100,
            percentage: 0,
            grade: 'قيد التقييم',
            decision: 'قيد الاعتماد',
            notes: 'تقييم تأسيسي فارغ يحتاج تعبئة بالبيانات الفعلية قبل اعتماد المورد.',
            workflowState: 'DRAFT',
          },
        });
        log('create', `supplierEval.${evalCode}`);
      } else {
        log('skip', `supplierEval.${evalCode}`);
      }
    } else if (!APPLY) {
      log('create', `supplierEval.${code}-EVAL-2026`);
    }
  }
}

async function prepareSurveyAndCapa(actor, qm) {
  await upsertByCode('survey', 'SURV-ISO-2026-001', {
    title: 'استبيان رضا المستفيدين عن تجربة الخدمة',
    target: 'BENEFICIARY',
    period: '2026-H1',
    responses: 0,
    avgScore: null,
    questionsJson: JSON.stringify([
      { q: 'ما مدى رضاك عن وضوح إجراءات الخدمة؟', scale: 5 },
      { q: 'ما مدى رضاك عن سرعة الاستجابة؟', scale: 5 },
      { q: 'ما مدى احترام الخصوصية والكرامة أثناء تقديم الخدمة؟', scale: 5 },
      { q: 'ما مدى رضاك عن جودة الخدمة المقدمة؟', scale: 5 },
      { q: 'ملاحظات أو مقترحات للتحسين', type: 'text' },
    ]),
    active: true,
    isPublic: true,
  }, {
    active: true,
    isPublic: true,
  });

  await upsertByCode('capa', 'CAPA-ISO-2026-001', {
    type: 'CORRECTIVE',
    status: 'OPEN',
    title: 'إغلاق فجوات جاهزية ISO 9001 قبل التدقيق الداخلي',
    description: 'إجراء تصحيحي تأسيسي لإغلاق فجوات السجلات: السياق، الأطراف المعنية، العمليات، المخاطر، الوثائق، التدريب، الموردين، الرضا، التدقيق والمراجعة الإدارية.',
    sourceType: 'ISO_READINESS',
    sourceCode: 'ISO-READINESS-2026',
    rootCauseAnalysis: 'البنية الوثائقية موجودة جزئياً، لكن السجلات التشغيلية داخل النظام غير مكتملة.',
    plannedAction: 'تعبئة السجلات التأسيسية، تنفيذ التدقيق الداخلي، عقد المراجعة الإدارية، واعتماد الوثائق الأساسية.',
    dueDate: nextDate('2026-06-30'),
    ownerId: qm.id,
    createdById: actor.id,
  }, {
    status: 'OPEN',
    dueDate: nextDate('2026-06-30'),
    ownerId: qm.id,
  });
}

async function main() {
  const actor = await findActor();
  const qm = await findQualityOwner();
  const depts = await departmentsByCode();

  console.log(`ISO readiness preparation mode: ${APPLY ? 'APPLY' : 'DRY_RUN'}${PUBLISH_DOCS ? ' + PUBLISH_DOCS' : ''}`);
  console.log(`Actor: ${actor.name} <${actor.email}>`);
  console.log(`Quality owner: ${qm.name} <${qm.email}>`);

  await prepareSwot(depts, qm);
  await prepareInterestedParties(depts, qm);
  await prepareProcesses(depts, qm);
  await prepareRisks(depts, actor, qm);
  await prepareDocuments(depts, actor, qm);
  await prepareCompetenceAndTraining(depts, actor);
  await prepareCommunication(actor, qm);
  await prepareAuditAndReview(depts, actor, qm);
  await prepareSuppliers(actor);
  await prepareSurveyAndCapa(actor, qm);

  console.log('\nApproval pack:');
  console.log('1. اعتماد نشر الوثائق ISO-DOC-001..012 بعد المراجعة.');
  console.log('2. اعتماد موعد التدقيق الداخلي AUD-ISO-2026-001 بتاريخ 2026-06-15.');
  console.log('3. اعتماد موعد المراجعة الإدارية MR-ISO-2026-001 بتاريخ 2026-06-30.');
  console.log('4. استبدال سجلات الموردين التأسيسية بأسماء الموردين الحقيقيين أو اعتمادها.');
  console.log('5. اعتماد إطلاق استبيان رضا المستفيدين SURV-ISO-2026-001.');
  console.log('6. تكليف مدير الجودة بمتابعة CAPA-ISO-2026-001 حتى الإغلاق.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
