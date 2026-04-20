import bcrypt from 'bcrypt';
import { prisma } from './db.js';
import { config } from './config.js';

async function main() {
  console.log('[seed] starting...');

  // ── الأقسام التنظيمية الحقيقية (12 قسماً) ──────────────────────────────
  // يجب أن تتطابق مع seed-strategic-plan.mjs بالضبط
  const depts = [
    { code: 'QM',  name: 'وحدة التميز المؤسسي والجودة',   nameEn: 'Quality & Excellence Unit',    manager: 'مدير الجودة' },
    { code: 'ADM', name: 'الإدارة التنفيذية العليا',       nameEn: 'Executive Management',          manager: 'المدير التنفيذي' },
    { code: 'SOC', name: 'قسم الرعاية الاجتماعية',        nameEn: 'Social Care Department',        manager: 'رئيس قسم الرعاية' },
    { code: 'KAF', name: 'قسم الكفالات',                  nameEn: 'Sponsorship Department',        manager: 'رئيس قسم الكفالات' },
    { code: 'EMP', name: 'قسم التمكين والتنمية',           nameEn: 'Empowerment Department',        manager: 'رئيس قسم التمكين' },
    { code: 'FIN', name: 'إدارة الشؤون المالية',           nameEn: 'Finance Department',            manager: 'المدير المالي' },
    { code: 'RES', name: 'إدارة تنمية الموارد المالية',    nameEn: 'Resource Development',          manager: 'مدير تنمية الموارد' },
    { code: 'INV', name: 'وحدة الاستثمار والأصول',         nameEn: 'Investment & Assets Unit',      manager: 'مسؤول الاستثمار' },
    { code: 'COM', name: 'إدارة الاتصال المؤسسي والتطوع',  nameEn: 'Communications & Volunteering', manager: 'مدير الاتصال' },
    { code: 'HR',  name: 'إدارة الموارد البشرية',          nameEn: 'Human Resources',               manager: 'مدير الموارد البشرية' },
    { code: 'IT',  name: 'وحدة تقنية المعلومات',           nameEn: 'Information Technology',        manager: 'مسؤول تقنية المعلومات' },
    { code: 'MKT', name: 'إدارة التسويق والحملات',         nameEn: 'Marketing & Campaigns',         manager: 'مدير التسويق' },
  ];
  for (const d of depts) {
    await prisma.department.upsert({ where: { code: d.code }, update: { name: d.name, nameEn: d.nameEn, manager: d.manager }, create: d });
  }
  console.log(`[seed] أقسام: ${depts.length} قسماً ✓`);

  // ── المستخدم المدير ──────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash(config.admin.password, config.bcryptRounds);
  const qmDept = await prisma.department.findUnique({ where: { code: 'QM' } });
  const adminUser = await prisma.user.upsert({
    where: { email: config.admin.email.toLowerCase() },
    update: {},
    create: {
      email: config.admin.email.toLowerCase(),
      passwordHash: adminPasswordHash,
      name: config.admin.name,
      role: 'SUPER_ADMIN',
      departmentId: qmDept?.id,
      jobTitle: 'مسؤول النظام',
    },
  });

  // ── مدير الجودة ──────────────────────────────────────────────────────────
  const qmPassword = process.env.QM_PASSWORD || `QM@${new Date().getFullYear()}!${Math.random().toString(36).slice(2, 8)}`;
  const qmPwd = await bcrypt.hash(qmPassword, config.bcryptRounds);
  const qmUser = await prisma.user.upsert({
    where: { email: 'quality@bir-sabia.org.sa' },
    update: {},
    create: {
      email: 'quality@bir-sabia.org.sa',
      passwordHash: qmPwd,
      name: 'مدير الجودة',
      role: 'QUALITY_MANAGER',
      departmentId: qmDept?.id,
      jobTitle: 'مدير الجودة',
    },
  });
  if (qmUser.createdAt >= new Date(Date.now() - 5000)) {
    console.log(`[seed] Quality Manager: quality@bir-sabia.org.sa — set QM_PASSWORD env to control password`);
  }

  // ── سياسة الجودة (الإصدار الأول) ─────────────────────────────────────────
  // يُنشئ فقط إذا لم تكن موجودة — seed-strategic-plan.mjs لا يُنشئها
  const policyExists = await prisma.qualityPolicy.findFirst();
  if (!policyExists) {
    await prisma.qualityPolicy.create({
      data: {
        version: '1.0',
        title: 'سياسة الجودة — جمعية البر بصبيا',
        content: `تلتزم جمعية البر بصبيا بتقديم خدمات إنسانية واجتماعية عالية الجودة تلبّي احتياجات المستفيدين وتتجاوز توقعاتهم، في إطار من الحوكمة الرشيدة والشفافية والمسؤولية.

نسعى إلى التحسين المستمر لأنظمتنا وعملياتنا وكفاءات كوادرنا، وفق متطلبات نظام إدارة الجودة ISO 9001:2015 ومتطلبات المستفيدين والأطراف ذات المصلحة.

نؤمن بأن الجودة مسؤولية الجميع، وأن التميز المؤسسي هو الطريق إلى تحقيق أهدافنا الاستراتيجية وخدمة مجتمعنا بإتقان وإخلاص.`,
        commitments: JSON.stringify([
          'استيفاء متطلبات المستفيدين والأطراف ذات المصلحة',
          'الالتزام بالتحسين المستمر لفاعلية نظام إدارة الجودة',
          'توفير الموارد اللازمة لتحقيق الأهداف الاستراتيجية',
          'بناء بيئة عمل تشجّع على الابتكار والتطوير',
          'الامتثال للمتطلبات التنظيمية والتشريعية المعمول بها',
        ]),
        approvedBy: config.admin.name || 'المدير التنفيذي',
        approvedAt: new Date('2026-01-01'),
        effectiveDate: new Date('2026-01-01'),
        reviewDate: new Date('2027-01-01'),
        active: true,
      },
    });
    console.log('[seed] سياسة الجودة v1.0: أُنشئت ✓');
  } else {
    console.log('[seed] سياسة الجودة: موجودة — تخطّي');
  }

  // ── ملاحظة: الأهداف والمخاطر تُنشئها seed-strategic-plan.mjs ─────────────
  // لا تُنشئ بيانات تجريبية هنا — تجنّباً للتعارض في الأكواد

  console.log('[seed] done ✓');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
