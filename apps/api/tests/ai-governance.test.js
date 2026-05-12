import { describe, expect, it } from 'vitest';

describe('AI governance policy', () => {
  it('limits employee AI to explanation-only access', async () => {
    const {
      getAiRolePolicy,
      sanitizeMessagesForPolicy,
      resolveGovernedAiRequest,
    } = await import('../src/lib/ai/governance.js');

    const policy = getAiRolePolicy('EMPLOYEE');
    expect(policy.canChat).toBe(true);
    expect(policy.canReadContext).toBe(false);
    expect(policy.canUploadFiles).toBe(false);
    expect(policy.forceMode).toBe('explain');
    expect(policy.maxTokens).toBeLessThanOrEqual(400);

    const governed = resolveGovernedAiRequest({
      role: 'EMPLOYEE',
      requestedMode: 'auto',
      providerOverride: 'anthropic',
      modelOverride: 'claude-sonnet-4-5',
    });
    expect(governed.providerOverride).toBeUndefined();
    expect(governed.modelOverride).toBeUndefined();

    const messages = Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: 'x'.repeat(2000),
    }));
    const safe = sanitizeMessagesForPolicy(messages, policy);
    expect(safe).toHaveLength(policy.maxMessages);
    expect(safe.at(-1).content.length).toBe(policy.maxInputChars);
  });

  it('keeps model/provider override limited to super admin', async () => {
    const { resolveGovernedAiRequest } = await import('../src/lib/ai/governance.js');

    const qm = resolveGovernedAiRequest({
      role: 'QUALITY_MANAGER',
      requestedMode: 'auto',
      providerOverride: 'openai',
      modelOverride: 'gpt-4o-mini',
    });
    expect(qm.providerOverride).toBeUndefined();
    expect(qm.modelOverride).toBeUndefined();

    const admin = resolveGovernedAiRequest({
      role: 'SUPER_ADMIN',
      requestedMode: 'auto',
      providerOverride: 'anthropic',
      modelOverride: 'claude-haiku-4-5',
    });
    expect(admin.providerOverride).toBe('anthropic');
    expect(admin.modelOverride).toBe('claude-haiku-4-5');
  });

  it('keeps context and upload permissions scoped to higher roles', async () => {
    const {
      getAiChatRoles,
      getAiContextRoles,
      getAiUploadRoles,
    } = await import('../src/lib/ai/governance.js');

    expect(getAiChatRoles()).toContain('EMPLOYEE');
    expect(getAiChatRoles()).toContain('DEPT_MANAGER');

    expect(getAiContextRoles()).not.toContain('EMPLOYEE');
    expect(getAiContextRoles()).toContain('DEPT_MANAGER');
    expect(getAiContextRoles()).toContain('QUALITY_MANAGER');

    expect(getAiUploadRoles()).not.toContain('EMPLOYEE');
    expect(getAiUploadRoles()).not.toContain('DEPT_MANAGER');
    expect(getAiUploadRoles()).toContain('QUALITY_MANAGER');
    expect(getAiUploadRoles()).toContain('SUPER_ADMIN');
  });

  it('rejects messages that exceed the role limits before model invocation', async () => {
    const { getAiRolePolicy, validateMessagesForPolicy } = await import('../src/lib/ai/governance.js');
    const policy = getAiRolePolicy('EMPLOYEE');
    const messages = [{ role: 'user', content: 'x'.repeat(policy.maxInputChars + 1) }];

    expect(() => validateMessagesForPolicy(messages, policy)).toThrow(/طويلة|long|الحد/i);
  });
});
