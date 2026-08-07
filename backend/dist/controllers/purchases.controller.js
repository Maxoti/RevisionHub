"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPurchase = createPurchase;
exports.getPurchaseStatus = getPurchaseStatus;
const db_1 = __importDefault(require("../config/db"));
const mpesa_service_1 = require("../services/mpesa.service");
const DUPLICATE_PUSH_WINDOW_SECONDS = 90;
// POST /api/purchases  { paper_id, phone, email? }
//
// Design note: we deliberately respond to the client as soon as we have a
// purchase_id, BEFORE calling Safaricom. The STK push + its DB update happen
// asynchronously afterward. This decouples "did the HTTP request survive"
// from "did the payment work" — the frontend drives everything else via
// polling GET /api/purchases/:id/status, which is resilient to slow upstream
// responses, gateway timeouts, and cold starts.
async function createPurchase(req, res) {
    const { paper_id, phone, email } = req.body;
    if (!paper_id || !phone) {
        res.status(400).json({ error: 'paper_id and phone are required' });
        return;
    }
    let paper;
    try {
        const { rows } = await db_1.default.query(`SELECT id, title, price FROM papers WHERE id = $1 AND active = TRUE`, [paper_id]);
        if (rows.length === 0) {
            res.status(404).json({ error: 'Paper not found' });
            return;
        }
        paper = rows[0];
    }
    catch (err) {
        console.error('[createPurchase] paper lookup failed:', err);
        res.status(500).json({ error: 'Could not process purchase. Try again.' });
        return;
    }
    // Guard against double-submission: if the user hit "Try Again" after a
    // slow/failed response, avoid firing a second STK push to the same phone
    // while one may still be open on Safaricom's side (which would otherwise
    // surface as a "Duplicated MSISDN" error).
    try {
        const { rows: pending } = await db_1.default.query(`SELECT id FROM purchases
       WHERE paper_id = $1 AND phone_number = $2 AND status = 'pending'
         AND created_at > NOW() - INTERVAL '${DUPLICATE_PUSH_WINDOW_SECONDS} seconds'
       ORDER BY created_at DESC LIMIT 1`, [paper.id, phone]);
        if (pending.length > 0) {
            res.status(202).json({
                purchase_id: pending[0].id,
                message: 'Payment already in progress. Check your phone.',
            });
            return;
        }
    }
    catch (err) {
        // Non-fatal — worst case we allow a duplicate push. Log and continue.
        console.error('[createPurchase] duplicate-check failed, continuing:', err);
    }
    let purchaseId;
    try {
        const { rows } = await db_1.default.query(`INSERT INTO purchases (paper_id, phone_number, email, amount, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`, [paper.id, phone, email || null, paper.price]);
        purchaseId = rows[0].id;
    }
    catch (err) {
        console.error('[createPurchase] insert failed:', err);
        res.status(500).json({ error: 'Could not process purchase. Try again.' });
        return;
    }
    // Respond immediately. Everything past this point is best-effort and must
    // never throw back into the request/response cycle — it's already closed.
    res.status(202).json({
        purchase_id: purchaseId,
        message: 'Processing your payment request.',
    });
    initiatePaymentAsync(purchaseId, phone, paper);
}
async function initiatePaymentAsync(purchaseId, phone, paper) {
    try {
        const stkResponse = await (0, mpesa_service_1.triggerStkPush)({
            phone,
            amount: paper.price,
            purchaseId,
            paperTitle: paper.title,
        });
        await db_1.default.query(`UPDATE purchases
       SET checkout_request_id = $1, merchant_request_id = $2, updated_at = NOW()
       WHERE id = $3`, [stkResponse.CheckoutRequestID, stkResponse.MerchantRequestID, purchaseId]);
    }
    catch (err) {
        const error = err;
        console.error('[initiatePaymentAsync] STK push failed:', error.response?.data || error.message);
        await db_1.default
            .query(`UPDATE purchases SET status = 'failed', updated_at = NOW() WHERE id = $1`, [purchaseId])
            .catch((dbErr) => console.error('[initiatePaymentAsync] failed to mark purchase failed:', dbErr));
    }
}
// GET /api/purchases/:id/status
async function getPurchaseStatus(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid purchase id' });
        return;
    }
    try {
        const { rows } = await db_1.default.query(`SELECT status, download_token, token_expires_at, token_used
       FROM purchases WHERE id = $1`, [id]);
        if (rows.length === 0) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const p = rows[0];
        const tokenValid = p.status === 'completed' && !p.token_used && new Date(p.token_expires_at) > new Date();
        res.json({
            status: p.status,
            download_token: tokenValid ? p.download_token : null,
        });
    }
    catch (err) {
        console.error('[getPurchaseStatus] query failed:', err);
        res.status(500).json({ error: 'Could not fetch purchase status. Try again.' });
    }
}
