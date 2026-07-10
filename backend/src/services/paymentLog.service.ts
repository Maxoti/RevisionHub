import pool from '../config/db';

interface LogEventParams {
  purchaseId?: number | null;
  checkoutRequestId?: string | null;
  phoneNumber?: string | null;
  eventType: string;
  payload?: unknown;
}

export async function logPaymentEvent({
  purchaseId = null,
  checkoutRequestId = null,
  phoneNumber = null,
  eventType,
  payload = null,
}: LogEventParams): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO payment_events (purchase_id, checkout_request_id, phone_number, event_type, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [purchaseId, checkoutRequestId, phoneNumber, eventType, payload ? JSON.stringify(payload) : null]
    );
  } catch (err) {
    // Never let logging failure break the payment flow
    console.error('[paymentLog] Failed to log event:', eventType, err);
  }
}