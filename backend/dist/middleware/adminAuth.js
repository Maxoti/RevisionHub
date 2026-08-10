"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function adminAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="Admin"');
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    const decoded = Buffer.from(header.split(' ')[1], 'base64').toString();
    const [user, pass] = decoded.split(':');
    console.error('DEBUG adminAuth — env ADMIN_USER:', JSON.stringify(process.env.ADMIN_USER));
    console.error('DEBUG adminAuth — env ADMIN_PASSWORD:', JSON.stringify(process.env.ADMIN_PASSWORD));
    console.error('DEBUG adminAuth — received user:', JSON.stringify(user));
    console.error('DEBUG adminAuth — received pass:', JSON.stringify(pass));
    console.error('DEBUG adminAuth — user match:', user === process.env.ADMIN_USER);
    console.error('DEBUG adminAuth — pass match:', pass === process.env.ADMIN_PASSWORD);
    if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASSWORD) {
        return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    res.status(401).json({ error: 'Invalid credentials' });
}
exports.default = adminAuth;
