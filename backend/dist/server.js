"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const keepAlive_1 = __importDefault(require("./jobs/keepAlive"));
const PORT = process.env.PORT || 3000;
const isSaas = process.env.TENANT_MODE === 'multi';
// require() inside the branch so only one app and one DB pool load
const app = isSaas
    ? require('./app.saas').default
    : require('./app').default;
console.log(`[server] TENANT_MODE=${process.env.TENANT_MODE} -> ${isSaas ? 'app.saas' : 'app'}`);
// ...keep your MPESA env debug logs here...
app.listen(PORT, () => {
    console.log(`revisionhub running on port ${PORT} (${isSaas ? 'saas' : 'single-tenant'})`);
});
keepAlive_1.default.start();
