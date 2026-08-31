import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { z } from 'zod';
import { prisma } from '@vybe/database';
import { calculateAge } from '../../utils/auth/age.js';
import { UpdateProfileSchema, UserIdParamSchema } from '@vybe/shared';
import type { User, Profile, Preference, Photo } from '@prisma/client';

type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
type UserIdParam = z.infer<typeof UserIdParamSchema>;

interface FullProfileResponse {
  user: {
    id: string;
    email: string;
    name: string;
    dateOfBirth: Date;
    gender: string;
    height: number | null;
    status: string;
  };
  profile: {
    bio: string | null;
    locationLabel: string | undefined;
  } | null;
  preferences: {
    preferredGender: string;
    minAge: number;
    maxAge: number;
    maxDistance: number;
    minHeight: number | null;
    maxHeight: number | null;
    physicalPreferences: Record<string, unknown> | null;
  } | null;
  photos: Array<{
    id: string;
    r2Key: string;
    width: number;
    height: number;
    isPrimary: boolean;
    orderIndex: number;
  }>;
}

function toFullProfile(user: User, profile: Profile | null, preferences: Preference | null, photos: Photo[]): FullProfileResponse {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      height: user.height,
      status: user.status,
    },
    profile: profile ? {
      bio: profile.bio,
      locationLabel: profile.latitude && profile.longitude ? 'Jakarta Selatan' : undefined,
    } : null,
    preferences: preferences ? {
      preferredGender: preferences.preferredGender,
      minAge: preferences.minAge,
      maxAge: preferences.maxAge,
      maxDistance: preferences.maxDistance,
      minHeight: preferences.minHeight,
      maxHeight: preferences.maxHeight,
      physicalPreferences: preferences.physicalPreferences as Record<string, unknown> | null,
    } : null,
    photos: photos.map(p => ({
      id: p.id,
      r2Key: p.r2Key,
      width: p.width,
      height: p.height,
      isPrimary: p.isPrimary,
      orderIndex: p.orderIndex,
    })).sort((a, b) => a.orderIndex - b.orderIndex),
  };
}

export function profileRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // GET /me - current user with profile, preferences, photos
  typedApp.get('/me', {
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
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                    dateOfBirth: { type: 'string', format: 'date-time' },
                    gender: { type: 'string' },
                    height: { type: 'number' },
                    status: { type: 'string' },
                  },
                },
                profile: { type: ['object', 'null'] },
                preferences: { type: ['object', 'null'] },
                photos: { type: 'array' },
              },
            },
          },
        },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.userId;

    const [user, profile, preferences, photos] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.profile.findUnique({ where: { userId } }),
      prisma.preference.findUnique({ where: { userId } }),
      prisma.photo.findMany({ where: { userId }, orderBy: { orderIndex: 'asc' } }),
    ]);

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return reply.send({
      success: true,
      data: toFullProfile(user, profile, preferences, photos),
    });
  });

  // GET /me/profile - current user profile only
  typedApp.get('/me/profile', {
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
                id: { type: 'string' },
                name: { type: 'string' },
                dateOfBirth: { type: 'string', format: 'date-time' },
                gender: { type: 'string' },
                height: { type: 'number' },
                bio: { type: ['string', 'null'] },
                locationLabel: { type: ['string', 'null'] },
              },
            },
          },
        },
        401: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.userId;

    const [user, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.profile.findUnique({ where: { userId } }),
    ]);

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const locationLabel = profile?.latitude && profile.longitude ? 'Jakarta Selatan' : undefined;

    return reply.send({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        height: user.height,
        bio: profile?.bio ?? null,
        locationLabel: locationLabel ?? null,
      },
    });
  });

  // PUT /me/profile - update own profile
  typedApp.put<{ Body: UpdateProfileInput }>('/me/profile', {
    preHandler: [app.authenticate],
    schema: {
      body: UpdateProfileSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                dateOfBirth: { type: 'string', format: 'date-time' },
                gender: { type: 'string' },
                height: { type: 'number' },
                bio: { type: ['string', 'null'] },
                locationLabel: { type: ['string', 'null'] },
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
    const userId = request.user.userId;
    const data = request.body as Record<string, unknown>;

    // Age gate if dateOfBirth is being updated
    const dateOfBirth = data['dateOfBirth'];
    if (typeof dateOfBirth === 'string') {
      const age = calculateAge(dateOfBirth);
      if (age < 18) {
        return reply.code(400).send({
          success: false,
          error: { code: 'AGE_RESTRICTION', message: 'You must be at least 18 years old' },
        });
      }
    }

    // Update user fields
    const userData: Record<string, unknown> = {};
    const name = data['name'];
    const dob = data['dateOfBirth'];
    const gender = data['gender'];
    const height = data['height'];
    if (typeof name === 'string') userData['name'] = name;
    if (typeof dob === 'string') userData['dateOfBirth'] = new Date(dob);
    if (typeof gender === 'string') userData['gender'] = gender;
    if (typeof height === 'number') userData['height'] = height;

    // Update profile fields
    const profileData: Record<string, unknown> = {};
    const bio = data['bio'];
    const latitude = data['latitude'];
    const longitude = data['longitude'];
    if (typeof bio === 'string') profileData['bio'] = bio;
    if (typeof latitude === 'number') profileData['latitude'] = latitude;
    if (typeof longitude === 'number') profileData['longitude'] = longitude;

    const [user, profile] = await Promise.all([
      prisma.user.update({
        where: { id: userId },
        data: userData,
      }),
      prisma.profile.upsert({
        where: { userId },
        update: profileData,
        create: { userId, ...profileData },
      }),
    ]);

    const locationLabel = profile.latitude && profile.longitude ? 'Jakarta Selatan' : undefined;

    return reply.send({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        height: user.height,
        bio: profile.bio ?? null,
        locationLabel: locationLabel ?? null,
      },
    });
  });

  // GET /users/:userId/profile - public profile of another user
  typedApp.get<{ Params: UserIdParam }>('/users/:userId/profile', {
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
                id: { type: 'string' },
                name: { type: 'string' },
                age: { type: 'number' },
                gender: { type: 'string' },
                height: { type: 'number' },
                bio: { type: ['string', 'null'] },
                distance: { type: ['number', 'null'] },
                locationLabel: { type: ['string', 'null'] },
                photos: { type: 'array' },
              },
            },
          },
        },
        401: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const currentUserId = request.user.userId;
    const { id: userId } = request.params;

    if (userId === currentUserId) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Use /me/profile for own profile' },
      });
    }

    const [targetUser, currentUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId, status: 'ACTIVE' },
        include: {
          profile: true,
          photos: { orderBy: { orderIndex: 'asc' } },
        },
      }),
      prisma.user.findUnique({
        where: { id: currentUserId },
        include: { profile: true },
      }),
    ]);

    if (!targetUser) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Check if blocked
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: userId },
          { blockerId: userId, blockedId: currentUserId },
        ],
      },
    });

    if (block) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const age = calculateAge(targetUser.dateOfBirth);
    let distance: number | null = null;
    let locationLabel: string | null = null;

    const targetProfile = targetUser.profile;
    const currentProfile = currentUser?.profile;

    if (targetProfile?.latitude && targetProfile.longitude && currentProfile?.latitude && currentProfile.longitude) {
      // Haversine distance calculation
      const R = 6371; // Earth radius in km
      const dLat = (targetProfile.latitude - currentProfile.latitude) * Math.PI / 180;
      const dLon = (targetProfile.longitude - currentProfile.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(currentProfile.latitude * Math.PI / 180) *
        Math.cos(targetProfile.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
      distance = Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
      locationLabel = 'Jakarta Selatan'; // In production, use reverse geocoding
    }

    return reply.send({
      success: true,
      data: {
        id: targetUser.id,
        name: targetUser.name,
        age,
        gender: targetUser.gender,
        height: targetUser.height,
        bio: targetProfile?.bio ?? null,
        distance,
        locationLabel,
        photos: targetUser.photos.map(p => ({
          id: p.id,
          r2Key: p.r2Key,
          width: p.width,
          height: p.height,
          isPrimary: p.isPrimary,
          orderIndex: p.orderIndex,
        })),
      },
    });
  });
}