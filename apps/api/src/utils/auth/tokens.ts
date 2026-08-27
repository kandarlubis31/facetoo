import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import { prisma } from '@vybe/database';

export interface TokenPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(app: FastifyInstance, payload: TokenPayload): string {
  return app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
}

export function generateRefreshToken(app: FastifyInstance, payload: TokenPayload): string {
  return app.jwt.sign(payload, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
}

export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; email: string } | null> {
  const tokenHash = await hashToken(token);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    return null;
  }

  return { userId: stored.userId, email: stored.user.email };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await prisma.refreshToken.update({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  }).catch(() => {}); // Ignore if not found
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function hashToken(token: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}