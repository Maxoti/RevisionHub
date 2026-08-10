"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// TEMPORARY: Auth bypassed for diagnostic testing — MUST BE REVERTED IMMEDIATELY AFTER TEST
function adminAuth(req, res, next) {
    console.log('DEBUG adminAuth — BYPASSED FOR TESTING');
    return next();
}
exports.default = adminAuth;
