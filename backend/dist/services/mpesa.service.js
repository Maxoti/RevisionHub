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
const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_ENV, MPESA_CALLBACK_URL, } = process.env;
const BASE_URL = MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
let cachedToken = null;
let tokenExpiresAt = 0;
async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt)
        return cachedToken;
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    const { data } = await axios_1.default.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` }, timeout: 8000 });
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000;
    return cachedToken;
}
function timestampNow() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds()));
}
function formatPhone(phone) {
    let p = phone.replace(/\s+/g, '');
    if (p.startsWith('0'))
        p = '254' + p.slice(1);
    if (p.startsWith('+'))
        p = p.slice(1);
    if (p.startsWith('7') || p.startsWith('1'))
        p = '254' + p;
    return p;
}
async function triggerStkPush({ phone, amount, purchaseId, paperTitle, }) {
    const token = await getAccessToken();
    const timestamp = timestampNow();
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
    const requestBody = {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerBuyGoodsOnline',
        Amount: amount,
        PartyA: formatPhone(phone),
        PartyB: '4968315',
        PhoneNumber: formatPhone(phone),
        CallBackURL: MPESA_CALLBACK_URL,
        AccountReference: `PUR${purchaseId}`,
        TransactionDesc: paperTitle.slice(0, 13),
    };
    // Fire-and-forget: don't block the STK push on this write.
    (0, paymentLog_service_1.logPaymentEvent)({
        purchaseId,
        phoneNumber: phone,
        eventType: 'stk_request',
        payload: requestBody,
    }).catch((err) => console.error('[logPaymentEvent stk_request]', err));
    try {
        const { data } = await axios_1.default.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, requestBody, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
        // Fire-and-forget here too — response already returned by Safaricom,
        // no reason to make the caller wait on a log write.
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
        const error = err;
        // This one's arguably worth awaiting since we're already in the error
        // path and about to throw — but even here it's not strictly required.
        (0, paymentLog_service_1.logPaymentEvent)({
            purchaseId,
            phoneNumber: phone,
            eventType: 'stk_error',
            payload: error.response?.data || { message: error.message },
        }).catch((logErr) => console.error('[logPaymentEvent stk_error]', logErr));
        throw err;
    }
}
async function handleStkCallback(callbackBody) {
    const body = callbackBody;
    const stkCallback = body?.Body?.stkCallback;
    // Log the raw callback unconditionally, before any validation —
    // guarantees we never lose evidence of what Safaricom actually sent.
    await (0, paymentLog_service_1.logPaymentEvent)({
        checkoutRequestId: stkCallback?.CheckoutRequestID || null,
        eventType: 'callback_received',
        payload: callbackBody,
    });
    if (!stkCallback)
        throw new Error('Malformed STK callback payload');
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT pu.*, pa.title AS paper_title, pa.file_key
       FROM purchases pu
       JOIN papers pa ON pa.id = pu.paper_id
       WHERE pu.checkout_request_id = $1 FOR UPDATE OF pu`, [CheckoutRequestID]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
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
            await (0, paymentLog_service_1.logPaymentEvent)({
                purchaseId: purchase.id,
                checkoutRequestId: CheckoutRequestID,
                phoneNumber: purchase.phone_number,
                eventType: 'callback_duplicate',
                payload: { ResultCode },
            });
            return; // Already processed — Safaricom retry
        }
        if (ResultCode !== 0) {
            await client.query(`UPDATE purchases SET status = 'failed', updated_at = NOW() WHERE id = $1`, [purchase.id]);
            await client.query('COMMIT');
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
        await (0, paymentLog_service_1.logPaymentEvent)({
            purchaseId: purchase.id,
            checkoutRequestId: CheckoutRequestID,
            phoneNumber: purchase.phone_number,
            eventType: 'callback_processed',
            payload: { receipt, ResultCode },
        });
        // ── Fire notifications outside the transaction ──────────────────
        const signedUrl = await (0, storage_service_1.getSignedDownloadUrl)(purchase.file_key, 24 * 60 * 60);
        (0, notifications_service_1.notifyBuyer)({
            phone: purchase.phone_number,
            email: purchase.email || null,
            paperTitle: purchase.paper_title,
            downloadUrl: signedUrl,
        }).catch((err) => console.error('[notifyBuyer unexpected]', err));
    }
    catch (err) {
        await client.query('ROLLBACK');
        await (0, paymentLog_service_1.logPaymentEvent)({
            checkoutRequestId: CheckoutRequestID,
            eventType: 'callback_error',
            payload: { error: err instanceof Error ? err.message : String(err) },
        });
        throw err;
    }
    finally {
        client.release();
    }
}
