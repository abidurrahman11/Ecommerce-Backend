const Product = require('../../src/classes/Product');

// unit tests for the Product domain class, focused on the deterministic
// stock reduction algorithm required by the assessment.
describe('Product class - stock reduction', () => {
  function makeProduct(stock) {
    return new Product({ id: 1, name: 'Test', sku: 'SKU-1', description: '', price: 10, stock, status: 'active' });
  }

  it('reduces stock correctly when there is enough', () => {
    const product = makeProduct(10);
    const newStock = product.computeStockAfterReduction(4);
    expect(newStock).toBe(6);
  });

  it('throws a conflict error when stock is insufficient', () => {
    const product = makeProduct(2);
    expect(() => product.computeStockAfterReduction(5)).toThrow(/Insufficient stock/);
  });

  it('throws on a zero or negative quantity', () => {
    const product = makeProduct(10);
    expect(() => product.computeStockAfterReduction(0)).toThrow(/positive integer/);
    expect(() => product.computeStockAfterReduction(-3)).toThrow(/positive integer/);
  });

  it('is deterministic, same input always gives the same output', () => {
    const productA = makeProduct(10);
    const productB = makeProduct(10);
    expect(productA.computeStockAfterReduction(3)).toBe(productB.computeStockAfterReduction(3));
  });

  it('hasEnoughStock reflects the current stock level', () => {
    const product = makeProduct(5);
    expect(product.hasEnoughStock(5)).toBe(true);
    expect(product.hasEnoughStock(6)).toBe(false);
  });

  it('isActive reflects the status field', () => {
    const active = new Product({ id: 1, sku: 'A', price: 1, stock: 1, status: 'active' });
    const inactive = new Product({ id: 2, sku: 'B', price: 1, stock: 1, status: 'inactive' });
    expect(active.isActive()).toBe(true);
    expect(inactive.isActive()).toBe(false);
  });
});
