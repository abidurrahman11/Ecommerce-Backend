'use strict';

module.exports = {
  async up(queryInterface) {
    // insert root categories first, { returning: true } (postgres only) gives
    // us the generated ids back so we can use them as parent_id below.
    const [electronics, fashion] = await queryInterface.bulkInsert(
      'Categories',
      [
        { name: 'Electronics', parent_id: null, createdAt: new Date(), updatedAt: new Date() },
        { name: 'Fashion', parent_id: null, createdAt: new Date(), updatedAt: new Date() }
      ],
      { returning: true }
    );

    const [mobilePhones, laptops] = await queryInterface.bulkInsert(
      'Categories',
      [
        { name: 'Mobile Phones', parent_id: electronics.id, createdAt: new Date(), updatedAt: new Date() },
        { name: 'Laptops', parent_id: electronics.id, createdAt: new Date(), updatedAt: new Date() }
      ],
      { returning: true }
    );

    const [men, women] = await queryInterface.bulkInsert(
      'Categories',
      [
        { name: 'Men', parent_id: fashion.id, createdAt: new Date(), updatedAt: new Date() },
        { name: 'Women', parent_id: fashion.id, createdAt: new Date(), updatedAt: new Date() }
      ],
      { returning: true }
    );

    await queryInterface.bulkInsert('Products', [
      {
        name: 'Galaxy S24',
        sku: 'MOB-GAL-S24',
        description: 'A flagship smartphone.',
        price: 899.99,
        stock: 25,
        status: 'active',
        category_id: mobilePhones.id,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'iPhone 16',
        sku: 'MOB-IPH-16',
        description: 'The latest iPhone.',
        price: 999.0,
        stock: 15,
        status: 'active',
        category_id: mobilePhones.id,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'MacBook Air M4',
        sku: 'LAP-MBA-M4',
        description: 'Thin and light laptop.',
        price: 1199.0,
        stock: 10,
        status: 'active',
        category_id: laptops.id,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Men's Denim Jacket",
        sku: 'MEN-JCK-001',
        description: 'Classic denim jacket.',
        price: 59.99,
        stock: 40,
        status: 'active',
        category_id: men.id,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Women's Summer Dress",
        sku: 'WMN-DRS-001',
        description: 'Light summer dress.',
        price: 45.5,
        stock: 30,
        status: 'active',
        category_id: women.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(queryInterface) {
    // delete products first since they reference categories.
    await queryInterface.bulkDelete('Products', null, {});
    await queryInterface.bulkDelete('Categories', null, {});
  }
};
