import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FeatureFlag from '../src/models/FeatureFlag';
import User from '../src/models/User';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || '');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(
      `Error connecting to MongoDB: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exit(1);
  }
};

// Define feature flags
const featureFlags = [
  // Core Features
  {
    name: 'Patient Management',
    key: 'patient_management',
    description: 'Core functionality for managing patient records',
    isActive: true,
    allowedTiers: ['free_trial', 'basic', 'pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'intern_pharmacist',
    ],
    customRules: {},
    metadata: {
      category: 'core',
      priority: 'critical',
      tags: ['patients', 'core', 'records'],
    },
  },
  {
    name: 'Medication Management',
    key: 'medication_management',
    description:
      'Core functionality for managing medication records and inventory',
    isActive: true,
    allowedTiers: ['free_trial', 'basic', 'pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'core',
      priority: 'critical',
      tags: ['medications', 'core', 'inventory'],
    },
  },
  {
    name: 'Basic Clinical Notes',
    key: 'basic_clinical_notes',
    description: 'Basic clinical note creation and management',
    isActive: true,
    allowedTiers: ['free_trial', 'basic', 'pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'intern_pharmacist',
    ],
    customRules: {},
    metadata: {
      category: 'core',
      priority: 'high',
      tags: ['clinical', 'notes', 'core'],
    },
  },
  {
    name: 'Clinical Decision Support',
    key: 'clinical_decision_support',
    description: 'AI-powered clinical decision support for diagnostic analysis',
    isActive: true,
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
    customRules: {
      requiredLicense: true,
    },
    metadata: {
      category: 'core',
      priority: 'high',
      tags: ['ai', 'diagnostics', 'clinical'],
    },
  },

  // Analytics Features
  {
    name: 'Basic Reports',
    key: 'basic_reports',
    description: 'Access to basic system reports and analytics',
    isActive: true,
    allowedTiers: ['basic', 'pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'analytics',
      priority: 'medium',
      tags: ['reports', 'analytics', 'statistics'],
    },
  },
  {
    name: 'Advanced Analytics',
    key: 'advanced_analytics',
    description: 'Advanced business intelligence dashboards and reports',
    isActive: true,
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacy_team', 'pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'analytics',
      priority: 'high',
      tags: ['analytics', 'dashboard', 'business intelligence'],
    },
  },
  {
    name: 'Predictive Analytics',
    key: 'predictive_analytics',
    description: 'AI-powered predictive analytics for business forecasting',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'analytics',
      priority: 'medium',
      tags: ['AI', 'analytics', 'predictions'],
    },
  },

  // Collaboration Features
  {
    name: 'Team Management',
    key: 'team_management',
    description: 'Create and manage pharmacy team members',
    isActive: true,
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacy_team', 'pharmacy_outlet'],
    customRules: {
      maxUsers: 10,
    },
    metadata: {
      category: 'collaboration',
      priority: 'high',
      tags: ['team', 'users', 'collaboration'],
    },
  },
  {
    name: 'Role Management',
    key: 'role_management',
    description: 'Advanced role and permission management',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'collaboration',
      priority: 'medium',
      tags: ['rbac', 'permissions', 'roles'],
    },
  },
  {
    name: 'Pharmacy Network',
    key: 'pharmacy_network',
    description: 'Connect and collaborate with other pharmacies',
    isActive: false, // Feature not yet active
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'collaboration',
      priority: 'low',
      tags: ['network', 'collaboration'],
    },
  },

  // Integration Features
  {
    name: 'API Access',
    key: 'api_access',
    description: 'Access to API endpoints for external integrations',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'integration',
      priority: 'medium',
      tags: ['api', 'integrations'],
    },
  },
  {
    name: 'Health System Integration',
    key: 'health_system_integration',
    description: 'Integration with external healthcare systems',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'integration',
      priority: 'high',
      tags: ['integrations', 'health systems'],
    },
  },

  // Compliance Features
  {
    name: 'Compliance Tracking',
    key: 'compliance_tracking',
    description: 'Track regulatory compliance requirements',
    isActive: true,
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
    customRules: {
      requiredLicense: true,
    },
    metadata: {
      category: 'compliance',
      priority: 'high',
      tags: ['compliance', 'regulatory'],
    },
  },
  {
    name: 'Audit Logs',
    key: 'audit_logs',
    description: 'Detailed audit logs for compliance and security',
    isActive: true,
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacy_team', 'pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'compliance',
      priority: 'high',
      tags: ['audit', 'security', 'compliance'],
    },
  },

  // Administration Features
  {
    name: 'Feature Flag Management',
    key: 'feature_flag_management',
    description: 'Manage and control system feature flags',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['super_admin'],
    customRules: {},
    metadata: {
      category: 'administration',
      priority: 'medium',
      tags: ['admin', 'features', 'configuration'],
    },
  },
  {
    name: 'System Settings',
    key: 'system_settings',
    description: 'Control system-wide configuration and settings',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['super_admin'],
    customRules: {},
    metadata: {
      category: 'administration',
      priority: 'high',
      tags: ['admin', 'settings', 'configuration'],
    },
  },
];

// Seed feature flags
const seedFeatureFlags = async () => {
  try {
    // Get admin user for attribution
    const adminUser = await User.findOne({ role: 'super_admin' });

    if (!adminUser) {
      console.error(
        'Admin user not found - cannot seed feature flags with attribution'
      );
      process.exit(1);
    }

    // Clear existing feature flags
    await FeatureFlag.deleteMany({});
    console.log('Existing feature flags cleared');

    // Insert new feature flags with admin user attribution
    const featureFlagsWithAttribution = featureFlags.map((flag) => ({
      ...flag,
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
    }));

    await FeatureFlag.insertMany(featureFlagsWithAttribution);
    console.log(`${featureFlags.length} feature flags seeded successfully`);

    // Exit process
    process.exit(0);
  } catch (error) {
    console.error(
      `Error seeding feature flags: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exit(1);
  }
};

// Run the seeder
connectDB().then(() => {
  seedFeatureFlags();
});
