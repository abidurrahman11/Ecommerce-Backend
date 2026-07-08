const { BadRequestError } = require('../utils/AppError');

// generic joi validation middleware. pass a joi schema, get a middleware
// that validates req.body and either calls next() or throws a 400 with all validation messages attached.
// usage: router.post('/register', validate(registerSchema), controller.register)
function validate(schema) {
  return (req, res, next) => {
    // abortEarly false so we collect all errors, not just the first one.
    // stripUnknown true so fields not in the schema get dropped.
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map((d) => d.message);
      return next(new BadRequestError('Validation failed', details));
    }

    // use the sanitized/validated body from here on.
    req.body = value;
    next();
  };
}

module.exports = validate;
