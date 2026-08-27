import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Test environment variables
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  process.env.API_PREFIX = '/api/v1';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/vybe_test?schema=public';
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.ARGON2_MEMORY_COST = '65536';
  process.env.ARGON2_TIME_COST = '3';
  process.env.ARGON2_PARALLELISM = '4';
});

afterAll(() => {
  // Cleanup
});