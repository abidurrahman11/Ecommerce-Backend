const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const logger = require('./utils/logger');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const healthRoutes = require('./routes/health.routes');

const app = express();
// use helmet to secure the app.
app.use(helmet());
// use cors to allow the app to be accessed from other domains.
app.use(cors());
// use morgan to log the requests.
// morgan is a middleware that logs the requests to the console.
const morganStream = { write: (msg) => logger.info(msg.trim()) };
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream: morganStream }));

// stripe webhook needs the raw request body to verify its signature, so this
// router is mounted here, before express.json() runs, on purpose.
app.use('/api/payments', require('./routes/paymentWebhook.routes'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/health', healthRoutes);

// Feature routes will be mounted here as they're built, example:
// use auth routes for register, login and getting the logged in user.
app.use('/api/auth', require('./routes/auth.routes'));
// public category routes (list + tree) and admin category CRUD, same router handles both, guarded per route.
app.use('/api/categories', require('./routes/category.routes'));
// public product routes (list, detail, related products).
app.use('/api/products', require('./routes/product.routes'));
// admin only product CRUD, kept on a separate path so admin vs public concerns don't mix.
app.use('/api/admin/products', require('./routes/admin.product.routes'));
// orders always belong to a logged in user, create + view own orders.
app.use('/api/orders', require('./routes/order.routes'));
// authenticated payment routes (initiate/confirm/execute/query), mounted
// after express.json() since these are normal parsed-json endpoints, unlike
// the webhook router mounted above.
app.use('/api/payments', require('./routes/payment.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
