/**
 * Script to create Patient Engagement & Follow-up Management feature flags
 * 
 * This script creates all necessary feature flags for the patient engagement module
 * with proper configuration for gradual rollout.
 */

import mongoose from 'mongoose';
import { FeatureFlag } from '../src/models/FeatureFlag';
import logger from '../src/utils/logger';

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Load environment variables
    require('dotenv').config();
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';
    console.log('Connecting to MongoDB Atlas...');
    
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB Atlas for feature flag creation');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Patient Engagement Feature Flags Configuration
const patientEngagementFeatureFlags = [
  {
    name: 'Patient Engagement Module',
    key: 'patient_engagement_module',
    description: 'Enable the complete Patient Engagement & Follow-up Management module',
    isActive: false, // Start disabled for gradual rollout
    allowedTiers: ['premium', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'admin'],
    customRules: {
      requiredLicense: true,
      targeting: {
        percentage: 0, // Start with 0% rollout
        conditions: {
          dateRange: {
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-12-31')
          }
        }
      }
    },
    metadata: {
      category: 'patient_engagement',
      priority: 'high',
      tags: ['appointments', 'follow-ups', 'patient-care', 'core-feature'],
      displayOrder: 1,
      marketingDescription: 'Complete appointment scheduling and follow-up management system',
      isMarketingFeature: true,
      icon: 'calendar_today'
    },
    targetingRules: {
      percentage: 0,
      conditions: {
        dateRange: {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31')
        }
      }
    }
  },
  {
    name: 'Appointment Scheduling',
    key: 'appointment_scheduling',
    description: 'Enable appointment scheduling functionality',
    isActive: false,
    allowedTiers: ['premium', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'admin'],
    customRules: {
      requiredLicense: true,
      targeting: {
        percentage: 0
      }
    },
    metadata: {
      category: 'patient_engagement',
      priority: 'high',
      tags: ['appointments', 'scheduling', 'calendar'],
      displayOrder: 2,
      marketingDescription: 'Schedule and manage patient appointments with calendar integration',
      isMarketingFeature: true,
      icon: 'event'
    },
    targetingRules: {
      percentage: 0
    }
  },
  {
    name: 'Follow-up Task Management',
    key: 'followup_task_management',
    description: 'Enable automated follow-up task creation and management',
    isActive: false,
    allowedTiers: ['premium', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'admin'],
    customRules: {
      requiredLicense: true,
      targeting: {
        percentage: 0
      }
    },
    metadata: {
      category: 'patient_engagement',
      priority: 'high',
      tags: ['follow-ups', 'tasks', 'automation'],
      displayOrder: 3,
      marketingDescription: 'Automated follow-up task creation based on clinical events',
      isMarketingFeature: true,
      icon: 'task_alt'
    },
    targetingRules: {
      percentage: 0
    }
  },
  {
    name: 'Smart Reminder System',
    key: 'smart_reminder_system',
    description: 'Enable multi-channel appointment and medication reminders',
    isActive: false,
    allowedTiers: ['premium', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'admin'],
    customRules: {
      requiredLicense: true,
      targeting: {
        percentage: 0
      }
    },
    metadata: {
      category: 'patient_engagement',
      priority: 'medium',
      tags: ['reminders', 'notifications', 'patient-communication'],
      displayOrder: 4,
      marketingDescription: 'Automated reminders via SMS, email, and WhatsApp',
      isMarketingFeature: true,
      icon: 'notifications'
    },
    targetingRules: {
      percentage: 0
    }
  },
  {
    name: 'Patient Portal',
    key: 'patient_portal',
    description: 'Enable patient self-service portal for appointment booking',
    isActive: false,
    allowedTiers: ['premium', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'admin'],
    customRules: {
      requiredLicense: true,
      targeting: {
        percentage: 0
      }
    },
    metadata: {
      category: 'patient_engagement',
      priority: 'medium',
      tags: ['patient-portal', 'self-service', 'booking'],
      displayOrder: 5,
      marketingDescription: 'Allow patients to book and manage appointments online',
      isMarketingFeature: true,
      icon: 'person'
    },
    targetingRules: {
      percentage: 0
    }
  },
  {
    name: 'Recurring Appointments',
    key: 'recurring_appointments',
    description: 'Enable recurring appointment scheduling for chronic disease patients',
    isActive: false,
    allowedTiers: ['premium', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'admin'],
    customRules: {
      requiredLicense: true,
      targeting: {
        percentage: 0
      }
    },
    metadata: {
      category: 'patient_engagement',
      priority: 'medium',
      tags: ['recurring', 'chronic-care', 'scheduling'],
      displayOrder: 6,
      marketingDescription: 'Automated recurring appointments for ongoing patient care',
      isMarketingFeature: true,
      icon: 'repeat'
    },
    targetingRules: {
      percentage: 0
    }
  },
  {
    name: 'Clinical Alerts',
    key: 'clinical_alerts',
    description: 'Enable contextual clinical alerts and pop-ups',
    isActive: false,
    allowedTiers: ['premium', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'admin'],
    customRules: {
      requiredLicense: true,
      targeting: {
        percentage: 0
      }
    },
    metadata: {
      category: 'patient_engagement',
      priority: 'medium',
      tags: ['alerts', 'clinical-decision-support', 'patient-safety'],
      displayOrder: 7,
      marketingDescription: 'Smart alerts for overdue appointments and clinical issues',
      isMarketingFeature: true,
      icon: 'warning'
    },
    targetingRules: {
      percentage: 0
    }
  },
  {
    name: 'Engagement Analytics',
    key: 'engagement_analytics',
    description: 'Enable patient engagement analytics and reporting',
    isActive: false,
    allowedTiers: ['premium', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'admin'],
    customRules: {
      requiredLicense: true,
      targeting: {
        percentage: 0
      }
    },
    metadata: {
      category: 'patient_engagement',
      priority: 'low',
      tags: ['analytics', 'reporting', 'metrics'],
      displayOrder: 8,
      marketingDescription: 'Comprehensive analytics on patient engagement and outcomes',
      isMarketingFeature: true,
      icon: 'analytics'
    },
    targetingRules: {
      percentage: 0
    }
  },
  {
    name: 'Schedule Management',
    key: 'schedule_management',
    description: 'Enable pharmacist schedule and capacity management',
    isActive: false,
    allowedTiers: ['premium', 'enterprise'],
    allowedRoles: ['pharmacy_manager', 'admin'],
    customRules: {
      requiredLicense: true,
      targeting: {
        percentage: 0
      }
    },
    metadata: {
      category: 'patient_engagement',
      priority: 'medium',
      tags: ['scheduling', 'capacity', 'workforce-management'],
      displayOrder: 9,
      marketingDescription: 'Manage pharmacist schedules and appointment capacity',
      isMarketingFeature: false,
      icon: 'schedule'
    },
    targetingRules: {
      percentage: 0
    }
  },
  {
    name: 'Module Integration',
    key: 'engagement_module_integration',
    description: 'Enable integration with existing modules (Visit, MTR, Clinical Interventions)',
    isActive: false,
    allowedTiers: ['premium', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_manager', 'admin'],
    customRules: {
      requiredLicense: true,
      targeting: {
        percentage: 0
      }
    },
    metadata: {
      category: 'patient_engagement',
      priority: 'high',
      tags: ['integration', 'workflow', 'interoperability'],
      displayOrder: 10,
      marketingDescription: 'Seamless integration with existing pharmacy workflows',
      isMarketingFeature: false,
      icon: 'integration_instructions'
    },
    targetingRules: {
      percentage: 0
    }
  }
];

// Create feature flags
const createFeatureFlags = async () => {
  try {
    logger.info('Creating Patient Engagement feature flags...');

    for (const flagData of patientEngagementFeatureFlags) {
      // Check if flag already exists
      const existingFlag = await FeatureFlag.findOne({ key: flagData.key });
      
      if (existingFlag) {
        logger.info(`Feature flag '${flagData.key}' already exists, skipping...`);
        continue;
      }

      // Create new feature flag
      const featureFlag = new FeatureFlag({
        ...flagData,
        createdBy: null, // System created
        usageMetrics: {
          totalUsers: 0,
          activeUsers: 0,
          usagePercentage: 0,
          lastUsed: null
        }
      });

      await featureFlag.save();
      logger.info(`Created feature flag: ${flagData.key}`);
    }

    logger.info('Patient Engagement feature flags created successfully!');
    
    // Display summary
    console.log('\n=== PATIENT ENGAGEMENT FEATURE FLAGS CREATED ===');
    console.log('The following feature flags have been created:');
    patientEngagementFeatureFlags.forEach((flag, index) => {
      console.log(`${index + 1}. ${flag.name} (${flag.key})`);
      console.log(`   - Description: ${flag.description}`);
      console.log(`   - Status: ${flag.isActive ? 'ENABLED' : 'DISABLED'}`);
      console.log(`   - Rollout: ${flag.targetingRules?.percentage || 0}%`);
      console.log('');
    });
    
    console.log('All flags are initially DISABLED for gradual rollout.');
    console.log('Use the feature flag management UI to enable them progressively.');
    
  } catch (error) {
    logger.error('Error creating feature flags:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await createFeatureFlags();
    
    console.log('\n✅ Patient Engagement feature flags setup complete!');
    console.log('\nNext steps:');
    console.log('1. Use the admin dashboard to configure rollout percentages');
    console.log('2. Enable flags progressively: 10% → 25% → 50% → 100%');
    console.log('3. Monitor usage metrics and error rates during rollout');
    
  } catch (error) {
    console.error('❌ Feature flag creation failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

export { patientEngagementFeatureFlags, createFeatureFlags };