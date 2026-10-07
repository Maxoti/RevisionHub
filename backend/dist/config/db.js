"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }, // Render/Supabase managed Postgres
});
pool.on('error', (err) => {
    console.error('Unexpected Postgres pool error:', err);
});
exports.default = pool;
