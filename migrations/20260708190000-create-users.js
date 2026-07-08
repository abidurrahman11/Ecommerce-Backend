'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      // never store plain password, only the bcrypt hash
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      // 'user' by default, 'admin' can create/update/delete products
      role: {
        type: Sequelize.ENUM('user', 'admin'),
        allowNull: false,
        defaultValue: 'user'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // email is looked up on every login, index it
    await queryInterface.addIndex('Users', ['email']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Users');
    // ENUM type isn't dropped automatically with the table in Postgres
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_role";');
  }
};
