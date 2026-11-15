import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { Pool } from "pg";
import { formatPhone } from "../services/mpesa.service";
import { TENANT_MODE, signToken, requireAuth } from "../middleware/tenantAuth";

// Slugs that would collide with frontend routes or look official
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "www", "signin", "signup", "login", "logout",
  "register", "upload", "dashboard", "saas", "static", "assets", "images",
  "default", "support", "help", "billing", "pricing", "about", "contact",
]);

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const BCRYPT_ROUNDS = 12;
// Used to burn the same CPU time when the username does not exist,
// so response time doesn't reveal which usernames are registered.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

const str = (v: unknown) => (typeof v === "string" ? v : "");

// Same rule as SignUpPage's slug input
const normalizeSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");

export function createAuthRouter(pool: Pool) {
  const router = Router();

  // ===================================================================
  // POST /tenants/register   (SignUpPage)
  // multi : creates a new tenant + its owner user
  // single: first-run bootstrap only - creates the owner of the default
  //         tenant; afterwards registration is closed
  // ===================================================================
  router.post("/tenants/register", async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const storeName = str(body.storeName).trim();
    const slug = normalizeSlug(str(body.storeSlug));
    const username = str(body.username).trim().toLowerCase();
    const password = str(body.password);
    const rawPhone = str(body.phone).trim();

    if (!storeName || !slug || !username || !rawPhone || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }
    if (storeName.length < 2 || storeName.length > 100) {
      return res.status(400).json({ error: "Store name must be 2-100 characters." });
    }
    if (slug.length < 3 || slug.length > 40) {
      return res.status(400).json({ error: "Store URL link must be 3-40 characters." });
    }
    if (RESERVED_SLUGS.has(slug)) {
      return res.status(409).json({ error: "That store link is reserved. Try another." });
    }
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: "Username must be 3-30 characters: letters, numbers, _ . - only.",
      });
    }
    // Keep in sync with the frontend (currently 6). bcrypt ignores bytes past 72.
    if (password.length < 6 || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: "Password must be 6-72 characters." });
    }

    let phone: string;
    try {
      phone = formatPhone(rawPhone);
      if (!phone) throw new Error("empty");
    } catch {
      return res.status(400).json({ error: "Enter a valid Kenyan phone number." });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      let tenant: { id: number; slug: string; store_name: string };

      if (TENANT_MODE === "single") {
        const def = await client.query(
          `SELECT id FROM public.tenants WHERE is_default FOR UPDATE`
        );
        const hasOwner = def.rowCount
          ? await client.query(`SELECT 1 FROM public.users WHERE tenant_id = $1 LIMIT 1`, [
              def.rows[0].id,
            ])
          : null;
        if (!def.rowCount || (hasOwner && hasOwner.rowCount)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ error: "Registration is closed on this site." });
        }
        const upd = await client.query(
          `UPDATE public.tenants
              SET store_name = $2, slug = $3, phone_number = $4,
                  status = 'active', updated_at = now()
            WHERE id = $1
        RETURNING id, slug, store_name`,
          [def.rows[0].id, storeName, slug, phone]
        );
        tenant = upd.rows[0];
      } else {
        const ins = await client.query(
          `INSERT INTO public.tenants
                  (store_name, slug, phone_number, status, setup_fee_paid, mpesa_status)
           VALUES ($1, $2, $3, 'active', false, 'unconfigured')
        RETURNING id, slug, store_name`,
          [storeName, slug, phone]
        );
        tenant = ins.rows[0];
      }

      const userRes = await client.query(
        `INSERT INTO public.users (tenant_id, username, password_hash, phone_number, role)
         VALUES ($1, $2, $3, $4, 'owner')
      RETURNING id, username, role`,
        [tenant.id, username, passwordHash, phone]
      );
      const user = userRes.rows[0];

      await client.query("COMMIT");

      const token = signToken({
        userId: user.id,
        tenantId: tenant.id,
        role: user.role,
        slug: tenant.slug,
      });

      return res.status(201).json({
        token,
        user: { id: user.id, username: user.username, role: user.role },
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          storeName: tenant.store_name,
          setupFeePaid: false,
          mpesaStatus: "unconfigured",
        },
      });
    } catch (err: any) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      if (err.code === "23505") {
        const c = String(err.constraint || "");
        if (c.includes("slug")) {
          return res.status(409).json({ error: "That store link is already taken." });
        }
        if (c.includes("username")) {
          return res.status(409).json({ error: "That username is already taken." });
        }
        return res
          .status(409)
          .json({ error: "Username or store link is already taken." });
      }
      // Log the message only - never req.body (it contains the password)
      console.error("register failed:", err.message);
      return res.status(500).json({ error: "Failed to register storefront." });
    } finally {
      client.release();
    }
  });

  // ===================================================================
  // POST /tenants/login   (SignInPage)
  // ===================================================================
  router.post("/tenants/login", async (req: Request, res: Response) => {
    const username = str(req.body?.username).trim().toLowerCase();
    const password = str(req.body?.password);

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    try {
      const r = await pool.query(
        `SELECT u.id, u.tenant_id, u.username, u.password_hash, u.role,
                u.status AS user_status,
                (u.locked_until IS NOT NULL AND u.locked_until > now()) AS is_locked,
                t.slug, t.store_name, t.status AS tenant_status,
                t.setup_fee_paid, t.subscription_ends_at, t.mpesa_status
           FROM public.users u
           JOIN public.tenants t ON t.id = u.tenant_id
          WHERE lower(u.username) = $1`,
        [username]
      );
      const u = r.rows[0];

      if (u?.is_locked) {
        return res.status(429).json({
          error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`,
        });
      }

      // Always run bcrypt so timing doesn't reveal whether the user exists
      const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);

      if (!u || !ok) {
        if (u) {
          await pool.query(
            `UPDATE public.users
                SET failed_login_attempts = CASE WHEN failed_login_attempts + 1 >= $2
                                                 THEN 0 ELSE failed_login_attempts + 1 END,
                    locked_until = CASE WHEN failed_login_attempts + 1 >= $2
                                        THEN now() + make_interval(mins => $3)
                                        ELSE locked_until END
              WHERE id = $1`,
            [u.id, MAX_FAILED_ATTEMPTS, LOCK_MINUTES]
          );
        }
        return res.status(401).json({ error: "Invalid username or password." });
      }

      if (u.user_status !== "active") {
        return res.status(403).json({ error: "This account has been disabled." });
      }
      if (u.tenant_status !== "active") {
        return res.status(403).json({ error: "This store is suspended. Contact support." });
      }

      await pool.query(
        `UPDATE public.users
            SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now()
          WHERE id = $1`,
        [u.id]
      );

      const token = signToken({
        userId: u.id,
        tenantId: u.tenant_id,
        role: u.role,
        slug: u.slug,
      });

      const endsAt: Date | null = u.subscription_ends_at;
      return res.json({
        token,
        user: { id: u.id, username: u.username, role: u.role },
        tenant: {
          id: u.tenant_id,
          slug: u.slug,
          storeName: u.store_name,
          setupFeePaid: u.setup_fee_paid,
          mpesaStatus: u.mpesa_status,
          subscriptionEndsAt: endsAt,
          subscriptionActive: !!endsAt && new Date(endsAt) > new Date(),
        },
      });
    } catch (err: any) {
      console.error("login failed:", err.message);
      return res.status(500).json({ error: "Unable to sign in. Please try again." });
    }
  });

  // ===================================================================
  // GET /tenants/me   (refresh dashboard state after login)
  // ===================================================================
  router.get("/tenants/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const r = await pool.query(
        `SELECT u.id, u.username, u.role,
                t.id AS tenant_id, t.slug, t.store_name, t.setup_fee_paid,
                t.subscription_ends_at, t.mpesa_status
           FROM public.users u
           JOIN public.tenants t ON t.id = u.tenant_id
          WHERE u.id = $1 AND u.tenant_id = $2 AND u.status = 'active'`,
        [req.auth!.userId, req.auth!.tenantId]
      );
      const row = r.rows[0];
      if (!row) return res.status(401).json({ error: "Please sign in again." });

      const endsAt: Date | null = row.subscription_ends_at;
      return res.json({
        user: { id: row.id, username: row.username, role: row.role },
        tenant: {
          id: row.tenant_id,
          slug: row.slug,
          storeName: row.store_name,
          setupFeePaid: row.setup_fee_paid,
          mpesaStatus: row.mpesa_status,
          subscriptionEndsAt: endsAt,
          subscriptionActive: !!endsAt && new Date(endsAt) > new Date(),
        },
      });
    } catch (err: any) {
      console.error("me failed:", err.message);
      return res.status(500).json({ error: "Could not load account." });
    }
  });

  return router;
}