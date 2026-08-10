import { Request, Response, NextFunction } from 'express';

// TEMPORARY: Auth bypassed for diagnostic testing — MUST BE REVERTED IMMEDIATELY AFTER TEST
function adminAuth(req: Request, res: Response, next: NextFunction): void {
  console.log('DEBUG adminAuth — BYPASSED FOR TESTING');
  return next();
}

export default adminAuth;