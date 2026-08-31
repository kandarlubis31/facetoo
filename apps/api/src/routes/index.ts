import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth/index.js';
import { profileRoutes } from './profile/index.js';
import { photoRoutes } from './photos/index.js';
import { preferenceRoutes } from './preferences/index.js';
import { discoveryRoutes } from './discovery/index.js';
import { env } from '../utils/env.js';

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get('/health', () => ({ success: true, status: 'ok' }));

  // API routes
  await app.register(authRoutes, { prefix: env.API_PREFIX });
  await app.register(profileRoutes, { prefix: env.API_PREFIX });
  await app.register(photoRoutes, { prefix: env.API_PREFIX });
  await app.register(preferenceRoutes, { prefix: env.API_PREFIX });
  await app.register(discoveryRoutes, { prefix: env.API_PREFIX });
}