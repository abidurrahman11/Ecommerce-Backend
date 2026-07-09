const { Product: ProductModel, Category: CategoryModel, sequelize } = require('../../models');
const { Op } = require('sequelize');
const Product = require('../classes/Product');
const { NotFoundError, ConflictError } = require('../utils/AppError');
const { getCategoryForest, findNodeById, collectDescendantIds } = require('../utils/categoryDFS');

// admin creates a product. sku uniqueness is also enforced at the db level,
// this check just gives a cleaner error message instead of a raw db error.
async function createProduct(data) {
  const existing = await ProductModel.findOne({ where: { sku: data.sku } });
  if (existing) {
    throw new ConflictError(`SKU "${data.sku}" is already in use`);
  }

  return ProductModel.create(data);
}

async function updateProduct(id, data) {
  const product = await ProductModel.findByPk(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (data.sku && data.sku !== product.sku) {
    const existing = await ProductModel.findOne({ where: { sku: data.sku } });
    if (existing) {
      throw new ConflictError(`SKU "${data.sku}" is already in use`);
    }
  }

  await product.update(data);
  return product;
}

async function deleteProduct(id) {
  const product = await ProductModel.findByPk(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }
  await product.destroy();
}

async function getProductById(id) {
  const product = await ProductModel.findByPk(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }
  return product;
}

// public product listing with basic filtering + pagination.
// onlyActive is true for the public route, admins can see everything.
async function listProducts({ page = 1, limit = 20, category_id, status, onlyActive = false } = {}) {
  const where = {};
  if (category_id) where.category_id = category_id;
  if (status) where.status = status;
  if (onlyActive) where.status = 'active';

  const offset = (page - 1) * limit;

  const { rows, count } = await ProductModel.findAndCountAll({
    where,
    limit,
    offset,
    order: [['id', 'DESC']]
  });

  return {
    products: rows,
    pagination: { page: Number(page), limit: Number(limit), total: count, totalPages: Math.ceil(count / limit) }
  };
}

// recommends related products using dfs over the cached category tree:
// find this product's category node, collect every descendant category id
// (dfs), then return other active products that live in any of those categories.
async function getRelatedProducts(productId, limit = 6) {
  const product = await getProductById(productId);

  if (!product.category_id) {
    return [];
  }

  const forest = await getCategoryForest(CategoryModel);
  const node = findNodeById(forest, product.category_id);

  // category might have been deleted after the product was tagged, if so
  // there's nothing to traverse.
  if (!node) {
    return [];
  }

  const categoryIds = collectDescendantIds(node);

  const related = await ProductModel.findAll({
    where: {
      category_id: categoryIds,
      status: 'active',
      id: { [Op.ne]: productId }
    },
    limit,
    order: [['id', 'DESC']]
  });

  return related;
}

// safely reduces stock for a product inside an existing transaction. locks
// the row (SELECT ... FOR UPDATE) so two concurrent payments can never both
// succeed against the same stale stock count.
async function reduceStock(productId, quantity, transaction) {
  const row = await ProductModel.findByPk(productId, {
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  if (!row) {
    throw new NotFoundError('Product not found');
  }

  const product = new Product(row);
  // throws ConflictError if there isn't enough stock, deterministic either way.
  const newStock = product.computeStockAfterReduction(quantity);

  await row.update({ stock: newStock }, { transaction });
  return newStock;
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  listProducts,
  getRelatedProducts,
  reduceStock,
  // exposed so the order/payment flow (step 5) can run everything in one transaction.
  sequelize
};
