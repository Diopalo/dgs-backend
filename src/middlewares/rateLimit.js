'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config');

const { windowMs, authMax, apiMax, auditMax } = config.rateLimit;

const errorResponse = (req, res) => {
  res.status(429).json({
    status:    'error',
    code:      'RATE_LIMIT_EXCEEDED',
    message:   'Trop de requêtes. Veuillez réessayer plus tard.',
    timestamp: new Date().toISOString(),
    path:      req.originalUrl,
  });
};

const isTest = process.env.NODE_ENV === 'test';

const authLimiter = rateLimit({
  windowMs,
  max:             isTest ? 10_000 : authMax,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         errorResponse,
});

const apiLimiter = rateLimit({
  windowMs,
  max:             isTest ? 10_000 : apiMax,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         errorResponse,
});

const auditLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             isTest ? 10_000 : auditMax,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         errorResponse,
  keyGenerator:    (req) => req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req),
});

module.exports = { authLimiter, apiLimiter, auditLimiter };
