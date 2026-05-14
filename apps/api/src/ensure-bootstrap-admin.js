import bcrypt from 'bcrypt';
import { prisma } from './db.js';
import { config } from './config.js';

const email = String(config.admin.email || '').trim().toLowerCase();

if (!email) {
  console.log('[ensure-admin] ADMIN_EMAIL is empty — skipping');
  await prisma.$disconnect();
  process.exit(0);
}

const qmDept = await prisma.department.findUnique({ where: { code: 'QM' } }).catch(() => null);
const existing = await prisma.user.findUnique({ where: { email } });

if (existing) {
  const data = {};
  if (!existing.active) data.active = true;
  if (existing.role !== 'SUPER_ADMIN') data.role = 'SUPER_ADMIN';
  if (!existing.name && config.admin.name) data.name = config.admin.name;
  if (!existing.departmentId && qmDept?.id) data.departmentId = qmDept.id;
  if (!existing.jobTitle) data.jobTitle = 'مسؤول النظام';

  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: existing.id }, data });
    console.log(`[ensure-admin] bootstrap admin restored/updated: ${email}`);
  } else {
    console.log(`[ensure-admin] bootstrap admin is healthy: ${email}`);
  }
} else {
  const passwordHash = await bcrypt.hash(config.admin.password, config.bcryptRounds);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: config.admin.name || 'مسؤول النظام',
      role: 'SUPER_ADMIN',
      departmentId: qmDept?.id,
      jobTitle: 'مسؤول النظام',
      active: true,
    },
  });
  console.log(`[ensure-admin] bootstrap admin created: ${email}`);
}

await prisma.$disconnect();
