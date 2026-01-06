/**
 * R2 Connection Test
 * 
 * Validates R2 credentials and connection
 */

import { describe, it, expect } from 'vitest';
import { getR2Backend } from './storage/r2-backend';

describe('R2 Connection', () => {
  it('should connect to R2 and perform basic operations', async () => {
    // Check if R2 credentials are configured
    expect(process.env.R2_ACCOUNT_ID).toBeDefined();
    expect(process.env.R2_ACCESS_KEY_ID).toBeDefined();
    expect(process.env.R2_SECRET_ACCESS_KEY).toBeDefined();
    expect(process.env.R2_BUCKET_NAME).toBeDefined();

    console.log('\n🔍 Testing R2 connection...');
    console.log('Account ID:', process.env.R2_ACCOUNT_ID);
    console.log('Bucket:', process.env.R2_BUCKET_NAME);

    // Get R2 backend instance
    const r2 = getR2Backend();

    // Test 1: Health check
    console.log('\n1️⃣ Running health check...');
    const isHealthy = await r2.healthCheck();
    expect(isHealthy).toBe(true);
    console.log('✅ Health check passed');

    // Test 2: Upload test file
    console.log('\n2️⃣ Uploading test file...');
    const testData = Buffer.from('Hello R2! Test at ' + new Date().toISOString());
    const uploadResult = await r2.put(
      'test/vitest-connection-test.txt',
      testData,
      'text/plain'
    );
    expect(uploadResult.key).toBe('test/vitest-connection-test.txt');
    expect(uploadResult.url).toContain('test/vitest-connection-test.txt');
    console.log('✅ Upload successful');
    console.log('   URL:', uploadResult.url);

    // Test 3: Download test file
    console.log('\n3️⃣ Downloading test file...');
    const downloadResult = await r2.get('test/vitest-connection-test.txt');
    expect(downloadResult.url).toContain('test/vitest-connection-test.txt');
    console.log('✅ Download successful');
    console.log('   URL:', downloadResult.url);

    // Test 4: Delete test file
    console.log('\n4️⃣ Deleting test file...');
    await r2.delete('test/vitest-connection-test.txt');
    console.log('✅ Delete successful');

    // Test 5: Get cost metrics
    console.log('\n5️⃣ Getting cost metrics...');
    const metrics = r2.getCostMetrics();
    expect(metrics.storageCostPerGB).toBe(0.015);
    expect(metrics.bandwidthCostPerGB).toBe(0);
    console.log('✅ Cost metrics:', metrics);

    console.log('\n🎉 All R2 tests passed! R2 is ready to use.\n');
  }, 30000); // 30 second timeout
});
