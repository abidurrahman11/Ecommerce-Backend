const { verifyToken } = require('../utils/jwt');
const { UnauthorizedError, ForbiddenError } = require('../utils/AppError');

// reads "Authorization: Bearer <token>", verifies it, and attaches the
// decoded payload to req.user. use on any route that needs a logged in user.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  // token comes after "Bearer ", so split on space and take the second part.
  const token = authHeader.split(' ')[1];

  try {
    // decoded payload is { id, role, iat, exp }.
    req.user = verifyToken(token);
    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

// use after requireAuth on admin only routes (e.g. product management).
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
}

module.exports = { requireAuth, requireAdmin };