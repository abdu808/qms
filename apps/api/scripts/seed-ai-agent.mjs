/**
 * seed-ai-agent.mjs — ينشئ حساب خدمة المستشار الذكي
 *
 * الاستخدام:
 *   node scripts/seed-ai-agent.mjs
 *
 * الناتج:
 *   - مستخدم "المستشار الذكي" بدور QUALITY_MANAGER في قاعدة البيانات
 *   - يطبع AI_AGENT_USER_ID الذي يجب إضافته لملف .env
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

const AI_AGENT_EMAIL = 'ai-agent@qms.local';
const AI_AGENT_NAME  = 'المستشار الذكي';

async function main() {
  console.log('🤖 إعداد حساب المستشار الذكي...\n');

  // تحقق هل يوجد مسبقاً
  const existing = await prisma.user.findUnique({ where: { email: AI_AGENT_EMAIL } });

  if (existing) {
    console.log(`✅ الحساب موجود مسبقاً:`);
    console.log(`   ID:    ${existing.id}`);
    console.log(`   Name:  ${existing.name}`);
    console.log(`   Role:  ${existing.role}`);
    console.log(`   Active: ${existing.active}`);
    console.log(`\n📋 أضف هذا لملف .env:`);
    console.log(`   AI_AGENT_USER_ID=${existing.id}`);
    return existing;
  }

  // كلمة مرور عشوائية — لن يتم استخدامها أبداً (بدون login)
  const randomPass = randomBytes(32).toString('hex');
  const passwordHash = createHash('sha256').update(randomPass).digest('hex');

  const user = await prisma.user.create({
    data: {
      email:        AI_AGENT_EMAIL,
      name:         AI_AGENT_NAME,
      passwordHash, // مستحيل معرفتها — لن يتم الدخول بها
      role:         'QUALITY_MANAGER',
      jobTitle:     'وكيل الذكاء الاصطناعي',
      active:       true,
      mustChangePassword: false,
    },
  });

  console.log(`✅ تم إنشاء حساب المستشار الذكي:`);
  console.log(`   ID:    ${user.id}`);
  console.log(`   Name:  ${user.name}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role:  ${user.role}`);
  console.log(`\n📋 أضف هذا لملف .env:`);
  console.log(`   AI_AGENT_USER_ID=${user.id}`);
  console.log(`\n⚠️  هذا الحساب لا يمكن تسجيل الدخول به — مخصص للوكيل الذكي فقط.`);

  return user;
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
