import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../test/utils.js';
import { prisma } from '@vybe/database';

describe('Interaction Routes', () => {
  let app: FastifyInstance;
  let accessToken: string;
  let userId: string;
  let otherAccessToken: string;
  let otherUserId: string;

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
    await prisma.like.deleteMany();
    await prisma.pass.deleteMany();
    await prisma.match.deleteMany();
    await prisma.block.deleteMany();
    await prisma.report.deleteMany();

    // Create main user
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'interaction-test@example.com',
        password: 'password123',
        name: 'Interaction User',
        dateOfBirth: '1995-01-01T00:00:00.000Z',
        gender: 'male',
      },
    });
    const body = JSON.parse(registerResponse.body);
    accessToken = body.data.accessToken;
    userId = body.data.user.id;

    // Create profile
    await prisma.profile.upsert({
      where: { userId },
      update: { latitude: -6.2088, longitude: 106.8456, bio: 'Test bio' },
      create: { userId, latitude: -6.2088, longitude: 106.8456, bio: 'Test bio' },
    });

    // Create other user
    const otherRegisterResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'other-interaction@example.com',
        password: 'password123',
        name: 'Other User',
        dateOfBirth: '1996-01-01T00:00:00.000Z',
        gender: 'female',
      },
    });
    const otherBody = JSON.parse(otherRegisterResponse.body);
    otherAccessToken = otherBody.data.accessToken;
    otherUserId = otherBody.data.user.id;

    await prisma.profile.upsert({
      where: { userId: otherUserId },
      update: { latitude: -6.21, longitude: 106.84, bio: 'Other bio' },
      create: { userId: otherUserId, latitude: -6.21, longitude: 106.84, bio: 'Other bio' },
    });

    // Set preferences for both users to match each other
    await prisma.preference.upsert({
      where: { userId },
      update: { preferredGender: 'female', minAge: 18, maxAge: 35, maxDistance: 50 },
      create: { userId, preferredGender: 'female', minAge: 18, maxAge: 35, maxDistance: 50 },
    });
    await prisma.preference.upsert({
      where: { userId: otherUserId },
      update: { preferredGender: 'male', minAge: 18, maxAge: 35, maxDistance: 50 },
      create: { userId: otherUserId, preferredGender: 'male', minAge: 18, maxAge: 35, maxDistance: 50 },
    });
  });

  describe('POST /users/:id/like', () => {
    it('should like a user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.isMatch).toBe(false);
      expect(body.data.matchId).toBeNull();
    });

    it('should create match when both users like each other', async () => {
      // First user likes second
      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // Second user likes first (mutual)
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${userId}/like`,
        headers: { authorization: `Bearer ${otherAccessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.isMatch).toBe(true);
      expect(body.data.matchId).toBeDefined();
    });

    it('should reject liking yourself', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${userId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_ACTION');
    });

    it('should reject duplicate like', async () => {
      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ALREADY_LIKED');
    });

    it('should remove existing pass when liking', async () => {
      // First pass
      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/pass`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // Then like - should remove pass
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject if blocked', async () => {
      // Block the other user
      await prisma.block.create({
        data: { blockerId: userId, blockedId: otherUserId },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /users/:id/pass', () => {
    let passUserId: string;
    let passAccessToken: string;

    beforeEach(async () => {
      // Create a new user for pass tests
      const passRegisterResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'pass-test@example.com',
          password: 'password123',
          name: 'Pass User',
          dateOfBirth: '1997-01-01T00:00:00.000Z',
          gender: 'female',
        },
      });
      const passBody = JSON.parse(passRegisterResponse.body);
      passAccessToken = passBody.data.accessToken;
      passUserId = passBody.data.user.id;

      await prisma.profile.upsert({
        where: { userId: passUserId },
        update: { latitude: -6.22, longitude: 106.85, bio: 'Pass bio' },
        create: { userId: passUserId, latitude: -6.22, longitude: 106.85, bio: 'Pass bio' },
      });
    });

    it('should pass a user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${passUserId}/pass`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject passing yourself', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${userId}/pass`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_ACTION');
    });

    it('should reject duplicate pass', async () => {
      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${passUserId}/pass`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${passUserId}/pass`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ALREADY_PASSED');
    });

    it('should remove existing like when passing', async () => {
      // First like
      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // Then pass - should remove like
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/pass`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /matches', () => {
    it('should return empty array initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/matches',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it('should return matches after mutual like', async () => {
      // Create match
      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${userId}/like`,
        headers: { authorization: `Bearer ${otherAccessToken}` },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/matches',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.data[0].user.id).toBe(otherUserId);
      expect(body.data[0].user.name).toBe('Other User');
      expect(body.data[0].user.distance).toBeDefined();
      expect(body.data[0].user.photos).toBeDefined();
    });
  });

  describe('POST /matches/:id/unmatch', () => {
    let matchId: string;

    beforeEach(async () => {
      // Create match
      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const matchResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${userId}/like`,
        headers: { authorization: `Bearer ${otherAccessToken}` },
      });
      const matchBody = JSON.parse(matchResponse.body);
      matchId = matchBody.data.matchId;
    });

    it('should unmatch a user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/matches/${matchId}/unmatch`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify match is deactivated
      const matchesResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/matches',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const matchesBody = JSON.parse(matchesResponse.body);
      expect(matchesBody.data.length).toBe(0);
    });

    it('should reject unmatching non-existent match', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/matches/00000000-0000-0000-0000-000000000000/unmatch',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /users/:id/block', () => {
    it('should block a user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/block`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject blocking yourself', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${userId}/block`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_ACTION');
    });

    it('should reject duplicate block', async () => {
      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/block`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/block`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should remove existing likes/passes/matches when blocking', async () => {
      // Like then block
      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/like`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/block`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // Verify like is removed
      const likes = await prisma.like.findMany({ where: { fromUserId: userId, toUserId: otherUserId } });
      expect(likes.length).toBe(0);
    });
  });

  describe('POST /users/:id/report', () => {
    it('should report a user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/report`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          reason: 'inappropriate_behavior',
          description: 'User was rude in chat',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject reporting yourself', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${userId}/report`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { reason: 'test' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_ACTION');
    });

    it('should validate reason length', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/users/${otherUserId}/report`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { reason: 'short' }, // too short
      });

      expect(response.statusCode).toBe(400);
    });
  });
});