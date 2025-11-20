/**
 * Verify Billing & Subscriptions setup
 * Run with: npx ts-node backend/scripts/verifyBillingSetup.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import BillingSubscription from '../src/models/BillingSubscription';
import BillingInvoice from '../src/models/BillingInvoice';
import Payment from '../src/models/Payment';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifySetup() {
  try {
    console.log('🔍 Verifying Billing & Subscriptions Setup\n');
    console.log('='.repeat(50));

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmily';
    console.log('\n📦 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check collections
    console.log('\n📊 Checking Database Collections:\n');

    const subscriptionCount = await BillingSubscription.countDocuments();
    console.log(`  Subscriptions: ${subscriptionCount}`);
    if (subscriptionCount > 0) {
      const statusCounts = await BillingSubscription.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      statusCounts.forEach(({ _id, count }) => {
        console.log(`    - ${_id}: ${count}`);
      });
    }

    const invoiceCount = await BillingInvoice.countDocuments();
    console.log(`\n  Invoices: ${invoiceCount}`);
    if (invoiceCount > 0) {
      const statusCounts = await BillingInvoice.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      statusCounts.forEach(({ _id, count }) => {
        console.log(`    - ${_id}: ${count}`);
      });
    }

    const paymentCount = await Payment.countDocuments({ status: 'completed' });
    console.log(`\n  Completed Payments: ${paymentCount}`);
    if (paymentCount > 0) {
      const totalRevenue = await Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      if (totalRevenue.length > 0) {
        console.log(`    - Total Revenue: ₦${totalRevenue[0].total.toLocaleString()}`);
      }
    }

    // Check if data exists
    console.log('\n' + '='.repeat(50));
    console.log('\n📋 Setup Status:\n');

    if (subscriptionCount === 0 && invoiceCount === 0 && paymentCount === 0) {
      console.log('⚠️  No billing data found in database');
      console.log('\n💡 To create test data, run:');
      console.log('   npx ts-node backend/scripts/seedBillingTestData.ts');
    } else {
      console.log('✅ Billing data exists in database');
      console.log('\n📊 Summary:');
      console.log(`   - ${subscriptionCount} subscriptions`);
      console.log(`   - ${invoiceCount} invoices`);
      console.log(`   - ${paymentCount} completed payments`);
    }

    // Check environment variables
    console.log('\n' + '='.repeat(50));
    console.log('\n🔐 Environment Variables:\n');

    const requiredVars = [
      'MONGODB_URI',
      'JWT_SECRET',
      'PAYSTACK_SECRET_KEY',
      'PAYSTACK_PUBLIC_KEY'
    ];

    let allVarsPresent = true;
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        console.log(`  ✅ ${varName}: Set`);
      } else {
        console.log(`  ❌ ${varName}: Missing`);
        allVarsPresent = false;
      }
    });

    // Final recommendations
    console.log('\n' + '='.repeat(50));
    console.log('\n📝 Next Steps:\n');

    if (!allVarsPresent) {
      console.log('  1. ❌ Set missing environment variables in .env file');
    } else {
      console.log('  1. ✅ All required environment variables are set');
    }

    if (subscriptionCount === 0) {
      console.log('  2. ⚠️  Seed test data: npx ts-node backend/scripts/seedBillingTestData.ts');
    } else {
      console.log('  2. ✅ Database has billing data');
    }

    console.log('  3. 🔄 Restart backend server: npm run dev');
    console.log('  4. 🌐 Open Billing & Subscriptions tab in browser');
    console.log('  5. 🔍 Check browser console for logs');
    console.log('  6. 📊 Verify data appears in all tabs');

    // Test API endpoints (if server is running)
    console.log('\n' + '='.repeat(50));
    console.log('\n🧪 To Test API Endpoints:\n');
    console.log('  curl -H "Authorization: Bearer YOUR_TOKEN" \\');
    console.log('    http://localhost:5000/api/billing/analytics');
    console.log('\n  curl -H "Authorization: Bearer YOUR_TOKEN" \\');
    console.log('    http://localhost:5000/api/billing/subscriptions?page=1&limit=10');

    console.log('\n' + '='.repeat(50));
    console.log('\n✅ Verification Complete!\n');

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB\n');
  }
}

// Run verification
verifySetup();
