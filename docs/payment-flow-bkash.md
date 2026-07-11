# bKash Payment Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as Backend API
    participant Redis
    participant Bkash as bKash
    participant DB as PostgreSQL

    FE->>API: POST /api/orders { items }
    API->>DB: create Order (status: pending) + OrderItems
    API-->>FE: order + total_amount

    FE->>API: POST /api/payments/{orderId}/initiate { provider: "bkash" }
    API->>Redis: get cached id_token
    alt token missing / expired
        API->>Bkash: grant token (username/password + app_key/app_secret)
        Bkash-->>API: id_token, expires_in
        API->>Redis: cache id_token (TTL = expires_in - buffer)
    end
    API->>Bkash: create checkout (amount, merchantInvoiceNumber)
    Bkash-->>API: { paymentID, bkashURL }
    API->>DB: create Payment (status: pending, transaction_id = paymentID)
    API-->>FE: bkashURL

    FE->>User: redirect to bkashURL
    User->>Bkash: approve payment on bKash's page
    Bkash-->>FE: redirect back with paymentID

    FE->>API: POST /api/payments/bkash/execute { paymentID }
    API->>Bkash: execute payment
    Bkash-->>API: { transactionStatus }
    API->>DB: finalizePayment() — locked transaction:<br/>Payment → success, reduce stock, Order → paid

    opt bKash server-to-server callback
        Bkash-->>API: POST /api/payments/bkash/webhook { paymentID }
        Note over API,Bkash: the webhook payload's own status is never trusted directly
        API->>Bkash: query payment (re-fetch authoritative status)
        Bkash-->>API: { transactionStatus }
        API->>DB: finalizePayment() — idempotent, no-op if already finalized
    end

    API-->>FE: payment status + order status
```

## Key implementation details

- **bKash sandbox callbacks aren't cryptographically signed** the way Stripe's are, so the webhook handler never trusts the callback body's status field — it always calls bKash's own `query payment` API to get the authoritative status before finalizing anything (`paymentService.handleBkashWebhook`).
- **The `id_token` is cached in Redis**, not re-requested on every API call, since bKash's grant token is valid for a fixed lifetime (typically ~1 hour). The cache TTL is set a little shorter than the real expiry as a safety buffer.
- **`execute` and the webhook both funnel into the same `finalizePayment()`** used by the Stripe flow — this is the payoff of the strategy pattern: one shared, well-tested finalization path regardless of which provider triggered it.
- Same guarantees as Stripe: stock reduced only on success, everything in one transaction, failed payments leave the order `pending` for retry.
