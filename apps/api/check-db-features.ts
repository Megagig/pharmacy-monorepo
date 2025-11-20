/**
 * Direct database check to verify plan features are correct
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Import models to register them with Mongoose (same as server.ts)
import './src/models/PricingPlan';
import './src/models/Subscription';

dotenv.config();

// Get the models after registration
const Subscription = mongoose.model('Subscription');
const PricingPlan = mongoose.model('PricingPlan');

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('✅ Connected to MongoDB\n');

        // Find the Pro subscription
        const sub: any = await Subscription.findOne({
            status: 'active',
            tier: 'pro'
        }).populate('planId').lean();

        console.log('📋 Subscription Details:');
        console.log('  Workspace ID:', sub?.workspaceId);
        console.log('  Status:', sub?.status);
        console.log('  Tier:', sub?.tier);
        console.log('  Plan ID:', sub?.planId?._id);
        console.log('  Plan Name:', sub?.planId?.name);
        console.log('\n📦 Plan Features:');
        console.log('  Type:', Array.isArray(sub?.planId?.features) ? 'Array' : typeof sub?.planId?.features);
        console.log('  Count:', Array.isArray(sub?.planId?.features) ? sub.planId.features.length : 'N/A');

        if (Array.isArray(sub?.planId?.features)) {
            console.log('  Has ai_diagnostics:', sub.planId.features.includes('ai_diagnostics'));
            console.log('  First 10 features:', sub.planId.features.slice(0, 10));
        } else {
            console.log('  Features object:', sub?.planId?.features);
        }

        await mongoose.disconnect();
        console.log('\n✅ Done');
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();
