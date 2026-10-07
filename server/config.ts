import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env and set it.`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';
const isVercel = Boolean(process.env.VERCEL);

const jwtSecret = requireEnv('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

export const config = {
  nodeEnv,
  isProduction,
  isVercel,
  port: Number(process.env.PORT ?? 5000),
  jwtSecret,
  jwtExpiresIn: '12h' as const,

  tursoUrl: optionalEnv('TURSO_DATABASE_URL'),
  tursoAuthToken: optionalEnv('TURSO_AUTH_TOKEN'),
  databasePath:
    optionalEnv('DATABASE_PATH') ?? (isVercel ? '/tmp/waffle_wisk.db' : path.resolve(process.cwd(), 'waffle_wisk.db')),

  seedDemoData: optionalEnv('SEED_DEMO_DATA') ? optionalEnv('SEED_DEMO_DATA') === 'true' : !isProduction,
  bootstrapAdmin: {
    name: optionalEnv('ADMIN_NAME') ?? 'Administrator',
    username: optionalEnv('ADMIN_USERNAME'),
    email: optionalEnv('ADMIN_EMAIL'),
    password: optionalEnv('ADMIN_PASSWORD'),
  },

  corsOrigins: (optionalEnv('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  loginRateLimit: Number(process.env.LOGIN_RATE_LIMIT ?? 10),

  blobToken: optionalEnv('BLOB_READ_WRITE_TOKEN'),
  uploadsDir: path.resolve(process.cwd(), 'uploads'),
};
