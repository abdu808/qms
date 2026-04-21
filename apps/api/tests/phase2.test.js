/**
 * tests/phase2.test.js — اختبارات المرحلة الثانية
 * يتحقق من: CAPA schema، Portal schema، webhook emitter، route modules تحمَّل بدون أخطاء.
 */
import { describe, it, expect } from 'vitest';
import { capaCreateSchema, capaUpdateSchema } from '../src/schemas/capa.schema.js';
import { announcementCreateSchema, portalSettingsSchema } from '../src/schemas/portal.schema.js';

describe('CAPA schemas', () => {
  it('يقبل dueDate بصيغة YYYY-MM-DD (من date input)', () => {
    const r = capaCreateSchema.safeParse({
      title: 'إجراء تصحيحي تجريبي',
      type: 'CORRECTIVE',
      sourceType: 'MANUAL',
      dueDate: '2026-12-31',
    });
    expect(r.success).toBe(true);
    expect(r.data.dueDate).toBeInstanceOf(Date);
  });

  it('يقبل dueDate بصيغة ISO كامل', () => {
    const r = capaCreateSchema.safeParse({
      title: 'تجربة',
      dueDate: '2026-12-31T12:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('يقبل dueDate فارغاً / null', () => {
    const r1 = capaCreateSchema.safeParse({ title: 'تجربة' });
    const r2 = capaCreateSchema.safeParse({ title: 'تجربة', dueDate: null });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('يرفض title قصيراً', () => {
    const r = capaCreateSchema.safeParse({ title: 'ab' });
    expect(r.success).toBe(false);
  });

  it('يرفض type غير صحيح', () => {
    const r = capaCreateSchema.safeParse({ title: 'تجربة', type: 'INVALID' });
    expect(r.success).toBe(false);
  });

  it('يرفض sourceType غير صحيح', () => {
    const r = capaCreateSchema.safeParse({ title: 'تجربة', sourceType: 'INVALID' });
    expect(r.success).toBe(false);
  });

  it('يقبل الحقول الإضافية في update (implementedAction, verificationNote, effective)', () => {
    const r = capaUpdateSchema.safeParse({
      implementedAction: 'تم تنفيذ الإجراء',
      verificationNote: 'تم التحقق',
      effective: true,
      lessonsLearned: 'الدرس المستفاد',
    });
    expect(r.success).toBe(true);
  });
});

describe('Portal schemas — تواريخ datetime-local', () => {
  it('يقبل publishedAt بصيغة datetime-local', () => {
    const r = announcementCreateSchema.safeParse({
      title: 'إعلان تجريبي',
      body: 'نص الإعلان هنا',
      publishedAt: '2026-04-21T18:00',
    });
    expect(r.success).toBe(true);
    expect(r.data.publishedAt).toBeInstanceOf(Date);
  });

  it('يقبل expiresAt = null', () => {
    const r = announcementCreateSchema.safeParse({
      title: 'إعلان تجريبي',
      body: 'هذا نص الإعلان التجريبي بطول كافٍ',
      expiresAt: null,
    });
    expect(r.success).toBe(true);
  });

  it('portalSettingsSchema: portalEnabled boolean اختياري', () => {
    const r1 = portalSettingsSchema.safeParse({ portalEnabled: true });
    const r2 = portalSettingsSchema.safeParse({ portalEnabled: false });
    const r3 = portalSettingsSchema.safeParse({});
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
  });
});

describe('Phase 2 route modules تحمَّل بدون أخطاء', () => {
  it('يستورد webhookEmitter', async () => {
    const mod = await import('../src/lib/webhookEmitter.js');
    expect(typeof mod.emitWebhook).toBe('function');
    expect(typeof mod.emitWebhookStrict).toBe('function');
    expect(typeof mod.invalidateWebhookCache).toBe('function');
  });

  it('يستورد capa route', async () => {
    const mod = await import('../src/routes/capa.js');
    expect(mod.default).toBeDefined();
  });

  it('يستورد charts route', async () => {
    const mod = await import('../src/routes/charts.js');
    expect(mod.default).toBeDefined();
  });

  it('يستورد webhookSettings route', async () => {
    const mod = await import('../src/routes/webhookSettings.js');
    expect(mod.default).toBeDefined();
  });

  it('يستورد isoAuditReport route', async () => {
    const mod = await import('../src/routes/reports/isoAuditReport.js');
    expect(mod.default).toBeDefined();
  });
});

describe('emitWebhook لا يرمي عند عدم التفعيل', () => {
  it('fire-and-forget silent when disabled', async () => {
    const { emitWebhook } = await import('../src/lib/webhookEmitter.js');
    // لا يجب أن يرمي أي شيء حتى لو لم تكن الإعدادات موجودة
    await expect(emitWebhook('TEST_EVENT', { foo: 'bar' })).resolves.toBeUndefined();
  });
});
