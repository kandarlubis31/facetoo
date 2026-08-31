import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../test/utils.js';
import { prisma } from '@vybe/database';

describe('Photo Routes', () => {
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
    await prisma.photo.deleteMany();

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'photo-test@example.com',
        password: 'password123',
        name: 'Photo Test User',
        dateOfBirth: '1995-01-01T00:00:00.000Z',
        gender: 'male',
      },
    });
    const body = JSON.parse(registerResponse.body);
    accessToken = body.data.accessToken;
    userId = body.data.user.id;
  });

  describe('GET /photos', () => {
    it('should return empty array initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });
  });

  describe('POST /photos', () => {
    it('should create photo metadata and return upload URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          r2Key: 'users/test-user/photo1.jpg',
          width: 800,
          height: 600,
          size: 102400,
          mimeType: 'image/jpeg',
          isPrimary: true,
          orderIndex: 0,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.r2Key).toBe('users/test-user/photo1.jpg');
      expect(body.data.uploadUrl).toContain('mock-r2.dev');
      expect(body.data.isPrimary).toBe(true);
      expect(body.data.orderIndex).toBe(0);
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          r2Key: 'test.jpg',
          // missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should unset previous primary when new primary is set', async () => {
      // Create first photo as primary
      await app.inject({
        method: 'POST',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          r2Key: 'users/test-user/photo1.jpg',
          width: 800,
          height: 600,
          size: 102400,
          mimeType: 'image/jpeg',
          isPrimary: true,
          orderIndex: 0,
        },
      });

      // Create second photo as primary
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          r2Key: 'users/test-user/photo2.jpg',
          width: 800,
          height: 600,
          size: 102400,
          mimeType: 'image/jpeg',
          isPrimary: true,
          orderIndex: 1,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.isPrimary).toBe(true);

      // Check that first photo is no longer primary
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const listBody = JSON.parse(listResponse.body);
      const primaryPhotos = listBody.data.filter((p: any) => p.isPrimary);
      expect(primaryPhotos.length).toBe(1);
      expect(primaryPhotos[0].r2Key).toBe('users/test-user/photo2.jpg');
    });
  });

  describe('PUT /photos/:id', () => {
    let photoId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          r2Key: 'users/test-user/photo1.jpg',
          width: 800,
          height: 600,
          size: 102400,
          mimeType: 'image/jpeg',
          isPrimary: false,
          orderIndex: 0,
        },
      });
      const body = JSON.parse(response.body);
      photoId = body.data.id;
    });

    it('should update photo primary status', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/photos/${photoId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { isPrimary: true },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.isPrimary).toBe(true);
    });

    it('should update photo order', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/photos/${photoId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { orderIndex: 5 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.orderIndex).toBe(5);
    });

    it('should return 404 for non-existent photo', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/photos/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { isPrimary: true },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /photos/:id', () => {
    let photoId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          r2Key: 'users/test-user/photo1.jpg',
          width: 800,
          height: 600,
          size: 102400,
          mimeType: 'image/jpeg',
          isPrimary: true,
          orderIndex: 0,
        },
      });
      const body = JSON.parse(response.body);
      photoId = body.data.id;
    });

    it('should delete photo', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/photos/${photoId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify photo is deleted
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data.length).toBe(0);
    });

    it('should promote next photo to primary when primary is deleted', async () => {
      // Create second photo
      const photo2Response = await app.inject({
        method: 'POST',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          r2Key: 'users/test-user/photo2.jpg',
          width: 800,
          height: 600,
          size: 102400,
          mimeType: 'image/jpeg',
          isPrimary: false,
          orderIndex: 1,
        },
      });
      const photo2Body = JSON.parse(photo2Response.body);
      const photo2Id = photo2Body.data.id;

      // Delete primary photo
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/photos/${photoId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      // Check that photo2 is now primary
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/photos',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data.length).toBe(1);
      expect(listBody.data[0].isPrimary).toBe(true);
      expect(listBody.data[0].id).toBe(photo2Id);
    });
  });
});