/**
 * tests/ai-tool-permissions.test.js
 * ───────────────────────────────────────────────────────────────
 * يتحقق أن طبقة فحص صلاحيات أدوات AI:
 *   1. ترفض الأدوات للأدوار التي لا تملك الصلاحية على المورد المرتبط
 *   2. تحجب sections حساسة في get_system_state بحسب الدور
 *   3. تطبّق scope حسب القسم لـ DEPT_MANAGER في الـ queries
 *
 * هذه الاختبارات pure — لا تتطلب قاعدة بيانات. تستخدم mock لـ prisma
 * عبر vi.mock، وتفحص:
 *   - gateToolForCaller (وحدة pure)
 *   - executeTool('get_system_state', ...) مع mock لـ prisma
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

beforeAll(() => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'x'.repeat(40);
  if (!process.env.AI_ENCRYPTION_KEY) process.env.AI_ENCRYPTION_KEY = 'y'.repeat(48);
});

// ─── 1. gateToolForCaller — وحدات نقية ─────────────────────────────
describe('gateToolForCaller — RBAC على أدوات AI', () => {
  it('يرفض الأداة عند callerUser=null (deny by default)', async () => {
    const { gateToolForCaller } = await import('../src/services/aiAgent/tools.js');
    expect(() => gateToolForCaller(null, 'create_indicator')).toThrow(/مصادَق/);
  });

  it('يرفض أداة غير مُسجَّلة في TOOL_PERMISSIONS', async () => {
    const { gateToolForCaller } = await import('../src/services/aiAgent/tools.js');
    expect(() => gateToolForCaller({ role: 'SUPER_ADMIN' }, 'fake_unregistered_tool')).toThrow(/غير مُسجَّلة/);
  });

  it('يسمح SUPER_ADMIN بكل الأدوات المُسجَّلة', async () => {
    const { gateToolForCaller, TOOL_PERMISSIONS } = await import('../src/services/aiAgent/tools.js');
    const sa = { role: 'SUPER_ADMIN' };
    for (const tool of Object.keys(TOOL_PERMISSIONS)) {
      expect(() => gateToolForCaller(sa, tool), `SUPER_ADMIN should pass "${tool}"`).not.toThrow();
    }
  });

  it('يرفض EMPLOYEE من create_indicator (تتطلب QM_UP)', async () => {
    const { gateToolForCaller } = await import('../src/services/aiAgent/tools.js');
    expect(() => gateToolForCaller({ role: 'EMPLOYEE' }, 'create_indicator')).toThrow(/مرفوضة/);
  });

  it('يرفض DEPT_MANAGER من create_strategic_plan (تتطلب QM_UP)', async () => {
    const { gateToolForCaller } = await import('../src/services/aiAgent/tools.js');
    expect(() => gateToolForCaller({ role: 'DEPT_MANAGER' }, 'create_strategic_plan')).toThrow(/مرفوضة/);
  });

  it('يسمح DEPT_MANAGER بـ update_objective (DEPT_MANAGER+ على objectives.update)', async () => {
    const { gateToolForCaller } = await import('../src/services/aiAgent/tools.js');
    expect(() => gateToolForCaller({ role: 'DEPT_MANAGER' }, 'update_objective')).not.toThrow();
  });

  it('يرفض GUEST_AUDITOR من جميع أدوات الكتابة', async () => {
    const { gateToolForCaller, TOOL_PERMISSIONS } = await import('../src/services/aiAgent/tools.js');
    const guest = { role: 'GUEST_AUDITOR' };
    const writeTools = Object.entries(TOOL_PERMISSIONS)
      .filter(([, p]) => p.action !== 'read')
      .map(([name]) => name);
    for (const tool of writeTools) {
      expect(() => gateToolForCaller(guest, tool), `GUEST_AUDITOR must NOT execute "${tool}"`).toThrow(/مرفوضة/);
    }
  });
});

// ─── 2. executeTool('get_system_state') — scope حسب الدور ─────────
// نُموّل prisma مع counters لقسمين مختلفين: قسم المتصل، وقسم آخر.
vi.mock('../src/db.js', () => {
  const dataset = {
    objective: [
      { id: 'obj-mine-1',   code: 'OBJ-001', title: 'هدف قسمي',  departmentId: 'dept-A', deletedAt: null },
      { id: 'obj-other-1',  code: 'OBJ-002', title: 'هدف قسم آخر', departmentId: 'dept-B', deletedAt: null },
    ],
    risk: [
      { id: 'r-mine',   code: 'R-1', title: 'خطر قسمي',  departmentId: 'dept-A', deletedAt: null },
      { id: 'r-other',  code: 'R-2', title: 'خطر آخر',   departmentId: 'dept-B', deletedAt: null },
    ],
    nCR: [
      { id: 'n-mine',  code: 'NCR-1', title: 'انحراف قسمي', departmentId: 'dept-A', deletedAt: null },
      { id: 'n-other', code: 'NCR-2', title: 'انحراف آخر',  departmentId: 'dept-B', deletedAt: null },
    ],
    operationalActivity: [
      { id: 'a-mine',  code: 'ACT-1', title: 'نشاط قسمي', deptId: 'dept-A' },
      { id: 'a-other', code: 'ACT-2', title: 'نشاط آخر',  deptId: 'dept-B' },
    ],
    user: [
      { id: 'u-1', name: 'Q', role: 'QUALITY_MANAGER', departmentId: 'dept-A' },
    ],
    department: [
      { id: 'dept-A', code: 'A', name: 'A' },
      { id: 'dept-B', code: 'B', name: 'B' },
    ],
    capa: [{ id: 'c-1', code: 'CAPA-1', deletedAt: null }],
    complaint: [{ id: 'cp-1', code: 'CP-1', deletedAt: null, receivedAt: new Date() }],
    audit: [{ id: 'au-1', code: 'AU-1', deletedAt: null, plannedDate: new Date() }],
  };

  const matchesWhere = (rec, where) => {
    if (!where) return true;
    for (const [k, v] of Object.entries(where)) {
      if (k === 'deletedAt') {
        if (v === null && rec.deletedAt !== null && rec.deletedAt !== undefined) return false;
        continue;
      }
      if (typeof v === 'object' && v !== null && 'not' in v) {
        if (rec[k] === v.not) return false;
        continue;
      }
      if (rec[k] !== v) return false;
    }
    return true;
  };
  const buildModel = (key) => ({
    findMany: async ({ where } = {}) => dataset[key].filter(r => matchesWhere(r, where)),
    count:    async ({ where } = {}) => dataset[key].filter(r => matchesWhere(r, where)).length,
    findUnique: async ({ where }) => dataset[key].find(r => r.id === where.id) || null,
    findFirst:  async () => null,
  });

  return {
    prisma: {
      strategicPlan:        buildModel('strategicPlan' in dataset ? 'strategicPlan' : 'department'),
      strategicGoal:        { findMany: async () => [], count: async () => 0 },
      operationalActivity:  buildModel('operationalActivity'),
      objective:            buildModel('objective'),
      axis:                 { findMany: async () => [] },
      indicator:            { findMany: async () => [], count: async () => 0 },
      user:                 buildModel('user'),
      department:           buildModel('department'),
      risk:                 buildModel('risk'),
      nCR:                  buildModel('nCR'),
      capa:                 buildModel('capa'),
      audit:                buildModel('audit'),
      complaint:            buildModel('complaint'),
      annualTarget:         { findMany: async () => [], count: async () => 0 },
      initiative:           { findMany: async () => [], count: async () => 0 },
      swotItem:             { findMany: async () => [] },
      managementReview:     { findMany: async () => [] },
      interestedParty:      { findMany: async () => [] },
      qualityPolicy:        { findFirst: async () => null },
    },
  };
});

// نموّل خدمات تقارير لتفادي تحميلها فعلياً
vi.mock('../src/services/progressReportService.js', () => ({
  generateReport: async () => ({}),
  compareDepartments: async () => ({}),
  detectTrends: async () => ({}),
  detectCrossContradictions: async () => ({}),
}));

describe('executeTool(get_system_state) — scope حسب الدور', () => {
  it('QUALITY_MANAGER يرى objectives من كل الأقسام', async () => {
    const { executeTool } = await import('../src/services/aiAgent/tools.js');
    const r = await executeTool('get_system_state', { sections: ['objectives'] }, {
      callerUser: { role: 'QUALITY_MANAGER', sub: 'u-q', departmentId: 'dept-A' },
    });
    expect(r.ok).toBe(true);
    expect(r.data.objectives.total).toBe(2);
  });

  it('DEPT_MANAGER يرى objectives قسمه فقط', async () => {
    const { executeTool } = await import('../src/services/aiAgent/tools.js');
    const r = await executeTool('get_system_state', { sections: ['objectives'] }, {
      callerUser: { role: 'DEPT_MANAGER', sub: 'u-dm', departmentId: 'dept-A' },
    });
    expect(r.ok).toBe(true);
    expect(r.data.objectives.total).toBe(1);
    expect(r.data.objectives.items[0].code).toBe('OBJ-001');
  });

  it('DEPT_MANAGER يرى risks قسمه فقط', async () => {
    const { executeTool } = await import('../src/services/aiAgent/tools.js');
    const r = await executeTool('get_system_state', { sections: ['risks'] }, {
      callerUser: { role: 'DEPT_MANAGER', sub: 'u-dm', departmentId: 'dept-A' },
    });
    expect(r.data.risks.total).toBe(1);
    expect(r.data.risks.items[0].code).toBe('R-1');
  });

  it('DEPT_MANAGER يرى ncrs قسمه فقط', async () => {
    const { executeTool } = await import('../src/services/aiAgent/tools.js');
    const r = await executeTool('get_system_state', { sections: ['ncrs'] }, {
      callerUser: { role: 'DEPT_MANAGER', sub: 'u-dm', departmentId: 'dept-A' },
    });
    expect(r.data.ncrs.total).toBe(1);
  });

  it('DEPT_MANAGER يرى activities قسمه فقط (deptId)', async () => {
    const { executeTool } = await import('../src/services/aiAgent/tools.js');
    const r = await executeTool('get_system_state', { sections: ['activities'] }, {
      callerUser: { role: 'DEPT_MANAGER', sub: 'u-dm', departmentId: 'dept-A' },
    });
    expect(r.data.activities.total).toBe(1);
  });

  it('DEPT_MANAGER لا يحصل على capas/complaints/audits (لا scope ممكن)', async () => {
    const { executeTool } = await import('../src/services/aiAgent/tools.js');
    const r = await executeTool('get_system_state', {
      sections: ['capas', 'complaints', 'audits'],
    }, {
      callerUser: { role: 'DEPT_MANAGER', sub: 'u-dm', departmentId: 'dept-A' },
    });
    expect(r.data.capas).toBeUndefined();
    expect(r.data.complaints).toBeUndefined();
    expect(r.data.audits).toBeUndefined();
  });

  it('DEPT_MANAGER لا يحصل على users (gate hard على QM+)', async () => {
    const { executeTool } = await import('../src/services/aiAgent/tools.js');
    const r = await executeTool('get_system_state', { sections: ['users'] }, {
      callerUser: { role: 'DEPT_MANAGER', sub: 'u-dm', departmentId: 'dept-A' },
    });
    expect(r.data.users).toBeUndefined();
  });

  it('DEPT_MANAGER مع sections:"all" يحصل على نسخة منزوعة من users', async () => {
    const { executeTool } = await import('../src/services/aiAgent/tools.js');
    const r = await executeTool('get_system_state', { sections: ['all'] }, {
      callerUser: { role: 'DEPT_MANAGER', sub: 'u-dm', departmentId: 'dept-A' },
    });
    expect(r.data.users).toBeUndefined();
  });

  it('EMPLOYEE مرفوض كلياً من get_system_state (TOOL_PERMISSIONS=dashboard.read=MANAGER_UP)', async () => {
    const { executeTool } = await import('../src/services/aiAgent/tools.js');
    await expect(
      executeTool('get_system_state', { sections: ['goals'] }, {
        callerUser: { role: 'EMPLOYEE', sub: 'u-e' },
      })
    ).rejects.toThrow(/مرفوضة/);
  });
});
