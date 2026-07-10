// base strategy every payment provider must implement. this is the whole
// point of the strategy pattern here: order/checkout code only ever talks
// to this interface, never to stripe or bkash directly, so adding a new
// provider later means writing one new subclass, not touching order logic.
class PaymentStrategy {
  // starts a payment with the provider for the given order.
  // should return { transaction_id, raw_response, ...providerSpecificExtras }
  async initiate(order) {
    throw new Error('initiate() must be implemented by a payment strategy subclass');
  }

  // re-checks the payment's real status with the provider (never trust a
  // client-supplied status) and returns { transaction_id, providerStatus, raw_response }
  // providerStatus must be one of 'pending' | 'success' | 'failed'.
  async verifyAndComplete(reference) {
    throw new Error('verifyAndComplete() must be implemented by a payment strategy subclass');
  }
}

module.exports = PaymentStrategy;
