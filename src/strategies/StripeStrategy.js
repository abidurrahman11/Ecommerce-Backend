const Stripe = require('stripe');
const PaymentStrategy = require('./PaymentStrategy');

// the stripe client is created lazily (on first actual use), not at module
// load time. creating it eagerly at the top of the file would run the
// moment anything requires this module (including jest auto-mocking it),
// which can happen before dotenv has loaded STRIPE_SECRET_KEY into
// process.env, causing a confusing "no apiKey provided" crash.
let stripeClient = null;
function getStripeClient() {
  if (!stripeClient) {
    stripeClient = Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// maps stripe's many payment intent statuses down to our 3 internal ones.
function mapStripeStatus(stripeStatus) {
  if (stripeStatus === 'succeeded') return 'success';
  if (['processing', 'requires_payment_method', 'requires_confirmation', 'requires_action', 'requires_capture'].includes(stripeStatus)) {
    return 'pending';
  }
  return 'failed'; // canceled, or anything unexpected
}

class StripeStrategy extends PaymentStrategy {
  // creates a payment intent for the order's total amount. the frontend
  // uses the returned client_secret to actually collect card details and
  // confirm the payment with stripe.js, we never touch card data here.
  async initiate(order) {
    // stripe expects the amount in the smallest currency unit (cents).
    const amountInCents = Math.round(order.total_amount * 100);

    const intent = await getStripeClient().paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: { order_id: String(order.id) }
    });

    return {
      transaction_id: intent.id,
      raw_response: intent,
      client_secret: intent.client_secret
    };
  }

  // re-fetches the payment intent from stripe itself, never trust a status
  // the client claims, always ask the provider directly.
  async verifyAndComplete(paymentIntentId) {
    const intent = await getStripeClient().paymentIntents.retrieve(paymentIntentId);

    return {
      transaction_id: intent.id,
      providerStatus: mapStripeStatus(intent.status),
      raw_response: intent
    };
  }

  // verifies the webhook signature and parses the event, throws if the
  // signature doesn't check out (the controller turns that into a 400).
  parseWebhookEvent(rawBody, signature) {
    return getStripeClient().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  }
}

module.exports = StripeStrategy;
