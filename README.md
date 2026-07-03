# RevisionHub — Exam Papers Marketplace

No-account digital marketplace: browse CBC & 8-4-4 past papers, pay per
download via M-Pesa STK Push, get an instant download link by WhatsApp and
email. Admin tools for uploading papers and looking up payment history.

**Live:** [revisionhub.co.ke](https://revisionhub.co.ke)

## Stack
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL on [Neon](https://neon.tech) (Frankfurt / eu-central-1)
- **File storage:** Cloudflare R2 (S3-compatible)
- **Payments:** Safaricom Daraja — STK Push (M-PESA Express), production till `4800959`, shortcode `4676355`
- **Email:** Resend
- **WhatsApp notifications:** Meta WhatsApp Cloud API
- **Frontend:** React + TypeScript + Vite + Tailwind
- **DNS/CDN:** Cloudflare

## Deployment architecture — two separate deploys

| Component | Hosted on | Domain | Deploys via |
|---|---|---|---|
| Customer storefront (React/Vite) | Vercel | `revisionhub.co.ke`, `www.revisionhub.co.ke` | `git push` → Vercel auto-build of `frontend/` |
| Backend API + M-Pesa callback | Render | `api.revisionhub.co.ke` | `git push` → Render auto-build of `backend/` |
| Admin tools (upload, payment history) | Render (static, same service as API) | `admin.revisionhub.co.ke` | Same Render deploy — served via `express.static` |

**Important:** `admin/*.html` files live at the project root, served by the
Express backend (`app.use('/admin', express.static(...))`) — they deploy
with Render, not Vercel, even though they're plain HTML/CSS/JS.

Both `api.revisionhub.co.ke` and `admin.revisionhub.co.ke` must be
registered as **verified Custom Domains** in Render's dashboard (Settings →
Custom Domains) with an issued SSL certificate — DNS pointing at Render
alone is not sufficient. Render's Hobby plan caps custom domains at 2 **per
workspace**, not per service, so check other projects if you hit the limit.

## Project structure
```
backend/
  src/
    config/db.ts               Postgres pool (Neon connection)
    db/schema.sql              Current schema — keep in sync with controllers
    services/
      mpesa.service.ts         STK push + idempotent callback handling
      storage.service.ts       R2 upload + signed download URLs
      notifications.service.ts Email (Resend) + WhatsApp (Meta Cloud API)
      paymentLog.service.ts    Audit trail logging (payment_events table)
    controllers/
      papers.controller.ts
      purchases.controller.ts
      mpesa.controller.ts
      download.controller.ts
      adminPayments.controller.ts
    routes/index.ts            All API routes
    middleware/adminAuth.ts    Basic Auth gate for /admin/* API routes
    app.ts / server.ts
admin/
  upload.html                 Paper upload form (Basic Auth)
  payment-history.html        Payment/event lookup tool (Basic Auth)
frontend/                     React + TS storefront (Vite, deploys to Vercel)
  src/
    components/PaperCard.tsx
    ...
```

## Environment variables (Render — backend)

```
DATABASE_URL=              # Neon connection string, sslmode=require
ADMIN_USER=
ADMIN_PASSWORD=            # avoid # in value — dotenv treats it as a comment
MPESA_ENV=production
MPESA_SHORTCODE=4676355
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=https://api.revisionhub.co.ke/api/mpesa/callback
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
RESEND_API_KEY=
EMAIL_FROM=papers@revisionhub.co.ke   # must be the VERIFIED root domain in Resend, not a subdomain
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_NUMBER=
```

## Environment variables (Vercel — frontend)
```
VITE_API_URL=https://revisionhub-syj9.onrender.com   # or api.revisionhub.co.ke once stable
```

## Database — Neon
- Region: Frankfurt (eu-central-1) — matches Render's region, no cross-region latency.
- Free tier: scales to zero after idle, wakes on next query (~300-800ms cold start), no forced expiry.
- Run `backend/src/db/schema.sql` via Neon's SQL Editor against a fresh database.
- **`schema.sql` must be kept current** — it's drifted from live schema twice already (missing `curriculum`/`grade`/`exam_type`/`term`/`year`/`is_bundle` on `papers`, missing `email` on `purchases`). Always update this file when adding a column via `ALTER TABLE`.

### Core tables
- `papers` — catalog (curriculum, grade, subject, exam_type, term, year, price, is_bundle, file_key)
- `purchases` — one row per STK push attempt (phone, email, amount, status, checkout_request_id, mpesa_receipt, download_token)
- `subscriptions` — 30-day access window per phone number (no recurring billing — Daraja has none; renewal is a fresh STK push)
- `otp_codes` — phone verification for subscription access
- `payment_events` — full audit trail (every STK request/response, raw M-Pesa callback payload, download attempt) keyed by purchase_id / checkout_request_id / phone_number, for resolving "I paid but got nothing" support cases

## Email — Resend
- Verified domain: `revisionhub.co.ke` (root domain, via Cloudflare Domain Connect — auto-added DKIM/SPF/MX records).
- `EMAIL_FROM` **must use the verified root domain**, e.g. `papers@revisionhub.co.ke`. Sending from a subdomain (`papers@send.revisionhub.co.ke`) will be rejected with a 403 even if DNS records exist under that subdomain — Resend treats subdomains as separate unverified entities.
- "Enable Receiving" toggle in Resend is OFF — not needed, was blocking overall domain verification status unnecessarily.

## Admin tools
- `admin.revisionhub.co.ke/admin/upload.html` — upload papers (PDF) or bundles (ZIP), Basic Auth.
- `admin.revisionhub.co.ke/admin/payment-history.html` — search purchase + full event history by phone number, Basic Auth. Use this whenever a customer disputes a payment.

## M-Pesa callback flow
1. `POST /api/purchases` → creates `pending` purchase row, triggers STK push.
2. Customer enters PIN on phone.
3. Safaricom calls `MPESA_CALLBACK_URL` (`api.revisionhub.co.ke/api/mpesa/callback`) — responds `200` immediately, processes async.
4. `handleStkCallback` uses `SELECT ... FOR UPDATE OF pu` on the purchase row for idempotency — safe against Safaricom's aggressive retry behavior.
5. On success: generates a 15-minute download token, sends WhatsApp + email notification with a signed R2 URL (valid 2 minutes once the download link is clicked, 24 hours in the email link).
6. Frontend polls `GET /api/purchases/:id/status` until it flips to `completed`.

## Known gaps / things to keep an eye on
- If the server crashes between the payment `COMMIT` and the notification send, the purchase is correctly marked `completed` but the customer may not get notified automatically. Currently mitigated by frontend polling (customer still sees the download link if they stay on the page) and a manual WhatsApp fallback message ("Payment timed out. If you paid, contact us via WhatsApp"). No automated retry queue yet.
- `papers.level` column is unused/dead — superseded by `curriculum` + `grade`, safe to drop later.

## Local dev
1. `cd backend && npm install`
2. `cd ../frontend && npm install`
3. Point `DATABASE_URL` at a Neon dev branch or local Postgres, run `schema.sql`.
4. `cd backend && npm run dev` (API), `cd frontend && npm run dev` (Vite, proxies `/api`).
5. For local M-Pesa callback testing, use ngrok and set `MPESA_CALLBACK_URL` to the ngrok URL temporarily — remember to switch back to the production callback URL before deploying.