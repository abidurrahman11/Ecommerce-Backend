const express = require('express');
const authController = require('../controllers/auth.controller');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { registerSchema, loginSchema } = require('../utils/validators/auth.validators');
const { sendSuccess } = require('../utils/apiResponse');
const { User: UserModel } = require('../../models');
const User = require('../classes/User');

const router = express.Router();

// register a new user.
router.post('/register', validate(registerSchema), asyncHandler(authController.register));

// log an existing user in
router.post('/login', validate(loginSchema), asyncHandler(authController.login));

// quick sanity check route, confirms requireAuth + token flow works end to end.
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await UserModel.findByPk(req.user.id);
    const user = new User(row);
    return sendSuccess(res, { data: user.toJSON() });
  })
);

module.exports = router;
