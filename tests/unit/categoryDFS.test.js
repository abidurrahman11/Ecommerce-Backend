const { buildForestFromRows, findNodeById, collectDescendantIds } = require('../../src/utils/categoryDFS');

// unit tests for the dfs helpers, pure functions so no db or redis involved.
describe('categoryDFS', () => {
  // a small tree used across the tests below:
  // Electronics
  //   Mobile Phones
  //     Android
  //     iOS
  //   Laptops
  // Fashion
  const rows = [
    { id: 1, name: 'Electronics', parent_id: null },
    { id: 2, name: 'Mobile Phones', parent_id: 1 },
    { id: 3, name: 'Laptops', parent_id: 1 },
    { id: 4, name: 'Android', parent_id: 2 },
    { id: 5, name: 'iOS', parent_id: 2 },
    { id: 6, name: 'Fashion', parent_id: null }
  ];

  it('builds a forest with correct roots and nesting', () => {
    const forest = buildForestFromRows(rows);

    // two root categories: Electronics and Fashion.
    expect(forest).toHaveLength(2);
    expect(forest.map((n) => n.name)).toEqual(['Electronics', 'Fashion']);

    const electronics = forest.find((n) => n.id === 1);
    expect(electronics.children).toHaveLength(2);

    const mobilePhones = electronics.children.find((n) => n.id === 2);
    expect(mobilePhones.children.map((n) => n.name)).toEqual(['Android', 'iOS']);
  });

  it('finds a node anywhere in the forest via dfs', () => {
    const forest = buildForestFromRows(rows);

    const found = findNodeById(forest, 5); // iOS, nested two levels deep
    expect(found).not.toBeNull();
    expect(found.name).toBe('iOS');

    const missing = findNodeById(forest, 999);
    expect(missing).toBeNull();
  });

  it('collects all descendant ids (dfs) including the node itself', () => {
    const forest = buildForestFromRows(rows);
    const mobilePhones = findNodeById(forest, 2);

    const ids = collectDescendantIds(mobilePhones);

    // Mobile Phones itself + Android + iOS, order doesn't matter here.
    expect(ids.sort()).toEqual([2, 4, 5]);
  });

  it('a leaf node only collects itself', () => {
    const forest = buildForestFromRows(rows);
    const laptops = findNodeById(forest, 3);

    expect(collectDescendantIds(laptops)).toEqual([3]);
  });

  it('treats a category with a missing parent as a root instead of dropping it', () => {
    const orphanRows = [...rows, { id: 7, name: 'Orphan', parent_id: 999 }];
    const forest = buildForestFromRows(orphanRows);

    expect(forest.find((n) => n.id === 7)).toBeDefined();
  });
});
