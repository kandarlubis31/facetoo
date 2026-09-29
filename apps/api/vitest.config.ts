import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    globalSetup: ['./vitest.globalSetup.ts'],
    hookTimeout: 120000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  plugins: [
    {
      name: 'test-env',
      config() {
        process.env['NODE_ENV'] = 'test';
        process.env['PORT'] = '3001';
        process.env['API_PREFIX'] = '/api/v1';
        process.env['DATABASE_URL'] = 'file:' + resolve(__dirname, 'test.db');
        process.env['JWT_SECRET'] = 'test-secret-key-for-testing-only';
        process.env['JWT_ACCESS_EXPIRES_IN'] = '15m';
        process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
        process.env['ARGON2_MEMORY_COST'] = '65536';
        process.env['ARGON2_TIME_COST'] = '3';
        process.env['ARGON2_PARALLELISM'] = '4';
      },
    },
  ],
});
