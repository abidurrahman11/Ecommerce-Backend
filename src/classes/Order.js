// domain class for Order. wraps the raw sequelize row + its items and owns
// the deterministic total/subtotal calculation, so the math lives in one place instead of being repeated across the service.
class Order {
  constructor(orderRow, items = []) {
    this.id = orderRow.id;
    this.user_id = orderRow.user_id;
    this.total_amount = Number(orderRow.total_amount);
    this.status = orderRow.status;
    // items are plain objects: { product_id, quantity, price, subtotal }
    this.items = items;
  }

  // deterministic: same price + quantity always gives the same subtotal.
  // rounds to 2 decimals so floating point math never drifts the price.
  static computeItemSubtotal(price, quantity) {
    return Math.round(Number(price) * quantity * 100) / 100;
  }

  // deterministic: total is just the sum of every item's subtotal.
  static computeTotal(items) {
    const total = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    return Math.round(total * 100) / 100;
  }

  // true if this order belongs to the given user, used for the ownership
  // check before letting someone view an order.
  belongsToUser(userId) {
    return this.user_id === userId;
  }

  isPending() {
    return this.status === 'pending';
  }

  isPaid() {
    return this.status === 'paid';
  }

  isCanceled() {
    return this.status === 'canceled';
  }

  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      total_amount: this.total_amount,
      status: this.status,
      items: this.items
    };
  }
}

module.exports = Order;