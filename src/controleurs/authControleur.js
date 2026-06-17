const prisma = require("../configuration/prismaClient");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const inscription = async (req, res) => {
  try {
    console.log("BODY RECU :", req.body);
    const { name, email, password, role } = req.body;

    const utilisateurExistant = await prisma.user.findUnique({
      where: { email }
    });

    if (utilisateurExistant) {
      return res.status(409).json({
        success: false,
        message: "Cet email est déjà utilisé."
      });
    }

    const motDePasseHash = await bcrypt.hash(password, 10);

    const utilisateur = await prisma.user.create({
      data: {
        name,
        email,
        password: motDePasseHash,
        role
      }
    });

    res.status(201).json({
      success: true,
      message: "Utilisateur créé avec succès.",
      data: {
        id: utilisateur.id,
        name: utilisateur.name,
        email: utilisateur.email,
        role: utilisateur.role
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur lors de l'inscription."
    });
  }
};

const connexion = async (req, res) => {
  try {
    const { email, password } = req.body;

    const utilisateur = await prisma.user.findUnique({
      where: { email }
    });

    if (!utilisateur) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable."
      });
    }

    const motDePasseValide = await bcrypt.compare(
      password,
      utilisateur.password
    );

    if (!motDePasseValide) {
      return res.status(401).json({
        success: false,
        message: "Mot de passe incorrect."
      });
    }

    const token = jwt.sign(
      {
        id: utilisateur.id,
        role: utilisateur.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h"
      }
    );

    res.status(200).json({
      success: true,
      message: "Connexion réussie.",
      token,
      utilisateur: {
        id: utilisateur.id,
        name: utilisateur.name,
        email: utilisateur.email,
        role: utilisateur.role
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur lors de la connexion."
    });
  }
};

module.exports = {
  inscription,
  connexion
};