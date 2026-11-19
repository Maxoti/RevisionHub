import { Request, Response } from 'express';
import pool from '../config/db.saas';
import { getSignedDownloadUrl } from '../services/storage.service';
import { logPaymentEvent } from '../services/saas.paymentLog.service';
import { withTenant } from '../utils/tenantDb';

// ---------------------------------------------------------------------------
// ASSUMPTIONS TO VERIFY
//   purchases.tenant_id and papers.tenant_id exist
//   withTenant(pool, tenantId, (client) => client.query(...)) returns the
//   callback's result, as used in saasRoutes.ts
// ---------------------------------------------------------------------------

// Never write a live bearer token into the payment log; a short prefix is
// enough to correlate attempts.
function tokenRef(token: string): string {
  return token.slice(0, 8);
}

// GET /api/store/:slug/download/:token
//
// Checks that the token belongs to a COMPLETED purchase of the store in the
// URL and that the paper being delivered belongs to that same store, then
// claims the token and redirects to a short-lived signed R2 URL. The file
// streams from R2 directly, not through the Node app.
export async function downloadByToken(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug || '').toLowerCase().slice(0, 60);
  const token = String(req.params.token || '');

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (!slug || !token) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  // Declared outside try so the catch block can log against the tenant.
  let tenantId: number | undefined;

  try {
    const tr = await pool.query(`SELECT id FROM public.tenants WHERE slug = $1`, [slug]);
    tenantId = tr.rows[0]?.id;

    // Unknown slug: no tenant to attach a log row to (tenant_id is NOT NULL).
    if (!tenantId) {
      res.status(404).json({ error: 'Invalid or unrecognised link' });
      return;
    }
    const tid: number = tenantId;

    const found = await withTenant(pool, tid, (c) =>
      c.query(
        `SELECT p.id, p.phone_number, p.token_expires_at, p.token_used, pa.file_key
         FROM purchases p
         JOIN papers pa ON pa.id = p.paper_id AND pa.tenant_id = p.tenant_id
         WHERE p.download_token = $1
           AND p.status = 'completed'
           AND p.tenant_id = $2`,
        [token, tid]
      )
    );

    if (found.rows.length === 0) {
      await logPaymentEvent({
        tenantId: tid,
        eventType: 'download_attempt',
        payload: { token: tokenRef(token), slug, result: 'not_found' },
      });
      res.status(404).json({ error: 'Invalid or unrecognised link' });
      return;
    }

    const purchase = found.rows[0];

    if (purchase.token_used) {
      await logPaymentEvent({
        tenantId: tid,
        purchaseId: purchase.id,
        phoneNumber: purchase.phone_number,
        eventType: 'download_attempt',
        payload: { token: tokenRef(token), result: 'already_used' },
      });
      res.status(410).json({ error: 'This download link has already been used' });
      return;
    }

    if (new Date() > new Date(purchase.token_expires_at)) {
      await logPaymentEvent({
        tenantId: tid,
        purchaseId: purchase.id,
        phoneNumber: purchase.phone_number,
        eventType: 'download_attempt',
        payload: { token: tokenRef(token), result: 'expired' },
      });
      res.status(410).json({ error: 'This download link has expired' });
      return;
    }

    // Sign BEFORE burning the token: if signing fails, the buyer can retry
    // instead of being left with a used token and no file.
    const url = await getSignedDownloadUrl(purchase.file_key, 120);

    // Atomic claim: only one request can flip token_used, even if two arrive
    // at once. COALESCE covers a NULL token_used on older rows.
    const claim = await withTenant(pool, tid, (c) =>
      c.query(
        `UPDATE purchases
         SET token_used = TRUE, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
           AND COALESCE(token_used, FALSE) = FALSE
           AND token_expires_at > NOW()
         RETURNING id`,
        [purchase.id, tid]
      )
    );

    if (!claim.rowCount) {
      await logPaymentEvent({
        tenantId: tid,
        purchaseId: purchase.id,
        phoneNumber: purchase.phone_number,
        eventType: 'download_attempt',
        payload: { token: tokenRef(token), result: 'lost_race' },
      });
      res.status(410).json({ error: 'This download link has already been used' });
      return;
    }

    await logPaymentEvent({
      tenantId: tid,
      purchaseId: purchase.id,
      phoneNumber: purchase.phone_number,
      eventType: 'download_attempt',
      payload: { token: tokenRef(token), result: 'success' },
    });

    res.redirect(url);
  } catch (err) {
    console.error('[saasDownload] error:', err);
    if (tenantId) {
      await logPaymentEvent({
        tenantId,
        eventType: 'download_error',
        payload: {
          token: tokenRef(token),
          error: err instanceof Error ? err.message : String(err),
        },
      }).catch(() => undefined);
    }
    res.status(500).json({ error: 'Something went wrong' });
  }
}