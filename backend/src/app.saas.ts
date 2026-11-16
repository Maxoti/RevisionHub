// src/app.saas.ts
import express from 'express';
import cors from 'cors';
import { createSaasRouter } from './routes/saasRoutes';
import { createAuthRouter } from './routes/authRoutes';
import pool from './config/db.saas';
const app = express();
app.use(cors({
  origin: ['https://edusynchub.co.ke', 'https://www.edusynchub.co.ke'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
}));
app.use(express.json());
app.use('/api', createAuthRouter(pool));
app.use('/api', createSaasRouter(pool));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
export default app;