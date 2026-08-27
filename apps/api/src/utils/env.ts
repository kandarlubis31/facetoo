export const env = {
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
  PORT: parseInt(process.env['PORT'] ?? '3000', 10),
  API_PREFIX: process.env['API_PREFIX'] ?? '/api/v1',

  DATABASE_URL: process.env['DATABASE_URL'] ?? '',

  JWT_SECRET: process.env['JWT_SECRET'] ?? '',
  JWT_ACCESS_EXPIRES_IN: process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m',
  JWT_REFRESH_EXPIRES_IN: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',

  ARGON2_MEMORY_COST: parseInt(process.env['ARGON2_MEMORY_COST'] ?? '65536', 10),
  ARGON2_TIME_COST: parseInt(process.env['ARGON2_TIME_COST'] ?? '3', 10),
  ARGON2_PARALLELISM: parseInt(process.env['ARGON2_PARALLELISM'] ?? '4', 10),

  R2_ACCOUNT_ID: process.env['R2_ACCOUNT_ID'] ?? '',
  R2_ACCESS_KEY_ID: process.env['R2_ACCESS_KEY_ID'] ?? '',
  R2_SECRET_ACCESS_KEY: process.env['R2_SECRET_ACCESS_KEY'] ?? '',
  R2_BUCKET_NAME: process.env['R2_BUCKET_NAME'] ?? 'vybe-photos',
  R2_PUBLIC_URL: process.env['R2_PUBLIC_URL'] ?? '',

  REDIS_URL: process.env['REDIS_URL'] ?? '',

  SMTP_HOST: process.env['SMTP_HOST'] ?? '',
  SMTP_PORT: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
  SMTP_USER: process.env['SMTP_USER'] ?? '',
  SMTP_PASS: process.env['SMTP_PASS'] ?? '',
  EMAIL_FROM: process.env['EMAIL_FROM'] ?? 'noreply@vybe.app',

  EXPO_PUSH_ACCESS_TOKEN: process.env['EXPO_PUSH_ACCESS_TOKEN'] ?? '',
  FCM_SERVER_KEY: process.env['FCM_SERVER_KEY'] ?? '',

  SENTRY_DSN: process.env['SENTRY_DSN'] ?? '',
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