import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeHtml } from '../utils/html.js';
import { BadRequest, NotFound, Unauthorized } from '../utils/errors.js';
import { upsertKpiEntry, isPeriodLocked } from '../services/kpi.js';
import { isDueMonth, frequencyLabel } from '../lib/kpiFrequency.js';

const router = Router();
const TOKEN_VERSION = 1;
const DEFAULT_TTL_DAYS = 45;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(data) {
  return crypto.createHmac('sha256', config.jwt.secret).update(data).digest('base64url');
}

export function createKpiEntryToken(payload, { ttlDays = DEFAULT_TTL_DAYS } = {}) {
  const body = {
    v: TOKEN_VERSION,
    kind: payload.kind,
    id: payload.id,
    year: Number(payload.year),
    month: Number(payload.month),
    userId: payload.userId,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 86400,
  };
  const encoded = base64url(JSON.stringify(body));
  return `${encoded}.${sign(encoded)}`;
}

function verifyKpiEntryToken(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) throw Unauthorized('رابط الإدخال غير صالح');
  const expected = sign(encoded);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw Unauthorized('رابط الإدخال غير صالح');
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw Unauthorized('رابط الإدخال غير صالح');
  }
  if (payload.v !== TOKEN_VERSION) throw Unauthorized('رابط الإدخال غير صالح');
  if (!['indicator', 'activity', 'objective'].includes(payload.kind)) throw Unauthorized('رابط الإدخال غير صالح');
  if (!payload.id || !payload.userId) throw Unauthorized('رابط الإدخال غير مكتمل');
  if (Number(payload.exp) < Math.floor(Date.now() / 1000)) throw Unauthorized('انتهت صلاحية رابط الإدخال');
  const year = Number(payload.year);
  const month = Number(payload.month);
  if (!Number.isInteger(year) || year < 2020 || year > new Date().getFullYear() + 2) throw Unauthorized('سنة الإدخال غير صالحة');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw Unauthorized('شهر الإدخال غير صالح');
  return { ...payload, year, month };
}

async function loadEntryContext(payload) {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.isActive === false) throw NotFound('المستخدم المرتبط بالرابط غير متاح');

  if (payload.kind === 'indicator') {
    const item = await prisma.indicator.findFirst({
      where: {
        id: payload.id,
        deletedAt: null,
        OR: [{ dataEntryUserId: user.id }, { ownerId: user.id }],
      },
      include: {
        annualTargets: { where: { year: payload.year }, take: 1 },
        kpiEntries: { where: { year: payload.year, month: payload.month }, take: 1 },
        strategicGoal: { select: { title: true, perspective: true } },
      },
    });
    if (!item) throw NotFound('المؤشر غير متاح لهذا الرابط');
    if (!isDueMonth(item.frequency, payload.month, item.seasonality)) {
      throw BadRequest(`هذا المؤشر تردده ${frequencyLabel(item.frequency)} ولا توجد قراءة مطلوبة لهذه الفترة`);
    }
    return {
      user,
      item,
      kind: 'indicator',
      title: item.nameAr,
      code: item.code,
      unit: item.unit,
      targetValue: item.annualTargets?.[0]?.targetValue ?? null,
      existing: item.kpiEntries?.[0] || null,
      goalTitle: item.strategicGoal?.title,
    };
  }

  if (payload.kind === 'activity') {
    const item = await prisma.operationalActivity.findFirst({
      where: { id: payload.id, deletedAt: null },
      include: {
        kpiEntries: { where: { year: payload.year, month: payload.month }, take: 1 },
        strategicGoal: { select: { title: true, perspective: true } },
      },
    });
    if (!item) throw NotFound('النشاط غير متاح لهذا الرابط');
    return {
      user,
      item,
      kind: 'activity',
      title: item.title,
      code: item.code,
      unit: item.targetUnit,
      targetValue: item.targetValue ?? null,
      existing: item.kpiEntries?.[0] || null,
      goalTitle: item.strategicGoal?.title,
    };
  }

  const item = await prisma.objective.findFirst({
    where: { id: payload.id, deletedAt: null, ownerId: user.id },
    include: {
      kpiEntries: { where: { year: payload.year, month: payload.month }, take: 1 },
      strategicGoal: { select: { title: true, perspective: true } },
    },
  });
  if (!item) throw NotFound('الهدف التشغيلي غير متاح لهذا الرابط');
  return {
    user,
    item,
    kind: 'objective',
    title: item.title,
    code: item.code,
    unit: item.unit,
    targetValue: item.target ?? null,
    existing: item.kpiEntries?.[0] || null,
    goalTitle: item.strategicGoal?.title,
  };
}

router.get('/:token', asyncHandler(async (req, res) => {
  const payload = verifyKpiEntryToken(req.params.token);
  const ctx = await loadEntryContext(payload);
  const lock = await isPeriodLocked(payload.year, payload.month);
  res.send(formPage(req.params.token, payload, ctx, lock));
}));

router.post('/:token', asyncHandler(async (req, res) => {
  const payload = verifyKpiEntryToken(req.params.token);
  await loadEntryContext(payload);

  const actualValue = Number(req.body.actualValue);
  if (!Number.isFinite(actualValue) || actualValue < 0) {
    throw BadRequest('القيمة الفعلية مطلوبة ويجب أن تكون رقماً موجباً');
  }
  const spent = req.body.spent === '' || req.body.spent == null ? null : Number(req.body.spent);
  if (spent != null && (!Number.isFinite(spent) || spent < 0)) {
    throw BadRequest('المصروف يجب أن يكون رقماً موجباً عند إدخاله');
  }

  const data = {
    year: payload.year,
    month: payload.month,
    actualValue,
    spent,
    note: String(req.body.note || '').trim().slice(0, 2000) || null,
    evidenceUrl: String(req.body.evidenceUrl || '').trim().slice(0, 500) || null,
    deviationReason: String(req.body.deviationReason || '').trim().slice(0, 4000) || null,
    actionNote: String(req.body.actionNote || '').trim().slice(0, 4000) || null,
    userId: payload.userId,
    userRole: 'EMPLOYEE',
  };
  if (payload.kind === 'indicator') data.indicatorId = payload.id;
  if (payload.kind === 'activity') data.activityId = payload.id;
  if (payload.kind === 'objective') data.objectiveId = payload.id;

  const result = await prisma.$transaction(async (tx) => upsertKpiEntry({ ...data, tx }));
  res.send(successPage(result));
}));

const baseStyle = `
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box} body{margin:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f3f7f4;direction:rtl;color:#14251d;min-height:100vh;padding:24px 12px}
    .wrap{width:100%;max-width:680px;margin:auto}.card{background:#fff;border:1px solid #dfe9e3;border-radius:18px;box-shadow:0 16px 40px rgba(21,37,29,.08);overflow:hidden}
    .header{background:linear-gradient(135deg,#176b3a,#2e8b57);color:#fff;padding:26px 30px}.brand{font-size:.82rem;opacity:.9;margin-bottom:10px}
    h1{font-size:1.45rem;line-height:1.45;margin:0 0 8px}.subtitle{font-size:.92rem;opacity:.92;line-height:1.7}
    .body{padding:24px 30px}.info{background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;border-radius:14px;padding:12px 14px;margin-bottom:18px;font-size:.9rem;line-height:1.8}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px}.box small{display:block;color:#64748b;margin-bottom:4px}.box b{font-size:1.05rem}
    label{display:block;font-weight:800;margin:14px 0 7px;color:#22352b;font-size:.95rem}.req{color:#dc2626}
    input,textarea{width:100%;border:1.5px solid #cfded5;border-radius:12px;padding:12px 14px;font-size:.98rem;font-family:inherit;direction:rtl;background:#fff}
    input:focus,textarea:focus{outline:none;border-color:#2e8b57;box-shadow:0 0 0 3px rgba(46,139,87,.12)}.hint{color:#64748b;font-size:.78rem;margin-top:5px;line-height:1.7}
    .submit-btn{width:100%;background:#176b3a;color:#fff;border:none;padding:15px;border-radius:13px;font-size:1rem;font-weight:900;cursor:pointer;margin-top:16px}.submit-btn:hover{background:#145c32}
    .warning{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:10px 12px;margin-top:12px;font-size:.86rem}
    .footer{text-align:center;font-size:.78rem;color:#64748b;padding:16px;border-top:1px solid #edf2ef;background:#fbfdfb}.status{padding:42px 30px;text-align:center}.status h1{color:#166534}
    @media(max-width:560px){.body,.header{padding:20px 16px}.grid{grid-template-columns:1fr}}
  </style>
`;

function formPage(token, payload, ctx, lock) {
  const title = escapeHtml(ctx.title || '');
  const code = escapeHtml(ctx.code || '');
  const userName = escapeHtml(ctx.user?.name || '');
  const target = ctx.targetValue == null ? '-' : escapeHtml(String(ctx.targetValue));
  const unit = escapeHtml(ctx.unit || '');
  const existing = ctx.existing || {};
  const disabled = lock.locked ? 'disabled' : '';
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}<title>إدخال قراءة أداء</title></head>
  <body><main class="wrap"><section class="card">
    <header class="header">
      <div class="brand">جمعية البر بصبيا - إدخال قراءة أداء</div>
      <h1>${title}</h1>
      <div class="subtitle">${code} - الفترة ${payload.year}/${String(payload.month).padStart(2, '0')}</div>
    </header>
    <div class="body">
      <div class="info">هذا رابط تعبئة مباشر ومحدود لهذا البند فقط. لا تحتاج إلى دخول النظام الكامل.</div>
      <div class="grid">
        <div class="box"><small>الموظف</small><b>${userName}</b></div>
        <div class="box"><small>المستهدف</small><b>${target} ${unit}</b></div>
      </div>
      ${lock.locked ? `<div class="warning">هذه الفترة مغلقة بعد مراجعة إدارية (${escapeHtml(lock.reviewCode || '')}) ولا يمكن تعديلها.</div>` : ''}
      <form method="POST" action="/kpi-entry/${escapeHtml(token)}">
        <label>القيمة الفعلية <span class="req">*</span></label>
        <input name="actualValue" type="number" min="0" step="0.01" required value="${existing.actualValue ?? ''}" ${disabled}>
        <div class="hint">أدخل الرقم فقط حسب وحدة المؤشر أعلاه.</div>

        <label>ملاحظة مختصرة</label>
        <textarea name="note" rows="3" maxlength="2000" ${disabled}>${escapeHtml(existing.note || '')}</textarea>

        <label>رابط دليل أو مرفق إن وجد</label>
        <input name="evidenceUrl" type="url" maxlength="500" value="${escapeHtml(existing.evidenceUrl || '')}" ${disabled}>

        <label>سبب الانحراف عند انخفاض النتيجة عن المستهدف</label>
        <textarea name="deviationReason" rows="2" maxlength="4000" ${disabled}>${escapeHtml(existing.deviationReason || '')}</textarea>
        <div class="hint">إذا كانت القيمة أقل من المتوقع، اكتب السبب ببساطة. سيطلبه النظام عند الحاجة.</div>

        <label>إجراء تصحيحي مختصر عند الانحراف الكبير</label>
        <textarea name="actionNote" rows="2" maxlength="4000" ${disabled}>${escapeHtml(existing.actionNote || '')}</textarea>
        <div class="hint">مثال: متابعة الحالة، استكمال المستند، إعادة جدولة التنفيذ.</div>

        <button class="submit-btn" type="submit" ${disabled}>حفظ القراءة</button>
      </form>
    </div>
    <footer class="footer">الرابط خاص بهذا الإدخال فقط، ويمكن إقفاله أو تجديده لاحقاً.</footer>
  </section></main></body></html>`;
}

function successPage(result) {
  const feedback = result?.feedback?.message ? `<p class="hint">${escapeHtml(result.feedback.message)}</p>` : '';
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>${baseStyle}<title>تم الحفظ</title></head>
  <body><main class="wrap"><section class="card">
    <header class="header"><div class="brand">جمعية البر بصبيا</div><h1>تم حفظ القراءة</h1></header>
    <div class="status"><h1>شكراً لك</h1><p>تم تحديث قراءة الأداء بنجاح.</p>${feedback}</div>
    <footer class="footer">يمكنك إغلاق هذه الصفحة الآن</footer>
  </section></main></body></html>`;
}

export default router;
