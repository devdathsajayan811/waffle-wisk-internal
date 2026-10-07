import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      DATABASE_PATH: ':memory:',
      SEED_DEMO_DATA: 'true',
      LOGIN_RATE_LIMIT: '1000',
      TURSO_DATABASE_URL: '',
    },
    testTimeout: 20000,
  },
});
