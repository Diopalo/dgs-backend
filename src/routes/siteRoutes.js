const express = require("express");
const router = express.Router();

const authentification = require("../middlewareJWT/authentification");
const autorisationRole = require("../middlewareJWT/authRoles.js");

const {
    createSite,
    getSites,
    getSiteById,
    updateSite,
    deleteSite,
    launchAudit,
    listAudits   
} = require("../controleurs/siteControleur");

// Routes classiques pour les sites
router.post("/", authentification, autorisationRole("ADMIN"), createSite);
router.get("/", authentification, getSites);
router.get("/:id", authentification, getSiteById);
router.put("/:id", authentification, autorisationRole("ADMIN"), updateSite);
router.delete("/:id", authentification, autorisationRole("ADMIN"), deleteSite);

// Lancement d'audit réservé à l'admin et à l'analyste
router.post('/:id/audits', authentification, autorisationRole('ADMIN', 'ANALYSTE'), launchAudit);
router.get('/:id/audits', authentification, listAudits);

module.exports = router;