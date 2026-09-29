function getEnv(key: string, fallback: string = ''): string {
  return process.env[key] ?? fallback;
}

function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  return val !== undefined ? parseInt(val, 10) : fallback;
}

export const env = {
  get NODE_ENV() { return getEnv('NODE_ENV', 'development'); },
  get PORT() { return getEnvInt('PORT', 3000); },
  get API_PREFIX() { return getEnv('API_PREFIX', '/api/v1'); },

  get DATABASE_URL() { return getEnv('DATABASE_URL'); },

  get JWT_SECRET() { return getEnv('JWT_SECRET'); },
  get JWT_ACCESS_EXPIRES_IN() { return getEnv('JWT_ACCESS_EXPIRES_IN', '15m'); },
  get JWT_REFRESH_EXPIRES_IN() { return getEnv('JWT_REFRESH_EXPIRES_IN', '7d'); },

  get ARGON2_MEMORY_COST() { return getEnvInt('ARGON2_MEMORY_COST', 65536); },
  get ARGON2_TIME_COST() { return getEnvInt('ARGON2_TIME_COST', 3); },
  get ARGON2_PARALLELISM() { return getEnvInt('ARGON2_PARALLELISM', 4); },

  get R2_ACCOUNT_ID() { return getEnv('R2_ACCOUNT_ID'); },
  get R2_ACCESS_KEY_ID() { return getEnv('R2_ACCESS_KEY_ID'); },
  get R2_SECRET_ACCESS_KEY() { return getEnv('R2_SECRET_ACCESS_KEY'); },
  get R2_BUCKET_NAME() { return getEnv('R2_BUCKET_NAME', 'vybe-photos'); },
  get R2_PUBLIC_URL() { return getEnv('R2_PUBLIC_URL'); },

  get REDIS_URL() { return getEnv('REDIS_URL'); },

  get SMTP_HOST() { return getEnv('SMTP_HOST'); },
  get SMTP_PORT() { return getEnvInt('SMTP_PORT', 587); },
  get SMTP_USER() { return getEnv('SMTP_USER'); },
  get SMTP_PASS() { return getEnv('SMTP_PASS'); },
  get EMAIL_FROM() { return getEnv('EMAIL_FROM', 'noreply@vybe.app'); },

  get EXPO_PUSH_ACCESS_TOKEN() { return getEnv('EXPO_PUSH_ACCESS_TOKEN'); },
  get FCM_SERVER_KEY() { return getEnv('FCM_SERVER_KEY'); },

  get SENTRY_DSN() { return getEnv('SENTRY_DSN'); },
};

if (env.NODE_ENV === 'production') {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ];
  for (const key of required) {
    if (!env[key as keyof typeof env]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
