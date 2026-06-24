'use strict';

const express   = require('express');
const router    = express.Router();
const auth      = require('../middlewares/auth');
const roles     = require('../middlewares/roles');
const validate  = require('../middlewares/validate');
const { auditLimiter } = require('../middlewares/rateLimit');
const { createSite: createSiteSchema, updateSite: updateSiteSchema } = require('../schemas/siteSchemas');

const {
  getSites, getSiteById, createSite, updateSite, deleteSite, launchAudit, listAudits, getAuditById,
} = require('../controleurs/siteControleur');

/**
 * @swagger
 * tags:
 *   name: Sites
 *   description: Gestion des sites SEO
 */

/**
 * @swagger
 * /api/sites:
 *   get:
 *     summary: Liste paginée des sites
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste des sites avec pagination
 */
router.get('/',    auth, getSites);

/**
 * @swagger
 * /api/sites/{id}:
 *   get:
 *     summary: Détail d'un site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Détail du site
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', auth, getSiteById);

/**
 * @swagger
 * /api/sites:
 *   post:
 *     summary: Créer un site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSite'
 *     responses:
 *       201:
 *         description: Site créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 */
router.post('/', auth, roles('ADMIN'), validate(createSiteSchema), createSite);

router.put('/:id',    auth, roles('ADMIN'), validate(updateSiteSchema), updateSite);
router.delete('/:id', auth, roles('ADMIN'), deleteSite);

/**
 * @swagger
 * /api/sites/{id}/audits:
 *   post:
 *     summary: Lancer un audit SEO (asynchrone)
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       202:
 *         description: Audit lancé, traitement en cours
 *       429:
 *         description: Trop d'audits lancés récemment
 */
router.post('/:id/audits',            auth, roles('ADMIN', 'ANALYSTE'), auditLimiter, launchAudit);
router.get('/:id/audits',             auth, listAudits);
router.get('/:id/audits/:auditId',    auth, getAuditById);

module.exports = router;
