const { BadRequestError, ConflictError } = require('../utils/AppError');

// domain class for Product. wraps the raw sequelize row and owns the rules
// around stock and availability, so this stays out of the model and out of
// the service. the actual db read/lock/save still happens in the service,
// this class only owns the decision logic (deterministic, no db calls here).
class Product {
  constructor(productRow) {
    this.id = productRow.id;
    this.name = productRow.name;
    this.sku = productRow.sku;
    this.description = productRow.description;
    this.price = Number(productRow.price);
    this.stock = productRow.stock;
    this.status = productRow.status;
    this.category_id = productRow.category_id;
  }

  // only "active" products should be sold or shown to normal users.
  isActive() {
    return this.status === 'active';
  }

  // true if there's enough stock for the requested quantity.
  hasEnoughStock(quantity) {
    return this.stock >= quantity;
  }

  // deterministic stock reduction algorithm. given a quantity, returns what
  // the new stock value should be, or throws if the reduction isn't valid.
  // this is pure logic, no db call here, the caller (service) is responsible
  // for wrapping the actual read + save in a locked transaction so this
  // never runs against stale/racy data.
  computeStockAfterReduction(quantity) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestError('Quantity to reduce must be a positive integer');
    }

    if (!this.hasEnoughStock(quantity)) {
      throw new ConflictError(`Insufficient stock for product "${this.sku}" (have ${this.stock}, need ${quantity})`);
    }

    return this.stock - quantity;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      sku: this.sku,
      description: this.description,
      price: this.price,
      stock: this.stock,
      status: this.status,
      category_id: this.category_id
    };
  }
}

module.exports = Product;
