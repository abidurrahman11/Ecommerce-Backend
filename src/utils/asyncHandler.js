// this wraps an async route/controller handler so any thrown error or rejected promise is forwarded to next(),
// reaching the central error handler instead of crashing the process or hanging the request.

// usage: router.get('/', asyncHandler(controller.list));

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;