'use strict';

const express  = require('express');
const router   = express.Router();
const auth     = require('../middlewares/auth');
const roles    = require('../middlewares/roles');
const validate = require('../middlewares/validate');
const { createKeyword, updateKeyword } = require('../schemas/keywordSchemas');
const { listMotsCles, createMotCle, updateMotCle, deleteMotCle, statsMotsCles } = require('../controleurs/motCleControleur');
const { measureAllKeywords } = require('../services/positionService');
const { NotFoundError } = require('../utils/errors');

/**
 * @swagger
 * tags:
 *   name: Mots-clés
 *   description: Gestion des mots-clés SEO et positions
 */

// Statiques avant /:id
router.get( '/:siteId/mots-cles/stats',   auth, statsMotsCles);
router.post('/:siteId/mots-cles/mesurer', auth, roles('ADMIN', 'ANALYSTE'), async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const result = await measureAllKeywords(siteId);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
});

router.get( '/:siteId/mots-cles',       auth, listMotsCles);
router.post('/:siteId/mots-cles',       auth, roles('ADMIN', 'ANALYSTE'), validate(createKeyword), createMotCle);
router.put( '/:siteId/mots-cles/:id',   auth, roles('ADMIN', 'ANALYSTE'), validate(updateKeyword), updateMotCle);
router.delete('/:siteId/mots-cles/:id', auth, roles('ADMIN'), deleteMotCle);

module.exports = router;
