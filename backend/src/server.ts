import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 3000;

// Debug env vars on startup
console.log('=== MPESA ENV CHECK ===');
console.log('MPESA_ENV:', process.env.MPESA_ENV);
console.log('MPESA_SHORTCODE:', process.env.MPESA_SHORTCODE);
console.log('MPESA_CALLBACK_URL:', process.env.MPESA_CALLBACK_URL);
console.log('MPESA_CONSUMER_KEY:', process.env.MPESA_CONSUMER_KEY?.slice(0, 6) + '***');
console.log('MPESA_CONSUMER_SECRET:', process.env.MPESA_CONSUMER_SECRET?.slice(0, 4) + '***');
console.log('MPESA_PASSKEY:', process.env.MPESA_PASSKEY ? 'SET ✓' : 'NOT SET ✗');
console.log('=======================');

app.listen(PORT, () => {
  console.log(`revisionhub running on port ${PORT}`);
});