const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { sequelize } = require('../../models');
const { getRedisClient } = require('../utils/redisClient');

const router = express.Router();

// GET /health
// checks if the process is up AND that DB + Redis are reachable.

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const checks = { db: 'down', redis: 'down' };
    // check if the database is reachable.
    try {
      await sequelize.authenticate();
      checks.db = 'up';
    } catch (_) {
      checks.db = 'down';
    }
    // check if the redis is reachable.
    try {
      const redis = getRedisClient();
      const pong = await redis.ping();
      checks.redis = pong === 'PONG' ? 'up' : 'down';
    } catch (_) {
      checks.redis = 'down';
    }

    const healthy = checks.db === 'up' && checks.redis === 'up';
    // send the response.
    return sendSuccess(res, {
      statusCode: healthy ? 200 : 503,
      data: { status: healthy ? 'ok' : 'degraded', checks }
    });
  })
);

module.exports = router;
