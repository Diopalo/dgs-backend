'use strict';

const { z } = require('zod');

const STATUTS = ['OUVERTE', 'EN_COURS', 'RESOLUE'];

const updateStatutReco = z.object({
  statut: z.enum(STATUTS, { errorMap: () => ({ message: `statut doit être : ${STATUTS.join(', ')}.` }) }),
});

module.exports = { updateStatutReco };
