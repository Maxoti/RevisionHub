"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertStorageConfig = assertStorageConfig;
exports.uploadPaper = uploadPaper;
exports.getSignedDownloadUrl = getSignedDownloadUrl;
exports.deletePaperFile = deletePaperFile;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
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
let client = null;
function resolveEndpoint() {
    const explicit = process.env.R2_ENDPOINT?.trim();
    if (explicit)
        return explicit.replace(/\/+$/, '');
    // Alternative used by the SaaS routes: build it from the account id
    const account = process.env.R2_ACCOUNT_ID?.trim();
    if (account)
        return `https://${account}.r2.cloudflarestorage.com`;
    throw new Error('R2 endpoint missing: set R2_ENDPOINT (https://<account-id>.r2.cloudflarestorage.com) or R2_ACCOUNT_ID.');
}
function getBucket() {
    const bucket = process.env.R2_BUCKET_NAME?.trim();
    if (!bucket)
        throw new Error('R2_BUCKET_NAME is not set.');
    return bucket;
}
function getClient() {
    if (client)
        return client;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
    if (!accessKeyId || !secretAccessKey) {
        throw new Error('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must both be set.');
    }
    client = new client_s3_1.S3Client({
        region: 'auto',
        endpoint: resolveEndpoint(),
        credentials: { accessKeyId, secretAccessKey },
    });
    return client;
}
/** Call once at startup (server.ts) so a bad config stops the boot instead of breaking downloads. */
function assertStorageConfig() {
    getClient();
    getBucket();
}
async function uploadPaper(fileKey, buffer, mimeType) {
    await getClient().send(new client_s3_1.PutObjectCommand({
        Bucket: getBucket(),
        Key: fileKey,
        Body: buffer,
        ContentType: mimeType,
    }));
}
/**
 * Short-lived signed URL — used only at the moment of a verified download,
 * never stored or shown to the buyer ahead of payment confirmation.
 */
async function getSignedDownloadUrl(fileKey, expiresInSeconds = 120) {
    const command = new client_s3_1.GetObjectCommand({ Bucket: getBucket(), Key: fileKey });
    return (0, s3_request_presigner_1.getSignedUrl)(getClient(), command, { expiresIn: expiresInSeconds });
}
// Deletes the underlying file from R2. Called by deletePaper()
// in papers.controller.ts when an admin removes a paper.
async function deletePaperFile(fileKey) {
    await getClient().send(new client_s3_1.DeleteObjectCommand({
        Bucket: getBucket(),
        Key: fileKey,
    }));
}
