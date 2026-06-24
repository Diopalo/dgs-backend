'use strict';

const { z } = require('zod');

const PRIORITIES = ['HAUTE', 'MOYENNE', 'BASSE'];

const createKeyword = z.object({
  expression:    z.string({ required_error: "L'expression est obligatoire." })
                   .min(2, "L'expression doit faire au moins 2 caractères.")
                   .max(100, "L'expression ne peut pas dépasser 100 caractères."),
  categorie:     z.string().max(100).optional().nullable(),
  volume_estime: z.number().int().nonnegative("Le volume estimé doit être un entier positif.").optional().nullable(),
  priorite:      z.enum(PRIORITIES, { errorMap: () => ({ message: `priorite doit être : ${PRIORITIES.join(', ')}.` }) }).default('MOYENNE'),
});

const updateKeyword = z.object({
  expression:    z.string().min(2).max(100).optional(),
  categorie:     z.string().max(100).optional().nullable(),
  volume_estime: z.number().int().nonnegative().optional().nullable(),
  priorite:      z.enum(PRIORITIES, { errorMap: () => ({ message: `priorite doit être : ${PRIORITIES.join(', ')}.` }) }).optional(),
});

module.exports = { createKeyword, updateKeyword };
