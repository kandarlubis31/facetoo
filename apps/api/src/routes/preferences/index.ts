import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@vybe/database';
import { UpdatePreferencesSchema } from '@vybe/shared';

type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;

export function preferenceRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // GET /preferences - get user preferences
  typedApp.get('/preferences', {
    preHandler: [app.authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                preferredGender: { type: 'string', enum: ['male', 'female', 'both'] },
                minAge: { type: 'number' },
                maxAge: { type: 'number' },
                maxDistance: { type: 'number' },
                minHeight: { type: ['number', 'null'] },
                maxHeight: { type: ['number', 'null'] },
                physicalPreferences: { type: ['object', 'null'] },
              },
            },
          },
        },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;

    const preferences = await prisma.preference.findUnique({
      where: { userId },
    });

    // Return defaults if not set
    if (!preferences) {
      return reply.send({
        success: true,
        data: {
          preferredGender: 'both',
          minAge: 18,
          maxAge: 99,
          maxDistance: 50,
          minHeight: null,
          maxHeight: null,
          physicalPreferences: null,
        },
      });
    }

    return reply.send({
      success: true,
      data: {
        preferredGender: preferences.preferredGender,
        minAge: preferences.minAge,
        maxAge: preferences.maxAge,
        maxDistance: preferences.maxDistance,
        minHeight: preferences.minHeight,
        maxHeight: preferences.maxHeight,
        physicalPreferences: preferences.physicalPreferences,
      },
    });
  });

  // PUT /preferences - update user preferences
  typedApp.put<{ Body: UpdatePreferencesInput }>('/preferences', {
    preHandler: [app.authenticate],
    schema: {
      body: UpdatePreferencesSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                preferredGender: { type: 'string', enum: ['male', 'female', 'both'] },
                minAge: { type: 'number' },
                maxAge: { type: 'number' },
                maxDistance: { type: 'number' },
                minHeight: { type: ['number', 'null'] },
                maxHeight: { type: ['number', 'null'] },
                physicalPreferences: { type: ['object', 'null'] },
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
    const data = request.body;

    // Validation: minAge <= maxAge
    if (data.minAge !== undefined && data.maxAge !== undefined && data.minAge > data.maxAge) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_AGE_RANGE', message: 'minAge must be less than or equal to maxAge' },
      });
    }

    // Validation: minHeight <= maxHeight
    if (data.minHeight !== undefined && data.maxHeight !== undefined && data.minHeight > data.maxHeight) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_HEIGHT_RANGE', message: 'minHeight must be less than or equal to maxHeight' },
      });
    }

    const preferences = await prisma.preference.upsert({
      where: { userId },
      update: {
        preferredGender: data.preferredGender,
        minAge: data.minAge,
        maxAge: data.maxAge,
        maxDistance: data.maxDistance,
        minHeight: data.minHeight,
        maxHeight: data.maxHeight,
        physicalPreferences: data.physicalPreferences,
      },
      create: {
        userId,
        preferredGender: data.preferredGender ?? 'both',
        minAge: data.minAge ?? 18,
        maxAge: data.maxAge ?? 99,
        maxDistance: data.maxDistance ?? 50,
        minHeight: data.minHeight,
        maxHeight: data.maxHeight,
        physicalPreferences: data.physicalPreferences,
      },
    });

    return reply.send({
      success: true,
      data: {
        preferredGender: preferences.preferredGender,
        minAge: preferences.minAge,
        maxAge: preferences.maxAge,
        maxDistance: preferences.maxDistance,
        minHeight: preferences.minHeight,
        maxHeight: preferences.maxHeight,
        physicalPreferences: preferences.physicalPreferences,
      },
    });
  });
}