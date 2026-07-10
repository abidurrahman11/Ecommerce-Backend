const PaymentStrategy = require('../../src/strategies/PaymentStrategy');
const PaymentContext = require('../../src/strategies/PaymentContext');
const StripeStrategy = require('../../src/strategies/StripeStrategy');
const BkashStrategy = require('../../src/strategies/BkashStrategy');
const paymentService = require('../../src/services/paymentService');

// unit tests for the strategy pattern itself, no
// network calls happen here, just checking the wiring and the interface.
describe('Payment strategy pattern', () => {
  it('the base strategy throws if used directly, subclasses must implement it', async () => {
    const base = new PaymentStrategy();
    await expect(base.initiate({})).rejects.toThrow(/must be implemented/);
    await expect(base.verifyAndComplete('x')).rejects.toThrow(/must be implemented/);
  });

  it('PaymentContext delegates initiate/verifyAndComplete to whatever strategy it holds', async () => {
    const fakeStrategy = {
      initiate: jest.fn().mockResolvedValue({ transaction_id: 'fake-1' }),
      verifyAndComplete: jest.fn().mockResolvedValue({ providerStatus: 'success' })
    };

    const context = new PaymentContext(fakeStrategy);
    const order = { id: 1, total_amount: 10 };

    const initiated = await context.initiate(order);
    expect(fakeStrategy.initiate).toHaveBeenCalledWith(order);
    expect(initiated.transaction_id).toBe('fake-1');

    const completed = await context.verifyAndComplete('fake-1');
    expect(fakeStrategy.verifyAndComplete).toHaveBeenCalledWith('fake-1');
    expect(completed.providerStatus).toBe('success');
  });

  it('swapping the strategy changes behavior without touching the context', async () => {
    const strategyA = { initiate: jest.fn().mockResolvedValue({ transaction_id: 'a' }) };
    const strategyB = { initiate: jest.fn().mockResolvedValue({ transaction_id: 'b' }) };

    const context = new PaymentContext(strategyA);
    expect((await context.initiate({})).transaction_id).toBe('a');

    context.setStrategy(strategyB);
    expect((await context.initiate({})).transaction_id).toBe('b');
  });

  describe('paymentService.getStrategy (the factory)', () => {
    it('returns a StripeStrategy for "stripe"', () => {
      expect(paymentService.getStrategy('stripe')).toBeInstanceOf(StripeStrategy);
    });

    it('returns a BkashStrategy for "bkash"', () => {
      expect(paymentService.getStrategy('bkash')).toBeInstanceOf(BkashStrategy);
    });

    it('rejects an unsupported provider without touching any strategy class', () => {
      expect(() => paymentService.getStrategy('paypal')).toThrow(/Unsupported payment provider/);
    });
  });
});
