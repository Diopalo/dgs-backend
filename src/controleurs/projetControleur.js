const prisma = require('../configuration/prismaClient');

// Créer un projet
const createProjet = async (req, res) => {
  try {
    const { nom, description } = req.body;

    if (!nom) {
      return res.status(400).json({
        success: false,
        message: "Le nom du projet est obligatoire."
      });
    }

    const projet = await prisma.projet.create({
      data: {
        nom,
        description,
        userId: req.user.id
      }
    });

    return res.status(201).json({
      success: true,
      message: "Projet créé avec succès.",
      data: projet
    });

  } catch (error) {
    console.error("Erreur création projet :", error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la création du projet."
    });
  }
};

// Récupérer tous les projets de l'utilisateur connecté
const getMesProjets = async (req, res) => {
  try {
    const projets = await prisma.projet.findMany({
      where: {
        userId: req.user.id
      },
      include: {
        sites: true
      }
    });

    return res.status(200).json({
      success: true,
      data: projets
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des projets."
    });
  }
};

module.exports = {
  createProjet,
  getMesProjets
};