'use strict';

const { z } = require('zod');

const inscription = z.object({
  name:     z.string({ required_error: 'Le nom est obligatoire.' })
              .min(2, 'Le nom doit faire au moins 2 caractères.')
              .max(100, 'Le nom ne peut pas dépasser 100 caractères.'),
  email:    z.string({ required_error: "L'email est obligatoire." })
              .email("Format d'email invalide."),
  password: z.string({ required_error: 'Le mot de passe est obligatoire.' })
              .min(8, 'Le mot de passe doit faire au moins 8 caractères.')
              .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères.'),
});

const connexion = z.object({
  email:    z.string({ required_error: "L'email est obligatoire." })
              .email("Format d'email invalide."),
  password: z.string({ required_error: 'Le mot de passe est obligatoire.' })
              .min(1, 'Le mot de passe est obligatoire.'),
});

module.exports = { inscription, connexion };
