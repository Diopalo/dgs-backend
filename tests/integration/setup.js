'use strict';

process.env.NODE_ENV   = 'test';
process.env.DATABASE_URL = 'file:./prisma/test.db';
process.env.JWT_SECRET = 'test_secret_for_jest_min_16chars';
process.env.PORT       = '3099';
process.env.LOG_LEVEL  = 'error';

const { execSync } = require('child_process');

beforeAll(() => {
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env: { ...process.env } });
});

afterAll(async () => {
  const prisma = require('../../src/configuration/prismaClient');
  await prisma.$disconnect();
});
