// test-tenant-resolution.ts
//
// Standalone script — run this directly, it does NOT touch app.ts or your
// live server. Just imports the provider and exercises it against whichever
// database DATABASE_URL points to (should be your Neon TEST BRANCH for now,
// never production, until this passes).
//
// Run with:
//   npx ts-node test-tenant-resolution.ts
//
// Or if ts-node isn't installed:
//   npm install --save-dev ts-node
//   npx ts-node test-tenant-resolution.ts

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { createTenantProvider } from './Providers/tenantProvider';

dotenv.config(); // loads DATABASE_URL, DEPLOYMENT_MODE, TENANT_ID from .env

// Minimal fake Express Request — only needs the `headers.host` field,
// since that's all MultiTenantProvider.resolve() actually reads.
function fakeRequest(host: string): any {
  return { headers: { host } };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('--- Tenant Resolution Test ---');
  console.log('DEPLOYMENT_MODE:', process.env.DEPLOYMENT_MODE ?? '(unset, defaults to "single")');
  console.log('DATABASE_URL host:', new URL(process.env.DATABASE_URL ?? '').host);
  console.log('');

  const provider = createTenantProvider(pool);

  // Test 1: known domain (the row you inserted earlier on the test branch)
  console.log('Test 1: resolving "revisionhub.co.ke"...');
  const tenant1 = await provider.resolve(fakeRequest('revisionhub.co.ke'));
  console.log(tenant1 ? `✅ Found: ${tenant1.business_name} (id ${tenant1.id})` : '❌ Not found');
  console.log('');

  // Test 2: unknown domain — should return null, not throw
  console.log('Test 2: resolving "unknown-domain.co.ke" (should be null)...');
  const tenant2 = await provider.resolve(fakeRequest('unknown-domain.co.ke'));
  console.log(tenant2 ? `⚠️ Unexpectedly found: ${JSON.stringify(tenant2)}` : '✅ Correctly returned null');
  console.log('');

  // Test 3: www. prefix should be stripped and still resolve
  console.log('Test 3: resolving "www.revisionhub.co.ke" (www should be stripped)...');
  const tenant3 = await provider.resolve(fakeRequest('www.revisionhub.co.ke'));
  console.log(tenant3 ? `✅ Found: ${tenant3.business_name}` : '❌ Not found — www stripping may be broken');
  console.log('');

  console.log('--- Done ---');
  await pool.end();
}

main().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});