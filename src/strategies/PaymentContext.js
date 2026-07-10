// the context in the strategy pattern. holds a reference to whichever
// strategy it was given and just delegates to it, this is the only thing
// the payment service talks to, it never imports StripeStrategy or BkashStrategy directly for the actual payment flow.
class PaymentContext {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  async initiate(order) {
    return this.strategy.initiate(order);
  }

  async verifyAndComplete(reference) {
    return this.strategy.verifyAndComplete(reference);
  }
}

module.exports = PaymentContext;
