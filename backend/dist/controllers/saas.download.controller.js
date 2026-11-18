"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadByToken = downloadByToken;
const db_saas_1 = __importDefault(require("../config/db.saas"));
const storage_service_1 = require("../services/storage.service");
const paymentLog_service_1 = require("../services/paymentLog.service");
const tenantDb_1 = require("../utils/tenantDb");
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ASSUMPTIONS TO VERIFY
//   purchases.tenant_id and papers.tenant_id exist
//   withTenant(pool, tenantId, (client) => client.query(...)) returns the
//   callback's result, as used in saasRoutes.ts
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Never write a live bearer token into the payment log; a short prefix is
// enough to correlate attempts.
function tokenRef(token) {
    return token.slice(0, 8);
}
// GET /api/store/:slug/download/:token
//
// Checks that the token belongs to a COMPLETED purchase of the store in the
// URL and that the paper being delivered belongs to that same store, then
// claims the token and redirects to a short-lived signed R2 URL. The file
// streams from R2 directly, not through the Node app.
async function downloadByToken(req, res) {
    const slug = String(req.params.slug || '').toLowerCase().slice(0, 60);
    const token = String(req.params.token || '');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!slug || !token) {
        res.status(400).json({ error: 'Invalid request' });
        return;
    }
    try {
        const tr = await db_saas_1.default.query(`SELECT id FROM public.tenants WHERE slug = $1`, [slug]);
        const tenantId = tr.rows[0]?.id;
        if (!tenantId) {
            res.status(404).json({ error: 'Invalid or unrecognised link' });
            return;
        }
        const found = await (0, tenantDb_1.withTenant)(db_saas_1.default, tenantId, (c) => c.query(`SELECT p.id, p.phone_number, p.token_expires_at, p.token_used, pa.file_key
         FROM purchases p
         JOIN papers pa ON pa.id = p.paper_id AND pa.tenant_id = p.tenant_id
         WHERE p.download_token = $1
           AND p.status = 'completed'
           AND p.tenant_id = $2`, [token, tenantId]));
        if (found.rows.length === 0) {
            await (0, paymentLog_service_1.logPaymentEvent)({
                eventType: 'download_attempt',
                payload: { token: tokenRef(token), slug, result: 'not_found' },
            });
            res.status(404).json({ error: 'Invalid or unrecognised link' });
            return;
        }
        const purchase = found.rows[0];
        if (purchase.token_used) {
            await (0, paymentLog_service_1.logPaymentEvent)({
                purchaseId: purchase.id,
                phoneNumber: purchase.phone_number,
                eventType: 'download_attempt',
                payload: { token: tokenRef(token), result: 'already_used' },
            });
            res.status(410).json({ error: 'This download link has already been used' });
            return;
        }
        if (new Date() > new Date(purchase.token_expires_at)) {
            await (0, paymentLog_service_1.logPaymentEvent)({
                purchaseId: purchase.id,
                phoneNumber: purchase.phone_number,
                eventType: 'download_attempt',
                payload: { token: tokenRef(token), result: 'expired' },
            });
            res.status(410).json({ error: 'This download link has expired' });
            return;
        }
        // Sign BEFORE burning the token: if signing fails, the buyer can retry
        // instead of being left with a used token and no file.
        const url = await (0, storage_service_1.getSignedDownloadUrl)(purchase.file_key, 120);
        // Atomic claim: only one request can flip token_used, even if two arrive
        // at once. COALESCE covers a NULL token_used on older rows.
        const claim = await (0, tenantDb_1.withTenant)(db_saas_1.default, tenantId, (c) => c.query(`UPDATE purchases
         SET token_used = TRUE, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
           AND COALESCE(token_used, FALSE) = FALSE
           AND token_expires_at > NOW()
         RETURNING id`, [purchase.id, tenantId]));
        if (!claim.rowCount) {
            await (0, paymentLog_service_1.logPaymentEvent)({
                purchaseId: purchase.id,
                phoneNumber: purchase.phone_number,
                eventType: 'download_attempt',
                payload: { token: tokenRef(token), result: 'lost_race' },
            });
            res.status(410).json({ error: 'This download link has already been used' });
            return;
        }
        await (0, paymentLog_service_1.logPaymentEvent)({
            purchaseId: purchase.id,
            phoneNumber: purchase.phone_number,
            eventType: 'download_attempt',
            payload: { token: tokenRef(token), result: 'success' },
        });
        res.redirect(url);
    }
    catch (err) {
        console.error('[saasDownload] error:', err);
        await (0, paymentLog_service_1.logPaymentEvent)({
            eventType: 'download_error',
            payload: { token: tokenRef(token), error: err instanceof Error ? err.message : String(err) },
        }).catch(() => undefined);
        res.status(500).json({ error: 'Something went wrong' });
    }
}
