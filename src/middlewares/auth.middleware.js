const { verifyToken, COOKIE_NAME } = require('../utils/jwt');
const { HttpError } = require('../utils/errors');

// Middleware de autenticacion: lee el JWT desde la cookie currentUser,
// lo valida y deja el payload (id, email, role) en req.user.
// Si no hay cookie o el token no es valido/expirado -> 401.
const authMiddleware = (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return next(new HttpError(401, 'No autenticado'));
  }

  try {
    req.user = verifyToken(token);
    return next();
  } catch (error) {
    return next(new HttpError(401, 'No autenticado'));
  }
};

module.exports = authMiddleware;