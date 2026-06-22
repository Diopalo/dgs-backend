'use strict';

const express = require('express');
const router  = express.Router();

const authentification  = require('../middlewareJWT/authentification');
const autorisationRole  = require('../middlewareJWT/authRoles');

const {
  listMotsCles,
  createMotCle,
  updateMotCle,
  deleteMotCle,
  statsMotsCles,
} = require('../controleurs/motCleControleur');

// IMPORTANT : /stats avant /:id pour éviter que "stats" soit capturé comme param
router.get( '/:siteId/mots-cles/stats', authentification, statsMotsCles);
router.get( '/:siteId/mots-cles',       authentification, listMotsCles);
router.post('/:siteId/mots-cles',       authentification, autorisationRole('ADMIN', 'ANALYSTE'), createMotCle);
router.put( '/:siteId/mots-cles/:id',   authentification, autorisationRole('ADMIN', 'ANALYSTE'), updateMotCle);
router.delete('/:siteId/mots-cles/:id', authentification, autorisationRole('ADMIN'), deleteMotCle);

module.exports = router;
