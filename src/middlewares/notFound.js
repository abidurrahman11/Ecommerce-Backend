const { NotFoundError } = require('../utils/AppError');

// catches any request that didn't match a route and forwards a 404 to the central error handler.

function notFound(req, res, next) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFound;
