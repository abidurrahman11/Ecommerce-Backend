const orderService = require('../services/orderService');
const { sendSuccess } = require('../utils/apiResponse');

// create an order from the logged in user's selected products.
async function create(req, res) {
  const order = await orderService.createOrder(req.user.id, req.body.items);
  return sendSuccess(res, { statusCode: 201, data: order, message: 'Order created' });
}

// list the logged in user's own orders.
async function list(req, res) {
  const result = await orderService.listOrdersForUser(req.user.id, req.validatedQuery);
  return sendSuccess(res, { data: result });
}

// get a single order, only if it belongs to the logged in user.
async function detail(req, res) {
  const order = await orderService.getOrderById(req.params.id, req.user.id);
  return sendSuccess(res, { data: order });
}

module.exports = { create, list, detail };
