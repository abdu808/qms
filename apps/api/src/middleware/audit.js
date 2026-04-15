import { prisma } from '../db.js';

/**
 * Audit trail middleware — logs every mutating request
 */
export function auditTrail() {
  return async (req, res, next) => {
    const start = Date.now();
    res.on('finish', async () => {
      try {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
        if (res.statusCode >= 400) return;
        const action =
          req.method === 'POST'   ? 'CREATE' :
          req.method === 'DELETE' ? 'DELETE' : 'UPDATE';
        const pathParts = req.path.split('/').filter(Boolean);
        const entityType = pathParts[1] || null;
        const entityId   = pathParts[2] || null;
        await prisma.auditLog.create({
          data: {
            userId: req.user?.sub || null,
            action,
            entityType,
            entityId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']?.slice(0, 500),
            changesJson: req.method !== 'DELETE' ? JSON.stringify(req.body).slice(0, 5000) : null,
          },
        });
      } catch (e) {
        // never fail the response over logging
        console.error('[audit] failed:', e.message);
      }
    });
    next();
  };
}

export async function logAuth(userId, action, req) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'Auth',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']?.slice(0, 500),
      },
    });
  } catch (e) { /* ignore */ }
}
