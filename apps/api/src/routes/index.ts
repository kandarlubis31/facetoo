import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth/index.js';
import { env } from '../utils/env.js';

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get('/health', () => ({ success: true, status: 'ok' }));

  // API routes
  await app.register(authRoutes, { prefix: env.API_PREFIX });
}