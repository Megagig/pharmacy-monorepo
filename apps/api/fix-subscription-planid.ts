import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;

        // Find a Pro plan with features
        const proPlan = await db.collection('pricingplans').findOne({
            tier: 'pro',
            features: { $exists: true, $ne: [] }
        });

        if (!proPlan) {
            console.error('❌ No Pro plan found with features!');
            process.exit(1);
        }

        console.log(`📦 Found Pro Plan: ${proPlan._id} (${proPlan.name})`);
        console.log(`Features: ${proPlan.features?.length || 0} features`);
        console.log(`Has ai_diagnostics: ${proPlan.features?.includes('ai_diagnostics')}`);

        // Update all active Pro subscriptions to use this plan
        const result = await db.collection('subscriptions').updateMany(
            {
                tier: 'pro',
                status: { $in: ['active', 'trial', 'past_due'] }
            },
            {
                $set: {
                    planId: proPlan._id
                }
            }
        );

        console.log(`\n✅ Updated ${result.modifiedCount} subscription(s)`);

        // Verify the fix
        const subscription = await db.collection('subscriptions').findOne({
            workspaceId: new mongoose.Types.ObjectId('68b5cd85f1f0f9758b8afbbf')
        });

        console.log('\n📋 Verification:');
        console.log(`Subscription planId: ${subscription?.planId}`);
        console.log(`Plan exists: ${subscription?.planId?.toString() === proPlan._id.toString()}`);

        await mongoose.disconnect();
        console.log('\n✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
})();
