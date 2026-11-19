import pool from '../config/db.saas';

interface LogEventParams {
  tenantId: number;
  purchaseId?: number | null;
  checkoutRequestId?: string | null;
  phoneNumber?: string | null;
  eventType: string;
  payload?: unknown;
}

export async function logPaymentEvent({
  tenantId,
  purchaseId = null,
  checkoutRequestId = null,
  phoneNumber = null,
  eventType,
  payload = null,
}: LogEventParams): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO payment_events
         (tenant_id, purchase_id, checkout_request_id, phone_number, event_type, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tenantId,
        purchaseId,
        checkoutRequestId,
        phoneNumber,
        eventType,
        payload ? JSON.stringify(payload) : null,
      ]
    );
  } catch (err) {
    // Never let logging failure break the payment flow
    console.error('[saasPaymentLog] Failed to log event:', eventType, err);
  }
}