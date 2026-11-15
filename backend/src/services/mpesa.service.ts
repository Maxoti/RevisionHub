import axios from 'axios';
import crypto from 'crypto';
import pool from '../config/db';
import { getSignedDownloadUrl } from './storage.service';
import { notifyBuyer } from './notifications.service';
import { logPaymentEvent } from './paymentLog.service';
import { decryptSecret } from '../utils/vaultCrypto';

const {
  APP_MODE,
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_TILL_NUMBER,
  MPESA_PASSKEY,
  MPESA_ENV,
  MPESA_CALLBACK_URL,
} = process.env;

const BASE_URL =
  MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// Cache OAuth tokens per consumerKey so multi-tenant sellers never collide
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(consumerKey: string, consumerSecret: string): Promise<string> {
  const cached = tokenCache.get(consumerKey);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const { data } = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` }, timeout: 8000 }
  );

  const expiresAt = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000;
  tokenCache.set(consumerKey, { token: data.access_token, expiresAt });
  return data.access_token;
}

function timestampNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

export function formatPhone(phone: string): string {
  let p = phone.replace(/\s+/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
  return p;
}

interface ResolvedMpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  shortCode: string;
  tillNumber: string;
  passkey: string;
}

async function resolveMpesaConfig(tenantId?: number | null): Promise<ResolvedMpesaConfig> {
  // 1. Premium Single-Tenant Mode (uses .env directly)
  if (APP_MODE !== 'saas' || !tenantId) {
    return {
      consumerKey: MPESA_CONSUMER_KEY!,
      consumerSecret: MPESA_CONSUMER_SECRET!,
      shortCode: MPESA_SHORTCODE!,
      tillNumber: MPESA_TILL_NUMBER || '1574886',
      passkey: MPESA_PASSKEY!,
    };
  }

  // 2. Multi-Tenant SaaS Mode (decrypts seller's AES-256 credentials from DB)
  const { rows } = await pool.query(
    `SELECT store_name, status, setup_fee_paid, mpesa_status, subscription_ends_at,
            till_number, store_number, encrypted_consumer_key, encrypted_consumer_secret, encrypted_passkey
     FROM public.tenants
     WHERE id = $1`,
    [tenantId]
  );

  const tenant = rows[0];
  if (!tenant) {
    throw new Error('Storefront not found.');
  }
  if (tenant.status === 'suspended' || !tenant.setup_fee_paid || tenant.mpesa_status !== 'active') {
    throw new Error('M-Pesa checkout is not yet activated for this store.');
  }
  if (tenant.subscription_ends_at && new Date(tenant.subscription_ends_at) < new Date()) {
    throw new Error('This store is temporarily unavailable. Please contact the store owner.');
  }
  if (!tenant.encrypted_consumer_key || !tenant.encrypted_consumer_secret || !tenant.encrypted_passkey) {
    throw new Error('Store M-Pesa credentials are incomplete.');
  }

  return {
    consumerKey: decryptSecret(tenant.encrypted_consumer_key),
    consumerSecret: decryptSecret(tenant.encrypted_consumer_secret),
    shortCode: tenant.store_number,
    tillNumber: tenant.till_number,
    passkey: decryptSecret(tenant.encrypted_passkey),
  };
}

interface StkPushParams {
  phone: string;
  amount: number;
  purchaseId: number;
  paperTitle: string;
  tenantId?: number | null; // Optional in single mode, required in SaaS mode
}

export async function triggerStkPush({
  phone,
  amount,
  purchaseId,
  paperTitle,
  tenantId,
}: StkPushParams): Promise<{ CheckoutRequestID: string; MerchantRequestID: string }> {
  const config = await resolveMpesaConfig(tenantId);
  const token = await getAccessToken(config.consumerKey, config.consumerSecret);
  const timestamp = timestampNow();
  const password = Buffer.from(
    `${config.shortCode}${config.passkey}${timestamp}`
  ).toString('base64');

  const requestBody = {
    BusinessShortCode: config.shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerBuyGoodsOnline',
    Amount: amount,
    PartyA: formatPhone(phone),
    PartyB: config.tillNumber,
    PhoneNumber: formatPhone(phone),
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: `PUR${purchaseId}`,
    TransactionDesc: paperTitle.slice(0, 13),
  };

  // Mask Password in audit logs so encrypted/derived secrets stay clean
  const safeLogPayload = { ...requestBody, Password: '[REDACTED]' };

  logPaymentEvent({
    purchaseId,
    phoneNumber: phone,
    eventType: 'stk_request',
    payload: safeLogPayload,
  }).catch((err) => console.error('[logPaymentEvent stk_request]', err));

  try {
    const { data } = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      requestBody,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
    );

    logPaymentEvent({
      purchaseId,
      checkoutRequestId: data.CheckoutRequestID,
      phoneNumber: phone,
      eventType: 'stk_response',
      payload: data,
    }).catch((err) => console.error('[logPaymentEvent stk_response]', err));

    return data;
  } catch (err: unknown) {
    const error = err as { response?: { data: unknown }; message: string };

    logPaymentEvent({
      purchaseId,
      phoneNumber: phone,
      eventType: 'stk_error',
      payload: error.response?.data || { message: error.message },
    }).catch((logErr) => console.error('[logPaymentEvent stk_error]', logErr));

    throw err;
  }
}

export async function handleStkCallback(callbackBody: unknown): Promise<void> {
  const body = callbackBody as {
    Body?: {
      stkCallback?: {
        CheckoutRequestID: string;
        ResultCode: number;
        ResultDesc?: string;
        CallbackMetadata?: { Item: { Name: string; Value: unknown }[] };
      };
    };
  };

  const stkCallback = body?.Body?.stkCallback;

  await logPaymentEvent({
    checkoutRequestId: stkCallback?.CheckoutRequestID || null,
    eventType: 'callback_received',
    payload: callbackBody,
  });

  if (!stkCallback) throw new Error('Malformed STK callback payload');

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT pu.*, pa.title AS paper_title, pa.file_key
       FROM purchases pu
       JOIN papers pa ON pa.id = pu.paper_id
       WHERE pu.checkout_request_id = $1 FOR UPDATE OF pu`,
      [CheckoutRequestID]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      await logPaymentEvent({
        checkoutRequestId: CheckoutRequestID,
        eventType: 'callback_error',
        payload: { reason: 'Unknown CheckoutRequestID', ResultCode },
      });
      console.warn('Callback for unknown CheckoutRequestID:', CheckoutRequestID);
      return;
    }

    const purchase = rows[0];

    if (purchase.status === 'completed') {
      await client.query('ROLLBACK');
      await logPaymentEvent({
        purchaseId: purchase.id,
        checkoutRequestId: CheckoutRequestID,
        phoneNumber: purchase.phone_number,
        eventType: 'callback_duplicate',
        payload: { ResultCode },
      });
      return;
    }

    if (ResultCode !== 0) {
      await client.query(
        `UPDATE purchases SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [purchase.id]
      );
      await client.query('COMMIT');
      await logPaymentEvent({
        purchaseId: purchase.id,
        checkoutRequestId: CheckoutRequestID,
        phoneNumber: purchase.phone_number,
        eventType: 'callback_failed',
        payload: { ResultCode, ResultDesc },
      });
      return;
    }

    const items = CallbackMetadata?.Item || [];
    const receipt = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;

    const downloadToken = crypto.randomBytes(24).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await client.query(
      `UPDATE purchases
       SET status = 'completed',
           mpesa_receipt = $1,
           download_token = $2,
           token_expires_at = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [receipt, downloadToken, tokenExpiresAt, purchase.id]
    );

    await client.query('COMMIT');

    await logPaymentEvent({
      purchaseId: purchase.id,
      checkoutRequestId: CheckoutRequestID,
      phoneNumber: purchase.phone_number,
      eventType: 'callback_processed',
      payload: { receipt, ResultCode },
    });

    const signedUrl = await getSignedDownloadUrl(purchase.file_key, 24 * 60 * 60);

    notifyBuyer({
      phone: purchase.phone_number,
      email: purchase.email || null,
      paperTitle: purchase.paper_title,
      downloadUrl: signedUrl,
    }).catch((err) => console.error('[notifyBuyer unexpected]', err));

  } catch (err) {
    await client.query('ROLLBACK');
    await logPaymentEvent({
      checkoutRequestId: CheckoutRequestID,
      eventType: 'callback_error',
      payload: { error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  } finally {
    client.release();
  }
}
export interface DarajaCredentials {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  businessShortCode: string;
  tillNumber: string;
}

export async function triggerRawBuyGoodsStkPush(params: {
  creds: DarajaCredentials;
  phone: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl: string;
}): Promise<{ CheckoutRequestID: string; MerchantRequestID: string }> {
  const { creds, phone, amount, accountReference, transactionDesc, callbackUrl } = params;
  const token = await getAccessToken(creds.consumerKey, creds.consumerSecret);
  const timestamp = timestampNow();
  const password = Buffer.from(
    `${creds.businessShortCode}${creds.passkey}${timestamp}`
  ).toString('base64');

  const requestBody = {
    BusinessShortCode: creds.businessShortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerBuyGoodsOnline',
    Amount: Math.ceil(amount),
    PartyA: formatPhone(phone),
    PartyB: creds.tillNumber,
    PhoneNumber: formatPhone(phone),
    CallBackURL: callbackUrl,
    AccountReference: accountReference.slice(0, 12),
    TransactionDesc: transactionDesc.slice(0, 20),
  };

  const { data } = await axios.post(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    requestBody,
    { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
  );

  return data;
}
