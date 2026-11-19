import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 storage.
 *
 * IMPORTANT: if the S3 client is created WITHOUT an endpoint, the AWS SDK silently
 * falls back to AWS itself and builds links like
 *   https://<bucket>.s3.auto.amazonaws.com/...
 * which do not exist. So the endpoint is resolved explicitly and a missing value
 * is a loud error, never a silent fallback.
 *
 * The client is created lazily (on first use) so environment variables are read
 * after dotenv / the hosting panel has loaded them, whatever the import order.
 */

let client: S3Client | null = null;

function resolveEndpoint(): string {
  const explicit = process.env.R2_ENDPOINT?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  // Alternative used by the SaaS routes: build it from the account id
  const account = process.env.R2_ACCOUNT_ID?.trim();
  if (account) return `https://${account}.r2.cloudflarestorage.com`;

  throw new Error(
    'R2 endpoint missing: set R2_ENDPOINT (https://<account-id>.r2.cloudflarestorage.com) or R2_ACCOUNT_ID.'
  );
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!bucket) throw new Error('R2_BUCKET_NAME is not set.');
  return bucket;
}

function getClient(): S3Client {
  if (client) return client;

  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must both be set.');
  }

  client = new S3Client({
    region: 'auto',
    endpoint: resolveEndpoint(),
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

/** Call once at startup (server.ts) so a bad config stops the boot instead of breaking downloads. */
export function assertStorageConfig(): void {
  getClient();
  getBucket();
}

export async function uploadPaper(
  fileKey: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    })
  );
}

/**
 * Short-lived signed URL — used only at the moment of a verified download,
 * never stored or shown to the buyer ahead of payment confirmation.
 */
export async function getSignedDownloadUrl(
  fileKey: string,
  expiresInSeconds: number = 120
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: fileKey });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

// Deletes the underlying file from R2. Called by deletePaper()
// in papers.controller.ts when an admin removes a paper.
export async function deletePaperFile(fileKey: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: fileKey,
    })
  );
}