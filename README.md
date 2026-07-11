# E-commerce Ordering & Payment System

Backend for user management, a product catalog with a category hierarchy, order management, and multi-provider payments (Stripe, bKash).

## Stack

Node.js · Express 5 · PostgreSQL (Sequelize) · Redis · JWT · Joi · Winston · Jest/Supertest

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your own values, see below

# create the databases
createdb ecommerce_db
createdb ecommerce_db_test

# run migrations
npm run migrate
npm run migrate:test

# seed an admin user + sample categories/products (dev db only)
npm run seed

npm run dev
```

Verify it's up:
```bash
curl http://localhost:3000/health
# { "success": true, "data": { "status": "ok", "checks": { "db": "up", "redis": "up" } } }
```

Seeded admin login: `admin@ecommerce.test` / `Admin@12345`

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with nodemon (auto-restart) |
| `npm start` | Start normally |
| `npm test` | Run the full Jest suite (unit + API) against the test database |
| `npm run migrate` / `migrate:test` | Run migrations against dev / test db |
| `npm run migrate:undo` | Roll back the last migration |
| `npm run seed` | Run seeders (admin user + sample catalog) |
| `npm run lint` | ESLint over `src/` |

## Environment variables

See [`.env.example`](.env.example) for the full list. Notably:
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — from the [Stripe dashboard](https://dashboard.stripe.com) (test mode) / [Stripe CLI](https://stripe.com/docs/stripe-cli) for local webhook forwarding
- `BKASH_*` — issued after bKash sandbox merchant approval via [developer.bka.sh](https://developer.bka.sh)
- `REDIS_URL` — used for the category-tree DFS cache and the bKash token cache

## Architecture at a glance

Strict layering: **routes → controllers → services → models**, with dedicated OOP domain classes (`User`, `Product`, `Order`, `Payment`) and a strategy pattern for payment providers. Full rationale in [`docs/architecture.md`](docs/architecture.md).

```
src/
  classes/       User, Product, Order, Payment (OOP domain logic)
  strategies/    PaymentStrategy, StripeStrategy, BkashStrategy, PaymentContext
  controllers/   thin HTTP <-> service glue
  services/      business logic, transactions
  middlewares/   auth, validation, central error handler
  routes/        route wiring only
  utils/         logger, jwt, redis client, category DFS + cache, validators
models/          Sequelize models
migrations/      Sequelize migrations
seeders/         admin user + sample catalog
tests/           unit/ + api/
docs/            architecture, ERD, payment flows, OpenAPI spec, Postman collection
```

## API documentation

- **OpenAPI 3.0 spec**: [`docs/openapi.json`](docs/openapi.json) — import into [Swagger Editor](https://editor.swagger.io), Postman, or Insomnia. If `swagger-ui-express` is installed (`npm install swagger-ui-express`), it's also served live and interactively at **`/api-docs`** when the server is running.
- **Postman collection**: [`docs/postman_collection.json`](docs/postman_collection.json) — import it, set the `base_url` variable, run *Auth → Login* first to auto-populate the `token`/`admin_token` variables, then everything else just works.

## Diagrams

- [System architecture](docs/architecture.md)
- [Entity Relationship Diagram](docs/erd.md)
- [Stripe payment flow](docs/payment-flow-stripe.md)
- [bKash payment flow](docs/payment-flow-bkash.md)

(All diagrams are Mermaid, rendered natively by GitHub/GitLab. Paste any block into [mermaid.live](https://mermaid.live) if you need a PNG/SVG export.)

## Testing

```bash
npm test
```

Covers: password hashing, deterministic order-total/stock-reduction algorithms, DFS category traversal, the full auth/category/product/order/payment API surface, and payment-specific edge cases (webhook redelivery idempotency, duplicate `transaction_id` handling, and a stock-race-condition rollback test). Stripe/bKash calls are mocked in tests — no live credentials required to run the suite.

## Deployment

Docker setup covered separately — not required to run the app locally as shown above.