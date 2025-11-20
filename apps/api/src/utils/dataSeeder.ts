import mongoose from 'mongoose';
import { config } from 'dotenv';
import { FeatureFlag } from '../models/FeatureFlag';
import SubscriptionPlan from '../models/SubscriptionPlan';
import User from '../models/User';
import bcrypt from 'bcryptjs';

// Load environment variables
config();

// Default feature flags configuration
const defaultFeatureFlags = [
  // Core Features
  {
    name: 'Patient Management',
    key: 'patient_management',
    description: 'Create, view, and manage patient records',
    allowedTiers: ['free_trial', 'basic', 'pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'super_admin',
    ],
    metadata: {
      category: 'core',
      priority: 'critical',
      tags: ['patients', 'basic'],
    },
  },
  {
    name: 'Medication Management',
    key: 'medication_management',
    description: 'Manage medication inventory and prescriptions',
    allowedTiers: ['free_trial', 'basic', 'pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'super_admin',
    ],
    metadata: {
      category: 'core',
      priority: 'critical',
      tags: ['medications', 'inventory'],
    },
  },
  {
    name: 'Clinical Notes',
    key: 'clinical_notes',
    description: 'Create and manage clinical notes for patients',
    allowedTiers: ['basic', 'pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'super_admin',
    ],
    customRules: {
      requiredLicense: true,
    },
    metadata: {
      category: 'core',
      priority: 'high',
      tags: ['notes', 'clinical'],
    },
  },

  // Analytics Features
  {
    name: 'Basic Reports',
    key: 'basic_reports',
    description: 'Generate basic reports and analytics',
    allowedTiers: ['basic', 'pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'super_admin',
    ],
    metadata: {
      category: 'analytics',
      priority: 'medium',
      tags: ['reports', 'analytics'],
    },
  },
  {
    name: 'Advanced Analytics',
    key: 'advanced_analytics',
    description: 'Access to advanced analytics and insights',
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'super_admin',
    ],
    metadata: {
      category: 'analytics',
      priority: 'medium',
      tags: ['analytics', 'insights', 'premium'],
    },
  },
  {
    name: 'Data Export',
    key: 'data_export',
    description: 'Export data in various formats (CSV, PDF, Excel)',
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'super_admin',
    ],
    metadata: {
      category: 'analytics',
      priority: 'medium',
      tags: ['export', 'data'],
    },
  },

  // Collaboration Features
  {
    name: 'Team Management',
    key: 'team_management',
    description: 'Invite and manage team members',
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacy_team', 'pharmacy_outlet', 'super_admin'],
    customRules: {
      maxUsers: 10,
    },
    metadata: {
      category: 'collaboration',
      priority: 'high',
      tags: ['team', 'collaboration'],
    },
  },
  {
    name: 'Multi-User Access',
    key: 'multi_user_access',
    description: 'Support for multiple users under one account',
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacy_team', 'pharmacy_outlet', 'super_admin'],
    metadata: {
      category: 'collaboration',
      priority: 'high',
      tags: ['multi-user', 'team'],
    },
  },
  {
    name: 'Role Management',
    key: 'role_management',
    description: 'Assign and manage user roles and permissions',
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacy_outlet', 'super_admin'],
    metadata: {
      category: 'collaboration',
      priority: 'medium',
      tags: ['roles', 'permissions'],
    },
  },

  // Integration Features
  {
    name: 'API Access',
    key: 'api_access',
    description: 'Access to REST API for integrations',
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacy_outlet', 'super_admin'],
    metadata: {
      category: 'integration',
      priority: 'low',
      tags: ['api', 'integration'],
    },
  },
  {
    name: 'Third-party Integrations',
    key: 'third_party_integrations',
    description: 'Connect with external systems and services',
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacy_outlet', 'super_admin'],
    metadata: {
      category: 'integration',
      priority: 'low',
      tags: ['integrations', 'external'],
    },
  },

  // Compliance Features
  {
    name: 'Audit Logs',
    key: 'audit_logs',
    description: 'Track all system activities and changes',
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'super_admin',
    ],
    metadata: {
      category: 'compliance',
      priority: 'high',
      tags: ['audit', 'compliance'],
    },
  },
  {
    name: 'Data Backup',
    key: 'data_backup',
    description: 'Automated data backup and recovery',
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'super_admin',
    ],
    metadata: {
      category: 'compliance',
      priority: 'high',
      tags: ['backup', 'recovery'],
    },
  },

  // Administration Features
  {
    name: 'User Management',
    key: 'user_management',
    description: 'Manage all system users and their permissions',
    allowedTiers: ['enterprise'],
    allowedRoles: ['super_admin'],
    metadata: {
      category: 'administration',
      priority: 'critical',
      tags: ['admin', 'users'],
    },
  },
  {
    name: 'System Configuration',
    key: 'system_configuration',
    description: 'Configure system settings and parameters',
    allowedTiers: ['enterprise'],
    allowedRoles: ['super_admin'],
    metadata: {
      category: 'administration',
      priority: 'critical',
      tags: ['admin', 'configuration'],
    },
  },
];

// Updated subscription plans with new pricing and features
const subscriptionPlans = [
  // Monthly plans
  {
    name: 'Free Trial',
    priceNGN: 0,
    billingInterval: 'monthly',
    isActive: true,
    tier: 'free_trial',
    trialDuration: 14, // days
    features: {
      patientLimit: null, // Unlimited during trial
      reminderSmsMonthlyLimit: null, // Unlimited during trial
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: false,
      teamSize: 1,
      apiAccess: true,
      auditLogs: true,
      dataBackup: true,
      clinicalNotesLimit: null, // Unlimited during trial
      prioritySupport: false,
      emailReminders: true,
      smsReminders: false,
      advancedReports: true,
      drugTherapyManagement: true,
      teamManagement: false,
      dedicatedSupport: false,
      adrReporting: false,
      drugInteractionChecker: false,
      doseCalculator: false,
      multiLocationDashboard: false,
      sharedPatientRecords: false,
      groupAnalytics: false,
      cdss: false,
    },
    description: '14-day free trial with access to all features',
    popularPlan: false,
  },
  {
    name: 'Basic',
    priceNGN: 1000,
    billingInterval: 'monthly',
    isActive: true,
    tier: 'basic',
    features: {
      patientLimit: 100,
      reminderSmsMonthlyLimit: 0, // No SMS
      reportsExport: true,
      careNoteExport: false,
      adrModule: false,
      multiUserSupport: false,
      teamSize: 1,
      apiAccess: false,
      auditLogs: false,
      dataBackup: false,
      clinicalNotesLimit: 500,
      patientRecordsLimit: 500,
      prioritySupport: false,
      emailReminders: true,
      smsReminders: false,
      advancedReports: false,
      drugTherapyManagement: false,
      teamManagement: false,
      dedicatedSupport: false,
      adrReporting: false,
      drugInteractionChecker: false,
      doseCalculator: false,
      multiLocationDashboard: false,
      sharedPatientRecords: false,
      groupAnalytics: false,
      cdss: false,
    },
    description: 'Perfect for individual pharmacists starting out',
    popularPlan: false,
  },
  {
    name: 'Pro',
    priceNGN: 2000,
    billingInterval: 'monthly',
    isActive: true,
    tier: 'pro',
    features: {
      patientLimit: null, // Unlimited
      reminderSmsMonthlyLimit: null, // Unlimited
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
      teamSize: null, // Unlimited
      apiAccess: true,
      auditLogs: true,
      dataBackup: true,
      clinicalNotesLimit: null, // Unlimited
      patientRecordsLimit: null, // Unlimited
      prioritySupport: true,
      emailReminders: true,
      smsReminders: false,
      advancedReports: true,
      drugTherapyManagement: true,
      teamManagement: false,
      dedicatedSupport: false,
      integrations: true,
      adrReporting: false,
      drugInteractionChecker: false,
      doseCalculator: false,
      multiLocationDashboard: false,
      sharedPatientRecords: false,
      groupAnalytics: false,
      cdss: false,
    },
    description: 'Ideal for growing pharmacy teams',
    popularPlan: false, // Changed from true to false
  },
  {
    name: 'Pharmily',
    priceNGN: 10000,
    billingInterval: 'monthly',
    isActive: true,
    tier: 'pharmily',
    features: {
      // Inherit all Pro features
      patientLimit: null, // Unlimited
      reminderSmsMonthlyLimit: null, // Unlimited
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
      teamSize: null, // Unlimited
      apiAccess: true,
      auditLogs: true,
      dataBackup: true,
      clinicalNotesLimit: null, // Unlimited
      patientRecordsLimit: null, // Unlimited
      prioritySupport: true,
      emailReminders: true,
      smsReminders: false,
      advancedReports: true,
      drugTherapyManagement: true,
      teamManagement: false,
      dedicatedSupport: false,
      integrations: true,
      // New Pharmily-specific features
      adrReporting: true,
      drugInteractionChecker: true,
      doseCalculator: true,
      multiLocationDashboard: false,
      sharedPatientRecords: false,
      groupAnalytics: false,
      cdss: false,
    },
    description:
      'Pro features + Advanced Reporting, ADR reporting, Drug Interaction checker, Dose Calculator',
    popularPlan: true, // This is now the popular plan
  },
  {
    name: 'Network',
    priceNGN: 20000,
    billingInterval: 'monthly',
    isActive: true,
    tier: 'network',
    features: {
      // Inherit all Pharmily features
      patientLimit: null, // Unlimited
      reminderSmsMonthlyLimit: null, // Unlimited
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
      teamSize: null, // Unlimited
      apiAccess: true,
      auditLogs: true,
      dataBackup: true,
      clinicalNotesLimit: null, // Unlimited
      patientRecordsLimit: null, // Unlimited
      prioritySupport: true,
      emailReminders: true,
      smsReminders: false,
      advancedReports: true,
      drugTherapyManagement: true,
      teamManagement: true, // Enable team management for Network
      dedicatedSupport: false,
      integrations: true,
      // Pharmily features
      adrReporting: true,
      drugInteractionChecker: true,
      doseCalculator: true,
      // New Network-specific features
      multiLocationDashboard: true,
      sharedPatientRecords: true,
      groupAnalytics: true,
      cdss: true, // Clinical Decision Support System
    },
    description:
      'Pharmily features + Multi-location Dashboard, Shared Patient Records, Group Analytics, CDSS',
    popularPlan: false,
  },
  {
    name: 'Enterprise',
    priceNGN: 0, // Price not displayed for contact sales
    billingInterval: 'monthly',
    isActive: true,
    tier: 'enterprise',
    isContactSales: true,
    whatsappNumber: '+2348060374755', // Updated WhatsApp number
    features: {
      // Inherit all Network features plus additional enterprise features
      patientLimit: null, // Unlimited
      reminderSmsMonthlyLimit: null, // Unlimited
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
      teamSize: null, // Unlimited
      apiAccess: true,
      auditLogs: true,
      dataBackup: true,
      clinicalNotesLimit: null, // Unlimited
      patientRecordsLimit: null, // Unlimited
      prioritySupport: true,
      emailReminders: true,
      smsReminders: true, // Enable SMS for Enterprise
      advancedReports: true,
      drugTherapyManagement: true,
      teamManagement: true,
      dedicatedSupport: true, // Dedicated support for Enterprise
      integrations: true,
      customIntegrations: true, // Custom integrations for Enterprise
      // All advanced features
      adrReporting: true,
      drugInteractionChecker: true,
      doseCalculator: true,
      multiLocationDashboard: true,
      sharedPatientRecords: true,
      groupAnalytics: true,
      cdss: true,
    },
    description:
      'Complete solution for large pharmacy chains with custom integrations and dedicated support',
    popularPlan: false,
  },
  // Yearly plans (with 25% discount - Monthly × 12 × 0.75)
  {
    name: 'Basic Yearly',
    priceNGN: 9000, // 1000 × 12 × 0.75
    billingInterval: 'yearly',
    isActive: true,
    tier: 'basic',
    features: {
      patientLimit: 100,
      reminderSmsMonthlyLimit: 0,
      reportsExport: true,
      careNoteExport: false,
      adrModule: false,
      multiUserSupport: false,
      teamSize: 1,
      apiAccess: false,
      auditLogs: false,
      dataBackup: false,
      clinicalNotesLimit: 500,
      patientRecordsLimit: 500,
      prioritySupport: false,
      emailReminders: true,
      smsReminders: false,
      advancedReports: false,
      drugTherapyManagement: false,
      teamManagement: false,
      dedicatedSupport: false,
      adrReporting: false,
      drugInteractionChecker: false,
      doseCalculator: false,
      multiLocationDashboard: false,
      sharedPatientRecords: false,
      groupAnalytics: false,
      cdss: false,
    },
    description: 'Perfect for individual pharmacists (Save 25% annually)',
    popularPlan: false,
  },
  {
    name: 'Pro Yearly',
    priceNGN: 18000, // 2000 × 12 × 0.75
    billingInterval: 'yearly',
    isActive: true,
    tier: 'pro',
    features: {
      patientLimit: null,
      reminderSmsMonthlyLimit: null,
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
      teamSize: null,
      apiAccess: true,
      auditLogs: true,
      dataBackup: true,
      clinicalNotesLimit: null,
      patientRecordsLimit: null,
      prioritySupport: true,
      emailReminders: true,
      smsReminders: false,
      advancedReports: true,
      drugTherapyManagement: true,
      teamManagement: false,
      dedicatedSupport: false,
      integrations: true,
      adrReporting: false,
      drugInteractionChecker: false,
      doseCalculator: false,
      multiLocationDashboard: false,
      sharedPatientRecords: false,
      groupAnalytics: false,
      cdss: false,
    },
    description: 'Ideal for growing pharmacy teams (Save 25% annually)',
    popularPlan: false,
  },
  {
    name: 'Pharmily Yearly',
    priceNGN: 90000, // 10000 × 12 × 0.75
    billingInterval: 'yearly',
    isActive: true,
    tier: 'pharmily',
    features: {
      patientLimit: null,
      reminderSmsMonthlyLimit: null,
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
      teamSize: null,
      apiAccess: true,
      auditLogs: true,
      dataBackup: true,
      clinicalNotesLimit: null,
      patientRecordsLimit: null,
      prioritySupport: true,
      emailReminders: true,
      smsReminders: false,
      advancedReports: true,
      drugTherapyManagement: true,
      teamManagement: false,
      dedicatedSupport: false,
      integrations: true,
      adrReporting: true,
      drugInteractionChecker: true,
      doseCalculator: true,
      multiLocationDashboard: false,
      sharedPatientRecords: false,
      groupAnalytics: false,
      cdss: false,
    },
    description:
      'Pro features + Advanced Reporting, ADR reporting, Drug Interaction checker, Dose Calculator (Save 25% annually)',
    popularPlan: true, // Most popular yearly plan
  },
  {
    name: 'Network Yearly',
    priceNGN: 180000, // 20000 × 12 × 0.75
    billingInterval: 'yearly',
    isActive: true,
    tier: 'network',
    features: {
      patientLimit: null,
      reminderSmsMonthlyLimit: null,
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
      teamSize: null,
      apiAccess: true,
      auditLogs: true,
      dataBackup: true,
      clinicalNotesLimit: null,
      patientRecordsLimit: null,
      prioritySupport: true,
      emailReminders: true,
      smsReminders: false,
      advancedReports: true,
      drugTherapyManagement: true,
      teamManagement: true,
      dedicatedSupport: false,
      integrations: true,
      adrReporting: true,
      drugInteractionChecker: true,
      doseCalculator: true,
      multiLocationDashboard: true,
      sharedPatientRecords: true,
      groupAnalytics: true,
      cdss: true,
    },
    description:
      'Pharmily features + Multi-location Dashboard, Shared Patient Records, Group Analytics, CDSS (Save 25% annually)',
    popularPlan: false,
  },
  {
    name: 'Enterprise Yearly',
    priceNGN: 0, // Price not displayed for contact sales
    billingInterval: 'yearly',
    isActive: true,
    tier: 'enterprise',
    isContactSales: true,
    whatsappNumber: '+2348060374755', // Updated WhatsApp number
    features: {
      patientLimit: null,
      reminderSmsMonthlyLimit: null,
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
      teamSize: null,
      apiAccess: true,
      auditLogs: true,
      dataBackup: true,
      clinicalNotesLimit: null,
      patientRecordsLimit: null,
      prioritySupport: true,
      emailReminders: true,
      smsReminders: true,
      advancedReports: true,
      drugTherapyManagement: true,
      teamManagement: true,
      dedicatedSupport: true,
      integrations: true,
      customIntegrations: true,
      adrReporting: true,
      drugInteractionChecker: true,
      doseCalculator: true,
      multiLocationDashboard: true,
      sharedPatientRecords: true,
      groupAnalytics: true,
      cdss: true,
    },
    description:
      'Complete solution for large pharmacy chains with custom integrations and dedicated support',
    popularPlan: false,
  },
];

class DataSeeder {
  async seedFeatureFlags() {
    try {
      console.log('Seeding feature flags...');

      // Clear existing feature flags
      await FeatureFlag.deleteMany({});

      // Create a default admin user for feature flag creation
      let adminUser = await User.findOne({ role: 'super_admin' });
      if (!adminUser) {
        // Get the Enterprise plan for the admin user
        const enterprisePlan = await SubscriptionPlan.findOne({
          name: 'Enterprise',
        });
        if (!enterprisePlan) {
          throw new Error(
            'Enterprise plan not found. Please run subscription plan seeding first.'
          );
        }

        const hashedPassword = await bcrypt.hash('admin123!', 12);
        adminUser = await User.create({
          email: 'admin@PharmacyCopilot.com',
          passwordHash: hashedPassword,
          firstName: 'System',
          lastName: 'Administrator',
          role: 'super_admin',
          status: 'active',
          emailVerified: true,
          licenseStatus: 'not_required',
          subscriptionTier: 'enterprise',
          currentPlanId: enterprisePlan._id, // Required field
          permissions: ['*'], // All permissions
          features: ['*'], // All features
        });
      }

      // Create feature flags
      const featureFlags = defaultFeatureFlags.map((flag) => ({
        ...flag,
        createdBy: adminUser._id,
        updatedBy: adminUser._id,
      }));

      await FeatureFlag.insertMany(featureFlags);
      console.log(`✅ Created ${featureFlags.length} feature flags`);
    } catch (error) {
      console.error('❌ Error seeding feature flags:', error);
      throw error;
    }
  }

  async seedSubscriptionPlans() {
    try {
      console.log('Seeding subscription plans...');

      // Clear existing plans
      await SubscriptionPlan.deleteMany({});

      // Create new plans
      await SubscriptionPlan.insertMany(subscriptionPlans);
      console.log(`✅ Created ${subscriptionPlans.length} subscription plans`);
    } catch (error) {
      console.error('❌ Error seeding subscription plans:', error);
      throw error;
    }
  }

  async seed() {
    try {
      console.log('🌱 Starting data seeding...');

      // Seed subscription plans first (required for users)
      await this.seedSubscriptionPlans();
      await this.seedFeatureFlags();

      console.log('✅ Data seeding completed successfully!');
    } catch (error) {
      console.error('❌ Data seeding failed:', error);
      process.exit(1);
    }
  }
}

export const dataSeeder = new DataSeeder();

// Allow running as standalone script
if (require.main === module) {
  const connectDB = require('../config/db').default;

  (async () => {
    try {
      await connectDB();
      await dataSeeder.seed();
      await mongoose.disconnect();
      console.log('Database connection closed.');
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    }
  })();
}
