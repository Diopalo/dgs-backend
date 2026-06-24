'use strict';

const express = require('express');
const router  = express.Router();
const auth    = require('../middlewares/auth');
const { createProjet, getMesProjets } = require('../controleurs/projetControleur');

router.post('/', auth, createProjet);
router.get('/',  auth, getMesProjets);

module.exports = router;
