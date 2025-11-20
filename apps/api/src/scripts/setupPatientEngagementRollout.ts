#!/usr/bin/env ts-node

/**
 * Patient Engagement Gradual Rollout Setup Script
 * 
 * This script sets up the patient engagement feature flags with gradual rollout capabilities.
 * It creates feature flags that can be gradually enabled for different percentages of workspaces.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeatureFlag } from '../models/FeatureFlag';
import { PATIENT_ENGAGEMENT_FLAGS } from '../middlewares/patientEngagementFeatureFlags';
import connectDB from '../config/db';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

interface PatientEngagementFeatureConfig {
  key: string;
  name: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  allowedTiers: string[];
  allowedRoles: string[];
  isMarketingFeature: boolean;
  displayOrder: number;
  marketingDescription?: string;
  icon?: string;
}

const PATIENT_ENGAGEMENT_FEATURES: PatientEngagementFeatureConfig[] = [
  {
    key: PATIENT_ENGAGEMENT_FLAGS.MODULE,
    name: 'Patient Engagement Module',
    description: 'Core patient engagement and follow-up management system',
    category: 'patient_engagement',
    priority: 'high',
    allowedTiers: ['professional', 'enterprise', 'premium'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'super_admin'],
    isMarketingFeature: true,
    displayOrder: 1,
    marketingDescription: 'Transform your pharmacy into a continuous care platform with systematic appointment scheduling and proactive follow-ups',
    icon: 'calendar-heart'
  },
  {
    key: PATIENT_ENGAGEMENT_FLAGS.APPOINTMENTS,
    name: 'Appointment Scheduling',
    description: 'Unified appointment scheduling system for all patient interactions',
    category: 'patient_engagement',
    priority: 'high',
    allowedTiers: ['professional', 'enterprise', 'premium'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'super_admin'],
    isMarketingFeature: true,
    displayOrder: 2,
    marketingDescription: 'Schedule MTM sessions, health checks, vaccinations, and consultations in one centralized calendar',
    icon: 'calendar-plus'
  },
  {
    key: PATIENT_ENGAGEMENT_FLAGS.FOLLOW_UPS,
    name: 'Follow-up Task Management',
    description: 'Automated follow-up task creation and management based on clinical events',
    category: 'patient_engagement',
    priority: 'high',
    allowedTiers: ['professional', 'enterprise', 'premium'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'super_admin'],
    isMarketingFeature: true,
    displayOrder: 3,
    marketingDescription: 'Never miss a critical follow-up with automated task creation for high-risk medications and clinical events',
    icon: 'clipboard-check'
  },
  {
    key: PATIENT_ENGAGEMENT_FLAGS.REMINDERS,
    name: 'Smart Reminder System',
    description: 'Multi-channel reminder system for appointments and medication adherence',
    category: 'patient_engagement',
    priority: 'high',
    allowedTiers: ['professional', 'enterprise', 'premium'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'super_admin'],
    isMarketingFeature: true,
    displayOrder: 4,
    marketingDescription: 'Reduce no-shows and improve adherence with intelligent reminders via SMS, email, and WhatsApp',
    icon: 'bell-ring'
  },
  {
    key: PATIENT_ENGAGEMENT_FLAGS.PATIENT_PORTAL,
    name: 'Patient Portal',
    description: 'Self-service portal for patients to book appointments and manage their care',
    category: 'patient_engagement',
    priority: 'medium',
    allowedTiers: ['enterprise', 'premium'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'super_admin'],
    isMarketingFeature: true,
    displayOrder: 5,
    marketingDescription: 'Empower patients to book appointments online and manage their healthcare journey',
    icon: 'user-circle'
  },
  {
    key: PATIENT_ENGAGEMENT_FLAGS.RECURRING_APPOINTMENTS,
    name: 'Recurring Appointments',
    description: 'Support for recurring appointments for chronic disease management',
    category: 'patient_engagement',
    priority: 'medium',
    allowedTiers: ['professional', 'enterprise', 'premium'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'super_admin'],
    isMarketingFeature: false,
    displayOrder: 6
  },
  {
    key: PATIENT_ENGAGEMENT_FLAGS.CLINICAL_ALERTS,
    name: 'Clinical Alerts',
    description: 'Contextual alerts and pop-ups based on patient clinical data',
    category: 'patient_engagement',
    priority: 'medium',
    allowedTiers: ['professional', 'enterprise', 'premium'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'super_admin'],
    isMarketingFeature: false,
    displayOrder: 7
  },
  {
    key: PATIENT_ENGAGEMENT_FLAGS.ANALYTICS,
    name: 'Engagement Analytics',
    description: 'Analytics and reporting for appointment and follow-up performance',
    category: 'patient_engagement',
    priority: 'medium',
    allowedTiers: ['enterprise', 'premium'],
    allowedRoles: ['pharmacy_manager', 'super_admin'],
    isMarketingFeature: true,
    displayOrder: 8,
    marketingDescription: 'Track appointment completion rates, patient engagement metrics, and pharmacy capacity utilization',
    icon: 'chart-line'
  },
  {
    key: PATIENT_ENGAGEMENT_FLAGS.SCHEDULE_MANAGEMENT,
    name: 'Schedule Management',
    description: 'Pharmacist schedule and capacity management tools',
    category: 'patient_engagement',
    priority: 'low',
    allowedTiers: ['professional', 'enterprise', 'premium'],
    allowedRoles: ['pharmacy_manager', 'super_admin'],
    isMarketingFeature: false,
    displayOrder: 9
  },
  {
    key: PATIENT_ENGAGEMENT_FLAGS.MODULE_INTEGRATION,
    name: 'Module Integration',
    description: 'Integration with existing Patient, Visit, MTR, and Clinical Intervention modules',
    category: 'patient_engagement',
    priority: 'high',
    allowedTiers: ['professional', 'enterprise', 'premium'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'super_admin'],
    isMarketingFeature: false,
    displayOrder: 10
  }
];

/**
 * Create or update patient engagement feature flags
 */
async function setupPatientEngagementFeatureFlags(): Promise<void> {
  try {
    logger.info('Setting up Patient Engagement feature flags...');

    for (const featureConfig of PATIENT_ENGAGEMENT_FEATURES) {
      const existingFlag = await FeatureFlag.findOne({ key: featureConfig.key });

      if (existingFlag) {
        logger.info(`Updating existing feature flag: ${featureConfig.key}`);
        
        // Update existing flag while preserving targeting rules
        await FeatureFlag.findOneAndUpdate(
          { key: featureConfig.key },
          {
            $set: {
              name: featureConfig.name,
              description: featureConfig.description,
              allowedTiers: featureConfig.allowedTiers,
              allowedRoles: featureConfig.allowedRoles,
              'metadata.category': featureConfig.category,
              'metadata.priority': featureConfig.priority,
              'metadata.displayOrder': featureConfig.displayOrder,
              'metadata.isMarketingFeature': featureConfig.isMarketingFeature,
              'metadata.marketingDescription': featureConfig.marketingDescription,
              'metadata.icon': featureConfig.icon,
              updatedAt: new Date()
            }
          }
        );
      } else {
        logger.info(`Creating new feature flag: ${featureConfig.key}`);
        
        // Create new flag with 0% rollout initially
        await FeatureFlag.create({
          key: featureConfig.key,
          name: featureConfig.name,
          description: featureConfig.description,
          isActive: true,
          allowedTiers: featureConfig.allowedTiers,
          allowedRoles: featureConfig.allowedRoles,
          metadata: {
            category: featureConfig.category,
            priority: featureConfig.priority,
            displayOrder: featureConfig.displayOrder,
            isMarketingFeature: featureConfig.isMarketingFeature,
            marketingDescription: featureConfig.marketingDescription,
            icon: featureConfig.icon,
            tags: ['patient_engagement', 'rollout']
          },
          targetingRules: {
            percentage: 0, // Start with 0% rollout
            conditions: {
              dateRange: {
                startDate: new Date(), // Available from now
                endDate: undefined // No end date
              }
            }
          },
          usageMetrics: {
            totalUsers: 0,
            activeUsers: 0,
            usagePercentage: 0,
            lastUsed: new Date(),
            usageByPlan: [],
            usageByWorkspace: []
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    logger.info('Patient Engagement feature flags setup completed successfully');
  } catch (error) {
    logger.error('Error setting up Patient Engagement feature flags:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    // Connect to database
    await connectDB();
    logger.info('Connected to database');

    // Setup feature flags
    await setupPatientEngagementFeatureFlags();

    logger.info('Patient Engagement rollout setup completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Setup failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { setupPatientEngagementFeatureFlags };