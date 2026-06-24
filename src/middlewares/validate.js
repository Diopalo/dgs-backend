'use strict';

const { z } = require('zod');
const { ValidationError } = require('../utils/errors');

module.exports = function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = (result.error.issues || []).map(e => ({
        field:   Array.isArray(e.path) ? e.path.join('.') : '',
        message: e.message,
      }));
      return next(new ValidationError('Données invalides.', details, 'VALIDATION_ERROR'));
    }

    req.body = result.data;
    next();
  };
};
