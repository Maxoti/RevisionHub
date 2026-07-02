import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';

const app = express();

app.use(cors({
  origin: [
    'https://revisionhub.co.ke',
    'https://www.revisionhub.co.ke',
    'http://localhost:5173'
  ]
}));

app.use(express.json());

app.use('/api', routes);

// Serve the static admin upload page
app.use('/admin', express.static(path.join(__dirname, '../../admin')));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;