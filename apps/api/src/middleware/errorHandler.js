export function notFound(req, res) {
  res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'المسار غير موجود',
      requestId: req.id || null,
    },
  });
}

function friendlyError(err, status) {
  const raw = String(err?.message || '').trim();
  if (/Invalid `prisma\./.test(raw) || err?.name?.startsWith?.('PrismaClient')) {
    if (raw.includes('Argument `records`')) {
      return {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'لا يمكن تعديل سجلات الحضور من نافذة بيانات التدريب. استخدم زر الحضور والفعالية.',
      };
    }
    if (/Unknown argument|Invalid value provided/.test(raw)) {
      return {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'تعذر حفظ السجل بسبب حقل غير صالح أو غير مدعوم في النموذج.',
      };
    }
    return {
      status: status >= 500 ? 400 : status,
      code: status >= 500 ? 'BAD_REQUEST' : (err.code || 'APP_ERROR'),
      message: 'تعذر حفظ السجل بسبب مشكلة في تنسيق البيانات. راجع الحقول وحاول مرة أخرى.',
    };
  }
  return null;
}

export function errorHandler(err, req, res, next) {
  const originalStatus = err.status || 500;
  const friendly = friendlyError(err, originalStatus);
  const status = friendly?.status || originalStatus;
  const code = friendly?.code || err.code || 'INTERNAL';
  const message = friendly?.message || err.message || 'خطأ داخلي في الخادم';
  if (status >= 500) console.error('[error]', { requestId: req.id || null, err });
  res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      requestId: req.id || null,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}
