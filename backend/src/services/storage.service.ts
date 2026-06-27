import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function uploadPaper(
  fileKey: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
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
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: fileKey });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}