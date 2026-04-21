/**
 * routes/import.js — استيراد البيانات من Excel (router رئيسي)
 *
 * GET  /api/import/template/:entity   → تحميل نموذج Excel فارغ
 * POST /api/import/preview/:entity    → رفع ملف + معاينة (بدون حفظ)
 * POST /api/import/confirm/:entity    → رفع ملف + استيراد فعلي
 */

import { Router } from 'express';
import multer     from 'multer';
import { BadRequest, Forbidden } from '../utils/errors.js';
import { buildTemplate, parseFile } from './import/_helpers.js';
import { ENTITIES as PEOPLE_ENTITIES,   IMPORTERS as PEOPLE_IMPORTERS }     from './import/importPeople.js';
import { ENTITIES as OPS_ENTITIES,      IMPORTERS as OPS_IMPORTERS }         from './import/importOperations.js';
import { ENTITIES as STRATEGIC_ENTITIES, IMPORTERS as STRATEGIC_IMPORTERS } from './import/importStrategic.js';

const router = Router();

// ─── دمج جميع الكيانات والمستوردين ───────────────────────────────────────────
const ENTITIES  = { ...PEOPLE_ENTITIES,   ...OPS_ENTITIES,      ...STRATEGIC_ENTITIES };
const IMPORTERS = { ...PEOPLE_IMPORTERS,  ...OPS_IMPORTERS,     ...STRATEGIC_IMPORTERS };

// ─── Multer: ذاكرة فقط، حد 10MB ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (
      file.mimetype.includes('spreadsheet') ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      cb(null, true);
    } else {
      cb(new Error('يجب أن يكون الملف بصيغة Excel (.xlsx)'));
    }
  },
});

// ─── صلاحية الاستيراد ────────────────────────────────────────────────────────
function requireImportRole(req, res, next) {
  if (!['SUPER_ADMIN', 'QUALITY_MANAGER'].includes(req.user?.role)) {
    return next(Forbidden('يتطلب صلاحية مدير الجودة أو أعلى'));
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════════════════════════════════

// قائمة الكيانات المدعومة
router.get('/entities', requireImportRole, async (req, res) => {
  const list = Object.entries(ENTITIES).map(([key, def]) => ({
    key,
    label: def.label,
    sheetName: def.sheetName,
    columns: def.columns.length,
    requiredColumns: def.columns.filter(c => c.required).length,
  }));
  res.json({ ok: true, entities: list });
});

// تحميل نموذج Excel
router.get('/template/:entity', requireImportRole, async (req, res, next) => {
  try {
    const entity = req.params.entity;
    if (!ENTITIES[entity]) throw BadRequest(`نوع غير مدعوم: ${entity}`);

    const wb = await buildTemplate(entity, ENTITIES);
    const buf = await wb.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="template-${entity}.xlsx"`);
    res.send(buf);
  } catch (err) { next(err); }
});

// معاينة — تحليل الملف بدون حفظ
router.post('/preview/:entity', requireImportRole, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw BadRequest('يرجى رفع ملف Excel');
    const entity = req.params.entity;
    if (!ENTITIES[entity]) throw BadRequest(`نوع غير مدعوم: ${entity}`);

    const { records, errors } = await parseFile(entity, req.file.buffer, ENTITIES);

    res.json({
      ok: true,
      entity,
      label: ENTITIES[entity].label,
      total:    records.length + errors.length,
      valid:    records.length,
      errorCount: errors.length,
      errors,
      preview: records.slice(0, 20).map(r => ({ row: r.row, data: r.data })),
      hasMore: records.length > 20,
    });
  } catch (err) { next(err); }
});

// استيراد فعلي
router.post('/confirm/:entity', requireImportRole, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw BadRequest('يرجى رفع ملف Excel');
    const entity = req.params.entity;
    if (!ENTITIES[entity]) throw BadRequest(`نوع غير مدعوم: ${entity}`);

    const importer = IMPORTERS[entity];
    if (!importer) throw BadRequest(`مستورد غير متاح لـ: ${entity}`);

    const { records, errors: parseErrors } = await parseFile(entity, req.file.buffer, ENTITIES);

    if (parseErrors.length > 0 && records.length === 0) {
      throw BadRequest('الملف يحتوي على أخطاء — لم يُستورد شيء');
    }

    const result = await importer(records, req.user.id);

    res.json({
      ok: true,
      entity,
      label: ENTITIES[entity].label,
      created:    result.created,
      updated:    result.updated,
      parseErrors,
      importErrors: result.errors,
      total: result.created + result.updated,
    });
  } catch (err) { next(err); }
});

export default router;
