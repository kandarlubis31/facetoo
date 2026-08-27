import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../test/utils.js';
import { prisma } from '@vybe/database';

describe('Auth Routes', () => {
  let app: FastifyInstance;

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
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          dateOfBirth: '1995-01-01T00:00:00.000Z',
          gender: 'male',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.user).toBeDefined();
      expect(body.data.user.email).toBe('test@example.com');
      expect(body.data.user.name).toBe('Test User');
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
          dateOfBirth: '1995-01-01T00:00:00.000Z',
          gender: 'male',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: '123',
          name: 'Test User',
          dateOfBirth: '1995-01-01T00:00:00.000Z',
          gender: 'male',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject registration for users under 18', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'minor@example.com',
          password: 'password123',
          name: 'Minor User',
          dateOfBirth: '2015-01-01T00:00:00.000Z',
          gender: 'male',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AGE_RESTRICTION');
    });

    it('should reject duplicate email registration', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'duplicate@example.com',
          password: 'password123',
          name: 'Test User',
          dateOfBirth: '1995-01-01T00:00:00.000Z',
          gender: 'male',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'duplicate@example.com',
          password: 'password123',
          name: 'Test User 2',
          dateOfBirth: '1995-01-01T00:00:00.000Z',
          gender: 'female',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('EMAIL_EXISTS');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'login@example.com',
          password: 'password123',
          name: 'Login User',
          dateOfBirth: '1995-01-01T00:00:00.000Z',
          gender: 'male',
        },
      });
    });

    it('should login with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe('login@example.com');
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
    });

    it('should reject login with invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject login for deactivated user', async () => {
      await prisma.user.update({
        where: { email: 'login@example.com' },
        data: { status: 'DEACTIVATED' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'refresh@example.com',
          password: 'password123',
          name: 'Refresh User',
          dateOfBirth: '1995-01-01T00:00:00.000Z',
          gender: 'male',
        },
      });
      const body = JSON.parse(response.body);
      refreshToken = body.data.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.refreshToken).not.toBe(refreshToken); // Token rotation
    });

    it('should reject invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: 'invalid-token' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should reject reused refresh token (rotation)', async () => {
      // First refresh
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken },
      });

      // Second refresh with same token should fail
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'logout@example.com',
          password: 'password123',
          name: 'Logout User',
          dateOfBirth: '1995-01-01T00:00:00.000Z',
          gender: 'male',
        },
      });
      const body = JSON.parse(response.body);
      refreshToken = body.data.refreshToken;
    });

    it('should revoke refresh token on logout', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: { refreshToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Try to use revoked token
      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken },
      });
      expect(refreshResponse.statusCode).toBe(401);
    });
  });

  describe('POST /auth/logout-all', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'logoutall@example.com',
          password: 'password123',
          name: 'LogoutAll User',
          dateOfBirth: '1995-01-01T00:00:00.000Z',
          gender: 'male',
        },
      });
      const body = JSON.parse(response.body);
      accessToken = body.data.accessToken;
      refreshToken = body.data.refreshToken;
    });

    it('should revoke all user sessions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Try to use revoked token
      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken },
      });
      expect(refreshResponse.statusCode).toBe(401);
    });

    it('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});