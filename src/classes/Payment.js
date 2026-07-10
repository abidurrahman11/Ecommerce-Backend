// domain class for Payment. wraps a raw sequelize row and owns the small
// bits of behavior around payment state, the actual provider communication
// (talking to stripe/bkash) lives in the strategy classes, not here.
class Payment {
  constructor(paymentRow) {
    this.id = paymentRow.id;
    this.order_id = paymentRow.order_id;
    this.provider = paymentRow.provider;
    this.transaction_id = paymentRow.transaction_id;
    this.status = paymentRow.status;
    this.raw_response = paymentRow.raw_response;
  }

  isPending() {
    return this.status === 'pending';
  }

  isSuccess() {
    return this.status === 'success';
  }

  isFailed() {
    return this.status === 'failed';
  }

  // raw_response can hold a large/internal provider payload, keep it out of
  // the default shape returned to the client.
  toJSON() {
    return {
      id: this.id,
      order_id: this.order_id,
      provider: this.provider,
      transaction_id: this.transaction_id,
      status: this.status
    };
  }
}

module.exports = Payment;