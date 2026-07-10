const Order = require('../../src/classes/Order');

// unit tests for the Order domain class, focused on the deterministic
// total/subtotal calculation algorithm required by the assessment.
describe('Order class - total/subtotal calculation', () => {
  it('computes an item subtotal as price * quantity', () => {
    expect(Order.computeItemSubtotal(10, 3)).toBe(30);
    expect(Order.computeItemSubtotal(9.99, 2)).toBe(19.98);
  });

  it('rounds subtotal to 2 decimals to avoid floating point drift', () => {
    // 0.1 + 0.2 style floating point issues would show up here without rounding.
    expect(Order.computeItemSubtotal(0.1, 3)).toBe(0.3);
  });

  it('is deterministic, same inputs always produce the same subtotal', () => {
    expect(Order.computeItemSubtotal(15.5, 4)).toBe(Order.computeItemSubtotal(15.5, 4));
  });

  it('computes the total as the sum of all item subtotals', () => {
    const items = [{ subtotal: 30 }, { subtotal: 19.98 }, { subtotal: 5.02 }];
    expect(Order.computeTotal(items)).toBe(55);
  });

  it('returns 0 for an order with no items', () => {
    expect(Order.computeTotal([])).toBe(0);
  });

  it('belongsToUser correctly identifies ownership', () => {
    const order = new Order({ id: 1, user_id: 7, total_amount: 10, status: 'pending' });
    expect(order.belongsToUser(7)).toBe(true);
    expect(order.belongsToUser(8)).toBe(false);
  });

  it('status helpers reflect the order status', () => {
    const pending = new Order({ id: 1, user_id: 1, total_amount: 10, status: 'pending' });
    const paid = new Order({ id: 2, user_id: 1, total_amount: 10, status: 'paid' });
    const canceled = new Order({ id: 3, user_id: 1, total_amount: 10, status: 'canceled' });

    expect(pending.isPending()).toBe(true);
    expect(paid.isPaid()).toBe(true);
    expect(canceled.isCanceled()).toBe(true);
  });
});
