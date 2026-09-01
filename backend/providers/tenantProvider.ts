// providers/tenantProvider.ts
//
// Two interchangeable strategies for resolving "which tenant is this request for?"
//   - MultiTenantProvider: looks up the tenant by the incoming domain (Host header).
//     Used when many clients share one deployment (e.g. Vercel + Render).
//   - SingleTenantProvider: always returns the one tenant configured via TENANT_ID.
//     Used when a client has their own dedicated deployment (e.g. cPanel).
//
// Application code never talks to these classes directly — it goes through
// tenantMiddleware, which picks the right one based on DEPLOYMENT_MODE and
// attaches the resolved tenant to req.tenant. Routes/services only ever read
// req.tenant — they don't know or care which provider produced it.

import { Pool } from 'pg';
import { Request } from 'express';

const CACHE_TTL_MS = 5 * 60_000; // 5 minutes

export interface Tenant {
  id: number;
  domain: string;
  business_name: string;
  logo_url: string | null;
  primary_color: string;
  show_whatsapp_banner: boolean;
  whatsapp_groups: { label: string; url: string }[];
  show_footer: boolean;
  facebook_url: string | null;
  footer_extra_link_label: string | null;
  footer_extra_link_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantProvider {
  resolve(req: Request): Promise<Tenant | null>;
}

interface CacheEntry {
  data: Tenant;
  expires: number;
}

export class MultiTenantProvider implements TenantProvider {
  private cache = new Map<string, CacheEntry>();

  constructor(private pool: Pool) {}

  async resolve(req: Request): Promise<Tenant | null> {
    const host = req.headers.host?.replace(/^www\./, '');
    if (!host) return null;

    const cached = this.cache.get(host);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const result = await this.pool.query<Tenant>(
      'SELECT * FROM tenants WHERE domain = $1 AND is_active = true',
      [host]
    );
    const tenant = result.rows[0] ?? null;

    if (tenant) {
      this.cache.set(host, { data: tenant, expires: Date.now() + CACHE_TTL_MS });
    }
    return tenant;
  }
}

export class SingleTenantProvider implements TenantProvider {
  private tenantId: string | undefined;
  private cached: Tenant | null = null;

  constructor(private pool: Pool) {
    this.tenantId = process.env.TENANT_ID;
  }

  async resolve(_req: Request): Promise<Tenant | null> {
    if (!this.tenantId) {
      throw new Error('SingleTenantProvider requires TENANT_ID to be set in the environment.');
    }

    if (this.cached) return this.cached;

    const result = await this.pool.query<Tenant>(
      'SELECT * FROM tenants WHERE id = $1 AND is_active = true',
      [this.tenantId]
    );
    this.cached = result.rows[0] ?? null;
    return this.cached;
  }
}

/**
 * Factory — chooses the provider based on DEPLOYMENT_MODE.
 *   DEPLOYMENT_MODE=multi  -> MultiTenantProvider  (shared Vercel+Render deployment)
 *   DEPLOYMENT_MODE=single -> SingleTenantProvider  (dedicated cPanel deployment)
 * Defaults to 'single' if unset, since that's the safer fallback for an
 * unconfigured environment (fails loudly if TENANT_ID is also missing,
 * rather than silently trying to serve arbitrary domains).
 */
export function createTenantProvider(pool: Pool): TenantProvider {
  const mode = process.env.DEPLOYMENT_MODE ?? 'single';
  return mode === 'multi'
    ? new MultiTenantProvider(pool)
    : new SingleTenantProvider(pool);
}