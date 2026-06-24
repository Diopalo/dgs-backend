'use strict';

class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name       = this.constructor.name;
    this.statusCode = statusCode;
    this.code       = code || 'INTERNAL_ERROR';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Données invalides', details = [], code = 'VALIDATION_ERROR') {
    super(message, 400, code);
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Non authentifié', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflit de données', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

module.exports = { AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError };
