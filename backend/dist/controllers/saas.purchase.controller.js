"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPurchase = createPurchase;
exports.getPurchaseStatus = getPurchaseStatus;
exports.mpesaCallback = mpesaCallback;
const crypto_1 = __importDefault(require("crypto"));
const db_saas_1 = __importDefault(require("../config/db.saas"));
const tenantDb_1 = require("../utils/tenantDb");
const vaultCrypto_1 = require("../utils/vaultCrypto");
const mpesa_service_1 = require("../services/mpesa.service");
const saas_storage_1 = require("../services/saas.storage");
const notifications_service_1 = require("../services/notifications.service");
// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------
const CALLBACK_SECRET = process.env.PLATFORM_CALLBACK_SECRET || '';
if (CALLBACK_SECRET.length < 24) {
    throw new Error('PLATFORM_CALLBACK_SECRET must be set (24+ characters).');
}
const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || 'https://api.edusynchub.co.ke').replace(/\/+$/, '');
const DUPLICATE_PUSH_WINDOW_SECONDS = 90;
// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const str = (v) => (typeof v === 'string' ? v : '');
const toId = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};
const safeEqual = (a, b) => {
    const A = Buffer.from(a);
    const B = Buffer.from(b);
    return A.length === B.length && crypto_1.default.timingSafeEqual(A, B);
};
// Public purchase reference: "<tenantId>.<purchaseId>.<signature>".
// It can't be guessed or enumerated, and it carries the tenant so the
// status lookup works under row-level security.
const sign = (s) => crypto_1.default.createHmac('sha256', CALLBACK_SECRET).update(s).digest('hex').slice(0, 24);
const makeRef = (tenantId, purchaseId) => `${tenantId}.${purchaseId}.${sign(`${tenantId}.${purchaseId}`)}`;
function parseRef(ref) {
    const [t, p, sig] = ref.split('.');
    const tenantId = toId(t);
    const purchaseId = toId(p);
    if (!tenantId || !purchaseId || !sig)
        return null;
    if (!safeEqual(sig, sign(`${tenantId}.${purchaseId}`)))
        return null;
    return { tenantId, purchaseId };
}
const TENANT_COLS = `t.id, t.slug, t.status, t.setup_fee_paid, t.mpesa_status,
  t.subscription_ends_at, t.till_number, t.store_number,
  t.encrypted_consumer_key, t.encrypted_consumer_secret, t.encrypted_passkey`;
// ---------------------------------------------------------------------
// POST /api/purchases  { paper_id, phone, email?, slug? }
//
// Responds as soon as the purchase row exists, BEFORE calling Safaricom.
// The STK push runs afterwards, and the page polls
// GET /api/purchases/:id/status for the result.
// ---------------------------------------------------------------------
async function createPurchase(req, res) {
    const paperId = toId(req.body?.paper_id);
    const phone = (0, mpesa_service_1.formatPhone)(str(req.body?.phone).trim());
    const email = str(req.body?.email).trim().slice(0, 255) || null;
    const slug = str(req.body?.slug).trim().toLowerCase().slice(0, 60);
    if (!paperId || !phone) {
        res.status(400).json({ error: 'paper_id and phone are required' });
        return;
    }
    if (!/^254[17]\d{8}$/.test(phone)) {
        res.status(400).json({ error: 'Enter a valid Safaricom number, e.g. 0712345678.' });
        return;
    }
    try {
        // 1. Which store is selling? Prefer the slug; otherwise derive it from the paper.
        const tr = slug
            ? await db_saas_1.default.query(`SELECT ${TENANT_COLS} FROM public.tenants t WHERE t.slug = $1`, [slug])
            : await db_saas_1.default.query(`SELECT ${TENANT_COLS}
             FROM public.papers p JOIN public.tenants t ON t.id = p.tenant_id
            WHERE p.id = $1`, [paperId]);
        const tenant = tr.rows[0];
        if (!tenant || tenant.status === 'suspended') {
            res.status(404).json({ error: 'Store not found.' });
            return;
        }
        if (!tenant.setup_fee_paid || tenant.mpesa_status !== 'active') {
            res.status(403).json({ error: 'This store is not accepting payments yet.' });
            return;
        }
        if (tenant.subscription_ends_at && new Date(tenant.subscription_ends_at) < new Date()) {
            res.status(403).json({ error: 'This store is temporarily unavailable.' });
            return;
        }
        // 2. The paper must belong to that store.
        const paperRes = await (0, tenantDb_1.withTenant)(db_saas_1.default, tenant.id, (c) => c.query(`SELECT id, title, price FROM public.papers
          WHERE id = $1 AND tenant_id = $2 AND active = TRUE`, [paperId, tenant.id]));
        const paper = paperRes.rows[0];
        if (!paper) {
            res.status(404).json({ error: 'Paper not found' });
            return;
        }
        // 3. Don't fire a second push while one may still be open on the phone.
        const dup = await (0, tenantDb_1.withTenant)(db_saas_1.default, tenant.id, (c) => c.query(`SELECT id FROM public.purchases
          WHERE tenant_id = $1 AND paper_id = $2 AND phone_number = $3
            AND status = 'pending'
            AND created_at > NOW() - INTERVAL '${DUPLICATE_PUSH_WINDOW_SECONDS} seconds'
          ORDER BY created_at DESC LIMIT 1`, [tenant.id, paper.id, phone]));
        if (dup.rows.length > 0) {
            res.status(202).json({
                purchase_id: makeRef(tenant.id, dup.rows[0].id),
                message: 'Payment already in progress. Check your phone.',
            });
            return;
        }
        // 4. Create the purchase (tenant_id is NOT NULL).
        const ins = await (0, tenantDb_1.withTenant)(db_saas_1.default, tenant.id, (c) => c.query(`INSERT INTO public.purchases (tenant_id, paper_id, phone_number, email, amount, status)
         VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`, [tenant.id, paper.id, phone, email, paper.price]));
        const purchaseId = ins.rows[0].id;
        res.status(202).json({
            purchase_id: makeRef(tenant.id, purchaseId),
            message: 'Processing your payment request.',
        });
        // Everything past this point is best-effort; the response is already sent.
        void initiatePaymentAsync(tenant, purchaseId, phone, paper);
    }
    catch (err) {
        console.error('[createPurchase] failed:', err instanceof Error ? err.message : err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Could not process purchase. Try again.' });
        }
    }
}
async function initiatePaymentAsync(tenant, purchaseId, phone, paper) {
    try {
        if (!tenant.encrypted_consumer_key || !tenant.encrypted_consumer_secret || !tenant.encrypted_passkey) {
            throw new Error('Store M-Pesa credentials are incomplete.');
        }
        const creds = {
            consumerKey: (0, vaultCrypto_1.decryptSecret)(tenant.encrypted_consumer_key),
            consumerSecret: (0, vaultCrypto_1.decryptSecret)(tenant.encrypted_consumer_secret),
            passkey: (0, vaultCrypto_1.decryptSecret)(tenant.encrypted_passkey),
            businessShortCode: tenant.store_number,
            tillNumber: tenant.till_number,
        };
        const stk = await (0, mpesa_service_1.triggerRawBuyGoodsStkPush)({
            creds,
            phone,
            amount: paper.price,
            accountReference: `PUR${purchaseId}`,
            transactionDesc: paper.title,
            callbackUrl: `${API_PUBLIC_URL}/api/mpesa/callback/${CALLBACK_SECRET}/${tenant.id}`,
        });
        console.log('[createPurchase] daraja:', JSON.stringify(stk));
        await (0, tenantDb_1.withTenant)(db_saas_1.default, tenant.id, (c) => c.query(`UPDATE public.purchases
            SET checkout_request_id = $1, merchant_request_id = $2, updated_at = NOW()
          WHERE id = $3 AND tenant_id = $4`, [stk.CheckoutRequestID, stk.MerchantRequestID, purchaseId, tenant.id]));
    }
    catch (err) {
        const e = err;
        console.error('[createPurchase] STK push failed:', JSON.stringify(e.response?.data) || e.message);
        await (0, tenantDb_1.withTenant)(db_saas_1.default, tenant.id, (c) => c.query(`UPDATE public.purchases SET status = 'failed', updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2`, [purchaseId, tenant.id])).catch((dbErr) => console.error('[createPurchase] could not mark failed:', dbErr.message));
    }
}
// ---------------------------------------------------------------------
// GET /api/purchases/:id/status   (id = the reference returned above)
// ---------------------------------------------------------------------
async function getPurchaseStatus(req, res) {
    const ref = parseRef(str(req.params.id));
    if (!ref) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    try {
        const r = await (0, tenantDb_1.withTenant)(db_saas_1.default, ref.tenantId, (c) => c.query(`SELECT status, download_token, token_expires_at, token_used
           FROM public.purchases WHERE id = $1 AND tenant_id = $2`, [ref.purchaseId, ref.tenantId]));
        const p = r.rows[0];
        if (!p) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const tokenValid = p.status === 'completed' && !p.token_used && new Date(p.token_expires_at) > new Date();
        res.json({
            status: p.status,
            download_token: tokenValid ? p.download_token : null,
        });
    }
    catch (err) {
        console.error('[getPurchaseStatus] failed:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: 'Could not fetch purchase status. Try again.' });
    }
}
async function mpesaCallback(req, res) {
    if (!safeEqual(str(req.params.key), CALLBACK_SECRET)) {
        res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
        return;
    }
    const ack = (desc = 'Accepted') => res.status(200).json({ ResultCode: 0, ResultDesc: desc });
    const tenantId = toId(req.params.tenantId);
    const cb = req.body?.Body?.stkCallback;
    if (!tenantId || !cb?.CheckoutRequestID) {
        ack();
        return;
    }
    // No phone numbers in the log.
    console.log('[mpesa/callback]', JSON.stringify({ tenantId, id: cb.CheckoutRequestID, code: cb.ResultCode, desc: cb.ResultDesc }));
    let completed = null;
    try {
        completed = await (0, tenantDb_1.withTenant)(db_saas_1.default, tenantId, async (c) => {
            const found = await c.query(`SELECT id, status, amount, paper_id, phone_number, email
           FROM public.purchases
          WHERE checkout_request_id = $1 AND tenant_id = $2
          FOR UPDATE`, [cb.CheckoutRequestID, tenantId]);
            const purchase = found.rows[0];
            // Unknown id (e.g. the vault's KES 1 test) or already processed.
            if (!purchase || purchase.status === 'completed')
                return null;
            if (Number(cb.ResultCode) !== 0) {
                await c.query(`UPDATE public.purchases SET status = 'failed', updated_at = NOW() WHERE id = $1`, [purchase.id]);
                return null;
            }
            const items = cb.CallbackMetadata?.Item || [];
            const paid = Number(items.find((i) => i.Name === 'Amount')?.Value);
            if (paid !== Number(purchase.amount)) {
                // Money arrived but the amount is wrong: leave it pending for manual review.
                console.error('[mpesa/callback] amount mismatch', {
                    id: cb.CheckoutRequestID,
                    expected: purchase.amount,
                    paid,
                });
                return null;
            }
            const receipt = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;
            const downloadToken = crypto_1.default.randomBytes(24).toString('hex');
            const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
            await c.query(`UPDATE public.purchases
            SET status = 'completed', mpesa_receipt = $1, download_token = $2,
                token_expires_at = $3, token_used = FALSE, updated_at = NOW()
          WHERE id = $4`, [receipt ? String(receipt) : null, downloadToken, tokenExpiresAt, purchase.id]);
            const paper = (await c.query(`SELECT title, file_key FROM public.papers WHERE id = $1 AND tenant_id = $2`, [purchase.paper_id, tenantId])).rows[0];
            return {
                phone: purchase.phone_number,
                email: purchase.email,
                title: paper?.title ?? 'your paper',
                fileKey: paper?.file_key,
            };
        });
    }
    catch (err) {
        console.error('[mpesa/callback] processing failed:', err instanceof Error ? err.message : err);
    }
    // After the commit, in its own try: a storage or notification failure must
    // never undo a payment that has already been recorded.
    if (completed && completed.fileKey) {
        try {
            const downloadUrl = await (0, saas_storage_1.getSignedDownloadUrl)(completed.fileKey, 24 * 60 * 60);
            (0, notifications_service_1.notifyBuyer)({
                phone: completed.phone,
                email: completed.email,
                paperTitle: completed.title,
                downloadUrl,
            }).catch((e) => console.error('[mpesa/callback] notifyBuyer failed:', e instanceof Error ? e.message : e));
        }
        catch (err) {
            console.error('[mpesa/callback] signed url failed:', err instanceof Error ? err.message : err);
        }
    }
    ack('Callback received');
}
