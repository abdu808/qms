#!/usr/bin/env node
/**
 * backup-keygen.mjs — توليد مفتاح تشفير للنسخ الاحتياطية (AES-256-GCM)
 *
 * الاستخدام:
 *   node scripts/backup-keygen.mjs
 *
 * الناتج: سطر BACKUP_ENCRYPTION_KEY=<64 محرف hex>
 * أضِف هذا السطر إلى متغيرات البيئة في Coolify — لا تحفظه في الكود أو Git.
 *
 * ⚠️  كل استدعاء يولّد مفتاحاً مختلفاً.
 *     احتفظ بالمفتاح في مكان آمن — بدونه لا يمكن فك تشفير النسخ القديمة.
 */
import { randomBytes } from 'node:crypto';

const key = randomBytes(32); // 256 bit
const hex = key.toString('hex');

console.log('');
console.log('━'.repeat(60));
console.log('🔑 مفتاح تشفير النسخ الاحتياطية (QMS AES-256-GCM)');
console.log('━'.repeat(60));
console.log('');
console.log(`BACKUP_ENCRYPTION_KEY=${hex}`);
console.log('');
console.log('الخطوات:');
console.log('  1. انسخ السطر أعلاه إلى Coolify → Environment Variables');
console.log('  2. لا تحفظه في الكود أو .env أو Git');
console.log('  3. احتفظ بنسخة في مدير كلمات مرور آمن');
console.log('  4. بدون هذا المفتاح لا يمكن فك تشفير النسخ القديمة');
console.log('');
console.log('━'.repeat(60));
