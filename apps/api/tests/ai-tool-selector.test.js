import { describe, expect, it } from 'vitest';
import { getToolsForRole } from '../src/services/aiAgent/tools.js';
import {
  detectToolIntent,
  selectToolsForRequest,
} from '../src/services/aiAgent/toolSelector.js';

const msg = (content) => [{ role: 'user', content }];

describe('aiAgent tool selector', () => {
  it('detects planning requests', () => {
    expect(detectToolIntent(msg('راجع ترابط الخطة الاستراتيجية مع الأهداف والأنشطة'))).toBe('planning');
  });

  it('keeps quick requests on a tiny tool surface', () => {
    const all = getToolsForRole('SUPER_ADMIN');
    const selected = selectToolsForRequest({
      tools: all,
      messages: msg('كم عدد المؤشرات؟'),
      callerRole: 'SUPER_ADMIN',
      routingTier: 'QUICK',
    });

    expect(selected.selectedToolCount).toBeLessThanOrEqual(4);
    expect(selected.selectedToolNames).toContain('get_system_state');
    expect(selected.selectedToolNames).not.toContain('create_indicator');
  });

  it('offers planning tools without unrelated complaint tools', () => {
    const all = getToolsForRole('SUPER_ADMIN');
    const selected = selectToolsForRequest({
      tools: all,
      messages: msg('حسن الخطة واربط الأنشطة بالمؤشرات والمبادرات'),
      callerRole: 'SUPER_ADMIN',
      routingTier: 'STANDARD',
    });

    expect(selected.intent).toBe('planning');
    expect(selected.selectedToolNames).toContain('evaluate_strategic_plan');
    expect(selected.selectedToolNames).toContain('update_operational_activity');
    expect(selected.selectedToolNames).not.toContain('create_complaint');
  });

  it('offers NCR/CAPA tools for quality-case requests', () => {
    const all = getToolsForRole('QUALITY_MANAGER');
    const selected = selectToolsForRequest({
      tools: all,
      messages: msg('حلل عدم المطابقة وفعالية CAPA والرضا'),
      callerRole: 'QUALITY_MANAGER',
      routingTier: 'STANDARD',
    });

    expect(selected.intent).toBe('qualityCases');
    expect(selected.selectedToolNames).toContain('analyze_ncr_patterns');
    expect(selected.selectedToolNames).toContain('measure_capa_effectiveness');
    expect(selected.selectedToolNames).toContain('track_beneficiary_satisfaction');
  });

  it('does not add tools outside the role-visible list', () => {
    const selected = selectToolsForRequest({
      tools: [{ name: 'get_system_state', input_schema: { type: 'object' } }],
      messages: msg('أنشئ مؤشر جديد للخطة'),
      callerRole: 'EMPLOYEE',
      routingTier: 'STANDARD',
    });

    expect(selected.selectedToolNames).toEqual(['get_system_state']);
  });

  it('review mode hides write tools on standard requests', () => {
    const all = getToolsForRole('SUPER_ADMIN');
    const selected = selectToolsForRequest({
      tools: all,
      messages: msg('راجع مؤشرات الخطة واقترح التحسينات'),
      callerRole: 'SUPER_ADMIN',
      routingTier: 'STANDARD',
      mode: 'review',
    });

    expect(selected.selectedToolNames).toContain('evaluate_strategic_plan');
    expect(selected.selectedToolNames).not.toContain('update_strategic_goal');
    expect(selected.selectedToolNames).not.toContain('create_indicator');
  });
});

