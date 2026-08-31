import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../test/utils.js';
import { prisma } from '@vybe/database';

describe('Preference Routes', () => {
  let app: FastifyInstance;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.preference.deleteMany();

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'pref-test@example.com',
        password: 'password123',
        name: 'Pref Test User',
        dateOfBirth: '1995-01-01T00:00:00.000Z',
        gender: 'male',
      },
    });
    const body = JSON.parse(registerResponse.body);
    accessToken = body.data.accessToken;
    userId = body.data.user.id;
  });

  describe('GET /preferences', () => {
    it('should return default preferences initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/preferences',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.preferredGender).toBe('both');
      expect(body.data.minAge).toBe(18);
      expect(body.data.maxAge).toBe(99);
      expect(body.data.maxDistance).toBe(50);
      expect(body.data.minHeight).toBeNull();
      expect(body.data.maxHeight).toBeNull();
      expect(body.data.physicalPreferences).toBeNull();
    });
  });

  describe('PUT /preferences', () => {
    it('should update preferences', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/preferences',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          preferredGender: 'female',
          minAge: 20,
          maxAge: 35,
          maxDistance: 30,
          minHeight: 160,
          maxHeight: 185,
          physicalPreferences: {
            bodyTypes: ['slim', 'athletic'],
            style: ['casual', 'sporty'],
            heightImportance: 0.8,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.preferredGender).toBe('female');
      expect(body.data.minAge).toBe(20);
      expect(body.data.maxAge).toBe(35);
      expect(body.data.maxDistance).toBe(30);
      expect(body.data.minHeight).toBe(160);
      expect(body.data.maxHeight).toBe(185);
      expect(body.data.physicalPreferences).toEqual({
        bodyTypes: ['slim', 'athletic'],
        style: ['casual', 'sporty'],
        heightImportance: 0.8,
      });
    });

    it('should validate minAge <= maxAge', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/preferences',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          minAge: 30,
          maxAge: 25,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_AGE_RANGE');
    });

    it('should validate minHeight <= maxHeight', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/preferences',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          minHeight: 180,
          maxHeight: 170,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_HEIGHT_RANGE');
    });

    it('should validate physicalPreferences schema', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/preferences',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          physicalPreferences: {
            bodyTypes: ['invalid_type'],
            heightImportance: 1.5, // > 1
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate age bounds', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/preferences',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          minAge: 15, // < 18
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});