import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }, // Render/Supabase managed Postgres
});

pool.on('error', (err: Error) => {
  console.error('Unexpected Postgres pool error:', err);
});

export default pool;