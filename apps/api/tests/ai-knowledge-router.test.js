import { describe, expect, it } from 'vitest';

describe('AI knowledge router', () => {
  it('answers greetings without model usage', async () => {
    const { routeKnowledgeQuestion } = await import('../src/lib/ai/knowledgeRouter.js');
    const r = routeKnowledgeQuestion([{ role: 'user', content: 'مساء الخير' }]);
    expect(r.handled).toBe(true);
    expect(r.source).toBe('local_greeting');
    expect(r.reply).toContain('مساء النور');
  });

  it('answers stable QMS knowledge questions locally', async () => {
    const { routeKnowledgeQuestion } = await import('../src/lib/ai/knowledgeRouter.js');
    const r = routeKnowledgeQuestion([{ role: 'user', content: 'ما الفرق بين NCR و CAPA؟' }]);
    expect(r.handled).toBe(true);
    expect(r.source).toBe('knowledge:ncr-capa');
    expect(r.reply).toContain('NCR');
    expect(r.reply).toContain('CAPA');
  });

  it('does not handle long analytical requests', async () => {
    const { routeKnowledgeQuestion } = await import('../src/lib/ai/knowledgeRouter.js');
    const r = routeKnowledgeQuestion([{
      role: 'user',
      content: 'حلل لي جميع مؤشرات الخطة الاستراتيجية مع أسباب الانحراف ومقترحات التحسين لكل قسم خلال 2026',
    }]);
    expect(r.handled).toBe(false);
  });

  it('uses custom knowledge entries before built-in entries', async () => {
    const { routeKnowledgeQuestionWithEntries } = await import('../src/lib/ai/knowledgeRouter.js');
    const r = routeKnowledgeQuestionWithEntries(
      [{ role: 'user', content: 'اشرح لي سياسة التنبيهات الجديدة' }],
      [{
        id: 'alerts-policy',
        title: 'سياسة التنبيهات',
        keywords: ['سياسة التنبيهات'],
        answer: 'التنبيهات الجديدة تبدأ بالتذكير ثم التصعيد حسب المدة.',
        enabled: true,
      }],
    );
    expect(r.handled).toBe(true);
    expect(r.source).toBe('knowledge:custom-alerts-policy');
    expect(r.reply).toContain('التذكير');
  });
});
