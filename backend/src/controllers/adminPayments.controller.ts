import { Request, Response } from 'express';
import pool from '../config/db';

// GET /api/admin/payment-history?phone=0729871381
// GET /api/admin/payment-history?checkout_request_id=ws_CO_...
export async function getPaymentHistory(req: Request, res: Response): Promise<void> {
  const { phone, checkout_request_id } = req.query;

  if (!phone && !checkout_request_id) {
    res.status(400).json({ error: 'Provide phone or checkout_request_id' });
    return;
  }

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (phone) {
    values.push(phone);
    conditions.push(`pe.phone_number = $${values.length}`);
  }
  if (checkout_request_id) {
    values.push(checkout_request_id);
    conditions.push(`pe.checkout_request_id = $${values.length}`);
  }

  const { rows: events } = await pool.query(
    `SELECT pe.id, pe.purchase_id, pe.checkout_request_id, pe.phone_number,
            pe.event_type, pe.payload, pe.created_at
     FROM payment_events pe
     WHERE ${conditions.join(' OR ')}
     ORDER BY pe.created_at DESC
     LIMIT 100`,
    values
  );

  const { rows: purchases } = await pool.query(
    `SELECT pu.id, pu.paper_id, pa.title AS paper_title, pu.phone_number, pu.email,
            pu.amount, pu.status, pu.mpesa_receipt, pu.checkout_request_id,
            pu.download_token, pu.token_used, pu.created_at, pu.updated_at
     FROM purchases pu
     JOIN papers pa ON pa.id = pu.paper_id
     WHERE ${phone ? 'pu.phone_number = $1' : 'pu.checkout_request_id = $1'}
     ORDER BY pu.created_at DESC`,
    [phone || checkout_request_id]
  );

  res.json({ purchases, events });
}