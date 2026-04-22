/**
 * uploader.mjs — يحفظ الملف المُحلَّل في قاعدة البيانات مباشرة عبر Prisma
 *
 * لا نستخدم REST API هنا لأن:
 *   - الـ CLI يعمل محلياً من نفس المشروع
 *   - Prisma access مباشر أسرع ولا يحتاج JWT
 *   - نتجنب تعقيد الـ auth tokens
 */
import { PrismaClient } from '@prisma/client';
import { readFile, copyFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const prisma = new PrismaClient();

/** يُولِّد كود فريد حسب النوع */
async function generateCode(prefix, model) {
  const year = new Date().getFullYear();
  const count = await prisma[model].count();
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * يرفع ملفاً واحداً حسب suggestedModule
 * @param {object} item — { filename, folder, filePath, analysis, textPreview }
 * @param {string} createdById — ID مستخدم الإنشاء
 * @returns { success, model, id, code, error? }
 */
export async function uploadItem(item, createdById) {
  const { analysis, filename } = item;
  const mod = analysis.suggestedModule || 'Document';

  try {
    switch (mod) {
      case 'QualityPolicy':  return await uploadPolicy(item);
      case 'Announcement':   return await uploadAnnouncement(item);
      case 'StrategicGoal':  return await uploadStrategicGoal(item);
      case 'OperationalActivity': return await uploadActivity(item);
      case 'Document':
      case 'Other':
      default:               return await uploadDocument(item, createdById);
    }
  } catch (e) {
    return { success: false, model: mod, error: e.message, filename };
  }
}

async function uploadDocument(item, createdById) {
  const { analysis, filename, filePath } = item;
  const code = await generateCode('DOC', 'document');

  // اختيار category حسب التحليل
  const categoryMap = {
    policy: 'POLICY', manual: 'MANUAL', procedure: 'PROCEDURE',
    form: 'FORM', report: 'RECORD',
  };
  const docCategory = categoryMap[analysis.category] || 'RECORD';

  const doc = await prisma.document.create({
    data: {
      code,
      title: analysis.title.slice(0, 200),
      category: docCategory,
      status: 'DRAFT',
      isoClause: analysis.isoClause || null,
      currentVersion: analysis.version || '1.0',
      createdById,
    },
  });

  // نسخ الملف إلى مجلد التخزين + إنشاء DocVersion
  if (filePath && existsSync(filePath)) {
    try {
      const storageDir = path.join(process.cwd(), 'storage', 'documents', doc.id);
      await mkdir(storageDir, { recursive: true });
      const destName = `v${doc.currentVersion}_${path.basename(filePath)}`;
      const dest = path.join(storageDir, destName);
      await copyFile(filePath, dest);
      const { stat } = await import('fs/promises');
      const fileStat = await stat(filePath);
      const lower = filename.toLowerCase();
      const mime =
        lower.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' :
        lower.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
        lower.endsWith('.md')   ? 'text/markdown' :
        lower.endsWith('.txt')  ? 'text/plain' :
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      await prisma.docVersion.create({
        data: {
          documentId: doc.id,
          version: doc.currentVersion,
          filePath: path.relative(process.cwd(), dest).replace(/\\/g, '/'),
          fileSize: fileStat.size,
          mimeType: mime,
          changeLog: `استيعاب أولي عبر ingestion layer — ${analysis.summary.slice(0, 200)}`,
        },
      });
    } catch (e) {
      console.warn(`  ⚠️  [${filename}] فشل نسخ الملف: ${e.message}`);
    }
  }

  return { success: true, model: 'Document', id: doc.id, code: doc.code, title: doc.title };
}

async function uploadPolicy(item) {
  const { analysis, textPreview } = item;
  // قد توجد سياسة نشطة — نُنشئ الجديدة غير نشطة
  const version = analysis.version || `1.${Date.now() % 1000}`;
  // احترام unique constraint على version
  const exists = await prisma.qualityPolicy.findUnique({ where: { version } });
  const v = exists ? `${version}-${Date.now().toString().slice(-4)}` : version;

  const policy = await prisma.qualityPolicy.create({
    data: {
      version: v,
      title: analysis.title.slice(0, 200),
      content: textPreview || analysis.summary,
      approvedBy: analysis.approvedBy || null,
      approvedAt: parseDateSafe(analysis.extractedDate),
      active: false, // يُفعَّل يدوياً من الأدمن
    },
  });

  return { success: true, model: 'QualityPolicy', id: policy.id, code: `POL-v${v}`, title: policy.title };
}

async function uploadAnnouncement(item) {
  const { analysis, textPreview } = item;
  const ann = await prisma.announcement.create({
    data: {
      title: analysis.title.slice(0, 200),
      summary: analysis.summary.slice(0, 500),
      body: textPreview || analysis.summary,
      category: 'إعلان',
      isActive: false, // يُفعَّل يدوياً
      publishedAt: parseDateSafe(analysis.extractedDate) || new Date(),
    },
  });
  return { success: true, model: 'Announcement', id: ann.id, code: `ANN-${ann.id.slice(0, 8)}`, title: ann.title };
}

async function uploadStrategicGoal(item) {
  const { analysis } = item;

  // ── حالة 1: الـ AI استخرج مصفوفة أهداف (strategic_plan مع goals) ────────
  if (Array.isArray(analysis.goals) && analysis.goals.length > 0) {
    const year = new Date().getFullYear();
    const currentCount = await prisma.strategicGoal.count();

    const created = [];
    for (let i = 0; i < analysis.goals.length; i++) {
      const g = analysis.goals[i];
      if (!g.title?.trim()) continue;

      const seq  = currentCount + created.length + 1;
      const code = `STR-${year}-${String(seq).padStart(4, '0')}`;

      // تجاهل إذا كان الهدف مكرراً (نفس العنوان موجود بالفعل)
      const exists = await prisma.strategicGoal.findFirst({
        where: { title: g.title.trim(), deletedAt: null },
      });
      if (exists) {
        created.push({ skipped: true, code: exists.code, title: exists.title });
        continue;
      }

      const goal = await prisma.strategicGoal.create({
        data: {
          code,
          title:       g.title.trim().slice(0, 200),
          perspective: g.perspective?.trim() || null,
          kpi:         g.kpi?.trim()         || null,
          baseline:    g.baseline?.trim()    || null,
          target:      g.target?.trim()      || null,
          initiatives: g.initiatives?.trim() || null,
          responsible: g.responsible?.trim() || null,
          notes:       analysis.summary,
          status:      'PLANNED',
        },
      });
      created.push({ code: goal.code, title: goal.title, id: goal.id });
    }

    const newGoals    = created.filter(g => !g.skipped);
    const skippedGoals = created.filter(g => g.skipped);
    return {
      success: true,
      model:   'StrategicGoal',
      count:   newGoals.length,
      skipped: skippedGoals.length,
      goals:   created,
      // أول هدف كـ id رئيسي للتوافق مع الـ logger
      id:    newGoals[0]?.id    || null,
      code:  newGoals[0]?.code  || created[0]?.code  || 'STR-??',
      title: `${newGoals.length} أهداف استراتيجية مستخرجة${skippedGoals.length ? ` (${skippedGoals.length} موجود مسبقاً)` : ''}`,
    };
  }

  // ── حالة 2: fallback — لا توجد مصفوفة (وثيقة أخرى صُنِّفت كـ StrategicGoal) ──
  const code = await generateCode('STR', 'strategicGoal');
  const goal = await prisma.strategicGoal.create({
    data: {
      code,
      title: analysis.title.slice(0, 200),
      notes: analysis.summary,
      status: 'PLANNED',
    },
  });
  return { success: true, model: 'StrategicGoal', id: goal.id, code, title: goal.title };
}

async function uploadActivity(item) {
  const { analysis } = item;
  const code = await generateCode('ACT', 'operationalActivity');
  const act = await prisma.operationalActivity.create({
    data: {
      code,
      title: analysis.title.slice(0, 200),
      description: analysis.summary,
      status: 'PLANNED',
      year: new Date().getFullYear(),
    },
  });
  return { success: true, model: 'OperationalActivity', id: act.id, code, title: act.title };
}

function parseDateSafe(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** يُحصل على ID أول SUPER_ADMIN (للحقل createdById) */
export async function getAdminUserId() {
  const u = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!u) throw new Error('لا يوجد SUPER_ADMIN — شغّل npm run seed أولاً');
  return u.id;
}

export async function disconnect() {
  await prisma.$disconnect();
}
