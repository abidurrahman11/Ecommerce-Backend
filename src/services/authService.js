const { User: UserModel } = require('../../models');
const User = require('../classes/User');
const { signToken } = require('../utils/jwt');
const { ConflictError, UnauthorizedError } = require('../utils/AppError');

// registers a new user. throws ConflictError if the email is already taken.
async function register({ name, email, password }) {
  // check if the email is already registered.
  const existing = await UserModel.findOne({ where: { email } });
  if (existing) {
    throw new ConflictError('Email is already registered');
  }

  // hash the password before saving it, never store plain text.
  const hashedPassword = await User.hashPassword(password);

  const row = await UserModel.create({ name, email, password: hashedPassword });
  const user = new User(row);

  // log the user in right after registering.
  const token = signToken({ id: user.id, role: user.role });

  return { user: user.toJSON(), token };
}

// logs a user in. throws UnauthorizedError for wrong email or password
async function login({ email, password }) {
  const row = await UserModel.findOne({ where: { email } });
  if (!row) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const user = new User(row);
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = signToken({ id: user.id, role: user.role });

  return { user: user.toJSON(), token };
}

module.exports = { register, login };
