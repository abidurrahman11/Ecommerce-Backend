const jwt = require('jsonwebtoken');

// sign a jwt token with the given payload (usually { id, role }).
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

// verify a jwt token and return its decoded payload.
// throws if invalid/expired, caller decides how to handle it.
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
