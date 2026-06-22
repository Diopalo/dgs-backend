const prisma = require("../configuration/prismaClient");
const { runAudit } = require('../services/auditRunner');

// Créer un site
const createSite = async (req, res) => {
    try {
        const { nom, url, projetId } = req.body;

        if (!nom || !url || !projetId) {
            return res.status(400).json({
                success: false,
                message: "Le nom, l'URL et l'id du projet sont obligatoires."
            });
        }

        const projet = await prisma.projet.findUnique({
            where: { id: Number(projetId) }
        });

        if (!projet) {
            return res.status(404).json({
                success: false,
                message: "Projet introuvable."
            });
        }

        const siteExistant = await prisma.site.findUnique({
            where: { url }
        });

        if (siteExistant) {
            return res.status(409).json({
                success: false,
                message: "Ce site existe déjà."
            });
        }

        const site = await prisma.site.create({
            data: {
                nom,
                url,
                projetId: Number(projetId)
            }
        });

        return res.status(201).json({
            success: true,
            message: "Site créé avec succès.",
            data: site
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la création du site."
        });
    }
};

// Récupération de tous les sites
const getSites = async (req, res) => {
    try {
        const sites = await prisma.site.findMany({
            include: {
                projet: true
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        return res.status(200).json({
            success: true,
            total: sites.length,
            data: sites
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des sites."
        });
    }
};

// Récupération d'un site par ID
const getSiteById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID invalide."
            });
        }

        const site = await prisma.site.findUnique({
            where: { id },
            include: {
                projet: true,
                keywords: true,
                auditResults: true
            }
        });

        if (!site) {
            return res.status(404).json({
                success: false,
                message: "Site introuvable."
            });
        }

        return res.status(200).json({
            success: true,
            data: site
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération du site."
        });
    }
};

// Modification d'un site
async function updateSite(req, res) {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID invalide."
            });
        }

        const { nom, url } = req.body;

        const site = await prisma.site.findUnique({
            where: { id }
        });

        if (!site) {
            return res.status(404).json({
                success: false,
                message: "Site introuvable."
            });
        }

        const siteModifie = await prisma.site.update({
            where: { id },
            data: {
                nom: nom ?? site.nom,
                url: url ?? site.url
            }
        });

        return res.status(200).json({
            success: true,
            message: "Site modifié avec succès.",
            data: siteModifie
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la modification du site."
        });
    }
}

// Suppression d'un site
async function deleteSite(req, res) {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID invalide."
            });
        }

        const site = await prisma.site.findUnique({
            where: { id }
        });

        if (!site) {
            return res.status(404).json({
                success: false,
                message: "Site introuvable."
            });
        }

        await prisma.site.delete({
            where: { id }
        });

        return res.status(200).json({
            success: true,
            message: "Site supprimé avec succès."
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la suppression du site."
        });
    }
}

// Lancer un audit
async function launchAudit(req, res) {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID invalide."
            });
        }

        const site = await prisma.site.findUnique({
            where: { id }
        });

        if (!site) {
            return res.status(404).json({
                success: false,
                message: "Site introuvable."
            });
        }

        const audit = await prisma.auditResult.create({
            data: {
                score: 0,
                details: JSON.stringify({ statut: "en_cours" }),
                siteId: id
            }
        });

        runAudit(audit.id, site.url);

        return res.status(202).json({
            success: true,
            message: "Audit lancé.",
            auditId: audit.id
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Erreur lors du lancement de l'audit.",
            error: err.message
        });
    }
}

// Historique des audits d'un site
async function listAudits(req, res) {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID invalide."
            });
        }

        const audits = await prisma.auditResult.findMany({
            where: {
                siteId: id
            },
            orderBy: {
                crawledAt: "desc"
            }
        });

        return res.status(200).json({
            success: true,
            data: audits
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Erreur serveur.",
            error: err.message
        });
    }
}

module.exports = {
    createSite,
    getSites,
    getSiteById,
    updateSite,
    deleteSite,
    launchAudit,
    listAudits
};