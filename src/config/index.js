'use strict';

require('dotenv').config();

const REQUIRED = ['JWT_SECRET', 'DATABASE_URL'];

function validate() {
  const isTest = process.env.NODE_ENV === 'test';

  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length > 0) {
    const msg = `[CONFIG] Variables d'environnement manquantes : ${missing.join(', ')}`;
    if (isTest) { console.warn(msg); return; }
    console.error(msg);
    process.exit(1);
  }
  if ((process.env.JWT_SECRET || '').length < 16) {
    const msg = '[CONFIG] JWT_SECRET trop court (minimum 16 caractères).';
    if (isTest) { console.warn(msg); return; }
    console.error(msg);
    process.exit(1);
  }
}

validate();

const config = {
  env:    process.env.NODE_ENV || 'development',
  port:   Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production',

  db: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret:            process.env.JWT_SECRET,
    expiresIn:         process.env.JWT_EXPIRES_IN         || '7d',
    refreshExpiresIn:  process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  serpapi: {
    key:     process.env.SERPAPI_KEY     || '',
    country: process.env.SERPAPI_COUNTRY || 'sn',
    lang:    process.env.SERPAPI_LANG    || 'fr',
  },

  crawler: {
    maxPages:   Number(process.env.CRAWLER_MAX_PAGES)   || 500,
    delayMs:    Number(process.env.CRAWLER_DELAY_MS)    || 500,
    maxWorkers: Number(process.env.CRAWLER_MAX_WORKERS) || 5,
    timeoutMs:  Number(process.env.CRAWLER_TIMEOUT_MS)  || 600_000,
    python:     process.env.PYTHON_EXECUTABLE || 'python3',
  },

  rateLimit: {
    windowMs:  Number(process.env.RATE_LIMIT_WINDOW_MS)  || 15 * 60 * 1000,
    authMax:   Number(process.env.RATE_LIMIT_AUTH_MAX)   || 10,
    apiMax:    Number(process.env.RATE_LIMIT_API_MAX)    || 100,
    auditMax:  Number(process.env.RATE_LIMIT_AUDIT_MAX)  || 5,
  },

  logs: {
    level: process.env.LOG_LEVEL || 'info',
    dir:   process.env.LOG_DIR   || 'logs',
  },
};

module.exports = config;
