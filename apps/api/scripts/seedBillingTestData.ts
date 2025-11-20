/**
 * Seed test billing data for development
 * Run with: npx ts-node backend/scripts/seedBillingTestData.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import BillingSubscription from '../src/models/BillingSubscription';
import BillingInvoice from '../src/models/BillingInvoice';
import Payment from '../src/models/Payment';
import Workplace from '../src/models/Workplace';
import SubscriptionPlan from '../src/models/SubscriptionPlan';
import User from '../src/models/User';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function seedBillingData() {
  try {
    console.log('🌱 Starting billing data seeding...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmily';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get first workspace and plan
    const workspace = await Workplace.findOne();
    const plan = await SubscriptionPlan.findOne();
    const user = await User.findOne();

    if (!workspace) {
      console.error('❌ No workspace found. Please create a workspace first.');
      process.exit(1);
    }

    if (!plan) {
      console.error('❌ No subscription plan found. Please create a plan first.');
      process.exit(1);
    }

    if (!user) {
      console.error('❌ No user found. Please create a user first.');
      process.exit(1);
    }

    console.log('📦 Using:');
    console.log(`  Workspace: ${workspace.name} (${workspace._id})`);
    console.log(`  Plan: ${plan.name} (${plan._id})`);
    console.log(`  User: ${user.email} (${user._id})\n`);

    // Clear existing test data
    console.log('🧹 Clearing existing test data...');
    await BillingSubscription.deleteMany({});
    await BillingInvoice.deleteMany({});
    await Payment.deleteMany({ paymentReference: /^TEST-/ });
    console.log('✅ Cleared\n');

    // Create test subscriptions
    console.log('📋 Creating test subscriptions...');
    const subscriptions = [];
    const statuses = ['active', 'trialing', 'past_due', 'canceled'];
    
    for (let i = 0; i < 20; i++) {
      const status = statuses[i % statuses.length];
      const now = new Date();
      const periodStart = new Date(now.getTime() - (30 - i) * 24 * 60 * 60 * 1000);
      const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      const subscription = await BillingSubscription.create({
        workspaceId: workspace._id,
        planId: plan._id,
        status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        billingCycleAnchor: periodStart,
        billingInterval: i % 2 === 0 ? 'monthly' : 'yearly',
        unitAmount: i % 2 === 0 ? 25000 : 250000,
        currency: 'NGN',
        quantity: 1,
        cancelAtPeriodEnd: status === 'canceled',
        trialEnd: status === 'trialing' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
        metadata: {
          testData: true,
          index: i
        }
      });

      subscriptions.push(subscription);
    }
    console.log(`✅ Created ${subscriptions.length} subscriptions\n`);

    // Create test invoices
    console.log('📄 Creating test invoices...');
    const invoices = [];
    const invoiceStatuses = ['paid', 'open', 'void', 'uncollectible'];

    for (let i = 0; i < 30; i++) {
      const status = invoiceStatuses[i % invoiceStatuses.length];
      const subscription = subscriptions[i % subscriptions.length];
      const amount = subscription.unitAmount;
      const dueDate = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000);

      const invoice = await BillingInvoice.create({
        workspaceId: workspace._id,
        subscriptionId: subscription._id,
        invoiceNumber: `INV-TEST-${String(i + 1).padStart(4, '0')}`,
        status,
        subtotal: amount,
        tax: 0,
        total: amount,
        amountPaid: status === 'paid' ? amount : 0,
        amountDue: status === 'paid' ? 0 : amount,
        currency: 'NGN',
        dueDate,
        paidAt: status === 'paid' ? dueDate : undefined,
        customerEmail: workspace.email || 'test@example.com',
        customerName: workspace.name,
        lineItems: [{
          description: `${plan.name} - ${subscription.billingInterval} subscription`,
          amount,
          quantity: 1,
          unitAmount: amount,
          planId: plan._id
        }],
        metadata: {
          testData: true,
          index: i
        }
      });

      invoices.push(invoice);
    }
    console.log(`✅ Created ${invoices.length} invoices\n`);

    // Create test payments
    console.log('💳 Creating test payments...');
    const payments = [];

    for (let i = 0; i < 50; i++) {
      const daysAgo = 60 - i;
      const completedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const amount = Math.floor(Math.random() * 50000) + 10000;

      const payment = await Payment.create({
        userId: user._id,
        planId: plan._id,
        amount,
        currency: 'NGN',
        paymentMethod: i % 3 === 0 ? 'paystack' : i % 3 === 1 ? 'nomba' : 'credit_card',
        status: 'completed',
        paymentReference: `TEST-REF-${String(i + 1).padStart(4, '0')}`,
        completedAt,
        metadata: {
          testData: true,
          index: i
        }
      });

      payments.push(payment);
    }
    console.log(`✅ Created ${payments.length} payments\n`);

    // Summary
    console.log('📊 Seeding Summary:');
    console.log(`  Subscriptions: ${subscriptions.length}`);
    console.log(`  - Active: ${subscriptions.filter(s => s.status === 'active').length}`);
    console.log(`  - Trialing: ${subscriptions.filter(s => s.status === 'trialing').length}`);
    console.log(`  - Past Due: ${subscriptions.filter(s => s.status === 'past_due').length}`);
    console.log(`  - Canceled: ${subscriptions.filter(s => s.status === 'canceled').length}`);
    console.log(`\n  Invoices: ${invoices.length}`);
    console.log(`  - Paid: ${invoices.filter(i => i.status === 'paid').length}`);
    console.log(`  - Open: ${invoices.filter(i => i.status === 'open').length}`);
    console.log(`  - Void: ${invoices.filter(i => i.status === 'void').length}`);
    console.log(`  - Uncollectible: ${invoices.filter(i => i.status === 'uncollectible').length}`);
    console.log(`\n  Payments: ${payments.length}`);
    console.log(`  - Total Amount: ₦${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}`);

    console.log('\n✅ Billing data seeding completed successfully!');
    console.log('\n💡 You can now view the data in the Billing & Subscriptions tab');

  } catch (error) {
    console.error('❌ Error seeding billing data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the seeding
seedBillingData();
