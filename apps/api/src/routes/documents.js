import { Router } from 'express';
import { crudRouter } from '../utils/crudFactory.js';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import { requireAction } from '../lib/permissions.js';
import { isAllowedFileKind } from '../lib/fileSignatures.js';
import { createSchema as docCreateSchema, updateSchema as docUpdateSchema } from '../schemas/document.schema.js';
import {
  approveDocument, obsoleteDocument, acknowledgeDocument, guardDocumentUpdate,
} from '../services/documentApproval.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dir, '..', '..', 'uploads', 'docs');

// Ensure upload directory exists (robust to read-only / wrong-owner volumes)
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {
  // Don't crash the server on boot — just warn. Uploads will fail later with
  // a clearer error. This handles Coolify's "volume mounted as root" gotcha.
  console.warn(`[documents] cannot create UPLOAD_DIR (${UPLOAD_DIR}):`, e.message);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${ts}${ext}`);
  },
});
// Blocklist of dangerous extensions — rejected before writing to disk.
// Defense-in-depth: magic-byte check (fileSignatures.js) runs post-write, but this
// stops obviously dangerous filenames even when mimetype is spoofed by the client.
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.dll', '.com', '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.vbe',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.php', '.php3', '.php4', '.php5', '.phtml',
  '.py', '.rb', '.pl', '.sh', '.bash', '.zsh', '.fish',
  '.jar', '.war', '.ear', '.class',
  '.asp', '.aspx', '.cer', '.cgi',
  '.htaccess', '.htpasswd',
]);

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    // 1. Extension check (client-side filename — fast gate before disk write)
    const ext = path.extname(file.originalname).toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return cb(new Error(`امتداد الملف "${ext}" غير مسموح به لأسباب أمنية`));
    }
    // 2. MIME type allowlist (client-provided — kept as secondary check)
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('نوع الملف غير مسموح به — PDF أو Word أو Excel أو صور فقط'));
  },
});

// حالة الوثيقة + قواعد الاعتماد/النشر نُقلت إلى services/documentApproval.js
// (ISO 7.5.3 — مصدر حقيقة واحد).

const router = crudRouter({
  model: 'document',
  resource: 'documents',
  codePrefix: 'DOC',
  searchFields: ['title', 'code'],
  include: {
    department: true,
    createdBy:  { select: { id: true, name: true } },
    approvedBy: { select: { id: true, name: true } },
    _count: { select: { acks: true, versions: true } },
  },
  allowedSortFields: ['createdAt', 'title', 'status'],
  schemas: { create: docCreateSchema, update: docUpdateSchema },
  smartFilters: {
    draft:     () => ({ status: 'DRAFT' }),
    published: () => ({ status: 'PUBLISHED' }),
    archived:  () => ({ status: 'ARCHIVED' }),
    governing: () => ({ governing: true }),
    mine:      (req) => ({ createdById: req.user.sub }),
    expiring:  () => {
      const soon = new Date(Date.now() + 30 * 86400000);
      return { status: 'PUBLISHED', reviewDate: { lt: soon } };
    },
    thisMonth: () => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      return { createdAt: { gte: d } };
    },
  },
  beforeCreate: async (data, req) => ({ ...data, createdById: req.user.sub, status: 'DRAFT' }),
  beforeUpdate: async (data, req) => {
    // حقول الاعتماد لا تُعدَّل إلا عبر /approve — ننزعها هنا دائماً
    delete data.approvedById;
    delete data.approvedAt;
    return guardDocumentUpdate(data, req.params.id);
  },
});

// POST /:id/approve — اعتماد رسمي (مع خيار publish)
router.post('/:id/approve', requireAction('documents', 'approve'), asyncHandler(async (req, res) => {
  const publish = req.body?.publish === true || req.body?.publish === 'true';
  const item = await approveDocument({
    docId:             req.params.id,
    userId:            req.user.sub,
    userRole:          req.user.role,
    publish,
    approvalReference: req.body?.approvalReference,
    approvalAuthority: req.body?.approvalAuthority,
    publicationUrl:    req.body?.publicationUrl,
  });
  res.json({ ok: true, item });
}));

// POST /:id/obsolete — سحب نهائي للوثيقة
router.post('/:id/obsolete', requireAction('documents', 'approve'), asyncHandler(async (req, res) => {
  const item = await obsoleteDocument({
    docId:    req.params.id,
    userRole: req.user.role,
  });
  res.json({ ok: true, item });
}));

// GET /:id/versions — سجل الإصدارات (ISO 7.5.3)
router.get('/:id/versions', requireAction('documents', 'read'), asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id, deletedAt: null },
    select: { id: true, code: true, title: true, currentVersion: true, status: true },
  });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  const versions = await prisma.docVersion.findMany({
    where: { documentId: req.params.id },
    orderBy: { uploadedAt: 'desc' },
  });
  res.json({ ok: true, document: doc, versions });
}));

// Acknowledge a document
router.post('/:id/ack', requireAction('documents', 'read'), asyncHandler(async (req, res) => {
  const ack = await acknowledgeDocument({
    docId:  req.params.id,
    userId: req.user.sub,
  });
  res.json({ ok: true, item: ack });
}));

// POST /:id/upload — رفع ملف إصدار جديد (ISO 7.5.3)
router.post('/:id/upload', requireAction('documents', 'update'), upload.single('file'), asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id, deletedAt: null } });
  if (!doc) throw NotFound('الوثيقة غير موجودة');
  if (!req.file) throw BadRequest('لم يتم إرفاق ملف');
  const uploadedBuffer = await fs.promises.readFile(req.file.path);
  if (!isAllowedFileKind(uploadedBuffer, ['pdf', 'ole-office', 'zip-office', 'jpg', 'png'])) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    throw BadRequest('محتوى الملف لا يطابق الأنواع المسموحة');
  }

  const version  = (req.body.version  || doc.currentVersion).trim();
  const changeLog = req.body.changeLog || null;

  // Save version record
  const ver = await prisma.docVersion.create({
    data: {
      documentId: doc.id,
      version,
      filePath:  req.file.filename,
      fileSize:  req.file.size,
      mimeType:  req.file.mimetype,
      changeLog,
    },
  });

  // Bump document's currentVersion to the uploaded version
  await prisma.document.update({
    where: { id: doc.id },
    data:  { currentVersion: version },
  });

  res.json({ ok: true, version: ver });
}));

// GET /:id/download/:versionId — تنزيل ملف إصدار
router.get('/:id/download/:versionId', requireAction('documents', 'read'), asyncHandler(async (req, res) => {
  const ver = await prisma.docVersion.findUnique({
    where: { id: req.params.versionId },
    include: { document: { select: { id: true, code: true, title: true } } },
  });
  if (!ver || ver.documentId !== req.params.id) throw NotFound('الملف غير موجود');

  const filePath = path.resolve(UPLOAD_DIR, ver.filePath);
  // منع Path Traversal — يجب أن يبقى المسار داخل UPLOAD_DIR
  if (!filePath.startsWith(UPLOAD_DIR + path.sep) && filePath !== UPLOAD_DIR) {
    throw BadRequest('مسار الملف غير مسموح به');
  }
  if (!fs.existsSync(filePath)) throw NotFound('الملف المادي غير موجود على الخادم');

  const ext = path.extname(ver.filePath);
  const safeName = `${ver.document.code}_v${ver.version}${ext}`;
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`);
  res.setHeader('Content-Type', ver.mimeType || 'application/octet-stream');
  res.sendFile(filePath);
}));

export default router;
