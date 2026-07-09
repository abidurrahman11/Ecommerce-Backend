'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    static associate(models) {
      // self referential: a category can have one parent and many children.
      Category.belongsTo(models.Category, { as: 'parent', foreignKey: 'parent_id' });
      Category.hasMany(models.Category, { as: 'children', foreignKey: 'parent_id' });

      // a category can have many products.
      Category.hasMany(models.Product, { foreignKey: 'category_id' });
    }
  }

  Category.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      parent_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'Category',
      tableName: 'Categories'
    }
  );

  return Category;
};
