"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadByToken = downloadByToken;
const db_1 = __importDefault(require("../config/db"));
const storage_service_1 = require("../services/storage.service");
const paymentLog_service_1 = require("../services/paymentLog.service");
// GET /api/download/:token
// Validates the token is unexpired and unused, then redirects to a
// short-lived signed R2 URL. Marks the token used so it can't be replayed.
async function downloadByToken(req, res) {
    const { token } = req.params;
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT p.id, p.phone_number, p.token_expires_at, p.token_used, pa.file_key
       FROM purchases p
       JOIN papers pa ON pa.id = p.paper_id
       WHERE p.download_token = $1 AND p.status = 'completed'
       FOR UPDATE OF p`, [token]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            await (0, paymentLog_service_1.logPaymentEvent)({
                eventType: 'download_attempt',
                payload: { token, result: 'not_found' },
            });
            res.status(404).json({ error: 'Invalid or unrecognised link' });
            return;
        }
        const purchase = rows[0];
        if (purchase.token_used) {
            await client.query('ROLLBACK');
            await (0, paymentLog_service_1.logPaymentEvent)({
                purchaseId: purchase.id,
                phoneNumber: purchase.phone_number,
                eventType: 'download_attempt',
                payload: { token, result: 'already_used' },
            });
            res.status(410).json({ error: 'This download link has already been used' });
            return;
        }
        if (new Date() > new Date(purchase.token_expires_at)) {
            await client.query('ROLLBACK');
            await (0, paymentLog_service_1.logPaymentEvent)({
                purchaseId: purchase.id,
                phoneNumber: purchase.phone_number,
                eventType: 'download_attempt',
                payload: { token, result: 'expired' },
            });
            res.status(410).json({ error: 'This download link has expired' });
            return;
        }
        await client.query(`UPDATE purchases SET token_used = TRUE, updated_at = NOW() WHERE id = $1`, [purchase.id]);
        await client.query('COMMIT');
        await (0, paymentLog_service_1.logPaymentEvent)({
            purchaseId: purchase.id,
            phoneNumber: purchase.phone_number,
            eventType: 'download_attempt',
            payload: { token, result: 'success' },
        });
        const url = await (0, storage_service_1.getSignedDownloadUrl)(purchase.file_key, 120);
        res.redirect(url);
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Download error:', err);
        await (0, paymentLog_service_1.logPaymentEvent)({
            eventType: 'download_error',
            payload: { token, error: err instanceof Error ? err.message : String(err) },
        });
        res.status(500).json({ error: 'Something went wrong' });
    }
    finally {
        client.release();
    }
}
