import { z } from 'zod';
import {
  Gender,
  PreferredGender,
  BodyType,
  StyleType,
  HairType,
  PhysicalPreferences,
} from './constants';

// Auth
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(50),
  dateOfBirth: z.string().datetime(), // ISO 8601
  gender: z.nativeEnum(Gender),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Profile
export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.nativeEnum(Gender).optional(),
  height: z.number().int().min(100).max(250).optional(),
  bio: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// Photos
export const CreatePhotoSchema = z.object({
  r2Key: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size: z.number().int().positive(),
  mimeType: z.string().regex(/^image\//),
  isPrimary: z.boolean().default(false),
  orderIndex: z.number().int().min(0).default(0),
});

export const UpdatePhotoSchema = z.object({
  isPrimary: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

// Preferences
export const PhysicalPreferencesSchema = z.object({
  bodyTypes: z.array(z.nativeEnum(BodyType)).optional(),
  style: z.array(z.nativeEnum(StyleType)).optional(),
  hair: z.array(z.nativeEnum(HairType)).optional(),
  heightImportance: z.number().min(0).max(1).optional(),
}) satisfies z.ZodType<PhysicalPreferences>;

export const UpdatePreferencesSchema = z.object({
  preferredGender: z.nativeEnum(PreferredGender).optional(),
  minAge: z.number().int().min(18).max(99).optional(),
  maxAge: z.number().int().min(18).max(99).optional(),
  maxDistance: z.number().int().min(1).max(100).optional(),
  minHeight: z.number().int().min(100).max(250).optional(),
  maxHeight: z.number().int().min(100).max(250).optional(),
  physicalPreferences: PhysicalPreferencesSchema.optional(),
});

// Discovery
export const DiscoveryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

// Interactions
export const UserIdParamSchema = z.object({
  id: z.string().uuid(),
});

// Block/Report
export const ReportSchema = z.object({
  reason: z.string().min(5).max(100),
  description: z.string().max(1000).optional(),
});

// Account
export const DeactivateAccountSchema = z.object({
  reason: z.string().max(500).optional(),
});

// Types
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type CreatePhotoInput = z.infer<typeof CreatePhotoSchema>;
export type UpdatePhotoInput = z.infer<typeof UpdatePhotoSchema>;
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;
export type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>;
export type UserIdParam = z.infer<typeof UserIdParamSchema>;
export type ReportInput = z.infer<typeof ReportSchema>;
export type DeactivateAccountInput = z.infer<typeof DeactivateAccountSchema>;