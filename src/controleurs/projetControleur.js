'use strict';

const prisma  = require('../configuration/prismaClient');
const { ValidationError } = require('../utils/errors');

const createProjet = async (req, res, next) => {
  try {
    const { nom, description } = req.body;
    if (!nom) return next(new ValidationError('Le nom du projet est obligatoire.', [{ field: 'nom', message: 'Requis.' }]));

    const projet = await prisma.projet.create({
      data: { nom, description, userId: req.user.id },
    });

    res.status(201).json({ status: 'success', data: projet });
  } catch (err) { next(err); }
};

const getMesProjets = async (req, res, next) => {
  try {
    const projets = await prisma.projet.findMany({
      where:   { userId: req.user.id },
      include: { sites: true },
    });
    res.json({ status: 'success', data: projets });
  } catch (err) { next(err); }
};

module.exports = { createProjet, getMesProjets };
