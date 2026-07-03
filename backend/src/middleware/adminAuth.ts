import { Request, Response, NextFunction } from 'express';

// Simple HTTP Basic Auth gate for the admin upload endpoint.
// Fine at this scale (one admin, low volume) — not meant to scale past that.

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const decoded = Buffer.from(header.split(' ')[1], 'base64').toString();
  const [user, pass] = decoded.split(':');

  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASSWORD) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Admin"');
  res.status(401).json({ error: 'Invalid credentials' });
}

export default adminAuth;