# Stripe Payment Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant Stripe

    User->>FE: Checkout
    FE->>API: POST /api/orders { items }
    API->>DB: create Order (status: pending) + OrderItems
    API-->>FE: order + total_amount

    FE->>API: POST /api/payments/{orderId}/initiate { provider: "stripe" }
    API->>Stripe: paymentIntents.create(amount)
    Stripe-->>API: PaymentIntent { id, client_secret }
    API->>DB: create Payment (status: pending, transaction_id = intent.id)
    API-->>FE: client_secret

    FE->>Stripe: confirmCardPayment(client_secret, card details)
    Note over FE,Stripe: card details never touch our backend (PCI scope stays with Stripe)
    Stripe-->>FE: immediate result (may still be "processing")

    par Webhook — source of truth
        Stripe-->>API: POST /api/payments/stripe/webhook<br/>(payment_intent.succeeded, signed)
        API->>API: verify signature (stripe.webhooks.constructEvent)
        API->>DB: finalizePayment() — locked transaction:<br/>Payment → success, reduce stock, Order → paid
    and Manual confirm — immediate UX feedback
        FE->>API: POST /api/payments/stripe/confirm { payment_intent_id }
        API->>Stripe: paymentIntents.retrieve(id)
        Stripe-->>API: current status
        API->>DB: finalizePayment() — idempotent,<br/>no-op if the webhook already finalized it
    end

    API-->>FE: payment status + order status
```

## Key implementation details

- **The webhook route is mounted with `express.raw({ type: 'application/json' })`, before the global `express.json()` middleware.** Stripe signature verification needs the exact raw request bytes — if the body had already been parsed to a JS object, the signature check would always fail. This is a common integration bug this project deliberately avoids (`src/routes/paymentWebhook.routes.js`, mounted early in `src/app.js`).
- **Both paths call the same `finalizePayment()`.** Whichever arrives first (webhook or manual confirm) does the real work; the second call is a safe no-op because the payment row is locked (`SELECT ... FOR UPDATE`) and its status is checked before any write.
- **Stock is only reduced on success**, inside the same DB transaction as the status update and the order status change — all three succeed together or all three roll back together.
- **A failed payment leaves the order `pending`**, not `canceled`, so the customer can retry with the same or a different provider instead of losing their order over one declined card.
