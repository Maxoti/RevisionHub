"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const url = process.env.SAAS_DATABASE_URL;
if (!url) {
    throw new Error('SAAS_DATABASE_URL is not set');
}
const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
const pool = new pg_1.Pool({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
});
pool.on('error', (err) => {
    console.error('Unexpected SaaS Postgres pool error:', err);
});
exports.default = pool;
