'use strict';

const prisma  = require('../configuration/prismaClient');
const { ValidationError, NotFoundError } = require('../utils/errors');

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

const updateProjet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, description } = req.body;

    const projet = await prisma.projet.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
    });

    if (!projet) {
      return next(
        new NotFoundError('Projet introuvable.', 'PROJECT_NOT_FOUND')
      );
    }

    const projetMaj = await prisma.projet.update({
      where: { id: Number(id) },
      data: {
        nom: nom ?? projet.nom,
        description:
          description !== undefined
            ? description
            : projet.description,
      },
    });

    res.json({
      status: 'success',
      data: projetMaj,
    });
  } catch (err) {
    next(err);
  }
};

const deleteProjet = async (req, res, next) => {
  try {
    const { id } = req.params;

    const projet = await prisma.projet.findFirst({
      where: {
        id: Number(id),
        userId: req.user.id,
      },
      include: {
        sites: true,
      },
    });

    if (!projet) {
      return next(
        new NotFoundError('Projet introuvable.', 'PROJECT_NOT_FOUND')
      );
    }

    if (projet.sites.length > 0) {
      return next(
        new ValidationError(
          'Impossible de supprimer un projet contenant des sites.',
          [
            {
              field: 'sites',
              message: 'Supprimez d’abord les sites associés.',
            },
          ]
        )
      );
    }

    await prisma.projet.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      status: 'success',
      message: 'Projet supprimé avec succès',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProjet,
  getMesProjets,
  updateProjet,
  deleteProjet
};