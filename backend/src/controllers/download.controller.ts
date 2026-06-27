import { Request, Response } from 'express';
import pool from '../config/db';
import { getSignedDownloadUrl } from '../services/storage.service';

// GET /api/download/:token
// Validates the token is unexpired and unused, then redirects to a
// short-lived signed R2 URL. Marks the token used so it can't be replayed.
export async function downloadByToken(req: Request, res: Response): Promise<void> {
  const { token } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT p.id, p.token_expires_at, p.token_used, pa.file_key
       FROM purchases p
       JOIN papers pa ON pa.id = p.paper_id
       WHERE p.download_token = $1 AND p.status = 'completed'
       FOR UPDATE`,
      [token]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Invalid or unrecognised link' });
      return;
    }

    const purchase = rows[0];

    if (purchase.token_used) {
      await client.query('ROLLBACK');
      res.status(410).json({ error: 'This download link has already been used' });
      return;
    }

    if (new Date() > new Date(purchase.token_expires_at)) {
      await client.query('ROLLBACK');
      res.status(410).json({ error: 'This download link has expired' });
      return;
    }

    await client.query(
      `UPDATE purchases SET token_used = TRUE, updated_at = NOW() WHERE id = $1`,
      [purchase.id]
    );
    await client.query('COMMIT');

    const url = await getSignedDownloadUrl(purchase.file_key, 120);
    res.redirect(url);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Download error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    client.release();
  }
}