import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', routes);

// Serve the built React frontend (run `npm run build` in /frontend first)
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get(/^(?!\/api|\/admin).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// Serve the static admin upload page (still gated by adminAuth on the API call itself)
app.use('/admin', express.static(path.join(__dirname, '../../admin')));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;