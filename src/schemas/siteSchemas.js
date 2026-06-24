'use strict';

const { z } = require('zod');

const createSite = z.object({
  nom:      z.string({ required_error: 'Le nom est obligatoire.' })
              .min(2, 'Le nom doit faire au moins 2 caractères.')
              .max(200, 'Le nom ne peut pas dépasser 200 caractères.'),
  url:      z.string({ required_error: "L'URL est obligatoire." })
              .url("L'URL doit être une URL valide (ex: https://example.com)."),
  projetId: z.number({ required_error: "L'ID du projet est obligatoire.", invalid_type_error: "L'ID du projet doit être un entier." })
              .int("L'ID du projet doit être un entier.")
              .positive("L'ID du projet doit être positif."),
});

const updateSite = z.object({
  nom: z.string().min(2).max(200).optional(),
  url: z.string().url("L'URL doit être valide.").optional(),
}).refine(data => data.nom || data.url, {
  message: 'Au moins un champ (nom ou url) doit être fourni.',
});

module.exports = { createSite, updateSite };
