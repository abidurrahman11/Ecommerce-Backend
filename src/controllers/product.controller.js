const productService = require('../services/productService');
const { sendSuccess } = require('../utils/apiResponse');

// admin: create a product.
async function create(req, res) {
  const product = await productService.createProduct(req.body);
  return sendSuccess(res, { statusCode: 201, data: product, message: 'Product created' });
}

// admin: update a product.
async function update(req, res) {
  const product = await productService.updateProduct(req.params.id, req.body);
  return sendSuccess(res, { data: product, message: 'Product updated' });
}

// admin: delete a product.
async function remove(req, res) {
  await productService.deleteProduct(req.params.id);
  return sendSuccess(res, { message: 'Product deleted' });
}

// public: list products with filters + pagination. only active products
// are shown here, admins use the same list under /api/admin/products to see everything.
async function list(req, res) {
  const result = await productService.listProducts({ ...req.validatedQuery, onlyActive: true });
  return sendSuccess(res, { data: result });
}

// admin: list all products regardless of status.
async function adminList(req, res) {
  const result = await productService.listProducts(req.validatedQuery);
  return sendSuccess(res, { data: result });
}

// public: single product detail.
async function detail(req, res) {
  const product = await productService.getProductById(req.params.id);
  return sendSuccess(res, { data: product });
}

// public: related products, uses dfs over the cached category tree.
async function related(req, res) {
  const products = await productService.getRelatedProducts(req.params.id);
  return sendSuccess(res, { data: products });
}

module.exports = { create, update, remove, list, adminList, detail, related };
