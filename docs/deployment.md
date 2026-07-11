# Deployment Guide

Covers: environment configuration, Docker (backend + DB), running the backend locally via ngrok, and pointers for deploying the frontend to Vercel.

---

## 1. Environment configuration guide

All configuration lives in `.env` (never committed — `.env.example` is the template, which *is* committed).

| Variable | Required for | Notes |
|---|---|---|
| `PORT` | always | defaults to 3000 |
| `NODE_ENV` | always | `development`, `test`, or `production` — controls CORS strictness, log format, error verbosity |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | always | Postgres connection. Inside Docker, `DB_HOST` is overridden to `postgres` automatically (see §2) |
| `DB_NAME_TEST` | `npm test` | separate database so tests never touch dev data |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | always | keep `JWT_SECRET` long and random, never reuse the sample value in production |
| `STRIPE_SECRET_KEY` | Stripe payments | test-mode key from the Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks | from `stripe listen` (local) or the dashboard's webhook endpoint config (production) |
| `BKASH_BASE_URL`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_APP_KEY`, `BKASH_APP_SECRET` | bKash payments | sandbox credentials from bKash's developer portal |
| `REDIS_URL` | always | category-tree cache + bKash token cache. Inside Docker, overridden to `redis://redis:6379` automatically |
| `CORS_ORIGINS` | production only | comma-separated list of allowed frontend origins (e.g. your Vercel URL). Ignored (fully permissive) when `NODE_ENV` is `development` or `test`, so your local Vite frontend always works without extra setup |

---

## 2. Docker (backend + Postgres + Redis)

You don't have Docker installed yet — here's the setup.

### Install Docker Desktop (macOS)

```bash
brew install --cask docker
```
Then open the **Docker** app from Applications once (it needs to finish starting up — you'll see a whale icon in the menu bar go steady). Alternatively, download directly from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).

Verify it's working:
```bash
docker --version
docker compose version
```

### Run everything

From the project root (`.env` must already exist — copy from `.env.example` if you haven't):

```bash
docker compose up --build
```

This starts three containers: `ecommerce_app`, `ecommerce_postgres`, `ecommerce_redis`, networked together. First run takes a minute to build the image and pull the Postgres/Redis images.

### Run migrations & seed inside the container

The app container does **not** auto-migrate on startup (deliberately — silent schema changes on every restart are risky). Run these once the containers are up:

```bash
docker compose exec app npm run migrate
docker compose exec app npm run seed
```

### Useful commands

```bash
docker compose logs -f app       # tail the backend's logs
docker compose down              # stop everything
docker compose down -v           # stop everything AND wipe the Postgres volume (fresh start)
docker compose exec app sh       # shell into the running app container
```

### Verify

```bash
curl http://localhost:3000/health
```

---

## 3. Running the backend locally via ngrok

ngrok exposes your local `localhost:3000` (whether running via `npm run dev` or via Docker — it doesn't care which) at a public HTTPS URL, so a real Stripe/bKash sandbox can send webhooks to it, or so someone else (e.g. an assessor, or your Vercel-hosted frontend during testing) can reach your machine.

### Install ngrok (macOS)

```bash
brew install ngrok/ngrok/ngrok
```

### Authenticate (one-time, free account)

1. Sign up at [ngrok.com](https://ngrok.com) (free tier is enough)
2. Copy your authtoken from the dashboard
3. Run:
```bash
ngrok config add-authtoken <your-token-here>
```

### Start the tunnel

With your backend already running (`npm run dev` or `docker compose up`):

```bash
ngrok http 3000
```

You'll get output like:
```
Forwarding    https://a1b2-c3d4.ngrok-free.app -> http://localhost:3000
```

That `https://...ngrok-free.app` URL is your backend, publicly reachable, for as long as this terminal stays open. **The URL changes every time you restart ngrok** on the free tier — keep that in mind when configuring webhook URLs.

### Using it with Stripe webhooks

You have two options:
- **Stripe CLI** (`stripe listen --forward-to localhost:3000/api/payments/stripe/webhook`) — simplest, doesn't need ngrok at all for this specific purpose, and prints a fresh `STRIPE_WEBHOOK_SECRET` each time.
- **ngrok + Stripe Dashboard** — add `https://your-ngrok-url.ngrok-free.app/api/payments/stripe/webhook` as a webhook endpoint in the Stripe dashboard, copy the signing secret it gives you into `STRIPE_WEBHOOK_SECRET`.

Either works; the CLI is quicker for iterative local testing, the dashboard+ngrok approach is closer to how it'd work in a real deployed environment.

### Using it with your frontend

Since your frontend is running at `http://localhost:5173`, it can already call `http://localhost:3000` directly — ngrok isn't needed for that on the same machine. You'd use the ngrok URL as the frontend's API base URL specifically when the frontend is deployed elsewhere (see §4) and needs to reach your local machine, or when someone external needs to hit your API.

---

## 4. Frontend on Vercel (pointers)

Your frontend is a separate project from this backend repo, so exact steps depend on its framework, but the shape is:

```bash
npm install -g vercel
cd /path/to/your/frontend
vercel login
vercel        # first deploy, follow the prompts
vercel --prod # promote to production
```

In the Vercel project settings, set an environment variable for your API base URL (e.g. `VITE_API_BASE_URL`) pointing at:
- your ngrok URL, if the backend is only running locally, or
- a properly hosted backend URL, if you deploy this backend somewhere too (not required by the assessment, which only asks for the backend to run locally via ngrok)

Then update this backend's `CORS_ORIGINS` (in `.env`, and restart) to include your Vercel URL:
```
CORS_ORIGINS=http://localhost:5173,https://your-project.vercel.app
```

---

## Summary of what's already handled in the code

- **CORS** is now environment-aware (`src/app.js`): fully open in development/test (so `localhost:5173` just works, no setup needed), locked to `CORS_ORIGINS` in production.
- **Dockerfile** builds a lean production image (`npm ci --omit=dev`, no dev dependencies, no test files — see `.dockerignore`).
- **docker-compose.yml** wires the app to Postgres and Redis by service name automatically — you never need to hand-edit `DB_HOST`/`REDIS_URL` for Docker, the compose file overrides them.
- **Migrations are run explicitly**, not automatically, in both local and Docker setups — a deliberate safety choice.
