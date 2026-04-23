/**
 * excel-to-seed.mjs — قراءة ملفات Excel الحقيقية وتوليد seed-data.json
 *
 * المدخلات: ISO9001/الخطط والمشرات/*.xlsx
 * المخرجات: apps/api/prisma/seed-data.json (مُلتزم في git)
 *
 * الاستخدام:
 *   cd apps/api && node scripts/excel-to-seed.mjs
 *
 * ثم seed-from-json.mjs يقرأ الملف ويُعبّئ DB (idempotent).
 *
 * المحتوى المُستخرَج:
 *   - departments:  مستخرَج من أسماء الإدارات في ملف الموظفين (مُوحَّد)
 *   - users:        20 موظف من الموظفين.xlsx مع تعيين الأدوار تلقائياً
 *   - strategicGoals: أهداف استراتيجية من "الخطة الاستراتيجية"
 *   - operationalActivities: ~45 نشاط تشغيلي من "بيانات الخطة 2026"
 *   - kpiCatalog:   30 KPI من KPI_Playbook "KPI_Catalog"
 */
import ExcelJS from 'exceljs';
import { resolve, dirname } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXCEL_DIR = resolve(__dirname, '../../../ISO9001/الخطط والمشرات');
const OUTPUT    = resolve(__dirname, '../prisma/seed-data.json');

// ─── Utils ────────────────────────────────────────────────────────────
const cellStr = (cell) => {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    return String(v.text ?? v.result ?? (v.richText?.map(t=>t.text).join('')) ?? '').trim();
  }
  return String(v).trim();
};
const cellNum = (cell) => {
  const s = cellStr(cell).replace(/[^\d.\-]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const slugify = (s) => String(s).normalize('NFKD').replace(/[^\w\u0600-\u06FF]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

async function loadSheet(file, sheetName) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolve(EXCEL_DIR, file));
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in ${file}`);
  return ws;
}

// ─── 1. إدارات (Departments) — توحيد الأسماء ─────────────────────────
// مفتاح = اسم أو جزء من اسم في ملف الموظفين / قيمة = {code, name}
// توحيد الأحرف العربية المتشابهة (ة→ه, ى→ي, أإآ→ا) للتعامل مع الأخطاء الإملائية
const normalizeAr = (s) => String(s || '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const DEPT_ALIASES = [
  { match: /استراتيجي|استارتيجي|جوده|تميز/i,   code: 'QM',   name: 'وحدة التميز المؤسسي والجودة' },
  { match: /تنفيذي/i,                            code: 'ADM',  name: 'الإدارة التنفيذية العليا' },
  { match: /رعايه|اجتماعي|مستفيدين|مجتمعي/i,    code: 'SOC',  name: 'قسم الرعاية الاجتماعية والمستفيدين' },
  { match: /تنميه الموراد|تنميه الموارد|موارد الماليه|تنميه الماليه/i, code: 'RES', name: 'إدارة تنمية الموارد المالية' },
  { match: /شيون الماليه|شئون الماليه|الاداره الماليه|ماليه/i, code: 'FIN', name: 'إدارة الشؤون المالية' },
  { match: /مستودعات|مخازن/i,                    code: 'WH',   name: 'إدارة المخازن والمستودعات' },
  { match: /علاقات عامه|اعلام|اتصال/i,            code: 'COM',  name: 'إدارة العلاقات العامة والإعلام' },
  { match: /حركه|صيانه/i,                         code: 'MNT',  name: 'إدارة الحركة والصيانة' },
  { match: /دعم الميسسي|دعم الميسسي|موارد بشريه|بشريه/i, code: 'HR', name: 'إدارة الدعم المؤسسي والموارد البشرية' },
  { match: /تقييم|متابعه/i,                       code: 'MON',  name: 'إدارة التقييم والمتابعة' },
  { match: /تدريب|معهد/i,                         code: 'EDU',  name: 'المعهد / التدريب' },
];
const UNKNOWN_DEPT = { code: 'GEN', name: 'إدارة عامة' };

function mapDept(rawName) {
  if (!rawName) return UNKNOWN_DEPT;
  // قد يحتوي الموظف على عدة إدارات مفصولة بفاصلة — نأخذ الأولى
  const first = rawName.split(/[,،]/)[0].trim();
  const normalized = normalizeAr(first);
  for (const a of DEPT_ALIASES) if (a.match.test(normalized)) return { code: a.code, name: a.name };
  return UNKNOWN_DEPT;
}

// ─── 2. تخمين الدور حسب اسم الإدارة والوظيفة ───────────────────────
function guessRole(rawDept, email) {
  if (email === 'abdu808@gmail.com') return 'SUPER_ADMIN';
  const n = normalizeAr(rawDept);
  if (/جوده|تميز|استراتيجي|استارتيجي/i.test(n)) return 'QUALITY_MANAGER';
  if (/تنفيذي/i.test(n)) return 'DEPT_MANAGER';
  return 'EMPLOYEE';
}

// ─── 3. بناء البريد إذا كان مفقوداً ────────────────────────────────
function buildEmail(name, idx, existing) {
  if (existing && /@/.test(existing)) return existing.toLowerCase();
  const slug = slugify(name).slice(0, 20) || `emp${idx}`;
  return `${slug}${idx}@bir-sabya.local`;
}

// ═══ EXTRACTION ═══════════════════════════════════════════════════════
async function extractUsers() {
  const ws = await loadSheet('الموظفين.xlsx', 'Sheet1');
  // الأعمدة: 1=كود | 2=الإسم | 3=الهوية | 4=الجوال | 5=النوع | 6=المصدر | 7=هاتف أرضي | 8=بريد | 9=الإدارة
  const users = [];
  const deptSet = new Map();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const code = cellStr(row.getCell(1));
    const name = cellStr(row.getCell(2));
    if (!code || !name) continue;
    const phone  = cellStr(row.getCell(4));
    const rawEmail = cellStr(row.getCell(8));
    const rawDept  = cellStr(row.getCell(9));
    const dept = mapDept(rawDept);
    const email = buildEmail(name, r, rawEmail);
    const role  = guessRole(rawDept, email);

    deptSet.set(dept.code, dept.name);
    users.push({
      employeeCode: code,
      email,
      name,
      phone: phone || null,
      jobTitle: rawDept || null,
      role,
      departmentCode: dept.code,
      // لا نضع passwordHash هنا — يُحسَب عند الـ seed من DEFAULT_PASSWORD
    });
  }
  return { users, deptSet };
}

async function extractStrategicGoals() {
  const ws = await loadSheet('الخطة الاستراتيجية جمعية البر صبياء محدثة.xlsx', 'الخطة الاستراتيجية');
  // الأعمدة (من r4 عنوان، r5+ بيانات):
  // 1=مجال العمل  2=الهدف الاستراتيجي  3=المؤشر  4=خط الأساس
  // 5=2025  6=2026  7=2027  8=المجموع  9=المبادرات  10=البرامج 2025
  // ملاحظة: بعض الصفوف فيها shift، نتعامل بمرونة
  const goals = [];
  const seen = new Set();
  let counter = 0;
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const c1 = cellStr(row.getCell(1));
    const c2 = cellStr(row.getCell(2));
    const c3 = cellStr(row.getCell(3));
    if (!c1 && !c2) continue;
    // في بعض الصفوف c1 هو "مجال العمل" + c2 هو "الهدف" ، في أخرى c1 هو الهدف مباشرة
    const domain = (c1 && c2 && c1 !== c2) ? c1 : '';
    const title  = domain ? c2 : c1;
    const kpi    = domain ? c3 : c2;
    if (!title || title.length < 5) continue;
    const key = title.slice(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);
    counter++;

    goals.push({
      code: `STR-2026-${String(counter).padStart(3, '0')}`,
      title,
      perspective: domain || 'الخدمات والمستفيدون',
      kpi: kpi || null,
      baseline: cellStr(row.getCell(domain ? 4 : 3)) || null,
      target:   [cellStr(row.getCell(domain ? 5 : 4)), cellStr(row.getCell(domain ? 6 : 5)), cellStr(row.getCell(domain ? 7 : 6))].filter(Boolean).join(' / ') || null,
      initiatives: cellStr(row.getCell(domain ? 9 : 8)) || null,
      responsible: null,
      startYear: 2025,
      endYear: 2027,
    });
  }
  return goals;
}

async function extractOperationalActivities() {
  const ws = await loadSheet('الخطة_التشغيلية_2026_التنفيذ.xlsx', 'بيانات الخطة 2026');
  // r4 عناوين، r6 عنوان محور، r7+ بيانات
  // 1=م  2=المحور  3=البرنامج  4=المؤشر  5=المستهدف  6=تكلفة  7=عدد  8=إجمالي
  // 21=المسؤول  22=ملاحظات
  const activities = [];
  for (let r = 7; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const num = cellStr(row.getCell(1));
    const perspective = cellStr(row.getCell(2));
    const title = cellStr(row.getCell(3));
    if (!title || title.length < 3 || title.startsWith('◄')) continue;
    // تحقق: هل رقم (م) موجود؟ إذا لا → صف عنوان محور
    if (!num || isNaN(Number(num))) continue;

    const kpi        = cellStr(row.getCell(4));
    const targetRaw  = cellStr(row.getCell(5));
    const unitCost   = cellNum(row.getCell(6));
    const units      = cellNum(row.getCell(7));
    const totalCost  = cellNum(row.getCell(8));
    const responsible = cellStr(row.getCell(22));
    const notes      = cellStr(row.getCell(23));

    // استخراج رقم من المستهدف (مثلاً "870 شهرياً" → 870)
    const targetNum = cellNum({ value: targetRaw });

    activities.push({
      code: `ACT-2026-${String(activities.length + 1).padStart(3, '0')}`,
      title,
      description: notes || null,
      perspective: perspective || null,
      responsible: responsible || null,
      year: 2026,
      budget: totalCost || (unitCost && units ? unitCost * units : null),
      targetValue: targetNum,
      targetUnit:  /شهر/i.test(targetRaw) ? 'شهري' : (/%/.test(targetRaw) ? '%' : 'عدد'),
      kpi: kpi || null,
      status: 'PLANNED',
      kpiType: 'CUMULATIVE',
    });
  }
  return activities;
}

async function extractKpiCatalog() {
  const ws = await loadSheet('KPI_Playbook_v10.xlsx', 'KPI_Catalog');
  // r1 عناوين، r2+ بيانات
  // 1=code 2=name 3=type 4=domain 5=def 6=formula 7=unit 8=dir 9=freq 10=owner 11=source 12=sla_day 13=green 14=yellow 15=weight 16=lead/lag 17=notes
  const kpis = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const code = cellStr(row.getCell(1));
    const name = cellStr(row.getCell(2));
    if (!code || !name) continue;
    kpis.push({
      kpiCode: code,
      title: name,
      kpiType: cellStr(row.getCell(3)) || 'Operational',
      domain: cellStr(row.getCell(4)),
      definition: cellStr(row.getCell(5)),
      formula: cellStr(row.getCell(6)),
      unit: cellStr(row.getCell(7)) || 'عدد',
      direction: /up/i.test(cellStr(row.getCell(8))) ? 'HIGHER_BETTER' : 'LOWER_BETTER',
      frequency: cellStr(row.getCell(9)),
      ownerRole: cellStr(row.getCell(10)),
      dataSource: cellStr(row.getCell(11)),
      greenMin:  cellNum(row.getCell(13)),
      yellowMin: cellNum(row.getCell(14)),
      weightPct: cellNum(row.getCell(15)),
      notes: cellStr(row.getCell(17)),
    });
  }
  return kpis;
}

// ═══ MAIN ═════════════════════════════════════════════════════════════
async function main() {
  console.log('📂 قراءة ملفات Excel من:', EXCEL_DIR);

  const { users, deptSet } = await extractUsers();
  const departments = Array.from(deptSet.entries()).map(([code, name]) => ({ code, name, nameEn: null }));

  const strategicGoals        = await extractStrategicGoals();
  const operationalActivities = await extractOperationalActivities();
  const kpiCatalog            = await extractKpiCatalog();

  const payload = {
    generatedAt: new Date().toISOString(),
    generatedFrom: 'excel-to-seed.mjs',
    defaultPassword: 'ChangeMe@2026',  // يُستبدل في seed-from-json.mjs (bcrypt)
    departments,
    users,
    strategicGoals,
    operationalActivities,
    kpiCatalog,
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`\n✅ تم توليد ${OUTPUT}\n`);
  console.log(`   🏢 إدارات:             ${departments.length}`);
  console.log(`   👤 مستخدمون:           ${users.length}`);
  console.log(`   🎯 أهداف استراتيجية:   ${strategicGoals.length}`);
  console.log(`   📅 أنشطة تشغيلية:      ${operationalActivities.length}`);
  console.log(`   📊 مؤشرات (KPI):       ${kpiCatalog.length}`);
  console.log(`\n📝 افحص الملف ثم شغّل: node scripts/seed-from-json.mjs`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
