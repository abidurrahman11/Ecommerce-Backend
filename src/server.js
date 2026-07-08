require('dotenv').config();

const app = require('./app');
const logger = require('./utils/logger');
const { sequelize } = require('../models');
const { getRedisClient } = require('./utils/redisClient');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // authenticate the database connection.
    await sequelize.authenticate();
    logger.info('PostgreSQL connection established');

    // Establish Redis connection eagerly so failures surface at boot, not on first request.
    getRedisClient();

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

// handle unhandled rejection.
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

// handle uncaught exception.
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

// start the server.
start();