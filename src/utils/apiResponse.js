// this is a consistent API response shape used across all controllers.

function sendSuccess(res, { statusCode = 200, data = null, message = null } = {}) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(message ? { message } : {})
  });
}

function sendError(res, { statusCode = 500, message = 'Something went wrong', details = null } = {}) {
  return res.status(statusCode).json({
    success: false,
    error: { message, ...(details ? { details } : {}) }
  });
}

module.exports = { sendSuccess, sendError };