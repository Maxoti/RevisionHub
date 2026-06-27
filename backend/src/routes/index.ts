import express from 'express';
import multer from 'multer';
import adminAuth from '../middleware/adminAuth';
import { listPapers, createPaper } from '../controllers/papers.controller';
import { createPurchase, getPurchaseStatus } from '../controllers/purchases.controller';
import { mpesaCallback } from '../controllers/mpesa.controller';
import { downloadByToken } from '../controllers/download.controller';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — bundles (zips) can be large
});

// Public — paper catalog
router.get('/papers', listPapers);

// Admin — upload a paper or bundle (Basic Auth)
router.post('/admin/papers', adminAuth, upload.single('file'), createPaper);

// Purchase flow
router.post('/purchases', createPurchase);
router.get('/purchases/:id/status', getPurchaseStatus);

// Daraja callback (server-to-server, Safaricom hits this)
router.post('/mpesa/callback', mpesaCallback);

// Download (single-use, 15-min token)
router.get('/download/:token', downloadByToken);

export default router;