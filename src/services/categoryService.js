const { Category: CategoryModel } = require('../../models');
const { NotFoundError, BadRequestError } = require('../utils/AppError');
const { getCategoryForest, invalidateCategoryCache } = require('../utils/categoryDFS');

// creates a category. if parent_id is given, make sure that parent actually exists.
async function createCategory({ name, parent_id }) {
  if (parent_id) {
    const parent = await CategoryModel.findByPk(parent_id);
    if (!parent) {
      throw new BadRequestError('parent_id does not reference an existing category');
    }
  }

  const category = await CategoryModel.create({ name, parent_id: parent_id || null });

  // the cached tree is now stale, clear it so the next read rebuilds it.
  await invalidateCategoryCache();

  return category;
}

async function updateCategory(id, { name, parent_id }) {
  const category = await CategoryModel.findByPk(id);
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  // a category can't be its own parent, that would create a cycle.
  if (parent_id && Number(parent_id) === Number(id)) {
    throw new BadRequestError('A category cannot be its own parent');
  }

  if (name !== undefined) category.name = name;
  if (parent_id !== undefined) category.parent_id = parent_id;
  await category.save();

  await invalidateCategoryCache();

  return category;
}

async function deleteCategory(id) {
  const category = await CategoryModel.findByPk(id);
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  // child categories are removed automatically (onDelete: CASCADE in the migration).
  await category.destroy();

  await invalidateCategoryCache();
}

// flat list, useful for admin dropdowns etc.
async function listCategories() {
  return CategoryModel.findAll({ order: [['id', 'ASC']] });
}

// nested tree (forest), backed by the redis cache.
async function getCategoryTree() {
  return getCategoryForest(CategoryModel);
}

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  listCategories,
  getCategoryTree
};
