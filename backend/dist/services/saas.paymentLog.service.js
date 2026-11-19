"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPaymentEvent = logPaymentEvent;
const db_saas_1 = __importDefault(require("../config/db.saas"));
async function logPaymentEvent({ tenantId, purchaseId = null, checkoutRequestId = null, phoneNumber = null, eventType, payload = null, }) {
    try {
        await db_saas_1.default.query(`INSERT INTO payment_events
         (tenant_id, purchase_id, checkout_request_id, phone_number, event_type, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            tenantId,
            purchaseId,
            checkoutRequestId,
            phoneNumber,
            eventType,
            payload ? JSON.stringify(payload) : null,
        ]);
    }
    catch (err) {
        // Never let logging failure break the payment flow
        console.error('[saasPaymentLog] Failed to log event:', eventType, err);
    }
}
