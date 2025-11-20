import mongoose from 'mongoose';
import PricingPlan from '../models/PricingPlan';
import PricingFeature from '../models/PricingFeature';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';

// Define all features
const features = [
    // Basic Features
    { featureId: 'dashboard_overview', name: 'Dashboard Overview', category: 'core', order: 1 },
    { featureId: 'patient_management', name: 'Patient Management', category: 'core', order: 2 },
    { featureId: 'clinical_notes', name: 'Clinical Notes', category: 'clinical', order: 3 },
    { featureId: 'medication_management_basic', name: 'Medication Management System (Basic)', category: 'clinical', order: 4 },
    { featureId: 'basic_reports', name: 'Reports & Analytics (Basic)', category: 'reporting', order: 5 },
    { featureId: 'user_management_single', name: 'User Management (1 user)', category: 'admin', order: 6 },
    { featureId: 'email_reminders', name: 'Email Reminders', category: 'communication', order: 7 },
    { featureId: 'settings_config', name: 'Settings & Configurations', category: 'core', order: 8 },
    { featureId: 'help_support_standard', name: 'Help & Support (Standard)', category: 'support', order: 9 },

    // Pro Features
    { featureId: 'unlimited_patients', name: 'Unlimited Patients', category: 'core', order: 10 },
    { featureId: 'unlimited_users', name: 'Unlimited Users', category: 'admin', order: 11 },
    { featureId: 'medication_therapy_review', name: 'Medication Therapy Review', category: 'clinical', order: 12 },
    { featureId: 'clinical_interventions', name: 'Clinical Interventions', category: 'clinical', order: 13 },
    { featureId: 'lab_result_integration', name: 'Lab Result Integration', category: 'clinical', order: 14 },
    { featureId: 'full_standard_reports', name: 'Reports & Analytics (Full Standard)', category: 'reporting', order: 15 },
    { featureId: 'priority_support', name: 'Priority Support', category: 'support', order: 16 },

    // Pharmily Features
    { featureId: 'adr_reporting', name: 'ADR (Adverse Drug Reaction) Reporting', category: 'clinical', order: 17 },
    { featureId: 'drug_interaction_checker', name: 'Drug Interaction Checker', category: 'clinical', order: 18 },
    { featureId: 'dose_calculator', name: 'Dose Calculator', category: 'clinical', order: 19 },
    { featureId: 'advanced_reporting', name: 'Advanced Reporting (Drill-downs, Exports, Insights)', category: 'reporting', order: 20 },
    { featureId: 'communication_hub', name: 'Communication Hub (Secure Internal Messaging)', category: 'communication', order: 21 },
    { featureId: 'drug_information_center', name: 'Drug Information Center', category: 'clinical', order: 22 },

    // Network Features
    { featureId: 'multi_location_dashboard', name: 'Multi-location Dashboard', category: 'enterprise', order: 23 },
    { featureId: 'shared_patient_records', name: 'Shared Patient Records (Across Branches)', category: 'enterprise', order: 24 },
    { featureId: 'group_analytics', name: 'Group Analytics (Compare Sites, Aggregate Data)', category: 'reporting', order: 25 },
    { featureId: 'cdss', name: 'Clinical Decision Support System (CDSS)', category: 'clinical', order: 26 },
    { featureId: 'team_management', name: 'Team Management (Roles, Permissions, Workflows)', category: 'admin', order: 27 },

    // Enterprise Features
    { featureId: 'custom_features', name: 'Custom Features', category: 'enterprise', order: 28 },
    { featureId: 'white_labeling', name: 'White-labeling (Optional)', category: 'enterprise', order: 29 },
    { featureId: 'dedicated_account_manager', name: 'Dedicated Account Manager', category: 'support', order: 30 },
    { featureId: 'advanced_integrations', name: 'Advanced Integrations (EMRs, National Health Registries)', category: 'enterprise', order: 31 },
    { featureId: 'tailored_cdss', name: 'Tailored Clinical Decision Support Rules', category: 'enterprise', order: 32 },
    { featureId: 'sla_support', name: 'SLA-based Support', category: 'support', order: 33 },
];

// Base monthly prices
const basePrices = {
    basic: 2000,
    pro: 2500,
    pharmily: 3500,
    network: 5000,
};

// Calculate yearly price with 10% discount
const calculateYearlyPrice = (monthlyPrice: number) => {
    const yearlyTotal = monthlyPrice * 12;
    const discount = yearlyTotal * 0.10;
    return Math.round(yearlyTotal - discount);
};

// Define pricing plans
const plans = [
    // Free Trial (no billing period variation)
    {
        name: 'Free Trial',
        slug: 'free-trial',
        price: 0,
        currency: 'NGN',
        billingPeriod: 'one-time',
        tier: 'free_trial',
        description: 'Experience the full power of PharmacyCopilot for 14 days',
        features: features.map(f => f.featureId), // All features for trial
        isPopular: false,
        isActive: true,
        isContactSales: false,
        trialDays: 14,
        order: 1,
        metadata: {
            buttonText: 'Start Free Trial',
            badge: '14 Days Free',
            icon: 'star',
        },
    },
    // Basic - Monthly
    {
        name: 'Basic',
        slug: 'basic-monthly',
        price: basePrices.basic,
        currency: 'NGN',
        billingPeriod: 'monthly',
        tier: 'basic',
        description: 'Perfect for individual pharmacists starting out',
        features: [
            'dashboard_overview',
            'patient_management',
            'clinical_notes',
            'medication_management_basic',
            'basic_reports',
            'user_management_single',
            'email_reminders',
            'settings_config',
            'help_support_standard',
        ],
        isPopular: false,
        isActive: true,
        isContactSales: false,
        order: 2,
        metadata: {
            buttonText: 'Get Started',
            icon: 'person',
        },
    },
    // Basic - Yearly (10% discount)
    {
        name: 'Basic',
        slug: 'basic-yearly',
        price: calculateYearlyPrice(basePrices.basic),
        currency: 'NGN',
        billingPeriod: 'yearly',
        tier: 'basic',
        description: 'Perfect for individual pharmacists starting out',
        features: [
            'dashboard_overview',
            'patient_management',
            'clinical_notes',
            'medication_management_basic',
            'basic_reports',
            'user_management_single',
            'email_reminders',
            'settings_config',
            'help_support_standard',
        ],
        isPopular: false,
        isActive: true,
        isContactSales: false,
        order: 2,
        metadata: {
            buttonText: 'Get Started',
            icon: 'person',
        },
    },
    // Pro - Monthly
    {
        name: 'Pro',
        slug: 'pro-monthly',
        price: basePrices.pro,
        currency: 'NGN',
        billingPeriod: 'monthly',
        tier: 'pro',
        description: 'For scaling solo or small practices',
        features: [
            'dashboard_overview',
            'patient_management',
            'clinical_notes',
            'medication_management_basic',
            'basic_reports',
            'settings_config',
            'help_support_standard',
            'unlimited_patients',
            'unlimited_users',
            'medication_therapy_review',
            'clinical_interventions',
            'lab_result_integration',
            'full_standard_reports',
            'priority_support',
        ],
        isPopular: true,
        isActive: true,
        isContactSales: false,
        order: 3,
        metadata: {
            buttonText: 'Get Started',
            badge: 'Most Popular',
            icon: 'bolt',
        },
    },
    // Pro - Yearly (10% discount)
    {
        name: 'Pro',
        slug: 'pro-yearly',
        price: calculateYearlyPrice(basePrices.pro),
        currency: 'NGN',
        billingPeriod: 'yearly',
        tier: 'pro',
        description: 'For scaling solo or small practices',
        features: [
            'dashboard_overview',
            'patient_management',
            'clinical_notes',
            'medication_management_basic',
            'basic_reports',
            'settings_config',
            'help_support_standard',
            'unlimited_patients',
            'unlimited_users',
            'medication_therapy_review',
            'clinical_interventions',
            'lab_result_integration',
            'full_standard_reports',
            'priority_support',
        ],
        isPopular: true,
        isActive: true,
        isContactSales: false,
        order: 3,
        metadata: {
            buttonText: 'Get Started',
            badge: 'Most Popular',
            icon: 'bolt',
        },
    },
    // Pharmily - Monthly
    {
        name: 'Pharmily',
        slug: 'pharmily-monthly',
        price: basePrices.pharmily,
        currency: 'NGN',
        billingPeriod: 'monthly',
        tier: 'pharmily',
        description: 'Collaborative + Advanced clinical tools',
        features: [
            'dashboard_overview',
            'patient_management',
            'clinical_notes',
            'medication_management_basic',
            'settings_config',
            'unlimited_patients',
            'unlimited_users',
            'medication_therapy_review',
            'clinical_interventions',
            'lab_result_integration',
            'full_standard_reports',
            'priority_support',
            'adr_reporting',
            'drug_interaction_checker',
            'dose_calculator',
            'advanced_reporting',
            'communication_hub',
            'drug_information_center',
        ],
        isPopular: false,
        isActive: true,
        isContactSales: false,
        order: 4,
        metadata: {
            buttonText: 'Get Started',
            icon: 'people',
        },
    },
    // Pharmily - Yearly (10% discount)
    {
        name: 'Pharmily',
        slug: 'pharmily-yearly',
        price: calculateYearlyPrice(basePrices.pharmily),
        currency: 'NGN',
        billingPeriod: 'yearly',
        tier: 'pharmily',
        description: 'Collaborative + Advanced clinical tools',
        features: [
            'dashboard_overview',
            'patient_management',
            'clinical_notes',
            'medication_management_basic',
            'settings_config',
            'unlimited_patients',
            'unlimited_users',
            'medication_therapy_review',
            'clinical_interventions',
            'lab_result_integration',
            'full_standard_reports',
            'priority_support',
            'adr_reporting',
            'drug_interaction_checker',
            'dose_calculator',
            'advanced_reporting',
            'communication_hub',
            'drug_information_center',
        ],
        isPopular: false,
        isActive: true,
        isContactSales: false,
        order: 4,
        metadata: {
            buttonText: 'Get Started',
            icon: 'people',
        },
    },
    // Network - Monthly
    {
        name: 'Network',
        slug: 'network-monthly',
        price: basePrices.network,
        currency: 'NGN',
        billingPeriod: 'monthly',
        tier: 'network',
        description: 'Multi-location & team-based practices',
        features: [
            'dashboard_overview',
            'patient_management',
            'clinical_notes',
            'medication_management_basic',
            'settings_config',
            'unlimited_patients',
            'unlimited_users',
            'medication_therapy_review',
            'clinical_interventions',
            'lab_result_integration',
            'full_standard_reports',
            'priority_support',
            'adr_reporting',
            'drug_interaction_checker',
            'dose_calculator',
            'advanced_reporting',
            'communication_hub',
            'drug_information_center',
            'multi_location_dashboard',
            'shared_patient_records',
            'group_analytics',
            'cdss',
            'team_management',
        ],
        isPopular: false,
        isActive: true,
        isContactSales: false,
        order: 5,
        metadata: {
            buttonText: 'Get Started',
            icon: 'business',
        },
    },
    // Network - Yearly (10% discount)
    {
        name: 'Network',
        slug: 'network-yearly',
        price: calculateYearlyPrice(basePrices.network),
        currency: 'NGN',
        billingPeriod: 'yearly',
        tier: 'network',
        description: 'Multi-location & team-based practices',
        features: [
            'dashboard_overview',
            'patient_management',
            'clinical_notes',
            'medication_management_basic',
            'settings_config',
            'unlimited_patients',
            'unlimited_users',
            'medication_therapy_review',
            'clinical_interventions',
            'lab_result_integration',
            'full_standard_reports',
            'priority_support',
            'adr_reporting',
            'drug_interaction_checker',
            'dose_calculator',
            'advanced_reporting',
            'communication_hub',
            'drug_information_center',
            'multi_location_dashboard',
            'shared_patient_records',
            'group_analytics',
            'cdss',
            'team_management',
        ],
        isPopular: false,
        isActive: true,
        isContactSales: false,
        order: 5,
        metadata: {
            buttonText: 'Get Started',
            icon: 'business',
        },
    },
    // Enterprise (no billing period variation)
    {
        name: 'Enterprise',
        slug: 'enterprise',
        price: 0,
        currency: 'NGN',
        billingPeriod: 'monthly',
        tier: 'enterprise',
        description: 'Custom solutions for large organizations',
        features: features.map(f => f.featureId), // All features
        isPopular: false,
        isActive: true,
        isContactSales: true,
        whatsappNumber: '2348012345678', // Replace with actual WhatsApp number
        order: 6,
        metadata: {
            buttonText: 'Book a Demo',
            badge: 'Custom',
            icon: 'star',
        },
    },
];

async function seedPricingData() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        console.log('Clearing existing pricing data...');
        await PricingFeature.deleteMany({});
        await PricingPlan.deleteMany({});
        console.log('Existing data cleared');

        // Insert features
        console.log('Inserting features...');
        const insertedFeatures = await PricingFeature.insertMany(features);
        console.log(`${insertedFeatures.length} features inserted`);

        // Insert plans
        console.log('Inserting plans...');
        const insertedPlans = await PricingPlan.insertMany(plans);
        console.log(`${insertedPlans.length} plans inserted`);

        console.log('\n✅ Pricing data seeded successfully!');
        console.log('\nSummary:');
        console.log(`- Features: ${insertedFeatures.length}`);
        console.log(`- Plans: ${insertedPlans.length}`);
        console.log('\nPlans created:');
        insertedPlans.forEach((plan) => {
            console.log(`  - ${plan.name} (${plan.slug}): ₦${plan.price}/${plan.billingPeriod}`);
        });

        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding pricing data:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Run the seed function
seedPricingData();
