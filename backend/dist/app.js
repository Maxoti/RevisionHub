"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: [
        'https://revisionhub.co.ke',
        'https://www.revisionhub.co.ke',
        'https://myassessment.co.ke',
        'https://www.myassessment.co.ke',
        'http://localhost:5173'
    ]
}));
app.use(express_1.default.json());
app.use('/api', routes_1.default);
// Serve the static admin upload page
app.use('/admin', express_1.default.static(path_1.default.join(__dirname, '../../admin')));
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});
exports.default = app;
