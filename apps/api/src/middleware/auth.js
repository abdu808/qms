/**
 * authorize(...roles) — يتحقق من الدور فقط (role-based)
 *   مثال: authorize('SUPER_ADMIN', 'QUALITY_MANAGER')
 *   متى تستخدمه: عندما يكون الوصول مرتبطاً بالدور مباشرة
 *
 * requireAction(resource, action) — يتحقق من صلاحية محددة (permission-based)
 *   مثال: requireAction('documents', 'approve')
 *   متى تستخدمه: عندما يكون الوصول مرتبطاً بعملية على resource محدد
 *   يقرأ من: lib/permissions-matrix.js (عبر lib/permissions.js)
 *
 * القاعدة: استخدم requireAction للعمليات الحساسة (approve/delete/export)
 *           استخدم authorize للصفحات والـ endpoints العامة
 */
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { Unauthorized, Forbidden } from '../utils/errors.js';

export function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
    if (!token) throw Unauthorized('الرجاء تسجيل الدخول');
    const payload = jwt.verify(token, config.jwt.secret);
    // JWTs in this system use the standard `sub` claim as the user id.
    // Older workflow helpers read `req.user.id`, so expose both shapes at
    // the authentication boundary instead of letting routes drift apart.
    req.user = { ...payload, id: payload.id || payload.sub };
    next();
  } catch (e) {
    next(Unauthorized('الجلسة منتهية أو غير صالحة'));
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(Unauthorized());
    if (roles.length && !roles.includes(req.user.role)) {
      return next(Forbidden('ليس لديك صلاحية تنفيذ هذا الإجراء'));
    }
    next();
  };
}

// Read-only roles cannot mutate
export function denyReadOnly(req, res, next) {
  if (req.user?.role === 'GUEST_AUDITOR' && req.method !== 'GET') {
    return next(Forbidden('هذا الحساب للقراءة فقط'));
  }
  next();
}
