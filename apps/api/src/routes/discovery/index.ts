import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@vybe/database';
import { DiscoveryQuerySchema } from '@vybe/shared';

type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>;

interface DiscoveryCandidate {
  id: string;
  name: string;
  age: number;
  gender: string;
  height: number | null;
  bio: string | null;
  distance: number | null;
  locationLabel: string | null;
  photos: Array<{
    id: string;
    r2Key: string;
    width: number;
    height: number;
    isPrimary: boolean;
    orderIndex: number;
  }>;
  compatibilityScore: number;
}

function calculateAge(dateOfBirth: Date): number {
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

function calculateCompatibilityScore(
  currentUser: any,
  currentPrefs: any,
  candidate: any,
  candidateProfile: any,
  distance: number | null
): number {
  let score = 0;
  let maxScore = 0;

  // 1. Preference match (40% weight)
  maxScore += 40;
  let prefMatch = 0;

  // Gender compatibility
  const candidateGender = candidate.gender;
  const prefGender = currentPrefs?.preferredGender || 'both';
  if (prefGender === 'both' || prefGender === candidateGender) {
    prefMatch += 15;
  }

  // Age preference
  const candidateAge = calculateAge(candidate.dateOfBirth);
  const minAge = currentPrefs?.minAge || 18;
  const maxAge = currentPrefs?.maxAge || 99;
  if (candidateAge >= minAge && candidateAge <= maxAge) {
    prefMatch += 15;
  }

  // Height preference
  const candidateHeight = candidateProfile?.height || candidate.height;
  const minHeight = currentPrefs?.minHeight;
  const maxHeight = currentPrefs?.maxHeight;
  if ((!minHeight || candidateHeight >= minHeight) && (!maxHeight || candidateHeight <= maxHeight)) {
    prefMatch += 10;
  }

  score += prefMatch;

  // 2. Distance score (30% weight)
  maxScore += 30;
  if (distance !== null && currentPrefs?.maxDistance) {
    const maxDist = currentPrefs.maxDistance;
    if (distance <= maxDist) {
      // Linear decay: closer = higher score
      score += 30 * (1 - distance / maxDist);
    }
  }

  // 3. Activity score (20% weight) - based on last active, photos, completeness
  maxScore += 20;
  let activityScore = 10; // base
  if (candidateProfile?.bio) activityScore += 3;
  if (candidate.photos?.length > 0) activityScore += 5;
  if (candidateProfile?.latitude && candidateProfile?.longitude) activityScore += 2;
  score += activityScore;

  // 4. Profile completeness (10% weight)
  maxScore += 10;
  let completenessScore = 0;
  if (candidate.name) completenessScore += 2;
  if (candidate.dateOfBirth) completenessScore += 2;
  if (candidate.gender) completenessScore += 2;
  if (candidateProfile?.bio) completenessScore += 2;
  if (candidateProfile?.latitude && candidateProfile?.longitude) completenessScore += 2;
  score += completenessScore;

  // Normalize to 0-100
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

export async function discoveryRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // GET /discovery - paginated candidates with filtering
  typedApp.get('/discovery', {
    preHandler: [app.authenticate],
    schema: {
      querystring: DiscoveryQuerySchema,
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
                  compatibilityScore: { type: 'number' },
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
    const { limit = 20, cursor } = request.query as DiscoveryQuery;

    // Get current user with profile and preferences
    const [currentUser, currentPrefs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: currentUserId },
        include: { profile: true, preferences: true },
      }),
      prisma.preference.findUnique({ where: { userId: currentUserId } }),
    ]);

    if (!currentUser || !currentUser.profile) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INCOMPLETE_PROFILE', message: 'Complete your profile first' },
      });
    }

    const currentProfile = currentUser.profile;
    const userLat = currentProfile.latitude;
    const userLon = currentProfile.longitude;
    const userGender = currentUser.gender;
    const userAge = calculateAge(currentUser.dateOfBirth);

    // Build base query for candidates
    const where: any = {
      id: { not: currentUserId },
      status: 'ACTIVE',
      profile: { isNot: null }, // Must have profile
    };

    // Gender compatibility filter
    if (currentPrefs?.preferredGender && currentPrefs.preferredGender !== 'both') {
      where.gender = currentPrefs.preferredGender;
    }

    // Age range filter
    const minAge = currentPrefs?.minAge || 18;
    const maxAge = currentPrefs?.maxAge || 99;
    const maxDateOfBirth = new Date();
    maxDateOfBirth.setFullYear(maxDateOfBirth.getFullYear() - minAge);
    const minDateOfBirth = new Date();
    minDateOfBirth.setFullYear(minDateOfBirth.getFullYear() - maxAge - 1);
    where.dateOfBirth = {
      gte: minDateOfBirth,
      lte: maxDateOfBirth,
    };

    // Exclude already interacted users (liked, passed, matched, blocked)
    const [likedIds, passedIds, matchedIds, blockedIds] = await Promise.all([
      prisma.like.findMany({ where: { fromUserId: currentUserId }, select: { toUserId: true } }),
      prisma.pass.findMany({ where: { fromUserId: currentUserId }, select: { toUserId: true } }),
      prisma.match.findMany({
        where: { OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }], isActive: true },
        select: { user1Id: true, user2Id: true },
      }),
      prisma.block.findMany({
        where: { OR: [{ blockerId: currentUserId }, { blockedId: currentUserId }] },
        select: { blockerId: true, blockedId: true },
      }),
    ]);

    const excludedIds = new Set<string>();
    likedIds.forEach(l => excludedIds.add(l.toUserId));
    passedIds.forEach(p => excludedIds.add(p.toUserId));
    matchedIds.forEach(m => {
      excludedIds.add(m.user1Id === currentUserId ? m.user2Id : m.user1Id);
    });
    blockedIds.forEach(b => {
      excludedIds.add(b.blockerId === currentUserId ? b.blockedId : b.blockerId);
    });

    if (excludedIds.size > 0) {
      where.id = { notIn: Array.from(excludedIds) };
    }

    // Cursor-based pagination
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    // Fetch candidates with profile and photos
    const candidates = await prisma.user.findMany({
      where,
      include: {
        profile: true,
        photos: { orderBy: { orderIndex: 'asc' } },
      },
      take: limit + 1, // +1 to check hasMore
      orderBy: { createdAt: 'desc' },
    });

    // Calculate distance and filter by maxDistance
    const maxDistance = currentPrefs?.maxDistance || 50;
    const candidatesWithDistance: DiscoveryCandidate[] = [];

    for (const candidate of candidates) {
      if (!candidate.profile) continue;

      let distance: number | null = null;
      if (userLat && userLon && candidate.profile.latitude && candidate.profile.longitude) {
        distance = calculateDistance(
          userLat, userLon,
          candidate.profile.latitude, candidate.profile.longitude
        );
        if (distance > maxDistance) continue; // Filter by max distance
      }

      // Get primary photo
      const primaryPhoto = candidate.photos.find(p => p.isPrimary) || candidate.photos[0];

      const compatibilityScore = calculateCompatibilityScore(
        currentUser,
        currentPrefs,
        candidate,
        candidate.profile,
        distance
      );

      candidatesWithDistance.push({
        id: candidate.id,
        name: candidate.name,
        age: calculateAge(candidate.dateOfBirth),
        gender: candidate.gender,
        height: candidate.height,
        bio: candidate.profile.bio,
        distance,
        locationLabel: candidate.profile.latitude && candidate.profile.longitude ? 'Jakarta Selatan' : null,
        photos: candidate.photos.map(p => ({
          id: p.id,
          r2Key: p.r2Key,
          width: p.width,
          height: p.height,
          isPrimary: p.isPrimary,
          orderIndex: p.orderIndex,
        })),
        compatibilityScore,
      });
    }

    // Sort by compatibility score (highest first)
    candidatesWithDistance.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Pagination
    const hasMore = candidatesWithDistance.length > limit;
    const results = hasMore ? candidatesWithDistance.slice(0, limit) : candidatesWithDistance;
    const nextCursor = hasMore ? (results[results.length - 1]?.id ?? null) : null;

    return reply.send({
      success: true,
      data: results,
      nextCursor,
      hasMore,
    });
  });
}