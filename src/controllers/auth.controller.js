const authService = require('../services/authService');
const { sendSuccess } = require('../utils/apiResponse');

// register a new user and return the created user + auth token
async function register(req, res) {
  const result = await authService.register(req.body);
  return sendSuccess(res, { statusCode: 201, data: result, message: 'User registered successfully' });
}

// log an existing user in and return the user + auth token.
async function login(req, res) {
  const result = await authService.login(req.body);
  return sendSuccess(res, { data: result, message: 'Login successful' });
}

module.exports = { register, login };