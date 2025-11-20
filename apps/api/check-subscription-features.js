const mongoose = require('mongoose');
require('dotenv').config();

async function checkSubscription() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Define schemas inline to avoid module issues
        const subscriptionSchema = new mongoose.Schema({}, { strict: false });
        const userSchema = new mongoose.Schema({}, { strict: false });

        const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
        const User = mongoose.models.User || mongoose.model('User', userSchema);

        // Find a user with 'pro' tier subscription
        const user = await User.findOne({ email: { $regex: /megagig/i } });
        if (!user) {
            console.log('❌ User not found');
            process.exit(0);
        }

        console.log('✅ User:', user.email, 'Workplace:', user.workplaceId);

        const sub = await Subscription.findOne({ workspaceId: user.workplaceId });
        if (!sub) {
            console.log('❌ No subscription found');
            process.exit(0);
        }

        console.log('\n📋 Subscription:');
        console.log('- Status:', sub.status);
        console.log('- Tier:', sub.tier);
        console.log('- Plan ID:', sub.planId);
        console.log('- Features array:', sub.features);
        console.log('- Has ai_diagnostics?', sub.features && sub.features.includes('ai_diagnostics'));

        // Fetch plan separately
        if (sub.planId) {
            const Plan = mongoose.models.PricingPlan || mongoose.model('PricingPlan', new mongoose.Schema({}, { strict: false }), 'pricingplans');
            const plan = await Plan.findById(sub.planId);
            if (plan) {
                console.log('\n📦 Plan document:');
                console.log('- Name:', plan.name);
                console.log('- Features:', plan.features);
                console.log('- Has ai_diagnostics?', plan.features && plan.features.includes('ai_diagnostics'));
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkSubscription();
