"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPhone = formatPhone;
exports.triggerStkPush = triggerStkPush;
exports.handleStkCallback = handleStkCallback;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = __importDefault(require("../config/db"));
const storage_service_1 = require("./storage.service");
const notifications_service_1 = require("./notifications.service");
const paymentLog_service_1 = require("./paymentLog.service");
const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_ENV, MPESA_CALLBACK_URL, MPESA_TILL_NUMBER, } = process.env;
const IS_PRODUCTION = MPESA_ENV === 'production';
const BASE_URL = IS_PRODUCTION
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
// Buy Goods Till that receives the money. Falls back to William's Till.
const TILL_NUMBER = MPESA_TILL_NUMBER || '1574886';
// ─────────────────────────────────────────────────────────────────────────
// Config check — fails with a clear message instead of a vague 400.
// Only names are reported, never values.
// ─────────────────────────────────────────────────────────────────────────
function assertConfig() {
    const required = {
        MPESA_CONSUMER_KEY,
        MPESA_CONSUMER_SECRET,
        MPESA_SHORTCODE,
        MPESA_PASSKEY,
        MPESA_CALLBACK_URL,
    };
    const missing = Object.entries(required)
        .filter(([, v]) => !v || !v.trim())
        .map(([k]) => k);
    if (missing.length > 0) {
        throw new Error(`M-Pesa config missing: ${missing.join(', ')}`);
    }
    if (IS_PRODUCTION && /mpesa|safaricom/i.test(MPESA_CALLBACK_URL)) {
        // Live Daraja is known to reject callback URLs containing certain words.
        console.warn('[mpesa config] MPESA_CALLBACK_URL contains "mpesa" or "safaricom". ' +
            'Live Daraja may reject it. Consider a neutral path such as /api/payments/callback.');
    }
}
// ─────────────────────────────────────────────────────────────────────────
// Access token
// ─────────────────────────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;
async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt)
        return cachedToken;
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    try {
        const { data } = await axios_1.default.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` }, timeout: 8000 });
        cachedToken = data.access_token;
        tokenExpiresAt = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000;
        return cachedToken;
    }
    catch (err) {
        cachedToken = null;
        tokenExpiresAt = 0;
        if (axios_1.default.isAxiosError(err)) {
            // No keys or secrets are logged here.
            console.error('[getAccessToken] failed:', err.response?.status, JSON.stringify(err.response?.data), 'BASE_URL:', BASE_URL);
        }
        else {
            console.error('[getAccessToken] failed:', err);
        }
        throw err;
    }
}
// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────
// Daraja expects Nairobi time (UTC+3). Using UTC+3 explicitly means the
// timestamp is correct even if the hosting server runs in UTC.
function timestampNow() {
    const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return (d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()));
}
function formatPhone(phone) {
    let p = phone.replace(/[\s-]/g, '');
    if (p.startsWith('+'))
        p = p.slice(1);
    if (p.startsWith('0'))
        p = '254' + p.slice(1);
    if (p.startsWith('7') || p.startsWith('1'))
        p = '254' + p;
    return p;
}
// ─────────────────────────────────────────────────────────────────────────
// STK push
// ─────────────────────────────────────────────────────────────────────────
async function triggerStkPush({ phone, amount, purchaseId, paperTitle, }) {
    assertConfig();
    const formattedPhone = formatPhone(phone);
    if (!/^254[17]\d{8}$/.test(formattedPhone)) {
        throw new Error('Invalid phone number format');
    }
    // Token failures are logged to payment_events too, so they are no longer
    // invisible. (Before, only the push request itself was logged.)
    let token;
    try {
        token = await getAccessToken();
    }
    catch (err) {
        (0, paymentLog_service_1.logPaymentEvent)({
            purchaseId,
            phoneNumber: phone,
            eventType: 'token_error',
            payload: axios_1.default.isAxiosError(err)
                ? { status: err.response?.status, data: err.response?.data ?? err.message }
                : { message: err instanceof Error ? err.message : String(err) },
        }).catch((logErr) => console.error('[logPaymentEvent token_error]', logErr));
        throw err;
    }
    const timestamp = timestampNow();
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
    const requestBody = {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerBuyGoodsOnline',
        Amount: amount,
        PartyA: formattedPhone,
        PartyB: 1574886,
        PhoneNumber: formattedPhone,
        CallBackURL: MPESA_CALLBACK_URL,
        AccountReference: `PUR${purchaseId}`,
        TransactionDesc: paperTitle.slice(0, 13),
    };
    // The Password field is base64 of shortcode + passkey + timestamp, so it
    // can be decoded to reveal the passkey. Never store it.
    (0, paymentLog_service_1.logPaymentEvent)({
        purchaseId,
        phoneNumber: phone,
        eventType: 'stk_request',
        payload: { ...requestBody, Password: '[redacted]', CallBackURL: '[redacted]' },
    }).catch((err) => console.error('[logPaymentEvent stk_request]', err));
    try {
        const { data } = await axios_1.default.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, requestBody, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
        (0, paymentLog_service_1.logPaymentEvent)({
            purchaseId,
            checkoutRequestId: data.CheckoutRequestID,
            phoneNumber: phone,
            eventType: 'stk_response',
            payload: data,
        }).catch((err) => console.error('[logPaymentEvent stk_response]', err));
        return data;
    }
    catch (err) {
        const detail = axios_1.default.isAxiosError(err)
            ? { status: err.response?.status, data: err.response?.data ?? err.message }
            : { message: err instanceof Error ? err.message : String(err) };
        // Visible in the server error log, not just the database.
        console.error('[triggerStkPush] failed:', JSON.stringify(detail));
        (0, paymentLog_service_1.logPaymentEvent)({
            purchaseId,
            phoneNumber: phone,
            eventType: 'stk_error',
            payload: detail,
        }).catch((logErr) => console.error('[logPaymentEvent stk_error]', logErr));
        throw err;
    }
}
// ─────────────────────────────────────────────────────────────────────────
// Callback handling
// ─────────────────────────────────────────────────────────────────────────
async function handleStkCallback(callbackBody) {
    const body = callbackBody;
    const stkCallback = body?.Body?.stkCallback;
    // Log the raw callback unconditionally, before any validation.
    await (0, paymentLog_service_1.logPaymentEvent)({
        checkoutRequestId: stkCallback?.CheckoutRequestID || null,
        eventType: 'callback_received',
        payload: callbackBody,
    });
    if (!stkCallback)
        throw new Error('Malformed STK callback payload');
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    const client = await db_1.default.connect();
    // Set only when this callback completed a purchase; used after the
    // transaction is committed to send the download link.
    let completed = null;
    let committed = false;
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT pu.*, pa.title AS paper_title, pa.file_key
       FROM purchases pu
       JOIN papers pa ON pa.id = pu.paper_id
       WHERE pu.checkout_request_id = $1 FOR UPDATE OF pu`, [CheckoutRequestID]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            committed = true; // transaction is closed
            await (0, paymentLog_service_1.logPaymentEvent)({
                checkoutRequestId: CheckoutRequestID,
                eventType: 'callback_error',
                payload: { reason: 'Unknown CheckoutRequestID', ResultCode },
            });
            console.warn('Callback for unknown CheckoutRequestID:', CheckoutRequestID);
            return;
        }
        const purchase = rows[0];
        if (purchase.status === 'completed') {
            await client.query('ROLLBACK');
            committed = true;
            await (0, paymentLog_service_1.logPaymentEvent)({
                purchaseId: purchase.id,
                checkoutRequestId: CheckoutRequestID,
                phoneNumber: purchase.phone_number,
                eventType: 'callback_duplicate',
                payload: { ResultCode },
            });
            return; // Already processed (retry)
        }
        if (ResultCode !== 0) {
            await client.query(`UPDATE purchases SET status = 'failed', updated_at = NOW() WHERE id = $1`, [purchase.id]);
            await client.query('COMMIT');
            committed = true;
            await (0, paymentLog_service_1.logPaymentEvent)({
                purchaseId: purchase.id,
                checkoutRequestId: CheckoutRequestID,
                phoneNumber: purchase.phone_number,
                eventType: 'callback_failed',
                payload: { ResultCode, ResultDesc },
            });
            return;
        }
        const items = CallbackMetadata?.Item || [];
        const receipt = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;
        const paid = Number(items.find((i) => i.Name === 'Amount')?.Value);
        // A success callback must carry a receipt and the right amount. If not,
        // do not release the paper. (Protects against forged callbacks.)
        if (!receipt || !Number.isFinite(paid) || paid < purchase.amount) {
            await client.query(`UPDATE purchases SET status = 'failed', updated_at = NOW() WHERE id = $1`, [purchase.id]);
            await client.query('COMMIT');
            committed = true;
            await (0, paymentLog_service_1.logPaymentEvent)({
                purchaseId: purchase.id,
                checkoutRequestId: CheckoutRequestID,
                phoneNumber: purchase.phone_number,
                eventType: 'callback_amount_mismatch',
                payload: {
                    expected: purchase.amount,
                    paid: Number.isFinite(paid) ? paid : null,
                    hasReceipt: Boolean(receipt),
                },
            });
            return;
        }
        const downloadToken = crypto_1.default.randomBytes(24).toString('hex');
        const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await client.query(`UPDATE purchases
       SET status = 'completed',
           mpesa_receipt = $1,
           download_token = $2,
           token_expires_at = $3,
           updated_at = NOW()
       WHERE id = $4`, [receipt, downloadToken, tokenExpiresAt, purchase.id]);
        await client.query('COMMIT');
        committed = true;
        await (0, paymentLog_service_1.logPaymentEvent)({
            purchaseId: purchase.id,
            checkoutRequestId: CheckoutRequestID,
            phoneNumber: purchase.phone_number,
            eventType: 'callback_processed',
            payload: { receipt, ResultCode },
        });
        completed = {
            phone: purchase.phone_number,
            email: purchase.email || null,
            paperTitle: purchase.paper_title,
            fileKey: purchase.file_key,
        };
    }
    catch (err) {
        if (!committed) {
            try {
                await client.query('ROLLBACK');
            }
            catch (rollbackErr) {
                console.error('[handleStkCallback] rollback failed:', rollbackErr);
            }
        }
        await (0, paymentLog_service_1.logPaymentEvent)({
            checkoutRequestId: CheckoutRequestID,
            eventType: 'callback_error',
            payload: { error: err instanceof Error ? err.message : String(err) },
        }).catch((logErr) => console.error('[logPaymentEvent callback_error]', logErr));
        throw err;
    }
    finally {
        client.release();
    }
    // ── Notifications run after the transaction is closed. A failure here
    // must not look like a payment failure: the purchase is already paid. ──
    if (completed) {
        try {
            const signedUrl = await (0, storage_service_1.getSignedDownloadUrl)(completed.fileKey, 24 * 60 * 60);
            await (0, notifications_service_1.notifyBuyer)({
                phone: completed.phone,
                email: completed.email,
                paperTitle: completed.paperTitle,
                downloadUrl: signedUrl,
            });
        }
        catch (notifyErr) {
            console.error('[handleStkCallback] notification failed:', notifyErr);
        }
    }
}
