import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../test/utils.js';
import { prisma } from '@vybe/database';

describe('Profile Routes', () => {
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
    await prisma.profile.deleteMany();
    await prisma.preference.deleteMany();
    await prisma.photo.deleteMany();

    // Register and login a test user
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'profile-test@example.com',
        password: 'password123',
        name: 'Profile Test User',
        dateOfBirth: '1995-01-01T00:00:00.000Z',
        gender: 'male',
      },
    });
    const registerBody = JSON.parse(registerResponse.body);
    accessToken = registerBody.data.accessToken;
    userId = registerBody.data.user.id;
  });

  describe('GET /me', () => {
    it('should return current user with profile, preferences, photos', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.user).toBeDefined();
      expect(body.data.user.id).toBe(userId);
      expect(body.data.user.email).toBe('profile-test@example.com');
      expect(body.data.profile).toBeDefined();
      expect(body.data.preferences).toBeDefined();
      expect(body.data.photos).toEqual([]);
    });

    it('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /me/profile', () => {
    it('should return current user profile', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me/profile',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(userId);
      expect(body.data.name).toBe('Profile Test User');
      expect(body.data.age).toBeDefined();
      expect(body.data.gender).toBe('male');
    });
  });

  describe('PUT /me/profile', () => {
    it('should update profile', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          bio: 'Updated bio',
          height: 180,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.bio).toBe('Updated bio');
      expect(body.data.height).toBe(180);
    });

    it('should reject invalid height', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          height: 50, // too short
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should enforce age gate on dateOfBirth update', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          dateOfBirth: '2015-01-01T00:00:00.000Z', // under 18
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AGE_RESTRICTION');
    });
  });

  describe('GET /users/:userId/profile', () => {
    let otherUserId: string;
    let otherAccessToken: string;

    beforeEach(async () => {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'other-profile@example.com',
          password: 'password123',
          name: 'Other User',
          dateOfBirth: '1996-01-01T00:00:00.000Z',
          gender: 'female',
        },
      });
      const body = JSON.parse(registerResponse.body);
      otherUserId = body.data.user.id;
      otherAccessToken = body.data.accessToken;
    });

    it('should return public profile of another user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${otherUserId}/profile`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(otherUserId);
      expect(body.data.name).toBe('Other User');
      expect(body.data.age).toBeDefined();
      expect(body.data.gender).toBe('female');
      expect(body.data.distance).toBeDefined();
      expect(body.data.locationLabel).toBeDefined();
      expect(body.data.photos).toEqual([]);
    });

    it('should reject requesting own profile via this endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${userId}/profile`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/00000000-0000-0000-0000-000000000000/profile',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});