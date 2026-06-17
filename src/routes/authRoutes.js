const express = require("express");

const {
  inscription,
  connexion
} = require("../controleurs/authControleur.js");

const authentification = require("../middlewareJWT/authentification.js");

const router = express.Router();

router.post("/inscription", inscription);
router.post("/connexion", connexion);

router.get(
    "/profil",
    authentification,
    (req, res) => {
        res.json({
            message: "Accès autorisé",
            user: req.user
        });
    }
);
module.exports = router;