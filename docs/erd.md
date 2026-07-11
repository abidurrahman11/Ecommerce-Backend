# Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ ORDERS : places
    CATEGORIES ||--o{ CATEGORIES : "parent of"
    CATEGORIES ||--o{ PRODUCTS : contains
    PRODUCTS ||--o{ ORDER_ITEMS : "ordered as"
    ORDERS ||--o{ ORDER_ITEMS : contains
    ORDERS ||--o{ PAYMENTS : "paid via"

    USERS {
        int id PK
        string name
        string email UK "unique, indexed"
        string password "bcrypt hash"
        enum role "user | admin"
    }

    CATEGORIES {
        int id PK
        string name
        int parent_id FK "self-referential, nullable, indexed"
    }

    PRODUCTS {
        int id PK
        string name
        string sku UK "unique"
        text description
        decimal price
        int stock
        enum status "active | inactive, indexed"
        int category_id FK "nullable, indexed"
    }

    ORDERS {
        int id PK
        int user_id FK "indexed"
        decimal total_amount
        enum status "pending | paid | canceled, indexed"
    }

    ORDER_ITEMS {
        int id PK
        int order_id FK "indexed"
        int product_id FK "indexed"
        int quantity
        decimal price "snapshotted at order time"
        decimal subtotal "quantity * price, computed deterministically"
    }

    PAYMENTS {
        int id PK
        int order_id FK "indexed"
        string provider "stripe | bkash, string not enum for extensibility"
        string transaction_id UK "unique, nullable until provider responds"
        enum status "pending | success | failed"
        jsonb raw_response "full provider payload, audit only, never returned to client"
    }
```

## Notes on deliberate design choices

- **`Categories.parent_id` is self-referential** with `ON DELETE CASCADE` — deleting a parent category removes its entire subtree. This is what the DFS traversal (assessment 2.2.5) walks.
- **`Products.category_id`** uses `ON DELETE SET NULL` — deleting a category never deletes products, it just uncategorizes them.
- **`OrderItems.product_id`** uses `ON DELETE RESTRICT` — a product referenced by any existing order can no longer be deleted outright (enforced at the DB level, surfaced as a clean `409` at the service layer).
- **`Payments.provider` is a plain string, not a Postgres enum.** Adding a new payment provider later (e.g. `paddle`, `paypal`) only requires a new strategy class + one line in the factory, never an `ALTER TYPE` migration.
- **`OrderItems.price` is a snapshot**, not a live reference to `Products.price` — so a later price change never retroactively alters historical orders.
