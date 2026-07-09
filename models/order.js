'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.User, { foreignKey: 'user_id' });
      Order.hasMany(models.OrderItem, { as: 'items', foreignKey: 'order_id' });
      // note: Payment model doesn't exist yet, add
      // `Order.hasMany(models.Payment, ...)` here once it does.
    }
  }

  Order.init(
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('pending', 'paid', 'canceled'),
        allowNull: false,
        defaultValue: 'pending'
      }
    },
    {
      sequelize,
      modelName: 'Order',
      tableName: 'Orders'
    }
  );

  return Order;
};