const { BadRequestError } = require('../utils/AppError');

// generic joi validation middleware. pass a joi schema, get a middleware
// that validates req.body (or req.query) and either calls next() or throws
// a 400 with all validation messages attached.
//
// source is 'body' by default. pass 'query' to validate query string params,
// note express 5 makes req.query read only, so for 'query' the validated
// result is placed on req.validatedQuery instead of overwriting req.query.
//
// usage: router.post('/register', validate(registerSchema), controller.register)
// usage: router.get('/', validate(listSchema, 'query'), controller.list)
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const input = source === 'query' ? req.query : req.body;

    // abortEarly false so we collect all errors, not just the first one.
    // stripUnknown true so fields not in the schema get dropped.
    const { error, value } = schema.validate(input, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map((d) => d.message);
      return next(new BadRequestError('Validation failed', details));
    }

    if (source === 'query') {
      req.validatedQuery = value;
    } else {
      req.body = value;
    }

    next();
  };
}

module.exports = validate;
