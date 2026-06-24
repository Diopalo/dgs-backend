'use strict';

const prisma  = require('../configuration/prismaClient');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const config  = require('../config');
const logger  = require('../utils/logger');
const { ConflictError, UnauthorizedError } = require('../utils/errors');

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
 *         description: Utilisateur créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 */
const inscription = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return next(new ConflictError('Cet email est déjà utilisé.', 'EMAIL_ALREADY_EXISTS'));

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    logger.info('Nouvel utilisateur créé', { userId: user.id, email: user.email });

    res.status(201).json({ status: 'success', data: user });
  } catch (err) { next(err); }
};

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
 *         description: JWT retourné
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
const connexion = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return next(new UnauthorizedError('Email ou mot de passe incorrect.', 'INVALID_CREDENTIALS'));

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)  return next(new UnauthorizedError('Email ou mot de passe incorrect.', 'INVALID_CREDENTIALS'));

    const token = jwt.sign(
      { id: user.id, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    logger.info('Connexion réussie', { userId: user.id });

    res.json({
      status: 'success',
      data: {
        token,
        utilisateur: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) { next(err); }
};

module.exports = { inscription, connexion };
