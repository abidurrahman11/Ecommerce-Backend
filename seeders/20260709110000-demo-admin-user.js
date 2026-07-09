'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    // hash the password the same way the User class does, so this admin
    // can actually log in through the normal /api/auth/login route.
    const hashedPassword = await bcrypt.hash('Admin@12345', 10);

    await queryInterface.bulkInsert('Users', [
      {
        name: 'Admin',
        email: 'admin@ecommerce.test',
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Users', { email: 'admin@ecommerce.test' });
  }
};
