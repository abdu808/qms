import { Router } from 'express';
import { MATRIX, ROLE_TIERS } from '../lib/permissions-matrix.js';

const router = Router();

// GET /api/meta/permissions — يُرجع matrix كاملاً للـ frontend
// لا يحتاج auth (قراءة فقط — لا معلومات حساسة)
router.get('/permissions', (_req, res) => {
  res.json({ ok: true, matrix: MATRIX, roleTiers: ROLE_TIERS });
});

export default router;
