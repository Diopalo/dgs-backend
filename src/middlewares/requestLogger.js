'use strict';

const logger = require('../utils/logger');

module.exports = function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl} — ${res.statusCode} — ${duration}ms`, {
      method:     req.method,
      path:       req.originalUrl,
      status:     res.statusCode,
      duration_ms: duration,
      ip:          req.ip || req.connection?.remoteAddress,
    });
  });

  next();
};
