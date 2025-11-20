import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;

        // Get subscription document directly
        const subscription = await db.collection('subscriptions').findOne({
            status: 'active',
            tier: 'pro'
        });

        console.log('📋 Raw Subscription Document:');
        console.log(JSON.stringify(subscription, null, 2));

        if (subscription?.planId) {
            console.log('\n📋 Plan ID exists, checking if plan document exists...');
            const plan = await db.collection('pricingplans').findOne({
                _id: subscription.planId
            });

            if (plan) {
                console.log('✅ Plan found:', plan.name);
                console.log('Features:', plan.features);
            } else {
                console.log('❌ Plan NOT found with ID:', subscription.planId);
                console.log('This means the planId references a non-existent document!');
            }
        } else {
            console.log('\n⚠️ Subscription has no planId field!');
            console.log('Need to set planId on subscription document.');
        }

        // Check what plans exist
        console.log('\n📦 Available Plans:');
        const plans = await db.collection('pricingplans').find({}).toArray();
        plans.forEach(p => {
            console.log(`  - ${p._id}: ${p.name} (${p.tier})`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
})();
