import { FastifyInstance } from 'fastify';
import { env } from '../utils/env.js';

export async function registerRoutes(app: FastifyInstance) {
  const prefix = env.API_PREFIX;

  // Health check
  app.get('/health', async () => ({ success: true, status: 'ok' }));

  // API routes will be registered here
  // await app.register(authRoutes, { prefix });
  // await app.register(profileRoutes, { prefix });
  // await app.register(photoRoutes, { prefix });
  // await app.register(preferenceRoutes, { prefix });
  // await app.register(discoveryRoutes, { prefix });
  // await app.register(interactionRoutes, { prefix });
  // await app.register(matchRoutes, { prefix });
  // await app.register(safetyRoutes, { prefix });
  // await app.register(accountRoutes, { prefix });
}