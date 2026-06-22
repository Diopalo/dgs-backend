const prisma = require("../configuration/prismaClient");

// ── GET /mots-cles?siteId=3 — Liste les mots-clés d'un site ────
const listerKeywords = async (req, res) => {
  try {
    const { siteId, priorite, categorie } = req.query;
    // req.query récupère les paramètres dans l'URL : ?siteId=3&priorite=HAUTE

    if (!siteId) {
      return res.status(400).json({
        success: false,
        message: "Le paramètre siteId est obligatoire."
      });
    }

    const keywords = await prisma.keyword.findMany({
      where: {
        siteId: parseInt(siteId),
        // On ajoute les filtres seulement s'ils sont fournis dans la requête
        ...(priorite && { priorite }),
        ...(categorie && { categorie })
      },
      orderBy: [
        { priorite: "desc" },
        // Trie d'abord par priorité (HAUTE en haut alphabétiquement
        // n'est pas garanti — on verra la nuance juste après)
        { volumeRecherche: "desc" }
        // Puis par volume de recherche décroissant
      ]
    });

    res.status(200).json({
      success: true,
      data: keywords
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des mots-clés."
    });
  }
};

// ── GET /mots-cles/:id — Détail d'un mot-clé avec historique ───
const obtenirKeyword = async (req, res) => {
  try {
    const keyword = await prisma.keyword.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        positions: {
          orderBy: { dateMesure: "asc" },
          // "asc" = du plus ancien au plus récent, pour tracer une courbe
          // dans le bon ordre chronologique
        }
      }
    });

    if (!keyword) {
      return res.status(404).json({
        success: false,
        message: "Mot-clé introuvable."
      });
    }

    res.status(200).json({
      success: true,
      data: keyword
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du mot-clé."
    });
  }
};

// ── POST /mots-cles — Crée un nouveau mot-clé ───────────────────
const creerKeyword = async (req, res) => {
  try {
    const { motCle, siteId, urlCible, volumeRecherche, categorie, priorite } = req.body;

    if (!motCle || !siteId) {
      return res.status(400).json({
        success: false,
        message: "Le motCle et le siteId sont obligatoires."
      });
    }

    const siteExiste = await prisma.site.findUnique({
      where: { id: parseInt(siteId) }
    });

    if (!siteExiste) {
      return res.status(404).json({
        success: false,
        message: "Le site spécifié n'existe pas."
      });
    }

    const nouveauKeyword = await prisma.keyword.create({
      data: {
        motCle,
        siteId: parseInt(siteId),
        urlCible: urlCible || null,
        volumeRecherche: volumeRecherche ? parseInt(volumeRecherche) : null,
        categorie: categorie || null,
        // Si priorite n'est pas fourni, Prisma applique automatiquement
        // @default(MOYENNE) défini dans le schéma
        ...(priorite && { priorite })
      }
    });

    res.status(201).json({
      success: true,
      message: "Mot-clé créé avec succès.",
      data: nouveauKeyword
    });
  } catch (error) {
    console.error(error);

    if (error.code === "P2009" || error.code === "P2025") {
      // P2009/P2025 peuvent survenir si la valeur de priorite envoyée
      // ne correspond à aucune valeur de l'enum (ex: "urgent")
      return res.status(422).json({
        success: false,
        message: "La priorité doit être BASSE, MOYENNE ou HAUTE."
      });
    }

    res.status(500).json({
      success: false,
      message: "Erreur lors de la création du mot-clé."
    });
  }
};

// ── PUT /mots-cles/:id — Modifie un mot-clé ─────────────────────
const modifierKeyword = async (req, res) => {
  try {
    const keywordId = parseInt(req.params.id);
    const { motCle, urlCible, volumeRecherche, categorie, priorite } = req.body;

    const keywordExiste = await prisma.keyword.findUnique({
      where: { id: keywordId }
    });

    if (!keywordExiste) {
      return res.status(404).json({
        success: false,
        message: "Mot-clé introuvable."
      });
    }

    const keywordMisAJour = await prisma.keyword.update({
      where: { id: keywordId },
      data: {
        ...(motCle && { motCle }),
        ...(urlCible !== undefined && { urlCible }),
        ...(volumeRecherche !== undefined && { volumeRecherche: parseInt(volumeRecherche) }),
        ...(categorie !== undefined && { categorie }),
        ...(priorite && { priorite })
      }
    });

    res.status(200).json({
      success: true,
      message: "Mot-clé mis à jour avec succès.",
      data: keywordMisAJour
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour du mot-clé."
    });
  }
};

// ── DELETE /mots-cles/:id — Supprime un mot-clé ─────────────────
const supprimerKeyword = async (req, res) => {
  try {
    const keywordId = parseInt(req.params.id);

    const keywordExiste = await prisma.keyword.findUnique({
      where: { id: keywordId }
    });

    if (!keywordExiste) {
      return res.status(404).json({
        success: false,
        message: "Mot-clé introuvable."
      });
    }

    // Grâce à onDelete: Cascade ajouté dans le schéma,
    // tout l'historique de positions de ce mot-clé est supprimé automatiquement
    await prisma.keyword.delete({
      where: { id: keywordId }
    });

    res.status(200).json({
      success: true,
      message: "Mot-clé supprimé avec succès."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression du mot-clé."
    });
  }
};

module.exports = {
  listerKeywords,
  obtenirKeyword,
  creerKeyword,
  modifierKeyword,
  supprimerKeyword
};