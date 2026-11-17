"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
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
// keepAlive pings the single-tenant DB (config/db), so skip it for the SaaS app
if (!isSaas) {
    require('./jobs/keepAlive').default.start();
}
