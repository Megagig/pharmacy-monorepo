import mongoose from 'mongoose';
import { config } from 'dotenv';
import SubscriptionPlan from '../src/models/SubscriptionPlan';
import FeatureFlag from '../src/models/FeatureFlag';
import User from '../src/models/User';

// Load environment variables
config();

const subscriptionPlans = [
  {
    name: 'Free Trial',
    tier: 'free_trial',
    description: 'A 14-day free trial with access to all features.',
    priceNGN: 0,
    billingInterval: 'monthly',
    features: {
      patientLimit: 10,
      reminderSmsMonthlyLimit: 5,
      reportsExport: false,
      careNoteExport: false,
      adrModule: false,
      multiUserSupport: false,
    },
  },
  {
    name: 'Basic',
    tier: 'basic',
    description: 'Ideal for individual pharmacists and small clinics.',
    priceNGN: 1000,
    billingInterval: 'monthly',
    features: {
      patientLimit: 100,
      reminderSmsMonthlyLimit: 50,
      reportsExport: true,
      careNoteExport: false,
      adrModule: false,
      multiUserSupport: false,
    },
  },
  {
    name: 'Basic Yearly',
    tier: 'basic',
    description: 'Ideal for individual pharmacists and small clinics.',
    priceNGN: 9000, // 25% discount
    billingInterval: 'yearly',
    features: {
      patientLimit: 100,
      reminderSmsMonthlyLimit: 50,
      reportsExport: true,
      careNoteExport: false,
      adrModule: false,
      multiUserSupport: false,
    },
  },
  {
    name: 'Pro',
    tier: 'pro',
    description: 'Perfect for growing pharmacies and teams.',
    priceNGN: 2000,
    billingInterval: 'monthly',
    features: {
      patientLimit: 500,
      reminderSmsMonthlyLimit: 200,
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
    },
  },
  {
    name: 'Pro Yearly',
    tier: 'pro',
    description: 'Perfect for growing pharmacies and teams.',
    priceNGN: 18000, // 25% discount
    billingInterval: 'yearly',
    features: {
      patientLimit: 500,
      reminderSmsMonthlyLimit: 200,
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
    },
  },
  {
    name: 'Pharmily',
    tier: 'pharmily',
    description: 'For pharmacies that need more features.',
    priceNGN: 5000,
    billingInterval: 'monthly',
    isPopular: true,
    features: {
      patientLimit: 1000,
      reminderSmsMonthlyLimit: 500,
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
    },
  },
  {
    name: 'Pharmily Yearly',
    tier: 'pharmily',
    description: 'For pharmacies that need more features.',
    priceNGN: 45000, // 25% discount
    billingInterval: 'yearly',
    isPopular: true,
    features: {
      patientLimit: 1000,
      reminderSmsMonthlyLimit: 500,
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
    },
  },
  {
    name: 'Network',
    tier: 'network',
    description: 'For pharmacy chains and groups.',
    priceNGN: 10000,
    billingInterval: 'monthly',
    features: {
      patientLimit: null,
      reminderSmsMonthlyLimit: null,
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
    },
  },
  {
    name: 'Network Yearly',
    tier: 'network',
    description: 'For pharmacy chains and groups.',
    priceNGN: 90000, // 25% discount
    billingInterval: 'yearly',
    features: {
      patientLimit: null,
      reminderSmsMonthlyLimit: null,
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
    },
  },
  {
    name: 'Enterprise',
    tier: 'enterprise',
    description: 'For large-scale operations and custom needs.',
    priceNGN: 0,
    billingInterval: 'monthly',
    isContactSales: true,
    whatsappNumber: '+2348060374755',
    features: {
      patientLimit: null, // unlimited
      reminderSmsMonthlyLimit: null, // unlimited
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
    },
  },
  {
    name: 'Enterprise Yearly',
    tier: 'enterprise',
    description: 'For large-scale operations and custom needs.',
    priceNGN: 0,
    billingInterval: 'yearly',
    isContactSales: true,
    whatsappNumber: '+2348060374755',
    features: {
      patientLimit: null, // unlimited
      reminderSmsMonthlyLimit: null, // unlimited
      reportsExport: true,
      careNoteExport: true,
      adrModule: true,
      multiUserSupport: true,
    },
  },
];

// Define feature flags with tier and role mapping
const featureFlags = [
  // Core features
  {
    name: 'Patient Management',
    key: 'patient_management',
    description: 'Ability to add, view, and manage patient records',
    isActive: true,
    allowedTiers: ['free_trial', 'basic', 'pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'intern_pharmacist',
    ],
    customRules: {
      requiredLicense: true,
    },
    metadata: {
      category: 'core',
      priority: 'critical',
      tags: ['patients', 'core'],
    },
  },
  {
    name: 'Medication Management',
    key: 'medication_management',
    description: 'Ability to manage medications, prescriptions, and refills',
    isActive: true,
    allowedTiers: ['free_trial', 'basic', 'pro', 'enterprise'],
    allowedRoles: [
      'pharmacist',
      'pharmacy_team',
      'pharmacy_outlet',
      'intern_pharmacist',
    ],
    customRules: {
      requiredLicense: true,
    },
    metadata: {
      category: 'core',
      priority: 'critical',
      tags: ['medications', 'prescriptions', 'core'],
    },
  },
  // Advanced features
  {
    name: 'Clinical Notes',
    key: 'clinical_notes',
    description: 'Ability to add and manage detailed clinical notes',
    isActive: true,
    allowedTiers: ['basic', 'pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
    customRules: {
      requiredLicense: true,
    },
    metadata: {
      category: 'core',
      priority: 'high',
      tags: ['clinical', 'notes', 'documentation'],
    },
  },
  {
    name: 'Basic Reports',
    key: 'basic_reports',
    description: 'Access to basic reports and export capabilities',
    isActive: true,
    allowedTiers: ['basic', 'pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'reporting',
      priority: 'medium',
      tags: ['reports', 'export'],
    },
  },
  {
    name: 'Advanced Analytics',
    key: 'advanced_analytics',
    description: 'Access to advanced analytics and business intelligence',
    isActive: true,
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'analytics',
      priority: 'medium',
      tags: ['analytics', 'reports', 'dashboards'],
    },
  },
  // Team features
  {
    name: 'Team Management',
    key: 'team_management',
    description: 'Ability to create and manage team members',
    isActive: true,
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacy_team', 'pharmacy_outlet'],
    customRules: {
      maxUsers: 5, // Pro tier limited to 5 users
    },
    metadata: {
      category: 'collaboration',
      priority: 'high',
      tags: ['team', 'users', 'management'],
    },
  },
  {
    name: 'Enterprise Team Management',
    key: 'enterprise_team_management',
    description: 'Advanced team management with unlimited users',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'collaboration',
      priority: 'high',
      tags: ['team', 'users', 'management', 'enterprise'],
    },
  },
  // Enterprise features
  {
    name: 'API Access',
    key: 'api_access',
    description: 'Access to API endpoints for integration',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'integration',
      priority: 'medium',
      tags: ['api', 'integration', 'enterprise'],
    },
  },
  {
    name: 'Priority Support',
    key: 'priority_support',
    description: 'Access to priority support channels',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
    customRules: {},
    metadata: {
      category: 'administration',
      priority: 'medium',
      tags: ['support', 'enterprise'],
    },
  },
  // Admin features
  {
    name: 'User Management',
    key: 'user_management',
    description: 'Ability to manage all users',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['super_admin'],
    customRules: {},
    metadata: {
      category: 'administration',
      priority: 'high',
      tags: ['admin', 'users'],
    },
  },
  {
    name: 'License Management',
    key: 'license_management',
    description: 'Ability to review and approve licenses',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['super_admin'],
    customRules: {},
    metadata: {
      category: 'administration',
      priority: 'high',
      tags: ['admin', 'licenses'],
    },
  },
  {
    name: 'Feature Flag Management',
    key: 'feature_flag_management',
    description: 'Ability to manage feature flags',
    isActive: true,
    allowedTiers: ['enterprise'],
    allowedRoles: ['super_admin'],
    customRules: {},
    metadata: {
      category: 'administration',
      priority: 'medium',
      tags: ['admin', 'features'],
    },
  },
];

const seedSubscriptionPlans = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Get or create super admin user for reference
    let adminUser = await User.findOne({ role: 'super_admin' });
    if (!adminUser) {
      console.log('Creating super admin user for feature flag creation...');
      adminUser = await User.create({
        firstName: 'System',
        lastName: 'Admin',
        email: 'admin@PharmacyCopilotsaas.com',
        passwordHash: 'adminPassword123', // Will be hashed by pre-save hook
        role: 'super_admin',
        status: 'active',
        emailVerified: true,
        licenseStatus: 'not_required',
        subscriptionTier: 'enterprise',
        currentPlanId: new mongoose.Types.ObjectId(), // Temporary ID, will be updated
        permissions: ['*'],
        features: ['*'],
      });
    }

    // Clear existing plans
    await SubscriptionPlan.deleteMany({});
    console.log('Cleared existing subscription plans');

    // Insert new plans
    const createdPlans = await SubscriptionPlan.insertMany(subscriptionPlans);
    console.log(`Created ${createdPlans.length} subscription plans:`);

    createdPlans.forEach((plan) => {
      console.log(
        `- ${plan.name}: ₦${plan.priceNGN.toLocaleString()}/${
          plan.billingInterval
        }`
      );
    });

    // Clear existing feature flags
    await FeatureFlag.deleteMany({});
    console.log('Cleared existing feature flags');

    // Insert feature flags with admin user reference
    console.log('Creating feature flags...');
    const createdFeatureFlags = await Promise.all(
      featureFlags.map((flag) =>
        FeatureFlag.create({
          ...flag,
          createdBy: adminUser._id,
          updatedBy: adminUser._id,
        })
      )
    );
    console.log(`Created ${createdFeatureFlags.length} feature flags:`);

    createdFeatureFlags.forEach((flag) => {
      console.log(
        `- ${flag.name} (${flag.key}): Available for ${flag.allowedTiers.join(
          ', '
        )} tiers`
      );
    });

    // Update admin user with reference to enterprise plan
    const enterprisePlan = createdPlans.find(
      (plan) => plan.name === 'Enterprise'
    );
    if (enterprisePlan && adminUser) {
      adminUser.currentPlanId = enterprisePlan._id;
      await adminUser.save();
      console.log('Updated admin user with enterprise plan reference.');
    }

    console.log('Subscription plans and feature flags seeded successfully!');
  } catch (error) {
    console.error('Error seeding subscription plans and feature flags:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the seed function if this file is executed directly
if (require.main === module) {
  seedSubscriptionPlans();
}

export default seedSubscriptionPlans;
