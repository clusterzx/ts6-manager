import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin', 12);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      displayName: 'Administrator',
      role: 'admin',
    },
  });

  // Seed default app settings
  await prisma.appSetting.upsert({
    where: { key: 'max_music_bots' },
    update: {},
    create: { key: 'max_music_bots', value: '5' },
  });

  console.log('Seed completed: default admin user + app settings created');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
