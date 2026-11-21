# RevisionHub — Exam Papers Marketplace

One codebase, two ways to run it:

| | **Single-tenant** (RevisionHub) | **Multi-tenant SaaS** (EdusyncHub) |
|---|---|---|
| What it is | One dedicated store per deployment | A platform where many teachers each open their own store |
| Example | `revisionhub.co.ke` and other client sites | `edusynchub.co.ke/<teacher-slug>` |
| Who gets paid | The site owner's M-Pesa Till | **Each seller's own** M-Pesa Buy Goods Till (100%, no commission) |
| Seller accounts | No, admin tools only | Yes: sign up, upload papers, activate, renew |
| Backend flag | `TENANT_MODE=single` | `TENANT_MODE=multi` |
| Git branch | `main` and the per-client branches | `edusynchub` |
| Database | Neon PostgreSQL | PostgreSQL (cPanel), tenant-scoped schema |
| Frontend host | Vercel | Vercel |
| Backend host | Render | cPanel Node.js app |

Buyers never need an account in either mode: they browse CBC, 8-4-4 and IGCSE
papers, pay per download via M-Pesa STK Push, and receive an instant download
link by WhatsApp and email.

**Live:** [revisionhub.co.ke](https://revisionhub.co.ke) (single-tenant) ·
[edusynchub.co.ke](https://edusynchub.co.ke) (multi-tenant SaaS)

---

## Branches (read before merging anything)

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | Single-tenant production (RevisionHub) | Vercel + Render auto-build on push |
| `Mark`, `Robert`, `william` | Per-client single-tenant builds | Each client's own hosting |
| `edusynchub` | Multi-tenant SaaS | Vercel project `revisionhub-saas` + cPanel Node app |

**Do not merge `edusynchub` into `main` or a client branch.** The SaaS backend
needs the tenant schema and refuses to start without its environment variables,
and a merge would auto-deploy it onto a live single-tenant site. Port individual
fixes with `git cherry-pick` instead.

---

## Stack
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (Neon for single-tenant; cPanel-hosted PostgreSQL for the SaaS)
- **File storage:** Cloudflare R2 (S3-compatible)
- **Payments:** Safaricom Daraja, STK Push (M-PESA Express), Buy Goods Till
- **Auth (multi-tenant):** JWT bearer tokens, bcrypt password hashes
- **Secrets at rest (multi-tenant):** AES-256-GCM (`utils/vaultCrypto.ts`)
- **Email:** Resend
- **WhatsApp notifications:** Meta WhatsApp Cloud API
- **Frontend:** React + TypeScript + Vite + Tailwind
- **DNS/CDN:** Cloudflare

---

## Deployment architecture

### Single-tenant (`main`)

| Component | Hosted on | Domain | Deploys via |
|---|---|---|---|
| Customer storefront (React/Vite) | Vercel | `revisionhub.co.ke`, `www.revisionhub.co.ke` | `git push` → Vercel auto-build of `frontend/` |
| Backend API + M-Pesa callback | Render | `api.revisionhub.co.ke` | `git push` → Render auto-build of `backend/` |
| Admin tools (upload, payment history) | Render (static, same service as API) | `admin.revisionhub.co.ke` | Same Render deploy, served via `express.static` |

`admin/*.html` files live at the project root and are served by the Express
backend (`app.use('/admin', express.static(...))`), so they deploy with Render,
not Vercel.

`api.revisionhub.co.ke` and `admin.revisionhub.co.ke` must both be registered as
**verified Custom Domains** in Render (Settings → Custom Domains) with an issued
SSL certificate; DNS pointing at Render alone is not enough. Render's Hobby plan
caps custom domains at 2 **per workspace**, not per service.

### Multi-tenant SaaS (`edusynchub`)

| Component | Hosted on | Domain | Deploys via |
|---|---|---|---|
| Landing, sign-up/sign-in, seller storefronts (React/Vite) | Vercel project `revisionhub-saas` | `www.edusynchub.co.ke` (apex redirects to it) | Push to `edusynchub` → Vercel build |
| Backend API + platform billing callback | cPanel Node.js app | `api.edusynchub.co.ke` | cPanel Git Version Control → Deploy HEAD Commit (see below) |
| Seller dashboard, super-admin vault | Vercel (static files from `frontend/public/`) | `/saas-upload`, `/vault` | Same Vercel deploy |

Vercel settings: root directory `frontend`, build command
`npm run build:edusynchub`, output directory `dist`, production branch
`edusynchub`. `frontend/vercel.json` rewrites every path to `index.html` so
`/signin`, `/signup` and `/<slug>` work on refresh.

Backend deploy on cPanel:

1. Build and commit the compiled backend: `cd backend && npm run build`, then commit `backend/dist`.
2. cPanel → Git Version Control → `revisionhub-saas` → set the branch to `edusynchub` → **Update from Remote** → **Deploy HEAD Commit**.
3. `.cpanel.yml` copies `backend/dist`, `package.json` and `package-lock.json` into the Node app folder and touches `tmp/restart.txt`. It never deletes anything there, so `node_modules` and server-side settings survive.
4. cPanel → Setup Node.js App: application root = the deploy folder, URL `api.edusynchub.co.ke`, startup file `dist/server.js`, environment variables below, then **Run NPM Install** and **Restart**.

---

## Project structure
```
backend/
  src/
    config/db.ts               Postgres pool
    db/schema.sql              Single-tenant schema (keep in sync with controllers)
    services/
      mpesa.service.ts         STK push + idempotent callback handling
      storage.service.ts       R2 upload + signed download URLs
      notifications.service.ts Email (Resend) + WhatsApp (Meta Cloud API)
      paymentLog.service.ts    Audit trail logging (payment_events table)
    controllers/               papers, purchases, mpesa, download, adminPayments
    routes/
      index.ts                 Single-tenant API routes
      authRoutes.ts            Multi-tenant: register, login, me
      saasRoutes.ts            Multi-tenant: seller papers/uploads, billing, vault
    middleware/
      adminAuth.ts             Basic Auth gate for /admin/* (single-tenant)
      tenantAuth.ts            JWT auth, role checks, tenant resolution, TENANT_MODE
    utils/
      tenantDb.ts              withTenant(): transaction with app.tenant_id set
      vaultCrypto.ts           AES-256-GCM encrypt/decrypt for stored Daraja keys
    app.ts                     Single-tenant app
    app.saas.ts                Multi-tenant app
    server.ts                  Starts the app that TENANT_MODE selects
admin/                         Single-tenant admin pages (Basic Auth)
  upload.html
  payment-history.html
migrations/
  001_add_tenants.sql
  dual_mode_tenancy.sql        Tenant layer; works on an empty or an existing DB
frontend/                      React + TS storefront (Vite)
  public/
    saas-upload.html           Seller dashboard (multi-tenant)
    vault.html                 Super-admin vault (multi-tenant)
  src/
    pages/                     LandingPage, SignInPage, SignUpPage, UploadPaper
    components/PaperCard.tsx
    main.tsx                   Routing; SaaS routes only when VITE_APP_MODE=saas
```

---

## How tenancy works

`TENANT_MODE` is read at startup and **must** be `single` or `multi`; the server
refuses to boot without it, so a missing flag can never silently open
registration.

**Single mode.** One store. The database still has a `tenants` table with one
default row, so the same code and schema serve both modes, and queries need no
tenant argument. `POST /api/tenants/register` works **once**, to create the
owner of the default tenant (first-run bootstrap), then closes.

**Multi mode.** Every request is tied to a tenant:

- **Public storefront routes:** the tenant is resolved from the `x-tenant-slug`
  header, then from `{slug}.ROOT_DOMAIN`, then from a custom domain
  (`tenants.custom_domain`).
- **Seller routes:** the tenant comes from the JWT. The backend re-checks the
  user and store in the database on every request, so a disabled user or
  suspended store loses access immediately.
- **Database:** every data table has a `tenant_id`. The `current_tenant_id()`
  function supplies it from `set_config('app.tenant_id', …)` (use `withTenant()`
  from `utils/tenantDb.ts`), or from the default tenant when it is the **only**
  tenant. Otherwise it raises an error, so a missing tenant can never write
  into the wrong store.

---

## Multi-tenant: seller lifecycle

1. **Free sign-up** (`/signup`): creates the store (`edusynchub.co.ke/<slug>`) and its owner user in one transaction. Sellers can upload papers straight away.
2. **Onboarding fee**: the seller pays the one-time setup fee (**KES 4,000**, includes the first month).
3. **Activation** (super-admin, `/vault`): the platform admin enters the seller's Daraja consumer key, consumer secret, passkey, Till and store number. They are encrypted (AES-256-GCM) before storage. Activation sets `setup_fee_paid`, `mpesa_status = active` and +30 days. A **KES 1 test STK push** verifies the Till.
4. **Selling**: buyers pay by STK push; the money goes to the seller's own Till, and the platform never holds it.
5. **Renewal** (**KES 300 / month**): the seller triggers an STK push to the platform Till. On success the subscription is extended 30 days. If it lapses, buyers cannot check out and sellers cannot upload until they renew; papers stay saved.

### Seller API (`/api`, Bearer token)

| Route | Roles | Purpose |
|---|---|---|
| `POST /tenants/register` | public | Create store + owner |
| `POST /tenants/login` | public | Returns a JWT (5 failed attempts lock the account 15 min) |
| `GET /tenants/me` | any | Current user and store state |
| `GET /tenants/papers` | any | List the store's papers |
| `POST /tenants/upload-url` | owner, admin | Signed R2 upload URL (PDF, Word, ZIP) |
| `POST /tenants/papers/save` | owner, admin | Save a paper record |
| `DELETE /tenants/papers/:id` | owner, admin | Soft-delete a paper |
| `POST /tenants/billing/renewal-stk` | owner | KES 300 renewal STK push |
| `POST /mpesa/platform-callback/:key` | Safaricom | Renewal callback (secret in path) |

### Super-admin vault API (`x-admin-secret` header)

`GET /vault/tenants` · `POST /vault/activate/:id` · `POST /vault/test-stk/:id` ·
`POST /vault/extend/:id` · `POST /vault/suspend/:id` ·
`POST /vault/users/:id/reset-password`

### Security notes

- Passwords: bcrypt (12 rounds). Login responses are identical for unknown user and wrong password, and timing is equalised.
- Daraja keys are never stored or logged in plain text. `VAULT_MASTER_KEY` is the only way to read them: **back it up**, because losing it means every seller must re-submit their keys.
- A seller can only attach files under `tenants/<their id>/`, so one store cannot register another store's file.
- The platform callback URL contains a secret and the callback checks the paid amount; the admin secret is compared in constant time.
- Reserved store slugs (`admin`, `api`, `signin`, `signup`, `upload`, `vault`, …) are rejected at sign-up because they collide with real pages.

---

## Environment variables

### Single-tenant backend (Render)
```
TENANT_MODE=single
DATABASE_URL=              # Neon connection string, sslmode=require
JWT_SECRET=                # 32+ characters
ADMIN_USER=
ADMIN_PASSWORD=            # avoid # in value: dotenv treats it as a comment
MPESA_ENV=production       # the code reads MPESA_ENV (not DARAJA_ENV)
MPESA_SHORTCODE=4676355
MPESA_TILL_NUMBER=4800959
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=https://api.revisionhub.co.ke/api/mpesa/callback
R2_ENDPOINT=               # https://<account-id>.r2.cloudflarestorage.com  (REQUIRED)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
RESEND_API_KEY=
EMAIL_FROM=papers@revisionhub.co.ke   # must be the VERIFIED root domain in Resend, not a subdomain
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_NUMBER=
```

### Multi-tenant backend (cPanel Node.js app)
```
TENANT_MODE=multi
SAAS_DATABASE_URL=         # postgres://<user>:<password>@localhost:5432/<saas database>
JWT_SECRET=                # 32+ characters, different from every other environment
JWT_EXPIRES_IN=12h
VAULT_MASTER_KEY=          # EXACTLY 64 hex chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SUPER_ADMIN_SECRET=        # 16+ characters, sent as the x-admin-secret header
PLATFORM_CALLBACK_SECRET=  # 24+ characters, goes into the renewal callback URL
API_PUBLIC_URL=https://api.edusynchub.co.ke
ROOT_DOMAIN=edusynchub.co.ke
CORS_ORIGINS=https://www.edusynchub.co.ke,https://edusynchub.co.ke
MPESA_ENV=production
MPESA_CALLBACK_URL=https://api.edusynchub.co.ke/api/mpesa/callback
PLATFORM_MPESA_CONSUMER_KEY=       # the platform's own Till (KES 300 renewals)
PLATFORM_MPESA_CONSUMER_SECRET=
PLATFORM_MPESA_PASSKEY=
PLATFORM_MPESA_STORE_NUMBER=
PLATFORM_MPESA_TILL_NUMBER=
R2_ENDPOINT=               # or set R2_ACCOUNT_ID instead; seller uploads use R2_ACCOUNT_ID
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
RESEND_API_KEY=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```
Do **not** set `PORT` on cPanel; Passenger supplies it. Sellers' Daraja keys are
**not** environment variables: they live encrypted in the database. Use a different
`JWT_SECRET`, `SUPER_ADMIN_SECRET` and `VAULT_MASTER_KEY` in every environment.

### Frontend (Vercel)
```
# Single-tenant storefront
VITE_API_URL=https://api.revisionhub.co.ke

# Multi-tenant SaaS (project revisionhub-saas)
VITE_API_URL=https://api.edusynchub.co.ke
VITE_APP_MODE=saas
```
Only public values belong in `VITE_` variables, because they are baked into the
JavaScript bundle. The plain `build` script is deliberately blocked: build per
target with `npm run build:edusynchub`, `build:mark`, `build:austine`,
`build:robert` or `build:william`.

---

## Database

### Single-tenant: Neon
- Region: Frankfurt (eu-central-1), matching Render's region.
- Free tier scales to zero after idle and wakes on the next query (~300-800 ms cold start).
- Run `backend/src/db/schema.sql` against a fresh database through Neon's SQL Editor.
- **Keep `schema.sql` current.** It has drifted from the live schema twice already. Update it whenever you `ALTER TABLE`.

### Multi-tenant: PostgreSQL
Run `migrations/dual_mode_tenancy.sql` once (phpPgAdmin or `psql`). It works on
an **empty** database (it creates the base tables first) and on an **existing**
single-tenant database (it attaches the old rows to a default tenant). It is
idempotent and runs in a single transaction, so an error rolls everything back.
Never run it against a database whose code is not tenant-aware.

What it adds:

- `tenants`: one row per store (slug, status, M-Pesa Till/store numbers, encrypted Daraja keys, subscription expiry).
- `users`: logins (`owner` / `admin` / `staff`), each belonging to one tenant. Usernames are globally unique, case-insensitive.
- `platform_payments`: the platform's own billing (KES 300 renewals).
- `tenant_id` on `papers`, `purchases`, `otp_codes`, `subscriptions` and `payment_events`.
- Composite foreign keys, so a purchase can only point at a paper from the **same** tenant.
- `payment_events.tenant_id` is nullable and filled by a trigger from the purchase, so audit logging never fails on a callback for an unknown checkout.
- `checkout_request_id` and `download_token` stay **globally** unique on purpose: Safaricom callbacks arrive before the tenant is known.

Optional Row-Level Security is included, commented out, at the bottom of the
migration. Enable it only once every request runs inside `withTenant()` and the
app connects with a non-owner database role.

### Core tables
- `papers`: catalog (curriculum, grade, subject, exam_type, term, year, price, is_bundle, file_key)
- `purchases`: one row per STK push attempt (phone, email, amount, status, checkout_request_id, mpesa_receipt, download_token)
- `subscriptions`: 30-day access window per phone number (no recurring billing: Daraja has none, renewal is a fresh STK push)
- `otp_codes`: phone verification for subscription access
- `payment_events`: full audit trail (every STK request/response, raw callback payload, download attempt) for resolving "I paid but got nothing" cases

---

## Email: Resend
- Verified domain: `revisionhub.co.ke` (root domain, via Cloudflare Domain Connect, with automatic DKIM/SPF/MX records).
- `EMAIL_FROM` **must use the verified root domain**, e.g. `papers@revisionhub.co.ke`. Sending from a subdomain is rejected with a 403 even if DNS records exist under it.
- The "Enable Receiving" toggle in Resend is OFF: it is not needed and blocked domain verification.

## Admin tools
- **Single-tenant:** `admin.revisionhub.co.ke/admin/upload.html` (PDF or ZIP bundles) and `payment-history.html` (purchase and event lookup by phone number, the first stop for a payment dispute). Both use Basic Auth.
- **Multi-tenant:** sellers use `/saas-upload`; the platform admin uses `/vault`. Both call the API with a token or the admin secret instead of Basic Auth.

---

## M-Pesa flows

### A. Buyer purchase (single-tenant)
1. `POST /api/purchases` creates a `pending` purchase row and triggers the STK push.
2. The customer enters their PIN on the phone.
3. Safaricom calls `MPESA_CALLBACK_URL`; the server answers `200` immediately and processes asynchronously.
4. `handleStkCallback` uses `SELECT … FOR UPDATE OF pu` on the purchase row, so Safaricom's retries are safe (idempotent).
5. On success it generates a 15-minute download token and sends a WhatsApp and email notification with a signed R2 URL (valid 24 hours in the message, 2 minutes once the download link is opened).
6. The frontend polls `GET /api/purchases/:id/status` until it flips to `completed`.

### B. Buyer purchase (multi-tenant)
The STK push is sent with the **seller's** decrypted Daraja credentials and Till
(`resolveMpesaConfig(tenantId)`). It is refused unless the store is active, the
setup fee is paid, `mpesa_status` is `active` and the subscription has not
expired. Callbacks are matched by the globally unique `checkout_request_id`, and
the tenant is read from the purchase. In multi mode a missing `tenantId` is an
error and never falls back to environment credentials.

### C. Platform billing (multi-tenant)
`POST /api/tenants/billing/renewal-stk` → STK push to the platform Till →
Safaricom calls `/api/mpesa/platform-callback/<PLATFORM_CALLBACK_SECRET>` → the
row is locked, the amount (KES 300) is verified, and the subscription is
extended by 30 days.

---

## Known gaps / things to keep an eye on
- **Multi-tenant storefront purchases:** the existing `papers`, `purchases`, `mpesa` and `download` controllers are single-tenant. The seller-store purchase and callback flow (flow B) needs tenant-aware controllers wired to `resolveTenant()` before buying works on `edusynchub.co.ke/<slug>`.
- If the server crashes between the payment `COMMIT` and the notification send, the purchase is correctly `completed` but the customer may not be notified automatically. It is mitigated by frontend polling and a manual WhatsApp fallback. There is no automated retry queue yet.
- `papers.level` is unused (superseded by `curriculum` + `grade`) and safe to drop later.
- `tenants.username` and `tenants.password_hash` are legacy columns kept (nullable) after credentials moved to `users`. Drop them once login is verified in production.
- The frontend seller pages (`saas-upload`, `vault`) must send `Authorization: Bearer <token>` (sellers) or `x-admin-secret` (vault). The old username-and-password-in-body calls are gone.
- Vercel's Hobby plan is for non-commercial use; move the SaaS frontend to a paid plan before promoting it.

## Local dev
1. `cd backend && npm install`, then `cd ../frontend && npm install`.
2. Point the database variable at a Neon dev branch or a local Postgres. Run `schema.sql` for single mode, or `migrations/dual_mode_tenancy.sql` for multi mode.
3. Create `backend/.env` with `TENANT_MODE=single` or `TENANT_MODE=multi` plus the variables above.
4. `cd backend && npm run dev` (API) and `cd frontend && npm run dev` (Vite, proxies `/api`). For the SaaS frontend run with `--mode edusynchub`.
5. For local M-Pesa callback testing, use ngrok and set the callback URL (and the platform callback host) to the ngrok URL temporarily. Switch it back before deploying.