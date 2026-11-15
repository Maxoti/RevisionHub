"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTenant = withTenant;
/**
 * Runs `fn` inside a transaction with app.tenant_id set for that transaction
 * only (set_config(..., true)), so current_tenant_id() and optional RLS are
 * safe with pooled connections. Never use a plain session-level SET with a pool.
 */
async function withTenant(pool, tenantId, fn) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [
            String(tenantId),
        ]);
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    }
    catch (err) {
        try {
            await client.query("ROLLBACK");
        }
        catch {
            /* ignore rollback failure */
        }
        throw err;
    }
    finally {
        client.release();
    }
}
