const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const { sendError } = require('../utils/apiResponse');

// single central error handler. every route/controller should throw (or call next(err)) instead of handling res.status(...).json(...)
// directly, so all error responses stay consistent. must be registered LAST, after all routes.

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isOperational = err instanceof AppError;
  const statusCode = isOperational ? err.statusCode : 500;
  const message = isOperational ? err.message : 'Internal server error';

  if (isOperational) {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`);
  } else {
    logger.error(`${req.method} ${req.originalUrl} -> 500: ${err.stack || err.message}`);
  }

  return sendError(res, {
    statusCode,
    message,
    details: isOperational ? err.details : undefined
  });
}

module.exports = errorHandler;
