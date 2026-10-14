"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mpesaCallback = mpesaCallback;
const crypto_1 = __importDefault(require("crypto"));
const mpesa_service_1 = require("../services/mpesa.service");
const CALLBACK_SECRET = process.env.MPESA_CALLBACK_SECRET || '';
// Constant-time comparison. Hashing both sides first gives equal-length
// buffers, so timingSafeEqual never throws and the length isn't leaked.
function secretMatches(provided) {
    if (!CALLBACK_SECRET || typeof provided !== 'string')
        return false; // fail closed
    const a = crypto_1.default.createHash('sha256').update(provided).digest();
    const b = crypto_1.default.createHash('sha256').update(CALLBACK_SECRET).digest();
    return crypto_1.default.timingSafeEqual(a, b);
}
// POST /api/mpesa/callback?key=<secret>
// Rejects anything without the right key. Otherwise answers 200 quickly,
// because Safaricom retries aggressively on slow or non-200 responses.
async function mpesaCallback(req, res) {
    if (!secretMatches(req.query.key)) {
        console.warn('Rejected M-Pesa callback: missing or invalid key from', req.ip);
        return res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
    }
    console.log('=== MPESA CALLBACK RECEIVED ===', JSON.stringify(req.body));
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    try {
        await (0, mpesa_service_1.handleStkCallback)(req.body);
    }
    catch (err) {
        console.error('Failed to process M-Pesa callback:', err);
    }
}
