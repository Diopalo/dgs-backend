'use strict';

const express = require('express');
const router  = express.Router();
const auth    = require('../middlewares/auth');
const {
  createProjet,
  getMesProjets,
  updateProjet,
  deleteProjet
} = require('../controleurs/projetControleur');

router.post('/', auth, createProjet);
router.get('/',  auth, getMesProjets);
router.put('/:id', auth, updateProjet);
router.delete('/:id', auth, deleteProjet);

module.exports = router;
