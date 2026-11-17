"use strict";
// src/app.saas.tsim
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const saasRoutes_1 = require("./routes/saasRoutes");
const authRoutes_1 = require("./routes/authRoutes");
const db_saas_1 = __importDefault(require("./config/db.saas"));
const app = (0, express_1.default)();
app.get('/api/__version', (_req, res) => res.json({ app: 'saas', build: '2026-11-17-a' }));
app.use((0, cors_1.default)({
    origin: ['https://edusynchub.co.ke', 'https://www.edusynchub.co.ke'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
}));
app.use(express_1.default.json());
app.use('/api', (0, authRoutes_1.createAuthRouter)(db_saas_1.default));
app.use('/api', (0, saasRoutes_1.createSaasRouter)(db_saas_1.default));
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});
exports.default = app;
