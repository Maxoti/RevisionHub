// middleware/tenant.ts
//
// NOT YET WIRED INTO app.ts — this file is inert until you explicitly do:
//   import { tenantMiddleware } from './middleware/tenant';
//   app.use(tenantMiddleware(pool));
// in your real app.ts. Until then, it has zero effect on anything running.

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Pool } from 'pg';
import { createTenantProvider, Tenant } from '../Providers/tenantProvider';
// Augment Express's Request type so req.tenant is recognized everywhere
// without needing `as any` casts in your route handlers.
declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

/**
 * Returns an Express middleware that resolves the current request's tenant
 * and attaches it to req.tenant. Responds 404 if no matching tenant is found
 * (multi-tenant mode: unrecognized domain) or 500 if misconfigured
 * (single-tenant mode: missing TENANT_ID).
 */
export function tenantMiddleware(pool: Pool): RequestHandler {
  const provider = createTenantProvider(pool);

  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      const tenant = await provider.resolve(req);

      if (!tenant) {
        res.status(404).json({
          error: `No active tenant configured for this request (host: ${req.headers.host}).`,
        });
        return;
      }

      req.tenant = tenant;
      next();
    } catch (err) {
      console.error('[tenantMiddleware] Failed to resolve tenant:', (err as Error).message);
      res.status(500).json({ error: 'Tenant resolution failed.' });
    }
  };
}