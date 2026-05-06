/**
 * routes/notificationRules.js
 *
 * قواعد التنبيه هي طبقة القرار التشغيلي فوق القوالب و n8n:
 * - القالب يحدد صياغة الرسالة.
 * - القاعدة تحدد هل الحدث مفعّل؟ ما القنوات؟ من الجمهور؟ وما سياسة التكرار/التصعيد؟
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authorize } from '../middleware/auth.js';
import { BadRequest, NotFound } from '../utils/errors.js';
import {
  ALLOWED_NOTIFICATION_CHANNELS,
  listNotificationRules,
  updateNotificationRule,
} from '../services/notificationRules.js';

const router = Router();
const QM_UP = ['SUPER_ADMIN', 'QUALITY_MANAGER'];

function cleanBody(body = {}) {
  const allowed = [
    'name',
    'description',
    'audience',
    'timing',
    'repeatPolicy',
    'escalation',
    'enabled',
    'channels',
    'createsTask',
  ];
  const data = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (data.channels !== undefined) {
    if (!Array.isArray(data.channels)) throw BadRequest('channels must be an array');
    for (const c of data.channels) {
      if (!ALLOWED_NOTIFICATION_CHANNELS.includes(String(c).toUpperCase())) {
        throw BadRequest(`قناة غير مسموحة: ${c}`);
      }
    }
    data.channels = data.channels.map(c => String(c).toUpperCase());
  }
  return data;
}

router.get('/', authorize(...QM_UP), asyncHandler(async (_req, res) => {
  const rules = await listNotificationRules();
  res.json({
    ok: true,
    data: rules,
    allowedChannels: ALLOWED_NOTIFICATION_CHANNELS,
  });
}));

router.patch('/:eventKey', authorize(...QM_UP), asyncHandler(async (req, res) => {
  const item = await updateNotificationRule(req.params.eventKey, cleanBody(req.body));
  if (!item) throw NotFound('قاعدة التنبيه غير موجودة');
  res.json({ ok: true, item });
}));

export default router;
