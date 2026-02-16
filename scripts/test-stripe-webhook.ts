#!/usr/bin/env tsx
/**
 * Stripe Webhook Configuration Test
 *
 * Verifies that Stripe webhook is properly configured and accessible.
 *
 * Usage:
 *   npx tsx scripts/test-stripe-webhook.ts
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const WEBHOOK_PATH = '/api/stripe/webhook';
const WEBHOOK_URL = `${BASE_URL}${WEBHOOK_PATH}`;

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Stripe Webhook Configuration Test                    ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// Check environment variables
function checkEnvironmentVariables() {
  console.log('📋 Step 1: Checking environment variables...\n');

  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'BASE_URL',
  ];

  let allPresent = true;

  for (const key of required) {
    const value = process.env[key];
    if (!value || value.includes('REPLACE') || value.includes('placeholder')) {
      console.log(`❌ ${key}: Missing or not configured`);
      allPresent = false;
    } else {
      // Mask sensitive values
      const maskedValue = value.substring(0, 12) + '...' + value.substring(value.length - 4);
      console.log(`✅ ${key}: ${maskedValue}`);
    }
  }

  // Check if using production keys
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  if (secretKey.startsWith('sk_test_')) {
    console.log('\n⚠️  WARNING: Using TEST mode keys');
    console.log('   Real payments will NOT be processed');
  } else if (secretKey.startsWith('sk_live_')) {
    console.log('\n✅ Using PRODUCTION mode keys');
    console.log('   Real payments WILL be processed');
  }

  console.log();
  return allPresent;
}

// Test webhook endpoint accessibility
async function testWebhookEndpoint() {
  console.log('🌐 Step 2: Testing webhook endpoint accessibility...\n');
  console.log(`   URL: ${WEBHOOK_URL}\n`);

  try {
    // Try to access the webhook endpoint
    // Note: This should return an error because we're not sending a valid Stripe signature
    // But at least we can verify the endpoint exists
    const response = await axios.post(
      WEBHOOK_URL,
      { test: 'data' },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: () => true, // Accept any status code
      }
    );

    if (response.status === 400) {
      console.log('✅ Endpoint is accessible');
      console.log('✅ Server is properly rejecting unsigned requests');
      console.log(`   (Got expected 400 Bad Request)\n`);
      return true;
    } else if (response.status === 404) {
      console.log('❌ Endpoint not found (404)');
      console.log('   Make sure the server is running\n');
      return false;
    } else {
      console.log(`⚠️  Unexpected response: ${response.status}`);
      console.log(`   Body: ${JSON.stringify(response.data).substring(0, 100)}\n`);
      return false;
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Cannot connect to server');
      console.log('   Server is not running or not accessible\n');
      console.log('   Please start the server first:');
      console.log('   cd "e:\\Awareness Market\\Awareness-Network"');
      console.log('   pnpm run dev\n');
    } else {
      console.log('❌ Network error:', error.message, '\n');
    }
    return false;
  }
}

// Display Stripe Dashboard instructions
function displayDashboardInstructions() {
  console.log('📝 Step 3: Verify Stripe Dashboard Configuration\n');
  console.log('   1. Visit: https://dashboard.stripe.com/webhooks');
  console.log('   2. Find your webhook endpoint');
  console.log(`   3. Verify URL: ${WEBHOOK_URL}`);
  console.log('   4. Verify events are selected:');
  console.log('      • checkout.session.completed');
  console.log('      • customer.subscription.created');
  console.log('      • customer.subscription.updated');
  console.log('      • customer.subscription.deleted');
  console.log('      • invoice.paid');
  console.log('      • invoice.payment_failed');
  console.log('   5. Click "Send test webhook" to verify\n');
}

// Display next steps
function displayNextSteps(configValid: boolean, endpointAccessible: boolean) {
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('📊 Test Results Summary:\n');
  console.log(`   Environment Variables: ${configValid ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`   Endpoint Accessibility: ${endpointAccessible ? '✅ Accessible' : '❌ Not Accessible'}\n`);

  if (configValid && endpointAccessible) {
    console.log('✅ Configuration looks good!\n');
    console.log('🚀 Next Steps:\n');
    console.log('   1. Test in Stripe Dashboard:');
    console.log('      Visit: https://dashboard.stripe.com/webhooks');
    console.log('      Click "Send test webhook"');
    console.log('      Verify you see a success response (200 OK)\n');
    console.log('   2. Test with real payment:');
    console.log('      • Create a test organization');
    console.log('      • Upgrade to a paid plan');
    console.log('      • Use test card: 4242 4242 4242 4242');
    console.log('      • Complete checkout');
    console.log('      • Verify organization plan tier updated\n');
    console.log('   3. Monitor webhook logs:');
    console.log('      • Check server logs for incoming webhooks');
    console.log('      • Check Stripe Dashboard webhook logs\n');
  } else {
    console.log('❌ Configuration has issues\n');
    console.log('🔧 Required Actions:\n');

    if (!configValid) {
      console.log('   1. Update .env file with correct values');
      console.log('      STRIPE_WEBHOOK_SECRET=whsec_...');
    }

    if (!endpointAccessible) {
      console.log('   2. Start the server:');
      console.log('      cd "e:\\Awareness Market\\Awareness-Network"');
      console.log('      pnpm run dev');
      console.log('   3. Ensure firewall allows port 3001');
    }

    console.log();
  }

  console.log('═══════════════════════════════════════════════════════\n');
}

// Main test function
async function main() {
  try {
    const configValid = checkEnvironmentVariables();
    const endpointAccessible = await testWebhookEndpoint();

    displayDashboardInstructions();
    displayNextSteps(configValid, endpointAccessible);

    if (!configValid || !endpointAccessible) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
