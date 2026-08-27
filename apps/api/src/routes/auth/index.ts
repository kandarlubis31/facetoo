import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { z } from 'zod';
import { prisma } from '@vybe/database';
import { hashPassword, verifyPassword } from '../../utils/auth/password.js';
import { generateAccessToken, generateRefreshToken, storeRefreshToken, verifyRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens } from '../../utils/auth/tokens.js';
import { isAdult } from '../../utils/auth/age.js';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '@vybe/shared';

type RegisterInput = z.infer<typeof RegisterSchema>;
type LoginInput = z.infer<typeof LoginSchema>;
type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export function authRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /auth/register
  typedApp.post<{ Body: RegisterInput }>('/auth/register', {
    schema: {
      body: RegisterSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        409: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { email, password, name, dateOfBirth, gender } = request.body;

    // Age gate: must be 18+
    if (!isAdult(dateOfBirth)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'AGE_RESTRICTION', message: 'You must be at least 18 years old to register' },
      });
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email already registered' },
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        dateOfBirth: new Date(dateOfBirth),
        gender,
      },
      select: { id: true, email: true, name: true },
    });

    // Generate tokens
    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(app, payload);
    const refreshToken = generateRefreshToken(app, payload);
    await storeRefreshToken(user.id, refreshToken);

    return reply.code(201).send({
      success: true,
      data: { user, accessToken, refreshToken },
    });
  });

  // POST /auth/login
  typedApp.post<{ Body: LoginInput }>('/auth/login', {
    schema: {
      body: LoginSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      return reply.code(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(app, payload);
    const refreshToken = generateRefreshToken(app, payload);
    await storeRefreshToken(user.id, refreshToken);

    return reply.send({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        refreshToken,
      },
    });
  });

  // POST /auth/refresh
  typedApp.post<{ Body: RefreshTokenInput }>('/auth/refresh', {
    schema: {
      body: RefreshTokenSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body;

    const verified = await verifyRefreshToken(refreshToken);
    if (!verified) {
      return reply.code(401).send({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }

    // Rotate: revoke old, create new
    await revokeRefreshToken(refreshToken);

    const payload = { userId: verified.userId, email: verified.email };
    const newAccessToken = generateAccessToken(app, payload);
    const newRefreshToken = generateRefreshToken(app, payload);
    await storeRefreshToken(verified.userId, newRefreshToken);

    return reply.send({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  });

  // POST /auth/logout
  typedApp.post<{ Body: RefreshTokenInput }>('/auth/logout', {
    schema: {
      body: RefreshTokenSchema,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        400: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body;
    await revokeRefreshToken(refreshToken);
    return reply.send({ success: true });
  });

  // POST /auth/logout-all (revoke all sessions)
  typedApp.post('/auth/logout-all', {
    preHandler: [app.authenticate],
    schema: {
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      });
    }
    await revokeAllUserRefreshTokens(userId);
    return reply.send({ success: true });
  });
}