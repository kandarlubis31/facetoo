import Fastify from 'fastify';

export async function buildApp(): Promise<FastifyInstance> {
  // Ensure test env vars are set before importing modules that read them
  process.env['NODE_ENV'] = 'test';
  process.env['PORT'] = '3001';
  process.env['API_PREFIX'] = '/api/v1';
  process.env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5432/vybe_test?schema=public';
  process.env['JWT_SECRET'] = 'test-secret-key-for-testing-only';
  process.env['JWT_ACCESS_EXPIRES_IN'] = '15m';
  process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
  process.env['ARGON2_MEMORY_COST'] = '65536';
  process.env['ARGON2_TIME_COST'] = '3';
  process.env['ARGON2_PARALLELISM'] = '4';

  // Now import modules that read env vars
  const { registerPlugins } = await import('../plugins/index.js');
  const { registerRoutes } = await import('../routes/index.js');
  const { errorHandler } = await import('../middleware/errorHandler.js');

  const app = Fastify({
    logger: false,
  });

  app.setErrorHandler(errorHandler);
  await registerPlugins(app);
  await registerRoutes(app);

  return app;
}

import type { FastifyInstance } from 'fastify';