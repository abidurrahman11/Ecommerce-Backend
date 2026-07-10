'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      Payment.belongsTo(models.Order, { foreignKey: 'order_id' });
    }
  }

  Payment.init(
    {
      order_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false
      },
      transaction_id: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
      },
      status: {
        type: DataTypes.ENUM('pending', 'success', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      raw_response: {
        type: DataTypes.JSONB,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'Payment',
      tableName: 'Payments'
    }
  );

  return Payment;
};