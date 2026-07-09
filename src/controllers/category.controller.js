const categoryService = require('../services/categoryService');
const { sendSuccess } = require('../utils/apiResponse');

// admin: create a category.
async function create(req, res) {
  const category = await categoryService.createCategory(req.body);
  return sendSuccess(res, { statusCode: 201, data: category, message: 'Category created' });
}

// admin: update a category.
async function update(req, res) {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  return sendSuccess(res, { data: category, message: 'Category updated' });
}

// admin: delete a category.
async function remove(req, res) {
  await categoryService.deleteCategory(req.params.id);
  return sendSuccess(res, { message: 'Category deleted' });
}

// public: flat list of all categories.
async function list(req, res) {
  const categories = await categoryService.listCategories();
  return sendSuccess(res, { data: categories });
}

// public: nested category tree (cached, built with dfs on a cache miss).
async function tree(req, res) {
  const categoryTree = await categoryService.getCategoryTree();
  return sendSuccess(res, { data: categoryTree });
}

module.exports = { create, update, remove, list, tree };
