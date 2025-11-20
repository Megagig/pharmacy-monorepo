/**
 * Enable Appointment Features Script
 * 
 * This script enables the required feature flags for appointment scheduling
 * Run with: npm run ts-node src/scripts/enableAppointmentFeatures.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import FeatureFlag from '../models/FeatureFlag';
import logger from '../utils/logger';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacopilot';

/**
 * Feature flags to enable for appointment scheduling
 */
const REQUIRED_FEATURE_FLAGS = [
  {
    key: 'patient_engagement_module',
    name: 'Patient Engagement Module',
    description: 'Main patient engagement module with appointments, follow-ups, and reminders',
    metadata: {
      category: 'patient_engagement',
      priority: 'high',
      tags: ['patient-engagement', 'core'],
    },
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'intern_pharmacist', 'super_admin', 'owner', 'Pharmacist', 'Staff', 'Owner'],
    isActive: true,
  },
  {
    key: 'appointment_scheduling',
    name: 'Appointment Scheduling',
    description: 'Schedule and manage patient appointments with pharmacists',
    metadata: {
      category: 'patient_engagement',
      priority: 'high',
      tags: ['appointments', 'scheduling'],
    },
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'intern_pharmacist', 'super_admin', 'owner', 'Pharmacist', 'Staff', 'Owner'],
    isActive: true,
  },
  {
    key: 'followup_task_management',
    name: 'Follow-up Task Management',
    description: 'Create and manage follow-up tasks for patients',
    metadata: {
      category: 'patient_engagement',
      priority: 'high',
      tags: ['follow-ups', 'tasks'],
    },
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'intern_pharmacist', 'super_admin', 'owner', 'Pharmacist', 'Staff', 'Owner'],
    isActive: true,
  },
  {
    key: 'smart_reminder_system',
    name: 'Smart Reminder System',
    description: 'Automated reminder system for appointments and follow-ups',
    metadata: {
      category: 'patient_engagement',
      priority: 'medium',
      tags: ['reminders', 'automation'],
    },
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'intern_pharmacist', 'super_admin', 'owner', 'Pharmacist', 'Staff', 'Owner'],
    isActive: true,
  },
];

/**
 * Main function to enable feature flags
 */
async function enableAppointmentFeatures() {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB successfully');

    logger.info(`Enabling ${REQUIRED_FEATURE_FLAGS.length} feature flags...`);

    for (const flagData of REQUIRED_FEATURE_FLAGS) {
      try {
        // Check if feature flag already exists
        const existingFlag = await FeatureFlag.findOne({ key: flagData.key });

        if (existingFlag) {
          // Update existing flag
          await FeatureFlag.updateOne(
            { key: flagData.key },
            {
              $set: {
                isActive: true,
                allowedTiers: flagData.allowedTiers,
                allowedRoles: flagData.allowedRoles,
                metadata: flagData.metadata,
              }
            }
          );
          logger.info(`✅ Updated feature flag: ${flagData.key}`);
        } else {
          // Create new flag
          await FeatureFlag.create(flagData);
          logger.info(`✅ Created feature flag: ${flagData.key}`);
        }
      } catch (error) {
        logger.error(`❌ Failed to process feature flag: ${flagData.key}`, error);
      }
    }

    logger.info('✅ All feature flags have been enabled successfully!');
    logger.info('\nEnabled features:');
    REQUIRED_FEATURE_FLAGS.forEach(flag => {
      logger.info(`  - ${flag.name} (${flag.key})`);
    });

    logger.info('\nYou can now use appointment scheduling features!');
  } catch (error) {
    logger.error('❌ Error enabling feature flags:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('Database connection closed');
    process.exit(0);
  }
}

// Run the script
enableAppointmentFeatures();
