"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadByToken = downloadByToken;
const db_1 = __importDefault(require("../config/db"));
const storage_service_1 = require("../services/storage.service");
const paymentLog_service_1 = require("../services/paymentLog.service");
// Known link-preview/crawler bots that pre-fetch URLs server-side
// (WhatsApp, Telegram, Facebook, Slack, etc.) before a human ever clicks.
// These must NOT be allowed to consume a single-use download token.
const BOT_USER_AGENT_PATTERN = /WhatsApp|facebookexternalhit|TelegramBot|Slackbot|Twitterbot|LinkedInBot|Discordbot|SkypeUriPreview|Google-InspectionTool/i;
// GET /api/download/:token
// Two layers of protection:
//   1. Known link-preview bots are detected by user-agent and never touch
//      token_used at all (they get a harmless HTML stub for their preview).
//   2. For everyone else, a short grace period after the first real hit
//      tolerates double-clicks, browser retries, or any bot that slips
//      past the user-agent filter, without leaving the link open forever.
async function downloadByToken(req, res) {
    const { token } = req.params;
    const userAgent = req.headers['user-agent'] || '';
    if (BOT_USER_AGENT_PATTERN.test(userAgent)) {
        // A link-preview bot is fetching this URL to generate a chat preview
        // card, not an actual customer. Return a harmless page WITHOUT
        // touching token_used, so the real click still works afterward.
        await (0, paymentLog_service_1.logPaymentEvent)({
            eventType: 'download_attempt',
            payload: { token, result: 'bot_preview_skipped', userAgent },
        });
        res
            .status(200)
            .set('Content-Type', 'text/html')
            .send('<html><head><title>Your exam paper</title></head><body></body></html>');
        return;
    }
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Fetching updated_at to track exactly when the token was first used,
        // so we can measure the grace window from that point.
        const { rows } = await client.query(`SELECT p.id, p.phone_number, p.token_expires_at, p.token_used, p.updated_at, pa.file_key
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
        // If already used, only hard-block once the grace period has elapsed.
        // This tolerates double-clicks, browser retries, or any bot that
        // slipped past the user-agent filter above.
        if (purchase.token_used) {
            const firstUsedTime = new Date(purchase.updated_at).getTime();
            const currentTime = new Date().getTime();
            const gracePeriodLimit = 2 * 60 * 1000; // 2 minutes in milliseconds
            if (currentTime - firstUsedTime > gracePeriodLimit) {
                await client.query('ROLLBACK');
                await (0, paymentLog_service_1.logPaymentEvent)({
                    purchaseId: purchase.id,
                    phoneNumber: purchase.phone_number,
                    eventType: 'download_attempt',
                    payload: { token, result: 'already_used_and_expired' },
                });
                res.status(410).json({ error: 'This download link has already been used' });
                return;
            }
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
        // Only flip token_used / updated_at on the FIRST hit, so we don't
        // keep resetting the grace window on every retry within it.
        if (!purchase.token_used) {
            await client.query(`UPDATE purchases SET token_used = TRUE, updated_at = NOW() WHERE id = $1`, [purchase.id]);
        }
        await client.query('COMMIT');
        await (0, paymentLog_service_1.logPaymentEvent)({
            purchaseId: purchase.id,
            phoneNumber: purchase.phone_number,
            eventType: 'download_attempt',
            payload: { token, result: purchase.token_used ? 'success_within_grace_window' : 'success' },
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
