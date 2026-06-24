'use strict';

const { AppError, ValidationError } = require('../utils/errors');
const logger  = require('../utils/logger');
const config  = require('../config');

function prismaErrorToAppError(err) {
  const { AppError: Err, NotFoundError, ValidationError: ValErr, ConflictError } = require('../utils/errors');
  if (!err.code) return null;

  switch (err.code) {
    case 'P2002': return new ConflictError(`Valeur déjà utilisée sur le champ : ${(err.meta?.target || []).join(', ')}`, 'UNIQUE_CONSTRAINT');
    case 'P2025': return new NotFoundError('Enregistrement introuvable.', 'RECORD_NOT_FOUND');
    case 'P2003': return new ValErr('Violation de contrainte de clé étrangère.', [], 'FOREIGN_KEY_CONSTRAINT');
    default:      return null;
  }
}

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  let error = err;

  // Convertir les erreurs Prisma en AppError
  if (err.constructor?.name?.startsWith('Prisma') || err.code?.startsWith('P')) {
    const converted = prismaErrorToAppError(err);
    if (converted) error = converted;
  }

  // Normaliser les erreurs inconnues
  if (!(error instanceof AppError)) {
    logger.error('Erreur non gérée', { message: err.message, stack: err.stack, path: req.originalUrl });
    error = new AppError('Une erreur interne est survenue.', 500, 'INTERNAL_ERROR');
  } else {
    const level = error.statusCode >= 500 ? 'error' : 'warn';
    logger[level](`[${error.code}] ${error.message}`, { path: req.originalUrl, statusCode: error.statusCode });
  }

  const body = {
    status:    'error',
    code:      error.code,
    message:   error.message,
    timestamp: new Date().toISOString(),
    path:      req.originalUrl,
  };

  if (error instanceof ValidationError && error.details?.length) {
    body.details = error.details;
  }

  if (!config.isProd && err.stack) {
    body.stack = err.stack;
  }

  res.status(error.statusCode).json(body);
};
