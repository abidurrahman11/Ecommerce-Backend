const { getRedisClient } = require('./redisClient');
const logger = require('./logger');

// single cache key holding the whole category forest (all root categories
// with their children nested). simpler than caching per-subtree, and the
// whole table is small enough that this is cheap to rebuild when it expires.
const CACHE_KEY = 'categories:forest';
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

// builds the category tree (forest, since there can be multiple roots) out
// of a flat list of category rows using depth first traversal. this only
// runs on a cache miss.
function buildForestFromRows(rows) {
  // map every id to its own node first so children can be attached in any order.
  const nodesById = new Map();
  rows.forEach((row) => {
    nodesById.set(row.id, { id: row.id, name: row.name, parent_id: row.parent_id, children: [] });
  });

  const roots = [];

  nodesById.forEach((node) => {
    if (node.parent_id === null || node.parent_id === undefined) {
      roots.push(node);
    } else {
      const parent = nodesById.get(node.parent_id);
      // if the parent somehow doesn't exist, treat this node as a root
      // instead of silently dropping it.
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  });

  return roots;
}

// returns the cached forest if present, otherwise builds it from the db
// and caches it. this is the function everything else should call.
async function getCategoryForest(CategoryModel) {
  const redis = getRedisClient();

  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    // if redis is having a bad day, don't let that break category browsing,
    // just fall through and hit the db instead.
    logger.warn(`Category cache read failed, falling back to db: ${err.message}`);
  }

  const rows = await CategoryModel.findAll({ raw: true });
  const forest = buildForestFromRows(rows);

  try {
    await redis.set(CACHE_KEY, JSON.stringify(forest), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn(`Category cache write failed: ${err.message}`);
  }

  return forest;
}

// depth first search through the forest for a node with the given id.
// returns the node, or null if not found.
function findNodeById(forest, id) {
  // dfs using an explicit stack instead of recursion, so it doesn't matter how deep the tree gets.
  const stack = [...forest];

  while (stack.length > 0) {
    const node = stack.pop();
    if (node.id === id) {
      return node;
    }
    // push children so they get visited next (depth first, not breadth first).
    stack.push(...node.children);
  }

  return null;
}

// depth first collection of every id under (and including) the given node.
// used to find "all products in this category or any of its sub-categories".
function collectDescendantIds(node) {
  const ids = [];
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    ids.push(current.id);
    stack.push(...current.children);
  }

  return ids;
}

// call this whenever a category is created, updated or deleted, so the
// next read rebuilds the tree instead of serving a stale one.
async function invalidateCategoryCache() {
  const redis = getRedisClient();
  try {
    await redis.del(CACHE_KEY);
  } catch (err) {
    logger.warn(`Category cache invalidation failed: ${err.message}`);
  }
}

module.exports = {
  getCategoryForest,
  findNodeById,
  collectDescendantIds,
  invalidateCategoryCache,
  // exported for unit testing without hitting redis/db.
  buildForestFromRows
};
