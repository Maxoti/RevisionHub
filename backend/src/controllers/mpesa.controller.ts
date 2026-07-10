import { Request, Response } from 'express';
import { handleStkCallback } from '../services/mpesa.service';

// POST /api/mpesa/callback — Safaricom hits this after the STK push resolves.
// Always return 200 quickly; Safaricom retries aggressively on non-200s,
// and we don't want retries piling up because of a slow response.
export async function mpesaCallback(req: Request, res: Response): Promise<void> {
  console.log('=== MPESA CALLBACK RECEIVED ===', JSON.stringify(req.body));
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    await handleStkCallback(req.body);
  } catch (err) {
    console.error('Failed to process M-Pesa callback:', err);
  }
}