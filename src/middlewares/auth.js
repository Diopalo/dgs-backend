'use strict';

const jwt    = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError } = require('../utils/errors');

module.exports = function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token manquant ou malformé.', 'TOKEN_MISSING'));
  }

  const token = authHeader.slice(7);

  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch {
    next(new UnauthorizedError('Token invalide ou expiré.', 'TOKEN_INVALID'));
  }
};
