import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;

        // Define all features that should be in Pro plan
        const proFeatures = [
            'ai_diagnostics',
            'reportsExport',
            'careNoteExport',
            'multiUserSupport',
            'prioritySupport',
            'emailReminders',
            'smsReminders',
            'advancedReports',
            'teamManagement',
            'basic_clinical_notes',
            'basic_reports',
            'team_management',
            'patient_management',
            'medication_management',
            'advanced_analytics',
            'compliance_tracking',
            'clinical_decision_support',
            'api_access',
            'audit_logs'
        ];

        // Update all Pro plans
        const result = await db.collection('pricingplans').updateMany(
            { tier: 'pro' },
            {
                $set: {
                    features: proFeatures
                }
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} Pro plan(s) with ${proFeatures.length} features`);

        // Now get one Pro plan
        const proPlan = await db.collection('pricingplans').findOne({ tier: 'pro' });

        console.log(`\n📦 Pro Plan ID: ${proPlan?._id}`);
        console.log(`Features: ${proPlan?.features?.length}`);
        console.log(`Has ai_diagnostics: ${proPlan?.features?.includes('ai_diagnostics')}`);

        // Update subscriptions to use this plan
        const subResult = await db.collection('subscriptions').updateMany(
            {
                tier: 'pro',
                status: { $in: ['active', 'trial', 'past_due'] }
            },
            {
                $set: {
                    planId: proPlan?._id
                }
            }
        );

        console.log(`\n✅ Updated ${subResult.modifiedCount} subscription(s) to use plan ${proPlan?._id}`);

        await mongoose.disconnect();
        console.log('\n✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
})();
