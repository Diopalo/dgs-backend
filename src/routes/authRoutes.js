'use strict';

const express  = require('express');
const router   = express.Router();
const validate = require('../middlewares/validate');
const auth     = require('../middlewares/auth');
const { inscription: inscriptionSchema, connexion: connexionSchema } = require('../schemas/authSchemas');
const { inscription, connexion } = require('../controleurs/authControleur');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentification et gestion des sessions
 */

/**
 * @swagger
 * /api/auth/inscription:
 *   post:
 *     summary: Créer un compte utilisateur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Inscription'
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 */
router.post('/inscription', validate(inscriptionSchema), inscription);

/**
 * @swagger
 * /api/auth/connexion:
 *   post:
 *     summary: Connexion et obtention du JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Connexion'
 *     responses:
 *       200:
 *         description: JWT retourné avec les infos utilisateur
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/connexion', validate(connexionSchema), connexion);

/**
 * @swagger
 * /api/auth/profil:
 *   get:
 *     summary: Profil de l'utilisateur connecté
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil retourné
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/profil', auth, (req, res) => res.json({ status: 'success', data: req.user }));

module.exports = router;
