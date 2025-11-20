import dotenv from 'dotenv';
import mongoose from 'mongoose';
import FeatureFlag from '../models/FeatureFlag';
import User from '../models/User';
import connectDB from '../config/db';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

/**
 * Script to add missing diagnostic feature flags to the database
 */

const diagnosticFeatureFlags = [
    {
        name: 'AI Diagnostics',
        key: 'ai_diagnostics',
        description: 'Enable AI-powered diagnostic analysis and clinical decision support',
        isActive: true,
        allowedTiers: ['free_trial', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'super_admin', 'owner'],
        customRules: {
            requiredLicense: true,
            maxUsers: null
        },
        metadata: {
            category: 'core',
            priority: 'high' as const,
            tags: ['ai', 'diagnostics', 'clinical', 'decision-support']
        }
    },
    {
        name: 'Clinical Decision Support',
        key: 'clinical_decision_support',
        description: 'Enable clinical decision support system and diagnostic workflows',
        isActive: true,
        allowedTiers: ['free_trial', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'super_admin', 'owner'],
        customRules: {
            requiredLicense: true,
            maxUsers: null
        },
        metadata: {
            category: 'core',
            priority: 'high' as const,
            tags: ['clinical', 'decision-support', 'diagnostics', 'workflow']
        }
    },
    {
        name: 'Drug Information',
        key: 'drug_information',
        description: 'Enable drug interaction checking, contraindications, and drug information lookup',
        isActive: true,
        allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'intern_pharmacist', 'super_admin', 'owner'],
        customRules: {
            requiredLicense: false,
            maxUsers: null
        },
        metadata: {
            category: 'core',
            priority: 'high' as const,
            tags: ['drug', 'interactions', 'contraindications', 'safety']
        }
    }
];

async function addDiagnosticFeatureFlags() {
    try {
        // Connect to database
        await connectDB();
        logger.info('Connected to database');

        // Find a super admin user to use as creator
        const superAdmin = await User.findOne({ role: 'super_admin' });
        if (!superAdmin) {
            throw new Error('No super admin user found. Please create a super admin user first.');
        }

        logger.info(`Using super admin user: ${superAdmin.firstName} ${superAdmin.lastName} (${superAdmin._id})`);

        // Add each feature flag
        for (const flagData of diagnosticFeatureFlags) {
            try {
                // Check if feature flag already exists
                const existingFlag = await FeatureFlag.findOne({ key: flagData.key });

                if (existingFlag) {
                    logger.info(`Feature flag '${flagData.key}' already exists, updating...`);

                    // Update existing flag
                    await FeatureFlag.findOneAndUpdate(
                        { key: flagData.key },
                        {
                            ...flagData,
                            updatedBy: superAdmin._id
                        },
                        { new: true }
                    );

                    logger.info(`✅ Updated feature flag: ${flagData.name}`);
                } else {
                    // Create new feature flag
                    const newFlag = new FeatureFlag({
                        ...flagData,
                        createdBy: superAdmin._id,
                        updatedBy: superAdmin._id
                    });

                    await newFlag.save();
                    logger.info(`✅ Created feature flag: ${flagData.name}`);
                }
            } catch (error) {
                logger.error(`❌ Failed to create/update feature flag '${flagData.key}':`, error);
            }
        }

        // Verify all flags were created
        const createdFlags = await FeatureFlag.find({
            key: { $in: diagnosticFeatureFlags.map(f => f.key) }
        });

        logger.info(`\n📊 Summary:`);
        logger.info(`- Expected feature flags: ${diagnosticFeatureFlags.length}`);
        logger.info(`- Created/Updated feature flags: ${createdFlags.length}`);

        createdFlags.forEach(flag => {
            logger.info(`  ✓ ${flag.name} (${flag.key}) - Active: ${flag.isActive}`);
        });

        if (createdFlags.length === diagnosticFeatureFlags.length) {
            logger.info('\n🎉 All diagnostic feature flags have been successfully added!');
            logger.info('\nNext steps:');
            logger.info('1. Update subscription plans to include ai_diagnostics feature');
            logger.info('2. Restart the backend server');
            logger.info('3. Test the diagnostic endpoints');
        } else {
            logger.warn('\n⚠️  Some feature flags may not have been created properly. Please check the logs above.');
        }

    } catch (error) {
        logger.error('❌ Failed to add diagnostic feature flags:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        logger.info('Database connection closed');
    }
}

// Run the script
if (require.main === module) {
    addDiagnosticFeatureFlags()
        .then(() => {
            logger.info('Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Script failed:', error);
            process.exit(1);
        });
}

export default addDiagnosticFeatureFlags;