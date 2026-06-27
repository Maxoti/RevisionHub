# Exam Papers Marketplace

No-account digital marketplace: browse papers, pay per download via M-Pesa STK push
(or order manually via WhatsApp), get an instant download link. Optional 30-day
"subscription" pass verified by phone + OTP.

## Stack
- Backend: Node.js + Express
- DB: PostgreSQL
- File storage: Cloudflare R2 (S3-compatible)
- Payments: Safaricom Daraja (STK Push, Buy Goods / till)
- Frontend: React + TypeScript + Vite + Tailwind

## Project structure
```
backend/
  src/
    config/db.js          Postgres pool
    db/schema.sql          Run this once against your database
    services/
      mpesa.service.js     STK push + idempotent callback handling
      storage.service.js   R2 upload + signed download URLs
      sms.service.js       OTP delivery (Mobiwave stub)
    controllers/           Route handlers
    routes/index.js        All API routes
    middleware/adminAuth.js
    app.js / server.js     Serves frontend/dist as static files
frontend/                  React + TS storefront (Vite)
  src/
    App.tsx                 Paper grid + modal orchestration
    api.ts                  Typed axios client
    types.ts                Shared types matching backend response shapes
    components/
      PaperCard.tsx
      BuyModal.tsx           STK push flow, polling, WhatsApp fallback
admin/upload.html          Paper upload form (Basic Auth via the API)
```

## Setup
1. `cd backend && npm install`
2. `cd ../frontend && npm install`
3. Create a Postgres database, then run `backend/src/db/schema.sql` against it
4. Copy `backend/.env.example` to `backend/.env` and fill in the values (see below)
5. Dev mode — two terminals:
   - `cd backend && npm run dev` (API on :3000)
   - `cd frontend && npm run dev` (Vite dev server, proxies `/api` to :3000)
6. Production build — `cd frontend && npm run build` outputs to `frontend/dist`,
   which Express serves automatically. Only the backend needs to run in prod.

## What's still needed from Robert before going live
- **Daraja production credentials** (Consumer Key, Consumer Secret, Passkey,
  Shortcode) from his Go-Live application — see prior conversation for the
  steps he needs to take at developer.safaricom.co.ke
- **His WhatsApp number** — set `WHATSAPP_BUSINESS_NUMBER` in `backend/.env`
  and also update `WHATSAPP_NUMBER` at the top of
  `frontend/src/components/BuyModal.tsx`
- **R2 bucket** — create one on Cloudflare, generate API tokens, fill in
  `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- **Admin credentials** — set `ADMIN_USER` / `ADMIN_PASSWORD` for the upload
  page at `/admin/upload.html`
- **Initial papers** — he uploads via the admin page once it's deployed (or
  you can bulk-seed via a script if he hands you all 50–100 at once)

## Deploying the M-Pesa callback
Daraja needs a publicly reachable HTTPS URL for `MPESA_CALLBACK_URL`. On
Render this is your deployed app's URL + `/api/mpesa/callback`. This must be
set correctly *before* testing live payments — Safaricom won't retry to a
different URL after the fact without you re-registering it.

## Notes on what's intentionally NOT built
- No accounts/login, by design — confirmed requirement
- No automated WhatsApp delivery (would require WhatsApp Cloud API + Meta
  business verification — out of scope for this budget/timeline). The
  "Order via WhatsApp" button is a `wa.me` link with a pre-filled message;
  Robert fulfills these manually by checking his till SMS against the
  message he receives
- No real recurring billing for subscriptions — Daraja has none. The
  "subscription" is a 30-day access window unlocked by a single payment;
  renewal is a fresh STK push when it lapses
