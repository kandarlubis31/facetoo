// Enums
export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export enum PreferredGender {
  MALE = 'male',
  FEMALE = 'female',
  BOTH = 'both',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
}

export enum InteractionType {
  LIKE = 'LIKE',
  PASS = 'PASS',
  MATCH = 'MATCH',
  BLOCK = 'BLOCK',
}

export enum BodyType {
  SLIM = 'slim',
  AVERAGE = 'average',
  ATHLETIC = 'athletic',
  CURVY = 'curvy',
  PLUS = 'plus',
}

export enum StyleType {
  CASUAL = 'casual',
  STREETWEAR = 'streetwear',
  FORMAL = 'formal',
  SPORTY = 'sporty',
  VINTAGE = 'vintage',
  MINIMALIST = 'minimalist',
}

export enum HairType {
  SHORT = 'short',
  MEDIUM = 'medium',
  LONG = 'long',
  BALD = 'bald',
  CURLY = 'curly',
}

// Physical Preferences
export interface PhysicalPreferences {
  bodyTypes?: BodyType[];
  style?: StyleType[];
  hair?: HairType[];
  heightImportance?: number; // 0-1 weight for scoring
}

// Pagination
export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Distance
export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface PublicLocation {
  distance: number; // km
  locationLabel: string; // e.g., "Jakarta Selatan"
}