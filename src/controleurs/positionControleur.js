const prisma = require("../configuration/prismaClient");

// ── GET /mots-cles/:id/positions — Historique complet ───────────
const obtenirHistoriquePositions = async (req, res) => {
  try {
    const keywordId = parseInt(req.params.id);

    const keyword = await prisma.keyword.findUnique({
      where: { id: keywordId }
    });

    if (!keyword) {
      return res.status(404).json({
        success: false,
        message: "Mot-clé introuvable."
      });
    }

    const positions = await prisma.positionnement.findMany({
      where: { keywordId },
      orderBy: { dateMesure: "asc" }
    });

    // ── Calcul de la progression (RG utile pour le dashboard) ──
    let evolution = null;
    if (positions.length >= 2) {
      const derniere = positions[positions.length - 1].position;
      const precedente = positions[positions.length - 2].position;
      // En SEO, une position plus PETITE est meilleure (1er > 10ème)
      // Donc si derniere < precedente, c'est une progression positive
      evolution = {
        valeur: precedente - derniere,
        // Ex: precedente=8, derniere=4 → valeur=4 → progression de 4 places
        sens: derniere < precedente ? "progression" : derniere > precedente ? "regression" : "stable"
      };
    }

    res.status(200).json({
      success: true,
      data: {
        motCle: keyword.motCle,
        historique: positions,
        evolution
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de l'historique."
    });
  }
};

// ── POST /mots-cles/:id/positions — Enregistre une mesure ───────
const enregistrerPosition = async (req, res) => {
  try {
    const keywordId = parseInt(req.params.id);
    const { position, dateMesure } = req.body;

    if (position === undefined) {
      return res.status(400).json({
        success: false,
        message: "Le champ position est obligatoire."
      });
    }

    const keywordExiste = await prisma.keyword.findUnique({
      where: { id: keywordId }
    });

    if (!keywordExiste) {
      return res.status(404).json({
        success: false,
        message: "Mot-clé introuvable."
      });
    }

    const nouvellePosition = await prisma.positionnement.create({
      data: {
        position: parseInt(position),
        keywordId,
        // Si dateMesure n'est pas fourni, Prisma utilise @default(now())
        ...(dateMesure && { dateMesure: new Date(dateMesure) })
      }
    });

    res.status(201).json({
      success: true,
      message: "Position enregistrée avec succès.",
      data: nouvellePosition
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement de la position."
    });
  }
};

module.exports = {
  obtenirHistoriquePositions,
  enregistrerPosition
};