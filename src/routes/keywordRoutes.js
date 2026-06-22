const express = require("express");
const {
  listerKeywords,
  obtenirKeyword,
  creerKeyword,
  modifierKeyword,
  supprimerKeyword
} = require("../controleurs/keywordControleur.js");

const {
  obtenirHistoriquePositions,
  enregistrerPosition
} = require("../controleurs/positionControleur.js");

const authentification = require("../middlewareJWT/authentification.js");
const autorisationRole = require("../middlewareJWT/authRoles.js");

const router = express.Router();

router.get("/", authentification, listerKeywords);
router.get("/:id", authentification, obtenirKeyword);

router.post(
  "/",
  authentification,
  autorisationRole("ADMIN", "ANALYSTE"),
  creerKeyword
);

router.put(
  "/:id",
  authentification,
  autorisationRole("ADMIN", "ANALYSTE"),
  modifierKeyword
);

router.delete(
  "/:id",
  authentification,
  autorisationRole("ADMIN"),
  supprimerKeyword
);

// ── Suivi de position ────────────────────────────────────────
router.get("/:id/positions", authentification, obtenirHistoriquePositions);

router.post(
  "/:id/positions",
  authentification,
  autorisationRole("ADMIN", "ANALYSTE"),
  enregistrerPosition
);

module.exports = router;