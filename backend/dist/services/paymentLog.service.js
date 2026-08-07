"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPaymentEvent = logPaymentEvent;
const db_1 = __importDefault(require("../config/db"));
async function logPaymentEvent({ purchaseId = null, checkoutRequestId = null, phoneNumber = null, eventType, payload = null, }) {
    try {
        await db_1.default.query(`INSERT INTO payment_events (purchase_id, checkout_request_id, phone_number, event_type, payload)
       VALUES ($1, $2, $3, $4, $5)`, [purchaseId, checkoutRequestId, phoneNumber, eventType, payload ? JSON.stringify(payload) : null]);
    }
    catch (err) {
        // Never let logging failure break the payment flow
        console.error('[paymentLog] Failed to log event:', eventType, err);
    }
}
