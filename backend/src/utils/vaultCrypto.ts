import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV, standard for GCM
const TAG_BYTES = 16; // full 128-bit auth tag

let cachedKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const hex = process.env.VAULT_MASTER_KEY;
  // Strict hex check: Buffer.from(badHex, "hex") silently truncates at the first bad char
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("VAULT_MASTER_KEY must be a 64-character hex string (32 bytes).");
  }
  cachedKey = Buffer.from(hex, "hex");
  return cachedKey;
}

/** Call once at startup (multi-tenant mode) so a missing key fails at boot, not at first activation. */
export function assertVaultKey(): void {
  getMasterKey();
}

/**
 * Encrypts a secret.
 *  - Without `context`: legacy format  iv:tag:ciphertext   (identical to before)
 *  - With    `context`: bound format   v2:iv:tag:ciphertext
 *    The context (e.g. `tenant:5:consumer_key`) is authenticated as GCM AAD, so a
 *    ciphertext copied into another tenant's row or another column will NOT decrypt.
 */
export function encryptSecret(plainText: string, context?: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv, {
    authTagLength: TAG_BYTES,
  });
  if (context) cipher.setAAD(Buffer.from(context, "utf8"));

  const encrypted = Buffer.concat([
    cipher.update(plainText.trim(), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const body = `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  return context ? `v2:${body}` : body;
}

/**
 * Decrypts both formats. Legacy values (no "v2:" prefix) keep working unchanged.
 * A "v2:" value requires the same `context` it was encrypted with.
 */
export function decryptSecret(payload: string, context?: string): string {
  const bound = payload.startsWith("v2:");
  const parts = (bound ? payload.slice(3) : payload).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format.");
  }
  if (bound && !context) {
    throw new Error("This secret is context-bound; a context is required to decrypt it.");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  // Node accepts shortened GCM tags unless told otherwise; reject them explicitly
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Invalid encrypted secret format.");
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv, {
      authTagLength: TAG_BYTES,
    });
    if (bound) decipher.setAAD(Buffer.from(context!, "utf8"));
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "Could not decrypt secret (wrong VAULT_MASTER_KEY, wrong context, or corrupted data)."
    );
  }
}