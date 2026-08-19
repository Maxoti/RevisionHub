"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPaper = uploadPaper;
exports.getSignedDownloadUrl = getSignedDownloadUrl;
exports.deletePaperFile = deletePaperFile;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const r2 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
const BUCKET = process.env.R2_BUCKET_NAME;
async function uploadPaper(fileKey, buffer, mimeType) {
    await r2.send(new client_s3_1.PutObjectCommand({
        Bucket: BUCKET,
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
    const command = new client_s3_1.GetObjectCommand({ Bucket: BUCKET, Key: fileKey });
    return (0, s3_request_presigner_1.getSignedUrl)(r2, command, { expiresIn: expiresInSeconds });
}
// NEW — deletes the underlying file from R2. Called by deletePaper()
// in papers.controller.ts when an admin removes a paper.
async function deletePaperFile(fileKey) {
    await r2.send(new client_s3_1.DeleteObjectCommand({
        Bucket: BUCKET,
        Key: fileKey,
    }));
}
