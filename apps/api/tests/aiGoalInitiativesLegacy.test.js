/**
 * tests/aiGoalInitiativesLegacy.test.js — AI-GOV-002
 * ───────────────────────────────────────────────────────────────────
 * يتحقق من أن أدوات AI لا تكتب في حقل initiatives النصي (legacy)
 * على نموذج StrategicGoal، وأن الأدوات المستقلة create_initiative /
 * update_initiative موجودة وقابلة للاستخدام.
 *
 * هذه الاختبارات pure — لا تتطلب قاعدة بيانات.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_SRC = readFileSync(resolve(__dirname, '../src/services/aiAgent/tools.js'), 'utf8');

// استخرج سطوراً غير تعليقية من كتلة case محددة
function extractCaseBlock(src, caseName) {
  const start = src.indexOf(`case '${caseName}':`);
  if (start === -1) throw new Error(`case '${caseName}' not found`);
  // نجد نهاية الكتلة بالبحث عن أول case تالية
  const nextCase = src.indexOf("case '", start + 1);
  return src.slice(start, nextCase === -1 ? src.length : nextCase);
}

function nonCommentLines(block) {
  return block
    .split('\n')
    .filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'));
}

beforeAll(() => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'x'.repeat(40);
  if (!process.env.AI_ENCRYPTION_KEY) process.env.AI_ENCRYPTION_KEY = 'y'.repeat(48);
});

// ─── 1. schema — حقل initiatives مُزال من أدوات الكتابة ─────────────
describe('AI-GOV-002 — schema: حقل initiatives غائب من أدوات الأهداف', () => {
  it('update_strategic_goal: لا يحتوي schema على حقل initiatives', async () => {
    const { ALL_AGENT_TOOLS } = await import('../src/services/aiAgent/tools.js');
    const tool = ALL_AGENT_TOOLS.find(t => t.name === 'update_strategic_goal');
    expect(tool, 'update_strategic_goal يجب أن يكون مُسجَّلاً').toBeDefined();
    const props = tool.input_schema?.properties ?? {};
    expect(props).not.toHaveProperty('initiatives');
  });

  it('create_strategic_goal: لا يحتوي schema على حقل initiatives', async () => {
    const { ALL_AGENT_TOOLS } = await import('../src/services/aiAgent/tools.js');
    const tool = ALL_AGENT_TOOLS.find(t => t.name === 'create_strategic_goal');
    expect(tool, 'create_strategic_goal يجب أن يكون مُسجَّلاً').toBeDefined();
    const props = tool.input_schema?.properties ?? {};
    expect(props).not.toHaveProperty('initiatives');
  });

  it('update_strategic_goal: description يوجّه نحو create_initiative / update_initiative', async () => {
    const { ALL_AGENT_TOOLS } = await import('../src/services/aiAgent/tools.js');
    const tool = ALL_AGENT_TOOLS.find(t => t.name === 'update_strategic_goal');
    expect(tool.description).toMatch(/create_initiative/);
  });

  it('create_strategic_goal: description يوجّه نحو create_initiative', async () => {
    const { ALL_AGENT_TOOLS } = await import('../src/services/aiAgent/tools.js');
    const tool = ALL_AGENT_TOOLS.find(t => t.name === 'create_strategic_goal');
    expect(tool.description).toMatch(/create_initiative/);
  });
});

// ─── 2. tools registry — أدوات المبادرات المستقلة ─────────────────────
describe('AI-GOV-002 — registry: أدوات المبادرات المستقلة موجودة', () => {
  it('create_initiative موجودة في ALL_AGENT_TOOLS', async () => {
    const { ALL_AGENT_TOOLS } = await import('../src/services/aiAgent/tools.js');
    const tool = ALL_AGENT_TOOLS.find(t => t.name === 'create_initiative');
    expect(tool, 'create_initiative يجب أن تكون في ALL_AGENT_TOOLS').toBeDefined();
    expect(tool.input_schema?.properties).toHaveProperty('goalId');
    expect(tool.input_schema?.properties).toHaveProperty('name');
  });

  it('update_initiative موجودة في ALL_AGENT_TOOLS', async () => {
    const { ALL_AGENT_TOOLS } = await import('../src/services/aiAgent/tools.js');
    const tool = ALL_AGENT_TOOLS.find(t => t.name === 'update_initiative');
    expect(tool, 'update_initiative يجب أن تكون في ALL_AGENT_TOOLS').toBeDefined();
    expect(tool.input_schema?.properties).toHaveProperty('id');
  });

  it('create_initiative و update_initiative ضمن ALWAYS_REVIEW_TOOLS', async () => {
    const { ALWAYS_REVIEW_TOOLS } = await import('../src/services/aiAgent/tools.js');
    expect(ALWAYS_REVIEW_TOOLS).toContain('create_initiative');
    expect(ALWAYS_REVIEW_TOOLS).toContain('update_initiative');
  });
});

// ─── 3. executor — لا كتابة في initiatives النصي (تحليل source) ───────
describe('AI-GOV-002 — executor source: لا كتابة في initiatives النصي', () => {
  it('update_strategic_goal executor: لا يتضمن initiatives في السطور الفعّالة', () => {
    const block = extractCaseBlock(TOOLS_SRC, 'update_strategic_goal');
    const activeLines = nonCommentLines(block).join('\n');
    // الحقل 'initiatives' يجب ألّا يظهر في pickFields أو data assignment
    expect(activeLines).not.toMatch(/'initiatives'/);
  });

  it('create_strategic_goal executor: لا يتضمن initiatives في السطور الفعّالة', () => {
    const block = extractCaseBlock(TOOLS_SRC, 'create_strategic_goal');
    const activeLines = nonCommentLines(block).join('\n');
    expect(activeLines).not.toMatch(/initiatives\s*[:=]/);
  });

  it('create_strategic_goal executor: لا destructure لـ initiatives من input', () => {
    const block = extractCaseBlock(TOOLS_SRC, 'create_strategic_goal');
    const activeLines = nonCommentLines(block).join('\n');
    // التدمير: const { ... initiatives ... } = input
    expect(activeLines).not.toMatch(/\{\s*[^}]*\binitiatives\b[^}]*\}\s*=\s*input/);
  });
});
