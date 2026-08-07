"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const adminAuth_1 = __importDefault(require("../middleware/adminAuth"));
const papers_controller_1 = require("../controllers/papers.controller");
const purchases_controller_1 = require("../controllers/purchases.controller");
const mpesa_controller_1 = require("../controllers/mpesa.controller");
const download_controller_1 = require("../controllers/download.controller");
const adminPayments_controller_1 = require("../controllers/adminPayments.controller");
const router = express_1.default.Router();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — bundles (zips) can be large
});
// Public — paper catalog
router.get('/papers', papers_controller_1.listPapers);
// Admin — upload a paper or bundle (Basic Auth)
router.post('/admin/papers', adminAuth_1.default, upload.single('file'), papers_controller_1.createPaper);
// Admin — payment history lookup (Basic Auth)
router.get('/admin/payment-history', adminAuth_1.default, adminPayments_controller_1.getPaymentHistory);
// Purchase flow
router.post('/purchases', purchases_controller_1.createPurchase);
router.get('/purchases/:id/status', purchases_controller_1.getPurchaseStatus);
// Daraja callback (server-to-server, Safaricom hits this)
router.post('/mpesa/callback', mpesa_controller_1.mpesaCallback);
// Download (single-use, 15-min token)
router.get('/download/:token', download_controller_1.downloadByToken);
exports.default = router;
