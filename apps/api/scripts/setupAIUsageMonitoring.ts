import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AIUsageLimits from '../src/models/AIUsageLimits';
import Workplace from '../src/models/Workplace';
import PricingPlan from '../src/models/PricingPlan';

// Import all models to ensure they're registered
import '../src/models/Subscription';
import '../src/models/User';
import '../src/models/Payment';

// Load environment variables
dotenv.config();

interface TierLimits {
  requests: number;
  budget: number;
}

const DEFAULT_TIER_LIMITS: Record<string, TierLimits> = {
  free_trial: { requests: 10, budget: 0.5 }, // $0.50 for 14 days
  basic: { requests: 50, budget: 2.0 }, // $2.00/month
  pro: { requests: 100, budget: 3.0 }, // $3.00/month
  pharmily: { requests: 150, budget: 4.0 }, // $4.00/month
  network: { requests: 500, budget: 8.0 }, // $8.00/month
  enterprise: { requests: -1, budget: -1 }, // Unlimited
};

async function setupAIUsageMonitoring() {
  try {
    console.log('🚀 Setting up AI Usage Monitoring system...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get current month
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Find all workspaces
    const workspaces = await Workplace.find({}).select('name currentSubscriptionId');
    console.log(`📊 Found ${workspaces.length} workspaces to process`);

    let processedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    for (const workspace of workspaces) {
      try {
        // Determine subscription tier - default to free_trial for now
        let tier = 'free_trial';
        
        // You can enhance this logic later to determine actual tiers
        // For now, we'll set all workspaces to free_trial to get the system working

        // Check if AI usage limits already exist
        const existingLimits = await AIUsageLimits.findOne({ 
          workspaceId: workspace._id 
        });

        const tierLimits = DEFAULT_TIER_LIMITS[tier] || DEFAULT_TIER_LIMITS.free_trial;

        if (existingLimits) {
          // Update existing limits if tier has changed
          if (existingLimits.subscriptionTier !== tier) {
            await AIUsageLimits.findByIdAndUpdate(existingLimits._id, {
              subscriptionTier: tier,
              'limits.requestsPerMonth': tierLimits.requests,
              'limits.costBudgetPerMonth': tierLimits.budget,
            });
            updatedCount++;
            console.log(`🔄 Updated limits for workspace: ${workspace.name} (${tier})`);
          }
        } else {
          // Create new AI usage limits
          const newLimits = new AIUsageLimits({
            workspaceId: workspace._id,
            subscriptionTier: tier,
            limits: {
              requestsPerMonth: tierLimits.requests,
              costBudgetPerMonth: tierLimits.budget,
            },
            currentUsage: {
              month: currentMonth,
              requestCount: 0,
              totalCost: 0,
              lastResetDate: new Date(),
            },
            suspended: false,
          });

          await newLimits.save();
          createdCount++;
          console.log(`✅ Created limits for workspace: ${workspace.name} (${tier})`);
        }

        processedCount++;
      } catch (error) {
        console.error(`❌ Error processing workspace ${workspace.name}:`, error);
      }
    }

    console.log('\n📈 Setup Summary:');
    console.log(`   Total workspaces processed: ${processedCount}`);
    console.log(`   New AI usage limits created: ${createdCount}`);
    console.log(`   Existing limits updated: ${updatedCount}`);

    // Create indexes for better performance
    console.log('\n🔍 Creating database indexes...');
    
    try {
      await AIUsageLimits.collection.createIndex({ workspaceId: 1 }, { unique: true });
      await AIUsageLimits.collection.createIndex({ subscriptionTier: 1 });
      await AIUsageLimits.collection.createIndex({ suspended: 1 });
      await AIUsageLimits.collection.createIndex({ 'currentUsage.month': 1 });
      console.log('✅ AI Usage Limits indexes created');
    } catch (indexError) {
      console.log('ℹ️ Indexes may already exist:', indexError.message);
    }

    // Display tier configuration
    console.log('\n🎯 AI Usage Tier Configuration:');
    console.log('┌─────────────┬──────────────┬─────────────────┐');
    console.log('│ Tier        │ Requests/Mo  │ Budget/Mo (USD) │');
    console.log('├─────────────┼──────────────┼─────────────────┤');
    Object.entries(DEFAULT_TIER_LIMITS).forEach(([tier, limits]) => {
      const requests = limits.requests === -1 ? 'Unlimited' : limits.requests.toString();
      const budget = limits.budget === -1 ? 'Unlimited' : `$${limits.budget.toFixed(2)}`;
      console.log(`│ ${tier.padEnd(11)} │ ${requests.padEnd(12)} │ ${budget.padEnd(15)} │`);
    });
    console.log('└─────────────┴──────────────┴─────────────────┘');

    console.log('\n🎉 AI Usage Monitoring setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your application server');
    console.log('   2. Access the AI Usage Monitoring tab in the Super Admin dashboard');
    console.log('   3. Monitor AI usage and adjust limits as needed');
    console.log('   4. Set up alerts for budget thresholds');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the setup
if (require.main === module) {
  setupAIUsageMonitoring()
    .then(() => {
      console.log('\n✨ Setup script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup script failed:', error);
      process.exit(1);
    });
}

export default setupAIUsageMonitoring;