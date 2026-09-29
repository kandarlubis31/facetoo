import { afterAll } from 'vitest';

afterAll(async () => {
  try {
    const { default: prisma } = await import('@vybe/database');
    await prisma.$disconnect();
  } catch {
    // ignore
  }
});
