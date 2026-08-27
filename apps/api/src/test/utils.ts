import Fastify from 'fastify';
import { registerPlugins } from '../plugins/index.js';
import { registerRoutes } from '../routes/index.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { env } from '../utils/env.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  app.setErrorHandler(errorHandler);
  await registerPlugins(app);
  await registerRoutes(app);

  return app;
}

import type { FastifyInstance } from 'fastify';