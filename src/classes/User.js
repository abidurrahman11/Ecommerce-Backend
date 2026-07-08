const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

// domain class for User. wraps the raw sequelize row and owns the password
// hashing / verification logic, so this stays out of the model and out of the service.
class User {
  constructor(userRow) {
    this.id = userRow.id;
    this.name = userRow.name;
    this.email = userRow.email;
    // this is the hashed password, never the plain one.
    this.password = userRow.password;
    this.role = userRow.role;
  }

  // hash a plain password before saving it to the db.
  static async hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  // compare a plain password (from login form) against the stored hash.
  async comparePassword(plainPassword) {
    return bcrypt.compare(plainPassword, this.password);
  }

  // true if this user has admin role, used to guard product management routes.
  isAdmin() {
    return this.role === 'admin';
  }

  // shape returned to the client. never leak the password hash.
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role
    };
  }
}

module.exports = User;
