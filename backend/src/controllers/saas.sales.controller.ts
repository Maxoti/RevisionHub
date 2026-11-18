import { Request, Response } from 'express';
import pool from '../config/db.saas';
import { withTenant } from '../utils/tenantDb';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Mount inside createSaasRouter (saasRoutes.ts), behind the seller guards:
//   router.get("/tenants/sales", ...seller, getSales);
// `seller` = [requireAuth, loadSeller]; loadSeller sets res.locals.tenant.
//
// ASSUMPTIONS TO VERIFY
//   purchases.tenant_id exists; purchases.created_at is TIMESTAMPTZ
//   (date filters use Africa/Nairobi days)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ALLOWED_STATUS = ['pending', 'completed', 'failed', 'all'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// GET /tenants/sales
//   ?status=completed|pending|failed|all   (default completed)
//   &phone=07XXXXXXXX
//   &checkout_request_id=ws_CO_...
//   &mpesa_receipt=QK...
//   &paper_id=12
//   &from=YYYY-MM-DD&to=YYYY-MM-DD        (inclusive, Nairobi days)
//   &limit=50&offset=0
//
// The seller sees ONLY purchases with their own tenant_id. The tenant id comes
// from the authenticated session (res.locals.tenant), never from the request.
export async function getSales(req: Request, res: Response): Promise<void> {
  const tenantId = Number((res.locals.tenant as { id?: number } | undefined)?.id);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    res.status(401).json({ error: 'Please sign in again.' });
    return;
  }

  const q = req.query;
  const status = String(q.status ?? 'completed');
  if (!(ALLOWED_STATUS as readonly string[]).includes(status)) {
    res.status(400).json({ error: 'status must be pending, completed, failed or all' });
    return;
  }

  const from = q.from ? String(q.from) : null;
  const to = q.to ? String(q.to) : null;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    res.status(400).json({ error: 'from/to must be YYYY-MM-DD' });
    return;
  }

  const limit = Math.min(Math.max(parseInt(String(q.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(parseInt(String(q.offset ?? 0), 10) || 0, 0);

  // Filters shared by the list and the summary (everything except status).
  const values: unknown[] = [tenantId];
  const where: string[] = ['pu.tenant_id = $1'];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    where.push(sql.replace('?', `$${values.length}`));
  };

  if (q.phone) add('pu.phone_number = ?', String(q.phone));
  if (q.checkout_request_id) add('pu.checkout_request_id = ?', String(q.checkout_request_id));
  if (q.mpesa_receipt) add('pu.mpesa_receipt = ?', String(q.mpesa_receipt));
  if (q.paper_id) {
    const paperId = Number(q.paper_id);
    if (!Number.isInteger(paperId)) {
      res.status(400).json({ error: 'paper_id must be a number' });
      return;
    }
    add('pu.paper_id = ?', paperId);
  }
  if (from) add(`(pu.created_at AT TIME ZONE 'Africa/Nairobi')::date >= ?::date`, from);
  if (to) add(`(pu.created_at AT TIME ZONE 'Africa/Nairobi')::date <= ?::date`, to);

  const baseWhere = where.join(' AND ');
  const baseValues = [...values];

  try {
    const { summary, sales } = await withTenant(pool, tenantId, async (c) => {
      // Summary ignores the status filter so revenue is always completed sales.
      const summaryRes = await c.query(
        `SELECT COUNT(*) FILTER (WHERE pu.status = 'completed')::int AS completed_count,
                COALESCE(SUM(pu.amount) FILTER (WHERE pu.status = 'completed'), 0) AS revenue,
                COUNT(*) FILTER (WHERE pu.status = 'pending')::int AS pending_count,
                COUNT(*) FILTER (WHERE pu.status = 'failed')::int AS failed_count
         FROM purchases pu
         WHERE ${baseWhere}`,
        baseValues
      );

      const listValues = [...baseValues];
      let listWhere = baseWhere;
      if (status !== 'all') {
        listValues.push(status);
        listWhere += ` AND pu.status = $${listValues.length}`;
      }
      listValues.push(limit, offset);

      // download_token is deliberately NOT selected: it is a buyer's bearer secret.
      const listRes = await c.query(
        `SELECT pu.id, pu.paper_id, pa.title AS paper_title, pu.phone_number, pu.email,
                pu.amount, pu.status, pu.mpesa_receipt, pu.checkout_request_id,
                pu.created_at, pu.updated_at,
                COUNT(*) OVER()::int AS total_count
         FROM purchases pu
         JOIN papers pa ON pa.id = pu.paper_id
         WHERE ${listWhere}
         ORDER BY pu.created_at DESC
         LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
        listValues
      );

      return { summary: summaryRes.rows[0], sales: listRes.rows };
    });

    res.json({
      summary,
      total: sales[0]?.total_count ?? 0,
      limit,
      offset,
      sales: sales.map(({ total_count, ...row }: Record<string, unknown>) => row),
    });
  } catch (err) {
    console.error('[getSales] query failed:', err);
    res.status(500).json({ error: 'Could not load sales. Try again.' });
  }
}