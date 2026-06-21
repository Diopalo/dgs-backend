const autorisationRole = (...rolesAutorises) => {

  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Utilisateur non authentifié."
      });
    }

    if (!rolesAutorises.includes(req.user.role)) {

      return res.status(403).json({
        success: false,
        message: "Accès refusé."
      });
    }

    next();
  };
};
module.exports = autorisationRole;