import { Request, Response } from 'express';
import pool from '../config/db';
import { triggerStkPush } from '../services/mpesa.service';

// POST /api/purchases  { paper_id, phone, email? }
export async function createPurchase(req: Request, res: Response): Promise<void> {
  try {
    const { paper_id, phone, email } = req.body;
    if (!paper_id || !phone) {
      res.status(400).json({ error: 'paper_id and phone are required' });
      return;
    }

    const { rows: paperRows } = await pool.query(
      `SELECT id, title, price FROM papers WHERE id = $1 AND active = TRUE`,
      [paper_id]
    );
    if (paperRows.length === 0) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }
    const paper = paperRows[0];

    const { rows: purchaseRows } = await pool.query(
      `INSERT INTO purchases (paper_id, phone_number, email, amount, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      [paper.id, phone, email || null, paper.price]
    );
    const purchaseId = purchaseRows[0].id;

    try {
      const stkResponse = await triggerStkPush({
        phone,
        amount: paper.price,
        purchaseId,
        paperTitle: paper.title,
      });

      await pool.query(
        `UPDATE purchases SET checkout_request_id = $1, merchant_request_id = $2 WHERE id = $3`,
        [stkResponse.CheckoutRequestID, stkResponse.MerchantRequestID, purchaseId]
      );

      res.status(202).json({
        purchase_id: purchaseId,
        message: 'STK push sent. Check your phone to complete payment.',
      });
    } catch (err: unknown) {
      await pool.query(
        `UPDATE purchases SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [purchaseId]
      );
      const error = err as { response?: { data: unknown }; message: string };
      console.error('STK push failed:', error.response?.data || error.message);
      res.status(502).json({ error: 'Could not initiate M-Pesa payment. Try again.' });
    }
  } catch (err: unknown) {
    console.error('createPurchase failed:', err);
    res.status(500).json({ error: 'Could not process purchase. Try again.' });
  }
}

// GET /api/purchases/:id/status
export async function getPurchaseStatus(req: Request, res: Response): Promise<void> {
  const { rows } = await pool.query(
    `SELECT status, download_token, token_expires_at, token_used FROM purchases WHERE id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const p = rows[0];
  res.json({
    status: p.status,
    download_token: p.status === 'completed' && !p.token_used ? p.download_token : null,
  });
}