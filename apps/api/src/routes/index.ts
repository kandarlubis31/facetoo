import type { FastifyInstance } from 'fastify';

export function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get('/health', () => ({ success: true, status: 'ok' }));

  // API routes will be registered here
  // app.register(authRoutes, { prefix: '/api/v1' });
  // app.register(profileRoutes, { prefix: '/api/v1' });
  // app.register(photoRoutes, { prefix: '/api/v1' });
  // app.register(preferenceRoutes, { prefix: '/api/v1' });
  // app.register(discoveryRoutes, { prefix: '/api/v1' });
  // app.register(interactionRoutes, { prefix: '/api/v1' });
  // app.register(matchRoutes, { prefix: '/api/v1' });
  // app.register(safetyRoutes, { prefix: '/api/v1' });
  // app.register(accountRoutes, { prefix: '/api/v1' });
}