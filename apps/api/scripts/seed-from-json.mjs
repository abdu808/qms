/**
 * seed-from-json.mjs — تعبئة DB من seed-data.json (idempotent)
 *
 * يقرأ: prisma/seed-data.json (المُولَّد من excel-to-seed.mjs)
 * يكتب: Departments, Users, StrategicGoals, OperationalActivities, Objectives (KPIs)
 *
 * كلّها upsert على code/email — آمن للتشغيل المتكرر.
 * يُشَغَّل تلقائياً من startup.sh عند أول deploy (إذا الـ JSON موجود و DB فارغ).
 *
 * تشغيل يدوي:
 *   node scripts/seed-from-json.mjs
 *   node scripts/seed-from-json.mjs --force   # تخطّي فحص "DB فارغ"
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '../prisma/seed-data.json');
const force     = process.argv.includes('--force');

const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function main() {
  // ── بوابة أمان: يعمل فقط بطلب صريح ─────────────────────────────────
  // SEED_FROM_JSON=on  →  يقرأ الملف ويعبّئ DB
  // بدونها            →  يتخطّى (حتى لو seed-data.json موجود)
  // السبب: seed-data.json خاص بكل منظمة، لا ينبغي تعبئته تلقائياً في كل deploy
  if (process.env.SEED_FROM_JSON !== 'on' && !force) {
    console.log('ℹ️  SEED_FROM_JSON!=on — تخطّي (شغّل مع SEED_FROM_JSON=on أو --force للتنفيذ)');
    return;
  }

  if (!existsSync(SEED_PATH)) {
    console.log(`ℹ️  ${SEED_PATH} غير موجود — تخطّي seed-from-json`);
    return;
  }
  const data = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  console.log(`📄 seed-data.json (مُولَّد: ${data.generatedAt})`);

  // فحص "هل نحتاج seed؟" — إذا كان هناك عدد كبير من المستخدمين، تخطّى إلا مع --force
  const existingUsers = await prisma.user.count();
  if (existingUsers > 3 && !force) {
    console.log(`ℹ️  يوجد ${existingUsers} مستخدم — DB ليس فارغاً، تخطّي. استخدم --force للتجاوز.`);
    return;
  }

  // ─── 1. Departments (upsert على code) ────────────────────────────────
  console.log('\n🏢 الإدارات...');
  const deptMap = new Map();  // code → id
  for (const d of data.departments) {
    const rec = await prisma.department.upsert({
      where:  { code: d.code },
      update: { name: d.name, nameEn: d.nameEn, active: true },
      create: { code: d.code, name: d.name, nameEn: d.nameEn, active: true },
    });
    deptMap.set(d.code, rec.id);
  }
  console.log(`   ✅ ${deptMap.size} إدارة`);

  // ─── 2. Users (upsert على email + hash password) ─────────────────────
  console.log('\n👤 المستخدمون...');
  const hash = await bcrypt.hash(data.defaultPassword || 'ChangeMe@2026', 10);
  let userCreated = 0, userUpdated = 0;
  for (const u of data.users) {
    const deptId = deptMap.get(u.departmentCode) || null;
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      await prisma.user.update({
        where: { email: u.email },
        data: {
          name: u.name, role: u.role, departmentId: deptId,
          phone: u.phone, jobTitle: u.jobTitle, active: true,
        },
      });
      userUpdated++;
    } else {
      await prisma.user.create({
        data: {
          email: u.email, name: u.name, role: u.role,
          passwordHash: hash, mustChangePassword: true,
          departmentId: deptId, phone: u.phone, jobTitle: u.jobTitle,
          active: true,
        },
      });
      userCreated++;
    }
  }
  console.log(`   ✅ مُنشأ: ${userCreated} · محدَّث: ${userUpdated} (كلمة مرور افتراضية: ${data.defaultPassword})`);

  // للاستخدام في createdById
  const firstAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }, select: { id: true },
  }) || await prisma.user.findFirst({ select: { id: true } });
  if (!firstAdmin) throw new Error('لا يوجد مستخدم صالح كمنشئ — seed فشل');

  // ─── 3. Strategic Goals (upsert على code) ────────────────────────────
  console.log('\n🎯 الأهداف الاستراتيجية...');
  for (const g of data.strategicGoals) {
    await prisma.strategicGoal.upsert({
      where:  { code: g.code },
      update: { title: g.title, perspective: g.perspective, kpi: g.kpi,
                baseline: g.baseline, target: g.target, initiatives: g.initiatives,
                responsible: g.responsible, startYear: g.startYear, endYear: g.endYear },
      create: { ...g, status: 'PLANNED', progress: 0 },
    });
  }
  console.log(`   ✅ ${data.strategicGoals.length} هدف`);

  // ─── 4. Operational Activities (upsert على code) ─────────────────────
  console.log('\n📅 الأنشطة التشغيلية...');
  for (const a of data.operationalActivities) {
    await prisma.operationalActivity.upsert({
      where:  { code: a.code },
      update: { title: a.title, description: a.description, perspective: a.perspective,
                responsible: a.responsible, year: a.year, budget: a.budget,
                targetValue: a.targetValue, targetUnit: a.targetUnit, kpiType: a.kpiType },
      create: { ...a, progress: 0 },
    });
  }
  console.log(`   ✅ ${data.operationalActivities.length} نشاط`);

  // ─── 5. KPI Catalog → Objectives (هدف جودة لكل KPI) ─────────────────
  console.log('\n📊 مؤشرات KPI...');
  let kpiCreated = 0;
  for (const k of data.kpiCatalog) {
    const code = `OBJ-${k.kpiCode}`;
    const existing = await prisma.objective.findUnique({ where: { code } });
    if (existing) continue;  // لا نُحدِّث الـ Objectives الموجودة لتجنّب كسر بيانات فعلية
    await prisma.objective.create({
      data: {
        code,
        title: k.title,
        description: [k.definition, k.formula ? `الصيغة: ${k.formula}` : null].filter(Boolean).join('\n'),
        kpi: k.title,
        baseline: null,
        target: k.greenMin || 100,
        unit: k.unit,
        currentValue: null,
        startDate: new Date('2026-01-01'),
        dueDate:   new Date('2026-12-31'),
        status: 'PLANNED',
        progress: 0,
        direction: k.direction,
        kpiType: 'SNAPSHOT',
        createdById: firstAdmin.id,
      },
    });
    kpiCreated++;
  }
  console.log(`   ✅ ${kpiCreated} مؤشر جديد (من أصل ${data.kpiCatalog.length})`);

  console.log('\n✨ تم seed-from-json بنجاح');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
