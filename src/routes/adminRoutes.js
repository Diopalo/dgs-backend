'use strict';

const express = require('express');
const router  = express.Router();
const auth    = require('../middlewares/auth');
const roles   = require('../middlewares/roles');
const { getStats, triggerPurge } = require('../controleurs/adminControleur');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Endpoints d'administration (ADMIN uniquement)
 */

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Statistiques globales du système
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques système
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/stats', auth, roles('ADMIN'), getStats);

/**
 * @swagger
 * /api/admin/purge:
 *   post:
 *     summary: Déclencher la purge manuelle des données > 90 jours
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Résultat de la purge
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/purge', auth, roles('ADMIN'), triggerPurge);

module.exports = router;
