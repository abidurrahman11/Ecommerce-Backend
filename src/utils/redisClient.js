const Redis = require('ioredis');
const logger = require('./logger');

let client = null;

// lazily create a single shared ioredis client for the whole app.
// import and call getRedisClient() wherever caching is needed (category tree DFS caching) instead of creating new connections.

function getRedisClient() {
  if (client) return client;

  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.error(`Redis error: ${err.message}`));

  return client;
}

module.exports = { getRedisClient };
