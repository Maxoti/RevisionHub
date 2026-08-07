import cron from 'node-cron';
import pool from '../config/db';

const keepAlive = cron.schedule('*/4 * * * *', async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
  } catch (error) {
    console.error('Error occurred while pinging the database:', error);
  }
});

export default keepAlive;