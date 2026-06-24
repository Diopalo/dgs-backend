'use strict';

const { ForbiddenError } = require('../utils/errors');

module.exports = function roles(...allowed) {
  return (req, res, next) => {
    if (!req.user) return next(new ForbiddenError('Utilisateur non authentifié.', 'NO_USER'));
    if (!allowed.includes(req.user.role)) {
      return next(new ForbiddenError(`Accès réservé aux rôles : ${allowed.join(', ')}.`, 'FORBIDDEN_ROLE'));
    }
    next();
  };
};
