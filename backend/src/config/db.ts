import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }, // Render/Supabase managed Postgres
});

pool.on('error', (err: Error) => {
  console.error('Unexpected Postgres pool error:', err);
});

export default pool;