'use strict';

const express = require('express');
const router  = express.Router();
const auth    = require('../middlewares/auth');
const roles   = require('../middlewares/roles');
const { getDashboard, getDashboardGlobal } = require('../controleurs/dashboardControleur');

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Tableaux de bord SEO agrégés
 */

/**
 * @swagger
 * /api/sites/{siteId}/dashboard:
 *   get:
 *     summary: Dashboard complet d'un site (audit + mots-clés + recos + calendrier + santé)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: siteId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Dashboard agrégé
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/sites/:siteId/dashboard', auth, getDashboard);

/**
 * @swagger
 * /api/dashboard/global:
 *   get:
 *     summary: Vue globale de tous les sites (ADMIN)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tableau de bord global trié par santé croissante
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/dashboard/global', auth, roles('ADMIN'), getDashboardGlobal);

module.exports = router;
