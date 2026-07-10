const {
  sequelize,
  Order: OrderModel,
  OrderItem: OrderItemModel,
  Product: ProductModel
} = require('../../models');
const Order = require('../classes/Order');
const Product = require('../classes/Product');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../utils/AppError');

// creates an order for a user from a list of { product_id, quantity }.
// checks that every product exists, is active, and has enough stock, but
// does NOT reduce stock here, stock is only reduced once payment succeeds
// (step 5), per the order flow in the assessment. everything runs in one
// transaction so a partially created order never gets left behind.
async function createOrder(userId, items) {
  return sequelize.transaction(async (transaction) => {
    const orderItemsData = [];

    for (const { product_id, quantity } of items) {
      const row = await ProductModel.findByPk(product_id, { transaction });
      if (!row) {
        throw new NotFoundError(`Product ${product_id} not found`);
      }

      const product = new Product(row);
      if (!product.isActive()) {
        throw new BadRequestError(`Product "${product.name}" is not available`);
      }
      if (!product.hasEnoughStock(quantity)) {
        throw new ConflictError(`Insufficient stock for product "${product.sku}"`);
      }

      // snapshot the price now, so it stays correct even if the product's
      // price changes later.
      const subtotal = Order.computeItemSubtotal(product.price, quantity);
      orderItemsData.push({ product_id: product.id, quantity, price: product.price, subtotal });
    }

    const totalAmount = Order.computeTotal(orderItemsData);

    const orderRow = await OrderModel.create(
      { user_id: userId, total_amount: totalAmount, status: 'pending' },
      { transaction }
    );

    const itemsWithOrderId = orderItemsData.map((item) => ({ ...item, order_id: orderRow.id }));
    await OrderItemModel.bulkCreate(itemsWithOrderId, { transaction });

    return new Order(orderRow, itemsWithOrderId).toJSON();
  });
}

// fetches a single order with its items, only if it belongs to the requesting user.
async function getOrderById(orderId, userId) {
  const orderRow = await OrderModel.findByPk(orderId, {
    include: [{ model: OrderItemModel, as: 'items' }]
  });

  if (!orderRow) {
    throw new NotFoundError('Order not found');
  }

  const order = new Order(orderRow, orderRow.items);
  if (!order.belongsToUser(userId)) {
    throw new ForbiddenError('You do not have access to this order');
  }

  return order.toJSON();
}

// lists a user's own orders, paginated, most recent first.
async function listOrdersForUser(userId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const { rows, count } = await OrderModel.findAndCountAll({
    where: { user_id: userId },
    include: [{ model: OrderItemModel, as: 'items' }],
    limit,
    offset,
    order: [['id', 'DESC']]
  });

  return {
    orders: rows.map((row) => new Order(row, row.items).toJSON()),
    pagination: { page: Number(page), limit: Number(limit), total: count, totalPages: Math.ceil(count / limit) }
  };
}

// moves an order to a new status. used by the payment flow (step 5) to mark
// an order paid or canceled once the provider confirms/fails the payment.
async function updateOrderStatus(orderId, status, transaction) {
  const orderRow = await OrderModel.findByPk(orderId, { transaction });
  if (!orderRow) {
    throw new NotFoundError('Order not found');
  }

  orderRow.status = status;
  await orderRow.save({ transaction });
  return orderRow;
}

module.exports = { createOrder, getOrderById, listOrdersForUser, updateOrderStatus };
