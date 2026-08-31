import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../test/utils.js';
import { prisma } from '@vybe/database';

describe('Discovery Routes', () => {
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
    await prisma.like.deleteMany();
    await prisma.pass.deleteMany();
    await prisma.match.deleteMany();
    await prisma.block.deleteMany();

    // Create main user
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'discovery-test@example.com',
        password: 'password123',
        name: 'Discovery User',
        dateOfBirth: '1995-01-01T00:00:00.000Z',
        gender: 'male',
      },
    });
    const body = JSON.parse(registerResponse.body);
    accessToken = body.data.accessToken;
    userId = body.data.user.id;

    // Create profile for main user with location
    await prisma.profile.upsert({
      where: { userId },
      update: { latitude: -6.2088, longitude: 106.8456, bio: 'Test bio' },
      create: { userId, latitude: -6.2088, longitude: 106.8456, bio: 'Test bio' },
    });

    // Create preferences
    await prisma.preference.upsert({
      where: { userId },
      update: { preferredGender: 'female', minAge: 18, maxAge: 35, maxDistance: 50 },
      create: { userId, preferredGender: 'female', minAge: 18, maxAge: 35, maxDistance: 50 },
    });
  });

  async function createCandidate(
    email: string,
    name: string,
    gender: 'male' | 'female',
    dateOfBirth: string,
    lat: number,
    lon: number,
    options: { bio?: string; height?: number } = {}
  ) {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'password123', name, dateOfBirth, gender },
    });
    const body = JSON.parse(registerResponse.body);
    const candidateId = body.data.user.id;

    await prisma.user.update({
      where: { id: candidateId },
      data: { height: options.height },
    });
    await prisma.profile.upsert({
      where: { userId: candidateId },
      update: { latitude: lat, longitude: lon, bio: options.bio },
      create: { userId: candidateId, latitude: lat, longitude: lon, bio: options.bio },
    });

    return candidateId;
  }

  describe('GET /discovery', () => {
    beforeEach(async () => {
      // Create female candidates
      await createCandidate('f1@example.com', 'Female 1', 'female', '1998-01-01T00:00:00.000Z', -6.21, 106.84, { height: 165 });
      await createCandidate('f2@example.com', 'Female 2', 'female', '1997-01-01T00:00:00.000Z', -6.22, 106.85, { height: 170 });
      await createCandidate('f3@example.com', 'Female 3', 'female', '1996-01-01T00:00:00.000Z', -6.23, 106.86, { height: 160 });

      // Create male candidate (should be filtered out by gender preference)
      await createCandidate('m1@example.com', 'Male 1', 'male', '1998-01-01T00:00:00.000Z', -6.21, 106.84, { height: 180 });

      // Create candidate too far away
      await createCandidate('far@example.com', 'Far Away', 'female', '1998-01-01T00:00:00.000Z', -7.5, 110.0, { height: 165 });

      // Create candidate outside age range (too old)
      await createCandidate('old@example.com', 'Too Old', 'female', '1970-01-01T00:00:00.000Z', -6.21, 106.84, { height: 165 });

      // Create candidate without profile (should be filtered)
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'noprofile@example.com', password: 'password123', name: 'No Profile', dateOfBirth: '1998-01-01T00:00:00.000Z', gender: 'female' },
      });
    });

    it('should return candidates matching preferences', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);

      // All returned candidates should be female (gender preference)
      body.data.forEach((candidate: any) => {
        expect(candidate.gender).toBe('female');
      });
    });

    it('should filter by age range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = JSON.parse(response.body);
      body.data.forEach((candidate: any) => {
        expect(candidate.age).toBeGreaterThanOrEqual(18);
        expect(candidate.age).toBeLessThanOrEqual(35);
      });
    });

    it('should filter by distance', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = JSON.parse(response.body);
      body.data.forEach((candidate: any) => {
        if (candidate.distance !== null) {
          expect(candidate.distance).toBeLessThanOrEqual(50);
        }
      });
    });

    it('should filter out users without profile', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = JSON.parse(response.body);
      // The candidate without profile should not appear
      body.data.forEach((candidate: any) => {
        expect(candidate.bio).toBeDefined();
      });
    });

    it('should include compatibility score', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = JSON.parse(response.body);
      body.data.forEach((candidate: any) => {
        expect(candidate.compatibilityScore).toBeDefined();
        expect(typeof candidate.compatibilityScore).toBe('number');
        expect(candidate.compatibilityScore).toBeGreaterThanOrEqual(0);
        expect(candidate.compatibilityScore).toBeLessThanOrEqual(100);
      });
    });

    it('should paginate with limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery?limit=2',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      const body = JSON.parse(response.body);
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.hasMore).toBeDefined();
    });

    it('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});