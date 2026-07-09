'use strict';

const { z } = require('zod');

const STATUTS = ['IDEE', 'REDACTION', 'PUBLIE'];

const createContenu = z.object({
  titre:             z.string({ required_error: 'Le titre est obligatoire.' })
                       .min(3, 'Le titre doit faire au moins 3 caractères.')
                       .max(300, 'Le titre ne peut pas dépasser 300 caractères.'),
  statut:            z.enum(STATUTS, { errorMap: () => ({ message: `statut doit être : ${STATUTS.join(', ')}.` }) }).default('IDEE'),
  date_publication: z.preprocess(
  (val) => {
    if (!val) return null;
    // Accepte "2026-07-08" (format HTML) ET "2026-07-08T00:00:00Z" (ISO complet)
    const date = new Date(val);
    return isNaN(date.getTime()) ? val : date.toISOString();
  },
  z.string().datetime({ message: 'date_publication doit être une date ISO 8601 valide.' }).optional().nullable()
),
  recommandationId:  z.number().int().positive().optional().nullable(),
  assigneA:          z.string().max(200).optional().nullable(),
  notes:             z.string().max(2000).optional().nullable(),
});

const updateContenu = z.object({
  titre:            z.string().min(3).max(300).optional(),
  statut:           z.enum(STATUTS, { errorMap: () => ({ message: `statut doit être : ${STATUTS.join(', ')}.` }) }).optional(),
  date_publication: z.preprocess(
  (val) => {
    if (!val) return null;
    // Accepte "2026-07-08" (format HTML) ET "2026-07-08T00:00:00Z" (ISO complet)
    const date = new Date(val);
    return isNaN(date.getTime()) ? val : date.toISOString();
  },
  z.string().datetime({ message: 'date_publication doit être une date ISO 8601 valide.' }).optional().nullable()
),
  assigneA:         z.string().max(200).optional().nullable(),
  notes:            z.string().max(2000).optional().nullable(),
});

module.exports = { createContenu, updateContenu };
