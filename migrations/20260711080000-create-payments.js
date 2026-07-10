'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Payments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        // keep payment history even if an order were ever removed.
        onDelete: 'RESTRICT'
      },
      // stored as a plain string, not an enum, on purpose: adding a new
      // provider later (step: "scalable schema for more providers") should
      // only mean adding a new strategy class, not a db migration to widen an enum.
      provider: {
        type: Sequelize.STRING,
        allowNull: false
      },
      // nullable because it's only known once the provider responds to the
      // initiate call, unique so the same provider transaction is never recorded twice.
      transaction_id: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'success', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      // full raw payload from the provider (create/confirm/webhook response),
      // kept for audit/debugging, never returned to the client as-is.
      raw_response: {
        type: Sequelize.JSONB,
        allowNull: true
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

    await queryInterface.addIndex('Payments', ['order_id']);
    await queryInterface.addIndex('Payments', ['provider']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Payments_status";');
  }
};
