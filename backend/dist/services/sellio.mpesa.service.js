"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPhone = formatPhone;
exports.triggerSellioStkPush = triggerSellioStkPush;
const axios_1 = __importDefault(require("axios"));
const SELLIO_STK_PUSH_URL = 'https://api.sellio.co.ke/v1/payment/stk-push';
const SELLIO_API_KEY = process.env.SELLIO_API_KEY;
function formatPhone(phone) {
    const digits = String(phone).replace(/\D/g, '');
    // Accept Kenyan mobile numbers in 07..., 01..., 2547...,
    // 2541..., +2547..., or +2541... formats.
    if (/^0[17]\d{8}$/.test(digits)) {
        return `254${digits.slice(1)}`;
    }
    if (/^254[17]\d{8}$/.test(digits)) {
        return digits;
    }
    throw new Error('Invalid Kenyan mobile phone number');
}
async function triggerSellioStkPush({ phone, amount, purchaseId, paperTitle, }) {
    if (!SELLIO_API_KEY) {
        throw new Error('SELLIO_API_KEY is not configured');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Amount must be a positive number');
    }
    const formattedPhone = formatPhone(phone);
    // Use a stable purchase reference so requests can be reconciled.
    const reference = `PUR-${purchaseId}`;
    try {
        const response = await axios_1.default.post(SELLIO_STK_PUSH_URL, {
            phone: formattedPhone,
            amount: Math.round(amount),
            reference,
            description: paperTitle.slice(0, 100),
        }, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SELLIO_API_KEY}`,
            },
            timeout: 15000,
        });
        return response.data;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            console.error('[Sellio STK Push failed]', {
                purchaseId,
                status: error.response?.status,
                response: error.response?.data,
                message: error.message,
            });
            throw new Error(`Sellio STK Push failed: ${error.response?.status ?? 'network error'}`);
        }
        throw error;
    }
}
