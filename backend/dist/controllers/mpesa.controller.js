"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mpesaCallback = mpesaCallback;
const mpesa_service_1 = require("../services/mpesa.service");
// POST /api/mpesa/callback — Safaricom hits this after the STK push resolves.
// Always return 200 quickly; Safaricom retries aggressively on non-200s,
// and we don't want retries piling up because of a slow response.
async function mpesaCallback(req, res) {
    console.log('=== MPESA CALLBACK RECEIVED ===', JSON.stringify(req.body));
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    try {
        await (0, mpesa_service_1.handleStkCallback)(req.body);
    }
    catch (err) {
        console.error('Failed to process M-Pesa callback:', err);
    }
}
