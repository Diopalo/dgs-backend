'use strict';

const express  = require('express');
const router   = express.Router();
const auth     = require('../middlewares/auth');
const roles    = require('../middlewares/roles');
const validate = require('../middlewares/validate');
const { createContenu: createSchema, updateContenu: updateSchema } = require('../schemas/contenuSchemas');
const { listContenus, createContenu, updateContenu, deleteContenu, getCalendrier } = require('../controleurs/contenuControleur');

/**
 * @swagger
 * tags:
 *   name: Contenus
 *   description: Calendrier éditorial et gestion des contenus
 */

/**
 * @swagger
 * /api/sites/{siteId}/contenus/calendrier:
 *   get:
 *     summary: Contenus groupés par mois
 *     tags: [Contenus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: siteId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Calendrier éditorial groupé par mois
 */
router.get('/:siteId/contenus/calendrier', auth, getCalendrier);

/**
 * @swagger
 * /api/sites/{siteId}/contenus:
 *   get:
 *     summary: Liste paginée des contenus éditoriaux
 *     tags: [Contenus]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Créer un contenu éditorial
 *     tags: [Contenus]
 *     security:
 *       - bearerAuth: []
 */
router.get( '/:siteId/contenus',       auth, listContenus);
router.post('/:siteId/contenus',       auth, validate(createSchema), createContenu);
router.patch('/:siteId/contenus/:id',  auth, validate(updateSchema), updateContenu);
router.delete('/:siteId/contenus/:id', auth, deleteContenu);

module.exports = router;
