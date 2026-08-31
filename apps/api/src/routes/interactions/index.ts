import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@vybe/database';
import { UserIdParamSchema } from '@vybe/shared';

type UserIdParam = z.infer<typeof UserIdParamSchema>;

interface LikeResponse {
  success: boolean;
  data?: {
    isMatch: boolean;
    matchId?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export async function interactionRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /users/:id/like - like a user, check for mutual match
  typedApp.post<{ Params: UserIdParam }>('/users/:id/like', {
    preHandler: [app.authenticate],
    schema: {
      params: UserIdParamSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                isMatch: { type: 'boolean' },
                matchId: { type: ['string', 'null'] },
              },
            },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
        409: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const currentUserId = request.user!.userId;
    const { id: targetUserId } = request.params as { id: string };

    // Cannot like yourself
    if (targetUserId === currentUserId) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'Cannot like yourself' },
      });
    }

    // Check if target user exists and is active
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId, status: 'ACTIVE' },
    });

    if (!targetUser) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: { fromUserId_toUserId: { fromUserId: currentUserId, toUserId: targetUserId } },
    });

    if (existingLike) {
      return reply.code(409).send({
        success: false,
        error: { code: 'ALREADY_LIKED', message: 'Already liked this user' },
      });
    }

    // Check if already passed - remove pass if so
    await prisma.pass.delete({
      where: { fromUserId_toUserId: { fromUserId: currentUserId, toUserId: targetUserId } },
    }).catch(() => {});

    // Check if blocked
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: currentUserId },
        ],
      },
    });

    if (block) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Create the like
    await prisma.like.create({
      data: { fromUserId: currentUserId, toUserId: targetUserId },
    });

    // Check for mutual like (match)
    const mutualLike = await prisma.like.findUnique({
      where: { fromUserId_toUserId: { fromUserId: targetUserId, toUserId: currentUserId } },
    });

    if (mutualLike) {
      // Create match - ensure consistent ordering (lower UUID first)
      const sortedIds = [currentUserId, targetUserId].sort() as [string, string];
      const [user1Id, user2Id] = sortedIds;

      const match = await prisma.match.create({
        data: { user1Id, user2Id },
      });

      return reply.send({
        success: true,
        data: { isMatch: true, matchId: match.id },
      });
    }

    return reply.send({
      success: true,
      data: { isMatch: false, matchId: null },
    });
  });

  // POST /users/:id/pass - pass a user
  typedApp.post<{ Params: UserIdParam }>('/users/:id/pass', {
    preHandler: [app.authenticate],
    schema: {
      params: UserIdParamSchema,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
        409: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const currentUserId = request.user!.userId;
    const { id: targetUserId } = request.params as { id: string };

    // Cannot pass yourself
    if (targetUserId === currentUserId) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'Cannot pass yourself' },
      });
    }

    // Check if target user exists and is active
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId, status: 'ACTIVE' },
    });

    if (!targetUser) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Check if already passed
    const existingPass = await prisma.pass.findUnique({
      where: { fromUserId_toUserId: { fromUserId: currentUserId, toUserId: targetUserId } },
    });

    if (existingPass) {
      return reply.code(409).send({
        success: false,
        error: { code: 'ALREADY_PASSED', message: 'Already passed this user' },
      });
    }

    // Check if already liked - remove like if so
    await prisma.like.delete({
      where: { fromUserId_toUserId: { fromUserId: currentUserId, toUserId: targetUserId } },
    }).catch(() => {});

    // Check if blocked
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: currentUserId },
        ],
      },
    });

    if (block) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Create the pass
    await prisma.pass.create({
      data: { fromUserId: currentUserId, toUserId: targetUserId },
    });

    return reply.send({ success: true });
  });

  // GET /matches - list user's matches
  typedApp.get('/matches', {
    preHandler: [app.authenticate],
    schema: {
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
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
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      age: { type: 'number' },
                      gender: { type: 'string' },
                      height: { type: ['number', 'null'] },
                      bio: { type: ['string', 'null'] },
                      distance: { type: ['number', 'null'] },
                      locationLabel: { type: ['string', 'null'] },
                      photos: {
                        type: 'array',
                        items: {
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
                  },
                  lastMessage: {
                    type: ['object', 'null'],
                    properties: {
                      id: { type: 'string' },
                      content: { type: 'string' },
                      senderId: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                      readAt: { type: ['string', 'null'], format: 'date-time' },
                    },
                  },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            nextCursor: { type: ['string', 'null'] },
            hasMore: { type: 'boolean' },
          },
        },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const currentUserId = request.user!.userId;
    const { limit = 20, cursor } = request.query as { limit?: number; cursor?: string };

    const where: any = {
      OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
      isActive: true,
    };

    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const matches = await prisma.match.findMany({
      where,
      include: {
        user1: {
          include: { profile: true, photos: { orderBy: { orderIndex: 'asc' } } },
        },
        user2: {
          include: { profile: true, photos: { orderBy: { orderIndex: 'asc' } } },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
    });

    // Get current user profile for distance calculation
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: { profile: true },
    });

    const results = matches.slice(0, limit).map(match => {
      const otherUser = match.user1Id === currentUserId ? match.user2 : match.user1;
      const otherProfile = otherUser.profile;

      let distance: number | null = null;
      if (currentUser?.profile?.latitude && currentUser?.profile?.longitude &&
          otherProfile?.latitude && otherProfile?.longitude) {
        const R = 6371;
        const dLat = (otherProfile.latitude - currentUser.profile.latitude) * Math.PI / 180;
        const dLon = (otherProfile.longitude - currentUser.profile.longitude) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(currentUser.profile.latitude * Math.PI / 180) *
          Math.cos(otherProfile.latitude * Math.PI / 180) *
          Math.sin(dLon / 2) ** 2;
        distance = Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
      }

      const age = new Date().getFullYear() - new Date(otherUser.dateOfBirth).getFullYear();
      const primaryPhoto = otherUser.photos.find(p => p.isPrimary) || otherUser.photos[0];

      return {
        id: match.id,
        user: {
          id: otherUser.id,
          name: otherUser.name,
          age,
          gender: otherUser.gender,
          height: otherUser.height,
          bio: otherProfile?.bio,
          distance,
          locationLabel: otherProfile?.latitude && otherProfile?.longitude ? 'Jakarta Selatan' : null,
          photos: otherUser.photos.map(p => ({
            id: p.id,
            r2Key: p.r2Key,
            width: p.width,
            height: p.height,
            isPrimary: p.isPrimary,
            orderIndex: p.orderIndex,
          })),
        },
        lastMessage: match.messages[0] ? {
          id: match.messages[0].id,
          content: match.messages[0].content,
          senderId: match.messages[0].senderId,
          createdAt: match.messages[0].createdAt,
          readAt: match.messages[0].readAt,
        } : null,
        createdAt: match.createdAt,
      };
    });

    const hasMore = matches.length > limit;
    const nextCursor = hasMore ? matches[limit - 1]?.createdAt.toISOString() ?? null : null;

    return reply.send({
      success: true,
      data: results,
      nextCursor,
      hasMore,
    });
  });

  // POST /matches/:id/unmatch - unmatch a user
  typedApp.post<{ Params: UserIdParam }>('/matches/:id/unmatch', {
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
    const currentUserId = request.user!.userId;
    const { id: matchId } = request.params as { id: string };

    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Match not found' },
      });
    }

    // Verify user is part of this match
    if (match.user1Id !== currentUserId && match.user2Id !== currentUserId) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Match not found' },
      });
    }

    // Soft delete the match
    await prisma.match.update({
      where: { id: matchId },
      data: { isActive: false },
    });

    return reply.send({ success: true });
  });

  // POST /users/:id/block - block a user
  typedApp.post<{ Params: UserIdParam }>('/users/:id/block', {
    preHandler: [app.authenticate],
    schema: {
      params: UserIdParamSchema,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
        409: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const currentUserId = request.user!.userId;
    const { id: targetUserId } = request.params as { id: string };

    // Cannot block yourself
    if (targetUserId === currentUserId) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'Cannot block yourself' },
      });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Check if already blocked
    const existingBlock = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: currentUserId, blockedId: targetUserId } },
    });

    if (existingBlock) {
      return reply.code(409).send({
        success: false,
        error: { code: 'ALREADY_BLOCKED', message: 'Already blocked this user' },
      });
    }

    // Create block (bidirectional - also remove any existing likes/passes/matches)
    await prisma.$transaction(async (tx) => {
      // Create block
      await tx.block.create({
        data: { blockerId: currentUserId, blockedId: targetUserId },
      });

      // Remove any existing likes between them
      await tx.like.deleteMany({
        where: {
          OR: [
            { fromUserId: currentUserId, toUserId: targetUserId },
            { fromUserId: targetUserId, toUserId: currentUserId },
          ],
        },
      });

      // Remove any existing passes between them
      await tx.pass.deleteMany({
        where: {
          OR: [
            { fromUserId: currentUserId, toUserId: targetUserId },
            { fromUserId: targetUserId, toUserId: currentUserId },
          ],
        },
      });

      // Deactivate any existing match
      await tx.match.updateMany({
        where: {
          OR: [
            { user1Id: currentUserId, user2Id: targetUserId },
            { user1Id: targetUserId, user2Id: currentUserId },
          ],
          isActive: true,
        },
        data: { isActive: false },
      });
    });

    return reply.send({ success: true });
  });

  // POST /users/:id/report - report a user
  typedApp.post<{ Params: UserIdParam }>('/users/:id/report', {
    preHandler: [app.authenticate],
    schema: {
      params: UserIdParamSchema,
      body: z.object({
        reason: z.string().min(5).max(100),
        description: z.string().max(1000).optional(),
      }),
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const currentUserId = request.user!.userId;
    const { id: targetUserId } = request.params as { id: string };
    const { reason, description } = request.body as { reason: string; description?: string };

    // Cannot report yourself
    if (targetUserId === currentUserId) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'Cannot report yourself' },
      });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Create report
    await prisma.report.create({
      data: {
        reporterId: currentUserId,
        reportedId: targetUserId,
        reason,
        description,
      },
    });

    return reply.send({ success: true });
  });
}