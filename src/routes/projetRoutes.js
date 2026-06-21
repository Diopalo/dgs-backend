const express = require('express');
const router = express.Router();

const projetControleur = require('../controleurs/projetControleur');
const authentification = require('../middlewareJWT/authentification');

router.post('/', authentification, projetControleur.createProjet);

router.get('/', authentification, projetControleur.getMesProjets);

module.exports = router;