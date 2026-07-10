const axios = require('axios');
const { getRedisClient } = require('../../utils/redisClient');
const logger = require('../../utils/logger');

const TOKEN_CACHE_KEY = 'bkash:id_token';

function baseHeaders(token) {
  return {
    Authorization: token,
    'X-App-Key': process.env.BKASH_APP_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

// gets a valid bkash id_token, cached in redis so we don't grant a brand new
// token on every single request, only once it's close to actually expiring.
async function grantToken() {
  const redis = getRedisClient();

  try {
    const cached = await redis.get(TOKEN_CACHE_KEY);
    if (cached) return cached;
  } catch (err) {
    logger.warn(`bKash token cache read failed, requesting a fresh token: ${err.message}`);
  }

  const res = await axios.post(
    `${process.env.BKASH_BASE_URL}/tokenized/checkout/token/grant`,
    {
      app_key: process.env.BKASH_APP_KEY,
      app_secret: process.env.BKASH_APP_SECRET
    },
    {
      headers: {
        username: process.env.BKASH_USERNAME,
        password: process.env.BKASH_PASSWORD,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    }
  );

  const { id_token: idToken, expires_in: expiresIn } = res.data;

  try {
    // cache it for a bit less than its real lifetime, so we never hand out
    // a token that's about to expire mid-request.
    const ttl = Math.max((expiresIn || 3600) - 60, 60);
    await redis.set(TOKEN_CACHE_KEY, idToken, 'EX', ttl);
  } catch (err) {
    logger.warn(`bKash token cache write failed: ${err.message}`);
  }

  return idToken;
}

// starts a bkash checkout, returns { paymentID, bkashURL, ... }
async function createPayment({ amount, orderId }) {
  const token = await grantToken();

  const res = await axios.post(
    `${process.env.BKASH_BASE_URL}/tokenized/checkout/create`,
    {
      amount: String(amount),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: `ORDER-${orderId}-${Date.now()}`
    },
    { headers: baseHeaders(token) }
  );

  return res.data;
}

// finalizes a payment the user already approved on bkash's page.
// returns { transactionStatus, trxID, ... }
async function executePayment(paymentID) {
  const token = await grantToken();

  const res = await axios.post(
    `${process.env.BKASH_BASE_URL}/tokenized/checkout/execute`,
    { paymentID },
    { headers: baseHeaders(token) }
  );

  return res.data;
}

// checks the current status of a payment without changing it.
async function queryPayment(paymentID) {
  const token = await grantToken();

  const res = await axios.post(
    `${process.env.BKASH_BASE_URL}/tokenized/checkout/payment/status`,
    { paymentID },
    { headers: baseHeaders(token) }
  );

  return res.data;
}

module.exports = { grantToken, createPayment, executePayment, queryPayment };
