import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../src/services/consultantAgent.js'), 'utf8');

describe('consultant agent operating posture', () => {
  it('frames plan review as execution readiness instead of judging the approved plan', () => {
    expect(source).toContain('جاهزية التنفيذ والمتابعة');
    expect(source).toContain('الخطة 2025-2027 معتمدة ولا أعيد الحكم على صلاحيتها');
    expect(source).toContain('لا تسأل المستخدم أي منهجية يقصد');
    expect(source).not.toContain('## 🔍 أي من هذه المنهجيات تقصد؟');
    expect(source).not.toContain('35/100');
    expect(source).not.toContain('حرج جداً');
  });
});
