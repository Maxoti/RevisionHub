import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";

// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------
export type TenantMode = "single" | "multi";

function readTenantMode(): TenantMode {
  const m = process.env.TENANT_MODE;
  if (m !== "single" && m !== "multi") {
    // Fail fast: a missing flag must never silently open registration.
    throw new Error('TENANT_MODE must be set to "single" or "multi".');
  }
  return m;
}
export const TENANT_MODE: TenantMode = readTenantMode();

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET must be set (32+ characters).");
  }
  return s;
}
// Validate at startup, not on first request
getJwtSecret();

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------
export type Role = "owner" | "admin" | "staff";

export interface AuthPayload {
  userId: number;
  tenantId: number;
  role: Role;
  slug: string;
}

export interface TenantContext {
  id: number;
  slug: string;
  storeName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      tenant?: TenantContext;
    }
  }
}

// ---------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------
export function signToken(p: AuthPayload): string {
  return jwt.sign(
    { tid: p.tenantId, role: p.role, slug: p.slug },
    getJwtSecret(),
    {
      subject: String(p.userId),
      expiresIn: (process.env.JWT_EXPIRES_IN || "12h") as jwt.SignOptions["expiresIn"],
    }
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Please sign in." });
  }
  try {
    const d = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    req.auth = {
      userId: Number(d.sub),
      tenantId: Number(d.tid),
      role: d.role as Role,
      slug: String(d.slug),
    };
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "You do not have permission to do that." });
    }
    next();
  };
}

// ---------------------------------------------------------------------
// Tenant resolution for PUBLIC storefront routes (papers, checkout, OTP)
//   single mode: always the default tenant
//   multi mode : x-tenant-slug header -> {slug}.ROOT_DOMAIN -> custom domain
// ---------------------------------------------------------------------
const cache = new Map<string, { t: TenantContext | null; exp: number }>();
const TTL_MS = 60_000;

export function resolveTenant(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let key: string;
      let sql: string;
      let params: string[];

      if (TENANT_MODE === "single") {
        key = "__default__";
        sql = `SELECT id, slug, store_name, status FROM public.tenants WHERE is_default`;
        params = [];
      } else {
        const host = (req.headers.host || "").split(":")[0].toLowerCase();
        const root = (process.env.ROOT_DOMAIN || "").toLowerCase();
        const headerSlug = String(req.headers["x-tenant-slug"] || "")
          .toLowerCase()
          .trim();

        if (headerSlug) {
          key = `slug:${headerSlug}`;
          sql = `SELECT id, slug, store_name, status FROM public.tenants WHERE slug = $1`;
          params = [headerSlug];
        } else if (root && host.endsWith(`.${root}`)) {
          const sub = host.slice(0, -(root.length + 1));
          key = `slug:${sub}`;
          sql = `SELECT id, slug, store_name, status FROM public.tenants WHERE slug = $1`;
          params = [sub];
        } else {
          key = `host:${host}`;
          sql = `SELECT id, slug, store_name, status FROM public.tenants WHERE custom_domain = $1`;
          params = [host];
        }
      }

      const hit = cache.get(key);
      let tenant: TenantContext | null;
      if (hit && hit.exp > Date.now()) {
        tenant = hit.t;
      } else {
        const r = await pool.query(sql, params);
        const row = r.rows[0];
        tenant =
          row && row.status === "active"
            ? { id: row.id, slug: row.slug, storeName: row.store_name }
            : null;
        if (row && row.status !== "active") {
          return res.status(403).json({ error: "This store is not available." });
        }
        cache.set(key, { t: tenant, exp: Date.now() + TTL_MS });
      }

      if (!tenant) {
        return res.status(404).json({ error: "Store not found." });
      }
      req.tenant = tenant;
      next();
    } catch (err: any) {
      console.error("resolveTenant failed:", err.message);
      res.status(500).json({ error: "Could not resolve store." });
    }
  };
}