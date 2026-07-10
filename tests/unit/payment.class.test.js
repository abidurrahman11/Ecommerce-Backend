const Payment = require('../../src/classes/Payment');

// unit tests for the Payment domain class.
describe('Payment class', () => {
  function makePayment(status) {
    return new Payment({
      id: 1,
      order_id: 10,
      provider: 'stripe',
      transaction_id: 'pi_123',
      status,
      raw_response: { secret: 'should-not-leak', id: 'pi_123' }
    });
  }

  it('status helpers reflect the current status', () => {
    expect(makePayment('pending').isPending()).toBe(true);
    expect(makePayment('success').isSuccess()).toBe(true);
    expect(makePayment('failed').isFailed()).toBe(true);
  });

  it('never leaks raw_response in the client-facing shape', () => {
    const json = makePayment('success').toJSON();
    expect(json.raw_response).toBeUndefined();
    expect(json).toEqual({
      id: 1,
      order_id: 10,
      provider: 'stripe',
      transaction_id: 'pi_123',
      status: 'success'
    });
  });
});
