'use strict';

const express  = require('express');
const router   = express.Router();
const auth     = require('../middlewares/auth');
const roles    = require('../middlewares/roles');
const validate = require('../middlewares/validate');
const { updateStatutReco } = require('../schemas/recoSchemas');
const { listRecommandations, updateStatutRecommandation, genererRecommandations, resumeRecommandations } = require('../controleurs/recoControleur');

/**
 * @swagger
 * tags:
 *   name: Recommandations
 *   description: Recommandations SEO générées automatiquement
 */

router.get( '/:siteId/recommandations/resume',  auth, resumeRecommandations);
router.post('/:siteId/recommandations/generer', auth, roles('ADMIN', 'ANALYSTE'), genererRecommandations);
router.get( '/:siteId/recommandations',         auth, listRecommandations);
router.patch('/:siteId/recommandations/:id',    auth, roles('ADMIN', 'ANALYSTE'), validate(updateStatutReco), updateStatutRecommandation);

module.exports = router;
