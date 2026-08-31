import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { z } from 'zod';
import { prisma } from '@vybe/database';
import { CreatePhotoSchema, UpdatePhotoSchema, UserIdParamSchema } from '@vybe/shared';

type CreatePhotoInput = z.infer<typeof CreatePhotoSchema>;
type UpdatePhotoInput = z.infer<typeof UpdatePhotoSchema>;
type UserIdParam = z.infer<typeof UserIdParamSchema>;

// Mock R2 storage for development - replace with real R2 client in production
function generatePresignedUrl(key: string): string {
  // In production, use @aws-sdk/s3-request-presigner with Cloudflare R2
  return `https://mock-r2.dev/${key}?presigned=true`;
}

function deleteFromStorage(key: string): Promise<void> {
  // In production, use @aws-sdk/client-s3 to delete from R2
  console.log(`[Mock R2] Deleted: ${key}`);
  return Promise.resolve();
}

export function photoRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // GET /photos - list user photos
  typedApp.get('/photos', {
    preHandler: [app.authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  r2Key: { type: 'string' },
                  width: { type: 'number' },
                  height: { type: 'number' },
                  size: { type: 'number' },
                  mimeType: { type: 'string' },
                  isPrimary: { type: 'boolean' },
                  orderIndex: { type: 'number' },
                  uploadUrl: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;

    const photos = await prisma.photo.findMany({
      where: { userId },
      orderBy: { orderIndex: 'asc' },
    });

    return reply.send({
      success: true,
      data: photos.map(p => ({
        id: p.id,
        r2Key: p.r2Key,
        width: p.width,
        height: p.height,
        size: p.size,
        mimeType: p.mimeType,
        isPrimary: p.isPrimary,
        orderIndex: p.orderIndex,
        uploadUrl: generatePresignedUrl(p.r2Key),
        createdAt: p.createdAt,
      })),
    });
  });

  // POST /photos - create photo metadata, return presigned upload URL
  typedApp.post<{ Body: CreatePhotoInput }>('/photos', {
    preHandler: [app.authenticate],
    schema: {
      body: CreatePhotoSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                r2Key: { type: 'string' },
                uploadUrl: { type: 'string' },
                width: { type: 'number' },
                height: { type: 'number' },
                isPrimary: { type: 'boolean' },
                orderIndex: { type: 'number' },
              },
            },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { r2Key, width, height, size, mimeType, isPrimary, orderIndex } = request.body;

    // If this is set as primary, unset other primary photos
    if (isPrimary) {
      await prisma.photo.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Get max orderIndex for new photo
    const maxOrder = await prisma.photo.findFirst({
      where: { userId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const photo = await prisma.photo.create({
      data: {
        userId,
        r2Key,
        width,
        height,
        size,
        mimeType,
        isPrimary: isPrimary ?? false,
        orderIndex: orderIndex ?? (maxOrder?.orderIndex ?? 0) + 1,
      },
    });

    return reply.code(201).send({
      success: true,
      data: {
        id: photo.id,
        r2Key: photo.r2Key,
        uploadUrl: generatePresignedUrl(photo.r2Key),
        width: photo.width,
        height: photo.height,
        isPrimary: photo.isPrimary,
        orderIndex: photo.orderIndex,
      },
    });
  });

  // PUT /photos/:id - update primary, ordering
  typedApp.put<{ Params: UserIdParam; Body: UpdatePhotoInput }>('/photos/:id', {
    preHandler: [app.authenticate],
    schema: {
      params: UserIdParamSchema,
      body: UpdatePhotoSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                r2Key: { type: 'string' },
                width: { type: 'number' },
                height: { type: 'number' },
                isPrimary: { type: 'boolean' },
                orderIndex: { type: 'number' },
              },
            },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;
    const { isPrimary, orderIndex } = request.body;

    const existingPhoto = await prisma.photo.findFirst({
      where: { id, userId },
    });

    if (!existingPhoto) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Photo not found' },
      });
    }

    // If setting as primary, unset other primary photos
    if (isPrimary === true) {
      await prisma.photo.updateMany({
        where: { userId, isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
    }

    const photo = await prisma.photo.update({
      where: { id },
      data: {
        isPrimary: isPrimary ?? existingPhoto.isPrimary,
        orderIndex: orderIndex ?? existingPhoto.orderIndex,
      },
    });

    return reply.send({
      success: true,
      data: {
        id: photo.id,
        r2Key: photo.r2Key,
        width: photo.width,
        height: photo.height,
        isPrimary: photo.isPrimary,
        orderIndex: photo.orderIndex,
      },
    });
  });

  // DELETE /photos/:id - soft delete + cleanup
  typedApp.delete<{ Params: UserIdParam }>('/photos/:id', {
    preHandler: [app.authenticate],
    schema: {
      params: UserIdParamSchema,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        401: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const existingPhoto = await prisma.photo.findFirst({
      where: { id, userId },
    });

    if (!existingPhoto) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Photo not found' },
      });
    }

    // Delete from storage (R2)
    await deleteFromStorage(existingPhoto.r2Key);

    // Check if this was the primary photo
    const wasPrimary = existingPhoto.isPrimary;

    // Delete from database
    await prisma.photo.delete({ where: { id } });

    // If deleted photo was primary, promote the next photo (lowest orderIndex)
    if (wasPrimary) {
      const nextPhoto = await prisma.photo.findFirst({
        where: { userId },
        orderBy: { orderIndex: 'asc' },
      });

      if (nextPhoto) {
        await prisma.photo.update({
          where: { id: nextPhoto.id },
          data: { isPrimary: true },
        });
      }
    }

    return reply.send({ success: true });
  });
}