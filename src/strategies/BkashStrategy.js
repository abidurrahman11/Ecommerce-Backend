const PaymentStrategy = require('./PaymentStrategy');
const bkashClient = require('../services/providers/bkashClient');

// maps bkash's transaction statuses down to our 3 internal ones.
function mapBkashStatus(transactionStatus) {
  if (transactionStatus === 'Completed') return 'success';
  if (transactionStatus === 'Initiated' || transactionStatus === 'Pending') return 'pending';
  return 'failed';
}

class BkashStrategy extends PaymentStrategy {
  // starts a bkash checkout for the order's total amount.
  async initiate(order) {
    const data = await bkashClient.createPayment({ amount: order.total_amount, orderId: order.id });

    return {
      transaction_id: data.paymentID,
      raw_response: data,
      // frontend redirects the user here to approve the payment on bkash's page.
      bkash_url: data.bkashURL
    };
  }

  // finalizes a payment the user already approved on bkash's page.
  async verifyAndComplete(paymentID) {
    const data = await bkashClient.executePayment(paymentID);

    return {
      transaction_id: data.paymentID || paymentID,
      providerStatus: mapBkashStatus(data.transactionStatus),
      raw_response: data
    };
  }

  // checks bkash's own record of a payment's status without changing anything,
  // used for the query endpoint and for re-verifying webhook callbacks.
  async query(paymentID) {
    const data = await bkashClient.queryPayment(paymentID);

    return {
      transaction_id: paymentID,
      providerStatus: mapBkashStatus(data.transactionStatus),
      raw_response: data
    };
  }
}

module.exports = BkashStrategy;