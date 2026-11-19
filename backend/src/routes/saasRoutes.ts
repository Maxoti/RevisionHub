import crypto from "crypto";
import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { encryptSecret, decryptSecret } from "../utils/vaultCrypto";
import {
  formatPhone,
  triggerRawBuyGoodsStkPush,
  DarajaCredentials,
} from "../services/mpesa.service";
import { requireAuth, requireRole } from "../middleware/tenantAuth";
import { withTenant } from "../utils/tenantDb";
import { createPurchase, getPurchaseStatus, mpesaCallback } from "../controllers/saas.purchase.controller";
import { downloadByToken } from "../controllers/saas.download.controller";
import { getSales } from "../controllers/saas.sales.controller";

// ---------------------------------------------------------------------
// Config (fail fast: no silent fallback secrets)
// ---------------------------------------------------------------------
function requireEnv(name: string, minLen = 1): string {
  const v = process.env[name];
  if (!v || v.length < minLen) {
    throw new Error(`${name} must be set${minLen > 1 ? ` (${minLen}+ characters)` : ""}.`);
  }
  return v;
}

const SUPER_ADMIN_SECRET = requireEnv("SUPER_ADMIN_SECRET", 16);
const CALLBACK_SECRET = requireEnv("PLATFORM_CALLBACK_SECRET", 24);
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || "https://edusynchub.co.ke";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
]);

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------
const str = (v: unknown) => (typeof v === "string" ? v : "");
const opt = (v: unknown, max: number): string | null => {
  const s = str(v).trim().slice(0, max);
  return s || null;
};
const safeEqual = (a: string, b: string) => {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
const toId = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

type Seller = Record<string, any>;
const tenantOf = (res: Response) => res.locals.tenant as Seller;

export function createSaasRouter(pool: Pool) {
  const router = Router();

  const getPlatformCredentials = (): DarajaCredentials => ({
    consumerKey: process.env.PLATFORM_MPESA_CONSUMER_KEY!,
    consumerSecret: process.env.PLATFORM_MPESA_CONSUMER_SECRET!,
    passkey: process.env.PLATFORM_MPESA_PASSKEY!,
    businessShortCode: process.env.PLATFORM_MPESA_STORE_NUMBER!,
    tillNumber: process.env.PLATFORM_MPESA_TILL_NUMBER!,
  });

  // ===================================================================
  // GUARDS
  // ===================================================================
  const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    const secret = str(req.headers["x-admin-secret"]);
    if (!secret || !safeEqual(secret, SUPER_ADMIN_SECRET)) {
      return res.status(401).json({ error: "Unauthorized Super-Admin access." });
    }
    next();
  };

  // After requireAuth: re-check the user and tenant in the DB on every
  // request, so disabled users / suspended stores lose access immediately
  // instead of when the JWT expires.
  const loadSeller = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await pool.query(
        `SELECT t.id, t.slug, t.store_name, t.phone_number, t.whatsapp_number,
                t.setup_fee_paid, t.subscription_ends_at, t.status, t.mpesa_status,
                t.till_number, t.store_number,
                u.username, u.role
           FROM public.users u
           JOIN public.tenants t ON t.id = u.tenant_id
          WHERE u.id = $1 AND u.tenant_id = $2 AND u.status = 'active'`,
        [req.auth!.userId, req.auth!.tenantId]
      );
      const t = r.rows[0];
      if (!t) return res.status(401).json({ error: "Please sign in again." });
      if (t.status === "suspended") {
        return res
          .status(403)
          .json({ error: "Account suspended. Contact EdusyncHub support." });
      }
      res.locals.tenant = t;
      next();
    } catch (err: any) {
      console.error("[loadSeller]", err.message);
      res.status(500).json({ error: "Could not verify your account." });
    }
  };

  const seller: RequestHandler[] = [requireAuth, loadSeller];

  // NOTE: /tenants/register, /tenants/login and /tenants/me live in authRoutes.ts

  // ===================================================================
  // 1. SELLER DASHBOARD & PAPER MANAGEMENT (saas-upload.html)
  // ===================================================================
  router.get("/tenants/papers", ...seller, async (_req: Request, res: Response) => {
    try {
      const t = tenantOf(res);
      const papers = await withTenant(pool, t.id, (c) =>
        c.query(
          `SELECT id, title, subject, curriculum, grade, exam_type, term, year,
                  price, is_bundle, created_at
             FROM public.papers
            WHERE tenant_id = $1 AND active = true
            ORDER BY created_at DESC`,
          [t.id]
        )
      );
      res.json({ tenant: t, papers: papers.rows });
    } catch (err: any) {
      console.error("[tenants/papers]", err.message);
      res.status(500).json({ error: "Failed to load seller dashboard." });
    }
  });
router.get("/store/:slug/papers", async (req: Request, res: Response) => {
  try {
    const slug = str(req.params.slug).toLowerCase().slice(0, 60);
    const tr = await pool.query(
      `SELECT id, store_name, slug, setup_fee_paid, mpesa_status, status,
      whatsapp_number, phone_number
         FROM public.tenants WHERE slug = $1`,
      [slug]
    );
    const t = tr.rows[0];
    if (!t || t.status === "suspended") {
      return res.status(404).json({ error: "Store not found." });
    }

    const where = ["tenant_id = $1", "active = true"];
    const args: unknown[] = [t.id];
    const add = (col: string, v: unknown) => {
      const s = str(v).trim();
      if (s) { args.push(s); where.push(`${col} = $${args.length}`); }
    };
    add("curriculum", req.query.curriculum);
    add("grade", req.query.grade);
    add("exam_type", req.query.type);
    add("term", req.query.term);
    const y = Number(req.query.year);
    if (Number.isInteger(y) && y > 1990) { args.push(y); where.push(`year = $${args.length}`); }

    const papers = await withTenant(pool, t.id, (c) =>
      c.query(
        `SELECT id, title, subject, curriculum, grade, exam_type, term, year, price, is_bundle
           FROM public.papers
          WHERE ${where.join(" AND ")}
          ORDER BY created_at DESC
          LIMIT 500`,
        args
      )
    );
        const wa = formatPhone(String(t.whatsapp_number || t.phone_number || ""));

    res.json({
      store: {
        name: t.store_name,
        slug: t.slug,
        whatsapp: /^254\d{9}$/.test(wa) ? wa : null,
      },
      purchasable: t.setup_fee_paid === true && t.mpesa_status === "active",
      papers: papers.rows,
    });

  } catch (err: any) {
    console.error("[store/papers]", err.message);
    res.status(500).json({ error: "Could not load papers." });
  }
});
  router.post(
    "/tenants/upload-url",
    ...seller,
    requireRole("owner", "admin"),
    async (req: Request, res: Response) => {
      try {
        const t = tenantOf(res);

        if (
          t.setup_fee_paid &&
          t.subscription_ends_at &&
          new Date(t.subscription_ends_at) < new Date()
        ) {
          return res.status(403).json({
            error: "Subscription expired. Renew for KES 300 to upload new papers.",
          });
        }

        const contentType = str(req.body?.contentType) || "application/pdf";
        if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
          return res.status(400).json({ error: "Unsupported file type." });
        }

        const safeFile =
          str(req.body?.fileName || "paper.pdf")
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .slice(0, 100) || "paper.pdf";
        const folderCurr =
          str(req.body?.curriculum || "general")
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "")
            .slice(0, 20) || "general";
        const yearNum = Number(req.body?.year);
        const folderYear =
          Number.isInteger(yearNum) && yearNum > 1990 && yearNum < 2100
            ? yearNum
            : new Date().getFullYear();

        const fileKey = `tenants/${t.id}/${folderYear}/${folderCurr}/${Date.now()}-${safeFile}`;

        const command = new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: fileKey,
          ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });
        res.json({ uploadUrl, fileKey });
      } catch (err: any) {
        console.error("[tenants/upload-url]", err.message);
        res.status(500).json({ error: "Could not generate upload URL." });
      }
    }
  );

  router.post(
    "/tenants/papers/save",
    ...seller,
    requireRole("owner", "admin"),
    async (req: Request, res: Response) => {
      try {
        const t = tenantOf(res);
        const b = req.body ?? {};

        const title = opt(b.title, 255);
        const fileKey = str(b.fileKey);
        if (!title || !fileKey) {
          return res.status(400).json({ error: "Title and uploaded fileKey are required." });
        }

        // SECURITY: a seller may only attach files uploaded under their own prefix.
        // Without this, one store could register another store's file_key and sell it.
        if (
          !fileKey.startsWith(`tenants/${t.id}/`) ||
          fileKey.includes("..") ||
          fileKey.length > 255
        ) {
          return res.status(400).json({ error: "Invalid file reference." });
        }

        const price = Math.round(Number(b.price) || 50);
        if (price < 1 || price > 150000) {
          return res.status(400).json({ error: "Price must be between KES 1 and 150,000." });
        }

        const result = await withTenant(pool, t.id, (c) =>
          c.query(
            `INSERT INTO public.papers
               (tenant_id, title, subject, curriculum, grade, exam_type, term, year,
                price, is_bundle, file_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id, title`,
            [
              t.id,
              title,
              opt(b.subject, 100),
              opt(b.curriculum, 20),
              opt(b.grade, 50),
              opt(b.examType, 50),
              opt(b.term, 20),
              Number(b.year) || new Date().getFullYear(),
              price,
              Boolean(b.isBundle),
              fileKey,
            ]
          )
        );

        res.status(201).json({ paper: result.rows[0] });
      } catch (err: any) {
        console.error("[tenants/papers/save]", err.message);
        res.status(500).json({ error: "Failed to save paper record." });
      }
    }
  );

  router.delete(
    "/tenants/papers/:paperId",
    ...seller,
    requireRole("owner", "admin"),
    async (req: Request, res: Response) => {
      try {
        const t = tenantOf(res);
        const paperId = toId(req.params.paperId);
        if (!paperId) return res.status(400).json({ error: "Invalid paper id." });

        const r = await withTenant(pool, t.id, (c) =>
          c.query(
            `UPDATE public.papers SET active = false
              WHERE id = $1 AND tenant_id = $2 AND active = true`,
            [paperId, t.id]
          )
        );
        if (!r.rowCount) return res.status(404).json({ error: "Paper not found." });

        res.json({ message: "Paper deleted." });
      } catch (err: any) {
        console.error("[tenants/papers/delete]", err.message);
        res.status(500).json({ error: "Failed to delete paper." });
      }
    }
  );
    // Edit a paper's details (not its file). Same auth + tenant scoping as delete.
  router.patch(
    "/tenants/papers/:paperId",
    ...seller,
    requireRole("owner", "admin"),
    async (req: Request, res: Response) => {
      try {
        const t = tenantOf(res);
        const paperId = toId(req.params.paperId);
        if (!paperId) return res.status(400).json({ error: "Invalid paper id." });

        const b = req.body ?? {};
        const clean = (v: unknown) => String(v ?? "").trim();
        const sets: string[] = [];
        const vals: unknown[] = [];
        const add = (col: string, v: unknown) => {
          vals.push(v);
          sets.push(`${col} = $${vals.length}`);
        };

        if (b.title !== undefined) {
          const title = clean(b.title);
          if (!title || title.length > 200) {
            return res.status(400).json({ error: "Title is required (max 200 characters)." });
          }
          add("title", title);
        }

        if (b.price !== undefined) {
          const price = Number(b.price);
          if (!Number.isInteger(price) || price < 1 || price > 150000) {
            return res.status(400).json({ error: "Price must be between KES 1 and 150,000." });
          }
          add("price", price);
        }

        if (b.year !== undefined && b.year !== null && b.year !== "") {
          const year = Number(b.year);
          if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: "Enter a valid year." });
          }
          add("year", year);
        }

        // Text fields: update only when a value is sent. Empty means "leave as is".
        const textFields: [string, unknown, number][] = [
          ["subject", b.subject, 100],
          ["grade", b.grade, 60],
          ["exam_type", b.examType, 80],
          ["term", b.term, 20],
        ];
        for (const [col, raw, max] of textFields) {
          const v = clean(raw);
          if (!v) continue;
          if (v.length > max) {
            return res.status(400).json({ error: `${col} is too long.` });
          }
          add(col, v);
        }

        if (!sets.length) return res.status(400).json({ error: "Nothing to update." });

        vals.push(paperId, t.id);
        const r = await withTenant(pool, t.id, (c) =>
          c.query(
            `UPDATE public.papers SET ${sets.join(", ")}
              WHERE id = $${vals.length - 1} AND tenant_id = $${vals.length} AND active = true
              RETURNING id, title, subject, grade, exam_type, term, year, price`,
            vals
          )
        );
        if (!r.rowCount) return res.status(404).json({ error: "Paper not found." });

        res.json({ message: "Paper updated.", paper: r.rows[0] });
      } catch (err: any) {
        console.error("[tenants/papers/patch]", err.message);
        res.status(500).json({ error: "Failed to update paper." });
      }
    }
  );

  // ===================================================================
  // 2. MONTHLY RENEWAL STK PUSH (KES 300 via Platform Buy Goods Till)
  // ===================================================================
  router.post(
    "/tenants/billing/renewal-stk",
    ...seller,
    requireRole("owner"),
    async (req: Request, res: Response) => {
      try {
        const t = tenantOf(res);

        if (!t.setup_fee_paid) {
          return res.status(400).json({
            error:
              "Complete your one-time KES 4,000 onboarding via 0729871381 first before monthly renewals.",
          });
        }

        const phone = formatPhone(str(req.body?.phone) || t.phone_number || "");
        if (!/^254[17]\d{8}$/.test(phone)) {
          return res.status(400).json({ error: "Enter a valid Kenyan phone number." });
        }

        // The secret in the path proves the callback came from our own STK request
        const callbackUrl = `${API_PUBLIC_URL}/api/mpesa/platform-callback/${CALLBACK_SECRET}`;

        const stk = await triggerRawBuyGoodsStkPush({
          creds: getPlatformCredentials(),
          phone,
          amount: 300,
          accountReference: `EDU-${t.slug}`,
          transactionDesc: "Edusync 300 Monthly",
          callbackUrl,
        });

        await pool.query(
          `INSERT INTO public.platform_payments
             (tenant_id, payment_type, phone_number, amount, checkout_request_id)
           VALUES ($1, 'renewal_300', $2, 300, $3)`,
          [t.id, phone, stk.CheckoutRequestID]
        );

        res.json({ checkoutRequestId: stk.CheckoutRequestID, amount: 300 });
      } catch (err: any) {
        console.error("[tenants/billing/renewal-stk]", err.response?.data || err.message);
        res.status(500).json({
          error: err.response?.data?.errorMessage || "KES 300 STK Push failed.",
        });
      }
    }
  );

  // ===================================================================
  // 3. PLATFORM BILLING CALLBACK (public endpoint, called by Safaricom)
  // ===================================================================
   router.post("/mpesa/platform-callback/:key", async (req: Request, res: Response) => {
    if (!safeEqual(str(req.params.key), CALLBACK_SECRET)) {
      return res.status(403).json({ ResultCode: 1, ResultDesc: "Forbidden" });
    }

    const ack = (desc = "Accepted") =>
      res.status(200).json({ ResultCode: 0, ResultDesc: desc });

    const cb = req.body?.Body?.stkCallback;
    if (!cb?.CheckoutRequestID) return ack();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // FOR UPDATE: two simultaneous callbacks must not both extend the subscription
      const p = await client.query(
        `SELECT * FROM public.platform_payments
          WHERE checkout_request_id = $1 FOR UPDATE`,
        [cb.CheckoutRequestID]
      );
      const payment = p.rows[0];

      if (!payment || payment.status === "completed") {
        await client.query("ROLLBACK");
        return ack("Already processed");
      }

      if (cb.ResultCode === 0) {
        const items: { Name: string; Value: unknown }[] = cb.CallbackMetadata?.Item || [];
        const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
        const paid = Number(items.find((i) => i.Name === "Amount")?.Value);

        if (paid !== Number(payment.amount)) {
          await client.query("ROLLBACK");
          console.error("[platform-callback] amount mismatch", {
            checkout: cb.CheckoutRequestID,
            expected: payment.amount,
            paid,
          });
          return ack();
        }

        await client.query(
          `UPDATE public.platform_payments
              SET status = 'completed', mpesa_receipt = $1, updated_at = NOW()
            WHERE id = $2`,
          [receipt ? String(receipt) : null, payment.id]
        );
        await client.query(
          `UPDATE public.tenants
              SET status = CASE WHEN status = 'suspended' THEN status ELSE 'active' END,
                  subscription_ends_at =
                    GREATEST(COALESCE(subscription_ends_at, NOW()), NOW()) + INTERVAL '30 days',
                  updated_at = NOW()
            WHERE id = $1`,
          [payment.tenant_id]
        );
      } else {
        // Log Safaricom's reason so failed payments can be diagnosed
        console.error(
          "[platform-callback] failed",
          JSON.stringify({
            code: cb.ResultCode,
            desc: cb.ResultDesc,
            id: cb.CheckoutRequestID,
          })
        );
        await client.query(
          `UPDATE public.platform_payments
              SET status = 'failed', updated_at = NOW()
            WHERE id = $1`,
          [payment.id]
        );
      }

      await client.query("COMMIT");
      return ack("Callback received");
    } catch (err: any) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      console.error("[mpesa/platform-callback]", err.message);
      return ack("Handled");
    } finally {
      client.release();
    }
  });

  // ===================================================================
  // 4. SUPER-ADMIN VAULT: LIST ALL TENANTS
  // ===================================================================
  router.get("/vault/tenants", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT t.id, o.username, t.store_name, t.slug, t.phone_number, t.whatsapp_number,
                t.setup_fee_paid, t.subscription_ends_at, t.status, t.mpesa_status,
                t.till_number, t.store_number, t.created_at
           FROM public.tenants t
           LEFT JOIN LATERAL (
                SELECT username FROM public.users
                 WHERE tenant_id = t.id AND role = 'owner'
                 ORDER BY id LIMIT 1
           ) o ON true
          ORDER BY CASE WHEN t.mpesa_status = 'pending_setup' THEN 0 ELSE 1 END,
                   t.created_at DESC`
      );
      res.json({ tenants: result.rows });
    } catch (err: any) {
      console.error("[vault/tenants]", err.message);
      res.status(500).json({ error: "Failed to load tenants." });
    }
  });

  // ===================================================================
  // 5. SUPER-ADMIN VAULT: ENCRYPT DARAJA KEYS & ACTIVATE STORE (after KES 2,550)
  // ===================================================================
  router.post(
    "/vault/activate/:tenantId",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const tenantId = toId(req.params.tenantId);
        if (!tenantId) return res.status(400).json({ error: "Invalid tenant id." });

        const { tillNumber, storeNumber, consumerKey, consumerSecret, passkey } =
          req.body ?? {};

        const existing = await pool.query(
          `SELECT encrypted_consumer_key, encrypted_consumer_secret, encrypted_passkey
             FROM public.tenants WHERE id = $1`,
          [tenantId]
        );
        const tenant = existing.rows[0];
        if (!tenant) return res.status(404).json({ error: "Tenant not found." });

        const encKey = consumerKey
          ? encryptSecret(String(consumerKey).trim())
          : tenant.encrypted_consumer_key;
        const encSecret = consumerSecret
          ? encryptSecret(String(consumerSecret).trim())
          : tenant.encrypted_consumer_secret;
        const encPasskey = passkey
          ? encryptSecret(String(passkey).trim())
          : tenant.encrypted_passkey;

        if (!encKey || !encSecret || !encPasskey) {
          return res.status(400).json({
            error: "Consumer Key, Consumer Secret, and Passkey are required.",
          });
        }

        await pool.query(
          `UPDATE public.tenants
              SET till_number = COALESCE(NULLIF($1, ''), till_number),
                  store_number = COALESCE(NULLIF($2, ''), store_number),
                  encrypted_consumer_key = $3,
                  encrypted_consumer_secret = $4,
                  encrypted_passkey = $5,
                  setup_fee_paid = true,
                  mpesa_status = 'active',
                  status = 'active',
                  subscription_ends_at = COALESCE(subscription_ends_at, NOW() + INTERVAL '30 days'),
                  updated_at = NOW()
            WHERE id = $6`,
          [
            tillNumber ? String(tillNumber).trim() : "",
            storeNumber ? String(storeNumber).trim() : "",
            encKey,
            encSecret,
            encPasskey,
            tenantId,
          ]
        );

        res.json({ message: "Credentials encrypted (AES-256) and storefront activated." });
      } catch (err: any) {
        console.error("[vault/activate]", err.message);
        res.status(500).json({ error: "Failed to encrypt and save credentials." });
      }
    }
  );

  // ===================================================================
  // 6. SUPER-ADMIN VAULT: TEST KES 1 STK PUSH FOR A TENANT TILL
  // ===================================================================
  router.post(
    "/vault/test-stk/:tenantId",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const tenantId = toId(req.params.tenantId);
        if (!tenantId) return res.status(400).json({ error: "Invalid tenant id." });

        const phone = formatPhone(str(req.body?.phone));
        if (!/^254[17]\d{8}$/.test(phone)) {
          return res.status(400).json({ error: "Enter a valid Kenyan phone number." });
        }

        const result = await pool.query(`SELECT * FROM public.tenants WHERE id = $1`, [
          tenantId,
        ]);
        const tenant = result.rows[0];
        if (!tenant) return res.status(404).json({ error: "Tenant not found." });

        if (
          !tenant.encrypted_consumer_key ||
          !tenant.encrypted_consumer_secret ||
          !tenant.encrypted_passkey
        ) {
          return res
            .status(400)
            .json({ error: "Save & encrypt Daraja keys before running a test STK." });
        }

        const tenantCreds: DarajaCredentials = {
          consumerKey: decryptSecret(tenant.encrypted_consumer_key),
          consumerSecret: decryptSecret(tenant.encrypted_consumer_secret),
          passkey: decryptSecret(tenant.encrypted_passkey),
          businessShortCode: tenant.store_number,
          tillNumber: tenant.till_number,
        };

               const stk = await triggerRawBuyGoodsStkPush({
          creds: tenantCreds,
          phone,
          amount: 1,
          accountReference: `TEST-${tenant.slug}`,
          transactionDesc: "Till Verification",
          callbackUrl: `${API_PUBLIC_URL}/api/mpesa/callback/${CALLBACK_SECRET}/${tenantId}`,
        });

        console.log("[vault/test-stk] daraja:", JSON.stringify(stk));

        if (String((stk as any).ResponseCode) !== "0") {
          return res.status(502).json({
            error: (stk as any).ResponseDescription || "Daraja did not accept the request.",
          });
        }

        res.json({
          message: "Test KES 1 STK Push sent!",
          checkoutRequestId: stk.CheckoutRequestID,
        });
      } catch (err: any) {
        console.error("[vault/test-stk]", err.response?.data || err.message);
        res.status(500).json({
          error: err.response?.data?.errorMessage || "Test STK failed. Check Daraja keys.",
        });
      }
    }
  );

  // ===================================================================
  // 7. SUPER-ADMIN VAULT: MANUAL +30 DAYS EXTENSION
  // ===================================================================
  router.post(
    "/vault/extend/:tenantId",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const tenantId = toId(req.params.tenantId);
        if (!tenantId) return res.status(400).json({ error: "Invalid tenant id." });

        const r = await pool.query(
          `UPDATE public.tenants
              SET status = 'active',
                  subscription_ends_at =
                    GREATEST(COALESCE(subscription_ends_at, NOW()), NOW()) + INTERVAL '30 days',
                  updated_at = NOW()
            WHERE id = $1`,
          [tenantId]
        );
        if (!r.rowCount) return res.status(404).json({ error: "Tenant not found." });

        res.json({ message: "Subscription extended by 30 days." });
      } catch (err: any) {
        console.error("[vault/extend]", err.message);
        res.status(500).json({ error: "Failed to extend subscription." });
      }
    }
  );

  // ===================================================================
  // 8. SUPER-ADMIN VAULT: TOGGLE SUSPEND / ACTIVE
  // ===================================================================
  router.post(
    "/vault/suspend/:tenantId",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const tenantId = toId(req.params.tenantId);
        if (!tenantId) return res.status(400).json({ error: "Invalid tenant id." });

        const r = await pool.query(
          `UPDATE public.tenants
              SET status = CASE WHEN status = 'suspended' THEN 'active' ELSE 'suspended' END,
                  updated_at = NOW()
            WHERE id = $1`,
          [tenantId]
        );
        if (!r.rowCount) return res.status(404).json({ error: "Tenant not found." });

        res.json({ message: "Store status toggled." });
      } catch (err: any) {
        console.error("[vault/suspend]", err.message);
        res.status(500).json({ error: "Failed to toggle store status." });
      }
    }
  );

  // ===================================================================
  // 9. SUPER-ADMIN VAULT: RESET A USER'S PASSWORD + CLEAR LOCKOUT
  //    (new: login now locks accounts after 5 failed attempts)
  // ===================================================================
  router.post(
    "/vault/users/:userId/reset-password",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = toId(req.params.userId);
        if (!userId) return res.status(400).json({ error: "Invalid user id." });

        const newPassword = str(req.body?.newPassword);
        if (newPassword.length < 8 || Buffer.byteLength(newPassword) > 72) {
          return res.status(400).json({ error: "Password must be 8-72 characters." });
        }

        const hash = await bcrypt.hash(newPassword, 12);
        const r = await pool.query(
          `UPDATE public.users
              SET password_hash = $1, failed_login_attempts = 0,
                  locked_until = NULL, updated_at = now()
            WHERE id = $2
        RETURNING username`,
          [hash, userId]
        );
        if (!r.rowCount) return res.status(404).json({ error: "User not found." });

        res.json({ message: `Password reset for ${r.rows[0].username}.` });
      } catch (err: any) {
        console.error("[vault/reset-password]", err.message);
        res.status(500).json({ error: "Failed to reset password." });
      }
    }
  );


  // ===================================================================
  // 10. BUYER PURCHASE FLOW + SELLER SALES
  // ===================================================================
  router.post("/purchases", createPurchase);
  router.get("/purchases/:id/status", getPurchaseStatus);
  router.post("/mpesa/callback/:key/:tenantId", mpesaCallback);
  router.get("/store/:slug/download/:token", downloadByToken);
  router.get("/tenants/sales", ...seller, getSales);

  return router;
}
