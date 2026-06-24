'use strict';

process.env.NODE_ENV    = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/test.db';
process.env.JWT_SECRET  = process.env.JWT_SECRET   || 'test_secret_for_jest_min_32_chars_ok';
process.env.LOG_LEVEL   = 'error';
