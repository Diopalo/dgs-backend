'use strict';

const { AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError } = require('../../src/utils/errors');

describe('Classes d\'erreurs métier', () => {
  test('AppError contient statusCode et code', () => {
    const err = new AppError('Test', 500, 'TEST_CODE');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('TEST_CODE');
    expect(err.isOperational).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  test('NotFoundError → 404 NOT_FOUND', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  test('ValidationError → 400 avec details', () => {
    const details = [{ field: 'email', message: 'Invalide' }];
    const err = new ValidationError('Bad input', details);
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual(details);
  });

  test('UnauthorizedError → 401', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  test('ForbiddenError → 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  test('ConflictError → 409', () => {
    const err = new ConflictError('Déjà existant');
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe('Déjà existant');
  });

  test('les sous-classes héritent d\'AppError', () => {
    expect(new NotFoundError() instanceof AppError).toBe(true);
    expect(new ValidationError() instanceof AppError).toBe(true);
    expect(new UnauthorizedError() instanceof AppError).toBe(true);
  });
});
